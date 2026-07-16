/**
 * Eval harness del FAQ router: calibra el umbral de similitud (FAQ_THRESHOLD).
 *
 * Método leave-one-out (LOO), que refleja producción: el router embede pregunta +
 * TODAS las variantes de cada duda. Para medir generalización sin trampa de
 * self-match, cada formulación se prueba contra el corpus completo MENOS ella
 * misma; sus hermanas (otras variantes de la misma duda) deberían rescatarla.
 * Así, agregar variantes sube la cobertura de forma legítima (no por copiar la
 * consulta dentro del corpus). Suma distractores (fuera de tema + adyacentes a
 * seguros sin cubrir) como negativos. Reporta:
 *   - por umbral: cobertura (hits sin LLM = ahorro), aciertos (contenido correcto),
 *     falsos+ (distractores que matchean por error)
 *   - ROC / AUC del clasificador binario "¿tiene respuesta canónica?": el AUC
 *     resume la separación independiente del umbral; la curva TPR/FPR justifica 0.65
 *
 *   OPENAI_API_KEY=sk-... pnpm eval:faq
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { rocAuc, rocCurve } from "../domain/analytics/roc.js";
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

// Distractores: mensajes SIN respuesta canónica en el catálogo. Son los negativos
// del ROC. Mezclan dos tipos a propósito: fuera de tema (fáciles) y adyacentes a
// seguros pero NO cubiertos (difíciles: lanchas, mala praxis, caución, etc.). Los
// difíciles son los que hacen la curva informativa; con solo fáciles el AUC da ~1
// trivial. Si alguno matchea por encima del umbral, es un falso positivo.
const DISTRACTORES = [
  // Fuera de tema
  "hola qué tal cómo andás",
  "gracias, muy amable",
  "quiero saber el resultado del partido de river",
  "cuánto sale un iphone nuevo",
  "necesito un turno con el médico clínico",
  "qué hora es",
  "contame un chiste",
  "cuál es la capital de francia",
  "cuánto está el dólar blue hoy",
  "recomendame una serie de netflix",
  "cómo hago un curriculum vitae",
  "quiero pedir una pizza grande",
  // Adyacentes a seguros, pero fuera de catálogo (negativos difíciles)
  "aseguran lanchas o embarcaciones",
  "seguro de mala praxis para profesionales de la salud",
  "seguro de caución para garantía de alquiler",
  "tienen seguro para el campo o agrícola",
  "seguro de responsabilidad civil para mi comercio",
  "aseguran drones",
  "seguro de viaje al exterior con cobertura médica en europa",
  "tienen seguro de sepelio",
  "seguro de crédito para exportadores",
  "aseguran obras de arte o joyas de lujo",
  "puedo asegurar un auto que está a nombre de mi papá",
  "qué pasa si presto el auto y lo choca un amigo",
  "cuánto tardan en pagarme un siniestro",
  "hacen descuento a jubilados",
  "puedo pagar la póliza en 12 cuotas sin interés",
  "necesito un certificado de cobertura para presentar en el trabajo",
  "atienden los sábados y domingos",
  "tienen oficinas para ir en persona en rosario",
  "seguro de responsabilidad ambiental para una fábrica",
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

// --- ROC / AUC del clasificador binario "¿esta consulta tiene respuesta canónica?"
// Positivos: las formulaciones conocidas (score = mejor match leave-one-out).
// Negativos: los distractores (score = mejor match contra el corpus completo).
// El AUC resume, independiente del umbral, qué tan bien el coseno separa a unos de
// otros. La curva muestra el trade-off TPR/FPR al mover el umbral (por qué 0.65).
const positives = queryMatches.map((q) => q.match?.score ?? 0);
const negatives = distractorMatches.map((m) => m?.score ?? 0);
const auc = rocAuc(positives, negatives);
const curve = rocCurve(positives, negatives);

console.log(`\n=== ROC / AUC (fire vs no-fire) ===`);
console.log(
  `Positivos: ${positives.length} formulaciones | Negativos: ${negatives.length} distractores`,
);
console.log(`AUC: ${auc.toFixed(4)}\n`);
console.log("Umbral   TPR (recall)   FPR");
console.log("------   ------------   ------");
for (const th of [0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5]) {
  const tpr = positives.filter((s) => s >= th).length / positives.length;
  const fpr = negatives.filter((s) => s >= th).length / negatives.length;
  console.log(
    `${th.toFixed(2)}     ${pct(tpr * positives.length, positives.length).padEnd(12)}   ${pct(fpr * negatives.length, negatives.length)}`,
  );
}

// Puntos de la curva en formato JSON, para graficar la ROC fuera del harness.
const puntos = curve.map((p) => [Number(p.fpr.toFixed(4)), Number(p.tpr.toFixed(4))]);
console.log(`\nROC (pares [fpr,tpr], para graficar):`);
console.log(JSON.stringify(puntos));

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
