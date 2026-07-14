/**
 * Server HTTP (Hono). Expone el webhook de WhatsApp (Meta Cloud API).
 *
 * - GET  /webhook  -> verificación del webhook (handshake con Meta).
 * - POST /webhook  -> recepción de mensajes entrantes.
 * - GET  /         -> health check.
 */
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { processMessage } from "../application/process-message.js";
import { config } from "../config/index.js";
import { parseMetaWebhook, verifyMetaSignature } from "../infrastructure/messaging/meta.js";
import { buildDependencies, buildMessagingProvider } from "./container.js";

const app = new Hono();
const deps = await buildDependencies();
const provider = buildMessagingProvider();

if (provider.name === "meta" && !config.meta.appSecret) {
  console.warn("⚠️  META_APP_SECRET no está seteado: no se verifica la firma del webhook.");
}

app.get("/", (c) => c.text("lacaja-whatsapp-bot OK"));

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

serve({ fetch: app.fetch, port: config.server.port }, (info) => {
  console.log(`🚀 Server escuchando en http://localhost:${info.port}`);
  console.log(`   Proveedor de mensajería: ${provider.name}`);
});
