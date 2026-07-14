/**
 * Adapter del puerto LlmPort para Anthropic (Claude) vía AI SDK.
 * Es el único módulo que conoce el proveedor de LLM. Cambiar a otro modelo o al
 * AI Gateway es escribir otro adapter con la misma interfaz.
 */
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { config } from "../../config/index.js";
import { LlmNotConfiguredError, type LlmPort } from "../../application/ports.js";

export function createAnthropicLlm(): LlmPort {
  const { apiKey, model } = config.llm;
  const provider = apiKey ? createAnthropic({ apiKey }) : null;

  return {
    async generate({ system, messages }) {
      if (!provider) throw new LlmNotConfiguredError();
      const { text } = await generateText({
        model: provider(model),
        system,
        messages,
        maxTokens: 400,
      });
      return text.trim();
    },
  };
}
