/**
 * Eval harness de la detección de emociones. Corre el clasificador sobre el set
 * etiquetado del benchmark y reporta accuracy, macro-F1, métricas por clase y la
 * matriz de confusión. Compara dos prompts (v1 base vs v2 con definiciones +
 * few-shot) en una sola corrida, para el A/B.
 *
 *   ANTHROPIC_API_KEY=sk-... pnpm eval:emotions
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { type EvalMetrics, evaluateEmotions } from "../domain/analytics/emotion-eval.js";
import { EMOTION_GUIDE, EMOTIONS, parseEmotion } from "../domain/emotion.js";

const apiKey = process.env.ANTHROPIC_API_KEY;
const model = process.env.AI_MODEL ?? "claude-sonnet-5";
if (!apiKey) {
  console.error("Falta ANTHROPIC_API_KEY. Corré: ANTHROPIC_API_KEY=sk-... pnpm eval:emotions");
  process.exit(1);
}

const benchPath = fileURLToPath(new URL("../../docs/benchmark-dudas.json", import.meta.url));
const bench = JSON.parse(readFileSync(benchPath, "utf8")) as {
  emociones: Array<{ id: string; mensaje: string; emocion: string }>;
};
const items = bench.emociones;

// v1: prompt base, sin definiciones (la línea de base).
const SYSTEM_V1 = [
  "Clasificás la emoción predominante del mensaje de un cliente de seguros por WhatsApp.",
  `Respondé SOLO con una de estas palabras, sin nada más: ${EMOTIONS.join(", ")}.`,
].join("\n");

// v2: definiciones ancladas en appraisal + few-shot (ejemplos nuevos, no del set,
// para no filtrar) + regla anti-neutral. Ataca las confusiones del baseline:
// interés vs satisfacción, y ansiedad/frustración cayendo a neutral.
const SYSTEM_V2 = [
  "Clasificás la emoción predominante del mensaje de un cliente de seguros por WhatsApp.",
  EMOTION_GUIDE, // misma guía calibrada que usa producción (assistant.ts)
  "Ejemplos:",
  '"listo, lo quiero, como pago?" -> interes',
  '"mil gracias, buenisimo todo" -> satisfaccion',
  '"me cubren si choco de noche?" -> ansiedad',
  '"otra vez el mismo error, no da mas" -> frustracion',
  '"son una verguenza, me estafaron" -> enojo',
  `Respondé SOLO con una de estas palabras: ${EMOTIONS.join(", ")}.`,
].join("\n");

const VARIANTS = [
  { name: "v1 (base)", system: SYSTEM_V1 },
  { name: "v2 (definiciones + few-shot)", system: SYSTEM_V2 },
];

async function classify(mensaje: string, system: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey as string,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 16,
      system,
      messages: [{ role: "user", content: mensaje }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = (data.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
  return parseEmotion(text);
}

/** Clasifica todo el set con un prompt, con concurrencia acotada y orden preservado. */
async function classifyAll(
  system: string,
  concurrency = 5,
): Promise<Array<{ gold: string; pred: string }>> {
  const out: Array<{ gold: string; pred: string }> = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      const item = items[i];
      if (!item) continue;
      const pred = await classify(item.mensaje, system).catch(() => "neutral");
      out[i] = { gold: item.emocion, pred };
      process.stdout.write(pred === item.emocion ? "." : "x");
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  process.stdout.write("\n");
  return out;
}

const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;

function printReport(name: string, m: EvalMetrics): void {
  console.log(`\n📊 ${name} (${m.total} mensajes, modelo ${model})`);
  console.log(`Accuracy: ${pct(m.accuracy)}   Macro-F1: ${m.macroF1.toFixed(3)}\n`);
  console.log("Clase           Prec.   Recall  F1      n");
  console.log("--------------  ------  ------  ------  --");
  for (const c of m.perClass) {
    console.log(
      `${c.clase.padEnd(14)}  ${pct(c.precision).padEnd(6)}  ${pct(c.recall).padEnd(6)}  ${c.f1.toFixed(3)}   ${c.support}`,
    );
  }
  console.log("\nMatriz de confusión (fila = real, columna = predicho):");
  const abbr = m.confusion.labels.map((l) => l.slice(0, 4));
  console.log(`${"".padEnd(14)}${abbr.map((a) => a.padStart(6)).join("")}`);
  m.confusion.matrix.forEach((row, i) => {
    const label = m.confusion.labels[i] ?? "";
    console.log(`${label.padEnd(14)}${row.map((v) => String(v).padStart(6)).join("")}`);
  });
}

const results: Array<{ name: string; m: EvalMetrics }> = [];
for (const v of VARIANTS) {
  console.log(`\n=== ${v.name} ===`);
  const pares = await classifyAll(v.system);
  const m = evaluateEmotions(pares, [...EMOTIONS]);
  printReport(v.name, m);
  results.push({ name: v.name, m });
}

console.log("\n=== Comparación ===");
for (const r of results) {
  console.log(
    `${r.name.padEnd(30)} macro-F1 ${r.m.macroF1.toFixed(3)}   accuracy ${pct(r.m.accuracy)}`,
  );
}
