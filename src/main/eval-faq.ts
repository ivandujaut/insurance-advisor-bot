/**
 * Eval harness del FAQ router: calibra el umbral de similitud (FAQ_THRESHOLD).
 *
 * Método leave-one-out (LOO), que refleja producción: el router embede pregunta +
 * TODAS las variantes de cada duda. Para medir generalización sin trampa de
 * self-match, cada formulación se prueba contra el corpus completo MENOS ella
 * misma; sus hermanas (otras variantes de la misma duda) deberían rescatarla.
 * Así, agregar variantes sube la cobertura de forma legítima (no por copiar la
 * consulta dentro del corpus). Suma distractores fuera de tema para medir falsos
 * positivos. Barre umbrales y reporta, por cada uno:
 *   - cobertura: % de formulaciones que resuelve el router (hits sin LLM = ahorro)
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

// Corpus como en producción: una entrada por (duda, texto), con pregunta + variantes.
const corpus = bench.faq.flatMap((f) =>
  [f.pregunta, ...(f.variantes ?? [])].map((texto) => ({
    id: f.id,
    texto,
    respuesta: f.respuesta,
  })),
);

console.log(
  `Corpus (leave-one-out): ${bench.faq.length} dudas, ${corpus.length} formulaciones + ${DISTRACTORES.length} distractores.`,
);

const corpusVectors = await embeddings.embed(corpus.map((c) => c.texto));
const docs: FaqDoc[] = corpusVectors.map((vector, i) => ({
  id: corpus[i]?.id ?? "",
  respuesta: corpus[i]?.respuesta ?? "",
  vector,
}));

// Leave-one-out: cada formulación se busca contra el corpus menos sí misma.
const queryMatches = docs.map((doc, i) => ({
  texto: corpus[i]?.texto ?? "",
  gold: doc.id,
  match: bestMatch(
    doc.vector,
    docs.filter((_, j) => j !== i),
  ),
}));

const distractorVectors = await embeddings.embed(DISTRACTORES);
const distractorMatches = distractorVectors.map((vec) => bestMatch(vec, docs));

const pct = (part: number, total: number) =>
  total === 0 ? "-" : `${Math.round((part / total) * 100)}%`;

console.log("\nUmbral  Cobertura        Aciertos         Falsos+");
console.log("------  ---------------  ---------------  -------------");
for (const th of [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85]) {
  const hits = queryMatches.filter((q) => (q.match?.score ?? 0) >= th);
  const aciertos = hits.filter((q) => q.match?.id === q.gold);
  const falsos = distractorMatches.filter((m) => (m?.score ?? 0) >= th);
  console.log(
    `${th.toFixed(2)}    ${`${hits.length}/${docs.length} (${pct(hits.length, docs.length)})`.padEnd(15)}  ${`${aciertos.length}/${hits.length} (${pct(aciertos.length, hits.length)})`.padEnd(15)}  ${`${falsos.length}/${DISTRACTORES.length}`.padEnd(13)}`,
  );
}

// Formulaciones cuyo vecino LOO más cercano es OTRA duda: señal de solapamiento
// entre entradas o de una formulación que conviene mover/reescribir.
const fallan = queryMatches.filter((q) => q.match?.id !== q.gold);
if (fallan.length > 0) {
  console.log(`\n⚠️  ${fallan.length} formulaciones cuyo vecino más cercano NO es su propia duda:`);
  for (const q of fallan) {
    console.log(
      `  "${q.texto}" -> ${q.match?.id ?? "?"} (esperaba ${q.gold}, score ${q.match?.score.toFixed(3)})`,
    );
  }
}
