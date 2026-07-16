/**
 * Métricas de evaluación de clasificación (para el eval de emociones). Puras:
 * reciben pares (gold, pred) y las etiquetas, y devuelven accuracy, F1 por clase,
 * macro-F1 y matriz de confusión. Se reporta macro-F1 (no accuracy) porque las
 * clases están desbalanceadas ("neutral" domina): la accuracy sola engaña.
 */

export interface ClassMetrics {
  clase: string;
  precision: number;
  recall: number;
  f1: number;
  support: number;
}

export interface EvalMetrics {
  total: number;
  aciertos: number;
  accuracy: number;
  macroF1: number;
  perClass: ClassMetrics[];
  /** matrix[i][j] = casos cuya clase real es labels[i] y se predijo labels[j]. */
  confusion: { labels: string[]; matrix: number[][] };
}

function f1(precision: number, recall: number): number {
  return precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
}

export function evaluateEmotions(
  pares: Array<{ gold: string; pred: string }>,
  labels: string[],
): EvalMetrics {
  const idx = new Map(labels.map((l, i) => [l, i]));
  const n = labels.length;
  const matrix = Array.from({ length: n }, () => Array<number>(n).fill(0));

  for (const { gold, pred } of pares) {
    const gi = idx.get(gold);
    const pj = idx.get(pred);
    if (gi === undefined || pj === undefined) continue; // etiqueta fuera del set
    const gRow = matrix[gi];
    if (gRow) gRow[pj] = (gRow[pj] ?? 0) + 1;
  }

  const perClass: ClassMetrics[] = labels.map((clase, i) => {
    const row = matrix[i] ?? [];
    const tp = row[i] ?? 0;
    const fp = matrix.reduce((s, r, g) => s + (g === i ? 0 : (r[i] ?? 0)), 0); // columna i menos tp
    const fn = row.reduce((s, v, p) => s + (p === i ? 0 : v), 0); // fila i menos tp
    const support = row.reduce((s, v) => s + v, 0);
    const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
    const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
    return { clase, precision, recall, f1: f1(precision, recall), support };
  });

  const total = pares.length;
  const aciertos = labels.reduce((s, _l, i) => s + (matrix[i]?.[i] ?? 0), 0);
  const macroF1 = perClass.reduce((s, c) => s + c.f1, 0) / (n || 1);

  return {
    total,
    aciertos,
    accuracy: total === 0 ? 0 : aciertos / total,
    macroF1,
    perClass,
    confusion: { labels, matrix },
  };
}
