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

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
}

export function createAnthropicLlm(): LlmPort {
  const { apiKey, model } = config.llm;

  return {
    async generate({ system, messages }) {
      if (!apiKey) throw new LlmNotConfiguredError();

      const res = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
          "content-type": "application/json",
        },
        // Sin `temperature` a propósito: los modelos nuevos lo rechazan.
        body: JSON.stringify({ model, max_tokens: MAX_TOKENS, system, messages }),
      });

      if (!res.ok) {
        throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
      }

      const data = (await res.json()) as AnthropicResponse;
      return (data.content ?? [])
        .filter((block) => block.type === "text")
        .map((block) => block.text ?? "")
        .join("")
        .trim();
    },
  };
}
