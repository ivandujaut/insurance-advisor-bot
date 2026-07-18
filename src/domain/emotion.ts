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
 * Nivel emocional acumulado de la sesión: el clasificador devuelve una etiqueta,
 * no una intensidad, así que el "nivel" sale de la severidad de la etiqueta y de
 * su persistencia. El enojo (dirigido, se siente maltratado) pesa 2 y alcanza el
 * umbral solo; la frustración (meta bloqueada, más leve) pesa 1 y necesita
 * sostenerse en más de un mensaje: una puede ser desahogo, dos es una señal. Una
 * satisfacción resetea (el malestar quedó atrás); lo demás no modifica.
 */
export const ADVISOR_OFFER_LEVEL = 2;

export function nivelEmocional(prev: number, emocion: Emotion): number {
  if (emocion === "enojo") return prev + 2;
  if (emocion === "frustracion") return prev + 1;
  if (emocion === "satisfaccion") return 0;
  return prev;
}

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

// Few-shot con ejemplos NUEVOS (no del benchmark, para no filtrar el eval).
const EMOTION_FEWSHOT = [
  "Ejemplos:",
  '"listo, lo quiero, como pago?" -> interes',
  '"mil gracias, buenisimo todo" -> satisfaccion',
  '"me cubren si choco de noche?" -> ansiedad',
  '"otra vez el mismo error, no da mas" -> frustracion',
  '"son una verguenza, me estafaron" -> enojo',
].join("\n");

/**
 * Prompt de clasificación de emoción (enfocado: solo clasifica, no genera). Es la
 * fuente única que usan el adapter de producción y el eval harness, así lo que se
 * mide es literalmente lo que corre.
 */
export function emotionClassificationPrompt(): string {
  return [
    "Clasificás la emoción predominante del mensaje de un cliente de seguros por WhatsApp.",
    EMOTION_GUIDE,
    EMOTION_FEWSHOT,
    `Respondé SOLO con una de estas palabras: ${EMOTIONS.join(", ")}.`,
  ].join("\n");
}

/** Normaliza el texto de emoción del LLM a un valor válido; si no matchea, neutral. */
export function parseEmotion(raw: string | undefined): Emotion {
  const t = (raw ?? "").trim().toLowerCase();
  return (EMOTIONS as readonly string[]).includes(t) ? (t as Emotion) : "neutral";
}
