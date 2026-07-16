/**
 * Eval harness del FAQ router: calibra el umbral de similitud (FAQ_THRESHOLD).
 *
 * Monta el corpus con la PREGUNTA canónica de cada duda y prueba con las VARIANTES
 * (paráfrasis reales) como consultas held-out: una variante debería matchear su
 * propia duda. Suma un set de distractores (mensajes fuera de tema) para medir
 * falsos positivos. Barre varios umbrales y reporta, por cada uno:
 *   - cobertura: % de variantes que resuelve el router (hits sin LLM = ahorro)
 *   - aciertos:  de esos hits, % con la duda correcta (precisión del contenido)
 *   - falsos+:   distractores que matchean por error (ruido a evitar)
 *
 *   OPENAI_API_KEY=sk-... pnpm eval:faq
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { bestMatch, type FaqDoc } from "../domain/faq/similarity.js";
import { createOpenAiEmbeddings } from "../infrastructure/embeddings/openai.js";

if (!process.env.OPENAI_API_KEY) {
  console.error("Falta OPENAI_API_KEY. Corré: OPENAI_API_KEY=sk-... pnpm eval:faq");
  process.exit(1);
}

const benchPath = fileURLToPath(new URL("../../docs/benchmark-dudas.json", import.meta.url));
const bench = JSON.parse(readFileSync(benchPath, "utf8")) as {
  faq: Array<{ id: string; pregunta: string; variantes?: string[]; respuesta: string }>;
};

// Distractores: mensajes fuera del catálogo de dudas. NO deberían matchear ninguna
// duda; si lo hacen, es un falso positivo (respuesta canónica equivocada).
const DISTRACTORES = [
  "hola qué tal cómo andás",
  "gracias, muy amable",
  "quiero saber el resultado del partido de river",
  "cuánto sale un iphone nuevo",
  "necesito un turno con el médico",
];

const embeddings = createOpenAiEmbeddings();

// Corpus: una pregunta canónica por duda. Las variantes quedan como consultas.
const corpusTextos = bench.faq.map((f) => f.pregunta);
const queries = bench.faq.flatMap((f) =>
  (f.variantes ?? []).map((v) => ({ texto: v, gold: f.id })),
);

console.log(
  `Corpus: ${corpusTextos.length} dudas. Consultas: ${queries.length} variantes + ${DISTRACTORES.length} distractores.`,
);

const corpusVectors = await embeddings.embed(corpusTextos);
const docs: FaqDoc[] = corpusVectors.map((vector, i) => ({
  id: bench.faq[i]?.id ?? "",
  respuesta: bench.faq[i]?.respuesta ?? "",
  vector,
}));

const queryVectors = await embeddings.embed(queries.map((q) => q.texto));
const distractorVectors = await embeddings.embed(DISTRACTORES);

// Mejor match (sin umbral) de cada consulta: lo evaluamos contra cada umbral en memoria.
const queryMatches = queryVectors.map((vec, i) => ({
  gold: queries[i]?.gold ?? "",
  match: bestMatch(vec, docs),
}));
const distractorMatches = distractorVectors.map((vec) => bestMatch(vec, docs));

const pct = (part: number, total: number) =>
  total === 0 ? "-" : `${Math.round((part / total) * 100)}%`;

console.log("\nUmbral  Cobertura      Aciertos       Falsos+");
console.log("------  -------------  -------------  -------------");
for (const th of [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85]) {
  const hits = queryMatches.filter((q) => (q.match?.score ?? 0) >= th);
  const aciertos = hits.filter((q) => q.match?.id === q.gold);
  const falsos = distractorMatches.filter((m) => (m?.score ?? 0) >= th);
  console.log(
    `${th.toFixed(2)}    ${`${hits.length}/${queries.length} (${pct(hits.length, queries.length)})`.padEnd(13)}  ${`${aciertos.length}/${hits.length} (${pct(aciertos.length, hits.length)})`.padEnd(13)}  ${`${falsos.length}/${DISTRACTORES.length}`.padEnd(13)}`,
  );
}

// Detalle: variantes que ni siquiera con umbral bajo caen en su propia duda (señal
// de que falta cubrir esa formulación o la respuesta canónica).
const fallan = queryMatches.filter((q) => q.match?.id !== q.gold);
if (fallan.length > 0) {
  console.log(`\n⚠️  ${fallan.length} variantes cuyo mejor match NO es su propia duda:`);
  for (const q of fallan) {
    const query = queries[queryMatches.indexOf(q)];
    console.log(
      `  "${query?.texto}" -> ${q.match?.id ?? "?"} (esperaba ${q.gold}, score ${q.match?.score.toFixed(3)})`,
    );
  }
}
