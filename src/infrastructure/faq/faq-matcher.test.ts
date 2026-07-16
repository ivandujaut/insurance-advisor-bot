import assert from "node:assert/strict";
import { test } from "node:test";
import type { EmbeddingsProvider } from "../../application/ports.js";
import { createFaqMatcher } from "./faq-matcher.js";

/**
 * Embeddings fake y determinístico: todo el corpus se mapea al mismo vector
 * [1,0], así una consulta [1,0] matchea (coseno 1) y una [0,1] no (coseno 0).
 * Evita la red y no necesita OPENAI_API_KEY.
 */
function fakeEmbeddings(queryVector: number[]): EmbeddingsProvider {
  return {
    async embed(texts) {
      // El corpus (varios textos) va todo a [1,0]; una sola consulta usa queryVector.
      if (texts.length === 1) return [queryVector];
      return texts.map(() => [1, 0]);
    },
  };
}

test("createFaqMatcher: una consulta parecida matchea por encima del umbral", async () => {
  const matcher = await createFaqMatcher(fakeEmbeddings([1, 0]), 0.75);
  const hit = await matcher.match("una pregunta cualquiera");
  assert.ok(hit, "esperaba un match");
  assert.ok((hit?.score ?? 0) >= 0.75);
  assert.ok(hit?.respuesta && hit.respuesta.length > 0);
});

test("createFaqMatcher: una consulta lejana no matchea (cae al asistente)", async () => {
  const matcher = await createFaqMatcher(fakeEmbeddings([0, 1]), 0.75);
  assert.equal(await matcher.match("algo sin relación"), null);
});

test("createFaqMatcher: sin embeddings (falla el corpus) queda desactivado", async () => {
  const roto: EmbeddingsProvider = {
    async embed() {
      throw new Error("OPENAI_API_KEY no configurada");
    },
  };
  const matcher = await createFaqMatcher(roto, 0.75);
  assert.equal(await matcher.match("¿qué es la franquicia?"), null);
});

test("createFaqMatcher: una consulta vacía no matchea", async () => {
  const matcher = await createFaqMatcher(fakeEmbeddings([1, 0]), 0.75);
  assert.equal(await matcher.match("   "), null);
});
