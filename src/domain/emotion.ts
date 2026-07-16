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

/**
 * Guía de clasificación calibrada (definiciones + regla anti-neutral). Fue la que
 * subió el macro-F1 de 0.72 a 0.91 en el eval (ver docs/emociones-investigacion.md).
 * Fuente única de verdad: la usan el asistente (producción) y el eval harness, así
 * lo que se mide es lo que corre.
 */
export const EMOTION_GUIDE = [
  'Para la "emocion", elegí la etiqueta que mejor aplique; NO uses "neutral" si hay carga emocional, aunque sea leve o venga como pregunta.',
  "- neutral: consulta informativa sin carga afectiva.",
  "- interes: quiere avanzar, contratar o comprar (mira hacia adelante), aunque use palabras positivas.",
  "- satisfaccion: agradece o queda conforme por algo ya resuelto (mira hacia atras).",
  "- confusion: no entiende o esta perdido.",
  "- frustracion: meta bloqueada o cansancio por no poder lograrlo.",
  "- enojo: enojo dirigido; se siente estafado o maltratado.",
  "- ansiedad: preocupacion o miedo sobre un resultado incierto, aunque venga como pregunta.",
].join("\n");

/** Normaliza el texto de emoción del LLM a un valor válido; si no matchea, neutral. */
export function parseEmotion(raw: string | undefined): Emotion {
  const t = (raw ?? "").trim().toLowerCase();
  return (EMOTIONS as readonly string[]).includes(t) ? (t as Emotion) : "neutral";
}
