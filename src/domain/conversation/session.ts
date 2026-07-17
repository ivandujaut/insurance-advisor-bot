/**
 * Modelo de dominio de la sesión de conversación y helpers puros sobre ella.
 * El almacenamiento vive detrás del puerto SessionStore (ver application/ports),
 * con un adapter en memoria en session/memory.ts. Este archivo no guarda estado.
 */

export type Stage =
  | "idle"
  | "main_menu"
  | "quoting_auto"
  | "quoting_hogar"
  | "quoting_accidentes"
  | "quoting_bici"
  // Tras una cotización: se ofrece avanzar (asesor / online) en vez de volver al
  // menú frío. Es el cierre del embudo, donde la intención de compra es máxima.
  | "post_quote"
  // Capturando el contacto para que un asesor llame con la cotización a mano.
  | "capturing_contact";

/** Etapas "a mitad de algo" que vale la pena retomar/re-enganchar (no menú ni idle). */
export const MID_FLOW_STAGES = new Set<Stage>([
  "quoting_auto",
  "quoting_hogar",
  "quoting_accidentes",
  "quoting_bici",
  "post_quote",
  "capturing_contact",
]);

/** Nombre del producto por etapa de cotización (para los mensajes de retomar). */
export const STAGE_PRODUCTO: Partial<Record<Stage, string>> = {
  quoting_auto: "auto",
  quoting_hogar: "hogar",
  quoting_accidentes: "accidentes personales",
  quoting_bici: "bici o monopatín",
};

/** Planes de auto de La Caja, de menor a mayor cobertura. */
export const AUTO_PLANS = [
  "Terceros Completo",
  "Terceros Completo con Granizo",
  "Todo Riesgo con Franquicia",
] as const;

/**
 * Catálogo de Accidentes Personales de La Caja. A diferencia de auto (factores)
 * y hogar (personalizable), es un catálogo de planes FIJOS con precio publicado
 * (relevado del sitio). El bot solo elige modalidad + plan; no estima.
 */
export interface AccidentesPlan {
  nombre: string;
  /** Precio mensual publicado (débito automático de tarjeta). */
  precio: number;
  resumen: string;
}

export const ACCIDENTES_MODALIDADES: Record<string, string> = {
  familiar: "Protección Familiar",
  "trabajo-independiente": "Trabajo Independiente",
  "personal-domestico": "Personal Doméstico",
};

export const ACCIDENTES_PLANES: Record<string, AccidentesPlan[]> = {
  familiar: [
    {
      nombre: "Plan A",
      precio: 9124,
      resumen:
        "Muerte accidental hasta $30M; en tránsito y transporte público hasta $77M; invalidez.",
    },
    {
      nombre: "Plan B",
      precio: 14176,
      resumen: "Muerte accidental e invalidez permanente hasta $61M.",
    },
    {
      nombre: "Plan C",
      precio: 8505,
      resumen: "Renta por internación $150.000/día; terapia intensiva; convalecencia.",
    },
  ],
  "trabajo-independiente": [
    {
      nombre: "Trabajadores Independientes",
      precio: 9600,
      resumen: "Muerte, invalidez y gastos médicos por accidente hasta $10M.",
    },
    {
      nombre: "Profesionales",
      precio: 10300,
      resumen: "Muerte e invalidez hasta $15M; gastos médicos hasta $1,5M.",
    },
  ],
  "personal-domestico": [
    {
      nombre: "Plan A",
      precio: 5500,
      resumen:
        "Muerte accidental hasta $18M; en tránsito y transporte público hasta $26,2M; invalidez.",
    },
  ],
};

export interface Turn {
  role: "user" | "assistant";
  content: string;
}

export interface Session {
  userId: string;
  name?: string;
  stage: Stage;
  /** Datos recolectados durante un flujo (ej: cotizacion). */
  data: Record<string, string>;
  /** Historial breve para dar contexto al LLM. */
  history: Turn[];
  /**
   * ISO del último mensaje procesado. Sirve para detectar cuando el usuario vuelve
   * a mitad de un flujo tras un hueco largo y ofrecerle retomar (ver flows.ts).
   */
  lastActivityAt?: string;
}

const MAX_HISTORY = 12;

/** Crea una sesión nueva en estado inicial. */
export function createSession(userId: string, name?: string): Session {
  return { userId, name, stage: "idle", data: {}, history: [] };
}

/** Agrega un turno al historial (muta la sesión). */
export function recordTurn(session: Session, role: Turn["role"], content: string): void {
  session.history.push({ role, content });
}

/** Recorta el historial para no crecer sin límite (contexto acotado del LLM). */
export function trimHistory(session: Session): void {
  if (session.history.length > MAX_HISTORY) {
    session.history = session.history.slice(-MAX_HISTORY);
  }
}
