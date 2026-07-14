/**
 * Adaptador para la WhatsApp Cloud API de Meta.
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  IncomingMessage,
  MessagingProvider,
  OutgoingMessage,
} from "../../application/ports.js";
import { getMetaConfig } from "../../config/index.js";

const GRAPH_API_VERSION = "v21.0";

/**
 * Verifica la firma X-Hub-Signature-256 que Meta pone en cada webhook (HMAC
 * SHA256 del body crudo con el app secret). Asegura que el request viene de Meta.
 */
export function verifyMetaSignature(
  rawBody: string,
  signature: string | undefined,
  appSecret: string,
): boolean {
  if (!signature) return false;
  const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  const received = Buffer.from(signature);
  const computed = Buffer.from(expected);
  if (received.length !== computed.length) return false;
  return timingSafeEqual(received, computed);
}

export class MetaProvider implements MessagingProvider {
  readonly name = "meta";
  private readonly accessToken: string;
  private readonly phoneNumberId: string;

  constructor() {
    const cfg = getMetaConfig();
    this.accessToken = cfg.accessToken;
    this.phoneNumberId = cfg.phoneNumberId;
  }

  async send(message: OutgoingMessage): Promise<void> {
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${this.phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: message.to,
        type: "text",
        text: { body: message.text },
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Error enviando a Meta (${res.status}): ${detail}`);
    }
  }
}

/**
 * Extrae los mensajes de texto de un payload de webhook de Meta.
 * Un webhook puede traer varios mensajes o eventos que no son mensajes
 * (ej: estados de entrega), por eso devuelve un array.
 */
export function parseMetaWebhook(payload: unknown): IncomingMessage[] {
  const messages: IncomingMessage[] = [];
  const body = payload as MetaWebhookBody;

  for (const entry of body?.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const contactName = value?.contacts?.[0]?.profile?.name;
      for (const msg of value?.messages ?? []) {
        if (msg.type === "text" && msg.text?.body) {
          messages.push({
            from: msg.from,
            text: msg.text.body,
            name: contactName,
          });
        }
      }
    }
  }

  return messages;
}

// --- Tipos parciales del payload de Meta (solo lo que usamos) ---
interface MetaWebhookBody {
  entry?: Array<{
    changes?: Array<{
      value?: {
        contacts?: Array<{ profile?: { name?: string } }>;
        messages?: Array<{
          from: string;
          type: string;
          text?: { body: string };
        }>;
      };
    }>;
  }>;
}
