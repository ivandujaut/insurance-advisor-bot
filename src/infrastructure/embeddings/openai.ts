/**
 * Adapter del puerto EmbeddingsProvider para OpenAI (text-embedding-3-small).
 * Es barato (fracción de centavo por mil tokens) y suficiente para la búsqueda
 * semántica del FAQ router. Único módulo que conoce el proveedor de embeddings.
 */
import type { EmbeddingsProvider } from "../../application/ports.js";
import { config } from "../../config/index.js";

const OPENAI_URL = "https://api.openai.com/v1/embeddings";

interface OpenAiEmbeddingsResponse {
  data: Array<{ embedding: number[] }>;
}

export function createOpenAiEmbeddings(): EmbeddingsProvider {
  const { apiKey, model } = config.embeddings;

  return {
    async embed(texts) {
      if (!apiKey) throw new Error("OPENAI_API_KEY no configurada");
      if (texts.length === 0) return [];
      const res = await fetch(OPENAI_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ model, input: texts }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        throw new Error(`OpenAI embeddings ${res.status}: ${await res.text()}`);
      }
      const data = (await res.json()) as OpenAiEmbeddingsResponse;
      return data.data.map((d) => d.embedding);
    },
  };
}
