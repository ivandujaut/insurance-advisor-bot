/**
 * Eval harness de la detección de emociones. Corre el clasificador sobre el set
 * etiquetado del benchmark y reporta accuracy, macro-F1, métricas por clase y la
 * matriz de confusión. Es la vara para medir la v1 y comparar mejoras (A/B).
 *
 *   ANTHROPIC_API_KEY=sk-... pnpm eval:emotions
 *
 * Usa un prompt de clasificación "v1" (sin definiciones de etiquetas), para medir
 * la línea de base. El siguiente paso agrega definiciones + few-shot y re-mide.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { type EvalMetrics, evaluateEmotions } from "../domain/analytics/emotion-eval.js";
import { EMOTIONS, parseEmotion } from "../domain/emotion.js";

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

async function classify(mensaje: string): Promise<string> {
  const system = [
    "Clasificás la emoción predominante del mensaje de un cliente de seguros por WhatsApp.",
    `Respondé SOLO con una de estas palabras, sin nada más: ${EMOTIONS.join(", ")}.`,
  ].join("\n");
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

/** Ejecuta las clasificaciones con concurrencia acotada, preservando el orden. */
async function classifyAll(concurrency = 5): Promise<Array<{ gold: string; pred: string }>> {
  const out: Array<{ gold: string; pred: string }> = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      const item = items[i];
      if (!item) continue;
      const pred = await classify(item.mensaje).catch(() => "neutral");
      out[i] = { gold: item.emocion, pred };
      process.stdout.write(pred === item.emocion ? "." : "x");
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  process.stdout.write("\n");
  return out;
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

function printReport(m: EvalMetrics): void {
  console.log(`\n📊 Eval de emociones (${m.total} mensajes, modelo ${model})\n`);
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
  console.log("");
}

const pares = await classifyAll();
printReport(evaluateEmotions(pares, [...EMOTIONS]));
