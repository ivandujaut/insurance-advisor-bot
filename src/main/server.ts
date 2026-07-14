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
import { parseMetaWebhook } from "../infrastructure/messaging/meta.js";
import { buildDependencies, buildMessagingProvider } from "./container.js";

const app = new Hono();
const deps = buildDependencies();
const provider = buildMessagingProvider();

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
  const payload = await c.req.json().catch(() => null);
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
