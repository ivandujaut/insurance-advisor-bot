/**
 * Adapter del puerto LlmPort para Anthropic (Claude).
 * Llama a la API de Mensajes directo (sin SDK) para controlar exactamente qué se
 * manda: los modelos nuevos (Sonnet 5 en adelante) deprecaron `temperature`, así
 * que no se envía. Es el único módulo que conoce el proveedor de LLM; cambiar de
 * modelo o al AI Gateway es escribir otro adapter con la misma interfaz.
 */
import { LlmNotConfiguredError, type LlmPort } from "../../application/ports.js";
import { config } from "../../config/index.js";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MAX_TOKENS = 400;
// Timeout por intento: un upstream colgado no puede dejar al usuario sin
// respuesta para siempre. Un reintento cubre timeouts y 5xx transitorios.
const TIMEOUT_MS = 15000;
const MAX_ATTEMPTS = 2;

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
}

export function createAnthropicLlm(): LlmPort {
  const { apiKey, model } = config.llm;

  return {
    async generate({ system, messages }) {
      if (!apiKey) throw new LlmNotConfiguredError();

      let lastError: unknown;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          const res = await fetch(ANTHROPIC_URL, {
            method: "POST",
            headers: {
              "x-api-key": apiKey,
              "anthropic-version": ANTHROPIC_VERSION,
              "content-type": "application/json",
            },
            // Sin `temperature` a propósito: los modelos nuevos lo rechazan.
            body: JSON.stringify({ model, max_tokens: MAX_TOKENS, system, messages }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
          });

          if (!res.ok) {
            const detail = `Anthropic API ${res.status}: ${await res.text()}`;
            // 5xx y 429 son transitorios: se reintentan. 4xx no.
            if ((res.status >= 500 || res.status === 429) && attempt < MAX_ATTEMPTS) {
              lastError = new Error(detail);
              continue;
            }
            throw new Error(detail);
          }

          const data = (await res.json()) as AnthropicResponse;
          return (data.content ?? [])
            .filter((block) => block.type === "text")
            .map((block) => block.text ?? "")
            .join("")
            .trim();
        } catch (err) {
          // Timeout/red: reintentar una vez; si ya fue el último intento, propaga.
          lastError = err;
          if (attempt >= MAX_ATTEMPTS) throw err;
        }
      }
      throw lastError;
    },
  };
}
