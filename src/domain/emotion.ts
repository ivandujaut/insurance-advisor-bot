/**
 * Emociones que el bot detecta en las respuestas abiertas del usuario. Un set
 * chico y accionable: sirve para decidir (derivar a asesor en enojo/frustracion)
 * y para medir el "funnel emocional" en /funnel. La deteccion la hace el LLM en
 * la misma llamada de la pregunta abierta (costo extra casi nulo); este modulo
 * solo define el vocabulario y normaliza lo que el modelo devuelve.
 */
export const EMOTIONS = [
  "neutral",
  "interes",
  "confusion",
  "frustracion",
  "enojo",
  "ansiedad",
  "satisfaccion",
] as const;

export type Emotion = (typeof EMOTIONS)[number];

/** Emociones negativas fuertes: disparan el ofrecimiento de un asesor humano. */
export const NEGATIVE_EMOTIONS: readonly Emotion[] = ["enojo", "frustracion"];

/** Normaliza el texto de emoción del LLM a un valor válido; si no matchea, neutral. */
export function parseEmotion(raw: string | undefined): Emotion {
  const t = (raw ?? "").trim().toLowerCase();
  return (EMOTIONS as readonly string[]).includes(t) ? (t as Emotion) : "neutral";
}
