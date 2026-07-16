/**
 * Curva ROC y AUC, puras. Para una decisión binaria por umbral (ej: el FAQ router
 * decide "disparar respuesta canónica" vs "caer al LLM" según un score de
 * similitud), miden qué tan bien el score separa positivos de negativos.
 *
 * - Positivo: la consulta SÍ tiene respuesta canónica (una duda conocida).
 * - Negativo: la consulta NO la tiene (un distractor fuera de catálogo).
 * - Score: similitud coseno del mejor match.
 *
 * TPR (recall) = positivos que superan el umbral / total positivos.
 * FPR          = negativos que superan el umbral / total negativos.
 * La curva recorre esos pares al mover el umbral; el AUC resume la separación
 * en un número (0.5 = azar, 1.0 = separación perfecta), independiente del umbral.
 */

export interface RocPoint {
  /** Umbral de score en este punto de la curva. */
  threshold: number;
  /** True positive rate (recall): positivos con score >= umbral. */
  tpr: number;
  /** False positive rate: negativos con score >= umbral. */
  fpr: number;
}

/**
 * Curva ROC: un punto por cada umbral candidato (los scores observados), más el
 * extremo (0,0). Ordenada por FPR creciente, lista para graficar o integrar.
 */
export function rocCurve(positives: number[], negatives: number[]): RocPoint[] {
  const nP = positives.length;
  const nN = negatives.length;
  if (nP === 0 || nN === 0) return [];

  // Umbrales candidatos: cada score distinto, de mayor a menor. Con umbral por
  // encima del máximo no dispara nada (0,0); bajándolo, van entrando puntos.
  const thresholds = [...new Set([...positives, ...negatives])].sort((a, b) => b - a);
  const atLeast = (xs: number[], t: number) => xs.filter((x) => x >= t).length;

  const points: RocPoint[] = [{ threshold: Number.POSITIVE_INFINITY, tpr: 0, fpr: 0 }];
  for (const t of thresholds) {
    points.push({ threshold: t, tpr: atLeast(positives, t) / nP, fpr: atLeast(negatives, t) / nN });
  }
  return points;
}

/**
 * AUC por el estadístico de Mann-Whitney: probabilidad de que un positivo tomado
 * al azar puntúe más alto que un negativo al azar (empates cuentan 0.5). Es
 * exactamente el área bajo la curva ROC, sin depender de la resolución de umbrales.
 */
export function rocAuc(positives: number[], negatives: number[]): number {
  const nP = positives.length;
  const nN = negatives.length;
  if (nP === 0 || nN === 0) return 0;

  let concordant = 0;
  for (const p of positives) {
    for (const n of negatives) {
      if (p > n) concordant += 1;
      else if (p === n) concordant += 0.5;
    }
  }
  return concordant / (nP * nN);
}
