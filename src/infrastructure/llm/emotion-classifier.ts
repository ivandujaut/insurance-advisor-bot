/**
 * Adapter del puerto EmotionClassifier para Anthropic. Hace una llamada enfocada
 * (solo clasifica, no genera) con el prompt del dominio y un modelo configurable
 * (más barato). Es best-effort: sin clave o ante cualquier falla devuelve
 * "neutral", así una emoción mal detectada nunca rompe la conversación.
 */
import type { EmotionClassifier } from "../../application/ports.js";
import { config } from "../../config/index.js";
import { type Emotion, emotionClassificationPrompt, parseEmotion } from "../../domain/emotion.js";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
// Se lo espera antes de responder (para decidir el aviso de asesor), así que su
// cola es latencia del usuario: cap ajustado. Haiku clasifica en ~1s; si a los 6s
// no contestó, cae a "neutral" y seguimos. Sin reintento a propósito: es
// best-effort y bloquea la respuesta, reintentar solo la alargaría.
const TIMEOUT_MS = 6000;

export function createAnthropicEmotionClassifier(): EmotionClassifier {
  const { apiKey, emotionModel } = config.llm;
  const system = emotionClassificationPrompt();

  return {
    async classify(message: string): Promise<Emotion> {
      if (!apiKey) return "neutral";
      try {
        const res = await fetch(ANTHROPIC_URL, {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": ANTHROPIC_VERSION,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: emotionModel,
            max_tokens: 16,
            system,
            messages: [{ role: "user", content: message }],
          }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) return "neutral";
        const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
        const text = (data.content ?? [])
          .filter((b) => b.type === "text")
          .map((b) => b.text ?? "")
          .join("");
        return parseEmotion(text);
      } catch (err) {
        console.error("No se pudo clasificar la emoción:", err);
        return "neutral";
      }
    },
  };
}
