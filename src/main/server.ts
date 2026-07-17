/**
 * Server HTTP (Hono). Expone dos canales sobre el mismo motor:
 *
 * - GET  /         -> demo web (página de chat, para que cualquiera lo pruebe).
 * - POST /chat     -> mensaje del canal web; responde el texto directo.
 * - GET  /funnel   -> dashboard de métricas del embudo (activación, drop-off, mix).
 * - GET  /webhook  -> verificación del webhook de WhatsApp (handshake con Meta).
 * - POST /webhook  -> recepción de mensajes de WhatsApp.
 * - GET  /health   -> health check.
 */
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { processMessage } from "../application/process-message.js";
import { runReengagement, runTemplateReengagement } from "../application/reengagement.js";
import { config } from "../config/index.js";
import { computeFunnel } from "../domain/analytics/funnel.js";
import { parseMetaWebhook, verifyMetaSignature } from "../infrastructure/messaging/meta.js";
import {
  buildAnalyticsReader,
  buildDependencies,
  buildMessagingProvider,
  shutdown,
} from "./container.js";
import { DEMO_HTML } from "./demo-page.js";
import { renderFunnelHtml } from "./funnel-page.js";
import { createRateLimiter } from "./rate-limit.js";

const app = new Hono();
const deps = await buildDependencies();
const provider = buildMessagingProvider();
const analytics = buildAnalyticsReader();

// Re-enganche proactivo (opt-in): barre sesiones a mitad de flujo e inactivas. Dos
// horizontes: B (dentro de la ventana de 24h, mensaje libre) y C (fuera, plantilla).
// Solo tienen canal en WhatsApp, por eso vienen apagados.
if (config.reengagement.enabled || config.reengagement.templateEnabled) {
  const windowMs = config.session.ttlSeconds * 1000;
  const ports = { sessions: deps.sessions, messaging: provider, events: deps.events };
  const timer = setInterval(() => {
    const now = new Date();
    if (config.reengagement.enabled) {
      runReengagement(ports, now, {
        afterMs: config.reengagement.afterMinutes * 60_000,
        windowMs,
      })
        .then((n) => n > 0 && console.log(`Re-enganche: ${n} nudge(s) enviados.`))
        .catch((err) => console.error("Error en el barrido de re-enganche (B):", err));
    }
    if (config.reengagement.templateEnabled) {
      runTemplateReengagement(ports, now, {
        windowMs,
        maxMs: config.reengagement.maxHours * 3_600_000,
        templateName: config.reengagement.templateName,
        templateLanguage: config.reengagement.templateLanguage,
      })
        .then((n) => n > 0 && console.log(`Re-enganche: ${n} plantilla(s) enviadas.`))
        .catch((err) => console.error("Error en el barrido de re-enganche (C):", err));
    }
  }, config.reengagement.intervalMinutes * 60_000);
  timer.unref(); // que no mantenga vivo el proceso por sí solo
  console.log(
    `🔔 Re-enganche proactivo activo (nudge: ${config.reengagement.enabled}, plantilla: ${config.reengagement.templateEnabled}), cada ${config.reengagement.intervalMinutes} min.`,
  );
}

// Protección del canal web público: cada mensaje puede llegar al LLM (pago), así
// que se limita por IP y se acotan los tamaños de entrada. Sin esto, cualquiera
// puede loopear /chat y quemar el crédito.
const chatLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });
const MAX_USERID_LEN = 64;
const MAX_TEXT_LEN = 4000;

/** IP del cliente detrás del proxy de Render (X-Forwarded-For), o un fallback. */
function clientIp(c: { req: { header: (n: string) => string | undefined } }): string {
  return c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

// Con Meta, la firma del webhook es obligatoria: sin ella, cualquiera puede
// mandar un webhook falso y hacer que el bot envíe desde el número de La Caja.
// Se falla al arrancar en vez de aceptar requests sin verificar.
if (provider.name === "meta" && !config.meta.appSecret) {
  throw new Error("MESSAGING_PROVIDER=meta requiere META_APP_SECRET (firma del webhook).");
}

// Canal web: la demo pública. La página de chat y su endpoint.
app.get("/", (c) => c.html(DEMO_HTML));
app.get("/health", (c) => c.text("lacaja-whatsapp-bot OK"));

// Dashboard del funnel: activación, drop-off por paso y mix de plan, en vivo.
app.get("/funnel", async (c) => {
  const [events, leads] = await Promise.all([analytics.readEvents(), analytics.readLeads()]);
  return c.html(renderFunnelHtml(computeFunnel(events, leads)));
});

app.post("/chat", async (c) => {
  if (!chatLimiter.allow(clientIp(c))) {
    return c.json({ error: "Demasiadas solicitudes. Probá de nuevo en un momento." }, 429);
  }
  let body: { userId?: string; text?: string; name?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "JSON inválido" }, 400);
  }
  const userId = (body.userId ?? "").trim();
  const text = (body.text ?? "").trim();
  if (!userId || !text) {
    return c.json({ error: "Faltan userId o text" }, 400);
  }
  if (userId.length > MAX_USERID_LEN || text.length > MAX_TEXT_LEN) {
    return c.json({ error: "userId o mensaje demasiado largo." }, 413);
  }
  const reply = await processMessage({ from: userId, text, name: body.name }, deps);
  return c.json({ reply });
});

// Verificación del webhook: Meta manda hub.challenge y espera que lo devolvamos.
app.get("/webhook", (c) => {
  const mode = c.req.query("hub.mode");
  const token = c.req.query("hub.verify_token");
  const challenge = c.req.query("hub.challenge");

  if (mode === "subscribe" && token === config.meta.verifyToken && challenge) {
    return c.text(challenge, 200);
  }
  return c.text("Forbidden", 403);
});

// Recepción de mensajes.
app.post("/webhook", async (c) => {
  const raw = await c.req.text();

  // Si hay app secret, se exige una firma válida (rechaza requests que no vienen de Meta).
  if (config.meta.appSecret) {
    const signature = c.req.header("x-hub-signature-256");
    if (!verifyMetaSignature(raw, signature, config.meta.appSecret)) {
      return c.text("Invalid signature", 403);
    }
  }

  let payload: unknown = null;
  try {
    payload = JSON.parse(raw);
  } catch {
    payload = null;
  }
  const messages = parseMetaWebhook(payload);

  // Respondemos 200 rápido a Meta y procesamos los mensajes aparte.
  for (const incoming of messages) {
    processMessage(incoming, deps)
      .then((reply) => provider.send({ to: incoming.from, text: reply }))
      .catch((err) => console.error("Error procesando mensaje:", err));
  }

  return c.text("EVENT_RECEIVED", 200);
});

const server = serve({ fetch: app.fetch, port: config.server.port }, (info) => {
  console.log(`🚀 Server escuchando en http://localhost:${info.port}`);
  console.log(`   Proveedor de mensajería: ${provider.name}`);
});

// Shutdown ordenado: en los redeploys/spin-downs de Render (SIGTERM) cerramos el
// server y las conexiones (pool de Postgres, Redis) en vez de cortarlas de cuajo.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    console.log(`↴ ${signal} recibido, cerrando...`);
    server.close();
    shutdown()
      .catch((err) => console.error("Error en shutdown:", err))
      .finally(() => process.exit(0));
  });
}
