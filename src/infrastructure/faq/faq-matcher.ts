/**
 * Adapter del puerto FaqMatcher: router semántico de dudas frecuentes.
 *
 * Al arrancar embede el corpus del benchmark (pregunta + variantes de cada duda)
 * una sola vez. En cada consulta embede la pregunta del usuario y busca el doc
 * más parecido por similitud coseno; si supera el umbral, devuelve la respuesta
 * canónica SIN llamar al LLM de generación. Esa es la palanca de costo.
 *
 * Best-effort: sin OPENAI_API_KEY (o si falla el embed del corpus al arrancar) el
 * router queda desactivado y toda consulta cae al asistente. Degrada, no rompe.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { EmbeddingsProvider, FaqMatcher } from "../../application/ports.js";
import { bestMatch, type FaqDoc } from "../../domain/faq/similarity.js";

interface BenchmarkFaq {
  id: string;
  pregunta: string;
  variantes?: string[];
  respuesta: string;
}

const here = dirname(fileURLToPath(import.meta.url));
// Única fuente del benchmark. En dev (tsx) se lee de docs/; en prod (dist), de la
// copia que deja copy-assets. Se prueba cada candidato y se usa el primero que exista.
const CANDIDATOS = [
  join(here, "../../../docs/benchmark-dudas.json"), // dev: src/infrastructure/faq -> repo/docs
  join(here, "../../benchmark-dudas.json"), // prod: dist/infrastructure/faq -> dist/
];

function loadFaqs(): BenchmarkFaq[] {
  const path = CANDIDATOS.find((p) => existsSync(p));
  if (!path) {
    console.warn("FAQ router: no se encontró benchmark-dudas.json; queda desactivado.");
    return [];
  }
  const data = JSON.parse(readFileSync(path, "utf8")) as { faq?: BenchmarkFaq[] };
  return data.faq ?? [];
}

/** Router desactivado: nunca matchea, todo cae al asistente. */
const NOOP: FaqMatcher = {
  async match() {
    return null;
  },
};

/**
 * Arma el FAQ matcher. Async porque embede el corpus al arrancar (una vez).
 * `threshold`: similitud coseno mínima para dar por buena una duda conocida.
 */
export async function createFaqMatcher(
  embeddings: EmbeddingsProvider,
  threshold: number,
): Promise<FaqMatcher> {
  const faqs = loadFaqs();
  if (faqs.length === 0) return NOOP;

  // Un documento por (duda, texto): la pregunta y cada variante. Así la consulta
  // matchea contra la formulación más parecida, no solo contra la pregunta canónica.
  const textos: string[] = [];
  const meta: Array<{ id: string; respuesta: string }> = [];
  for (const f of faqs) {
    for (const texto of [f.pregunta, ...(f.variantes ?? [])]) {
      textos.push(texto);
      meta.push({ id: f.id, respuesta: f.respuesta });
    }
  }

  let vectors: number[][];
  try {
    vectors = await embeddings.embed(textos);
  } catch (err) {
    console.warn(
      `FAQ router desactivado (no se pudo embeder el corpus): ${(err as Error).message}`,
    );
    return NOOP;
  }

  const docs: FaqDoc[] = vectors.map((vector, i) => ({
    id: meta[i]?.id ?? "",
    respuesta: meta[i]?.respuesta ?? "",
    vector,
  }));
  console.log(`FAQ router activo: ${faqs.length} dudas, ${docs.length} formulaciones.`);

  return {
    async match(question) {
      const q = question.trim();
      if (!q) return null;
      let embedded: number[][];
      try {
        embedded = await embeddings.embed([q]);
      } catch {
        return null; // best-effort: ante falla, que responda el asistente
      }
      const vec = embedded[0];
      if (!vec) return null;
      const m = bestMatch(vec, docs);
      if (!m || m.score < threshold) return null;
      return { id: m.id, respuesta: m.respuesta, score: m.score };
    },
  };
}
