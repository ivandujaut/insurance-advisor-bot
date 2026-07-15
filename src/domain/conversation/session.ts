/**
 * Modelo de dominio de la sesión de conversación y helpers puros sobre ella.
 * El almacenamiento vive detrás del puerto SessionStore (ver application/ports),
 * con un adapter en memoria en session/memory.ts. Este archivo no guarda estado.
 */

export type Stage = "idle" | "main_menu" | "quoting_auto" | "quoting_hogar";

/** Planes de auto de La Caja, de menor a mayor cobertura. */
export const AUTO_PLANS = [
  "Terceros Completo",
  "Terceros Completo con Granizo",
  "Todo Riesgo con Franquicia",
] as const;

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
