/**
 * Store de sesiones en memoria. Suficiente para desarrollo y demo.
 * En produccion conviene reemplazar por un KV/Redis (misma interfaz).
 */

export type Stage =
  | "idle"
  | "main_menu"
  | "quoting_auto";

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
const store = new Map<string, Session>();

export function getSession(userId: string, name?: string): Session {
  let session = store.get(userId);
  if (!session) {
    session = { userId, name, stage: "idle", data: {}, history: [] };
    store.set(userId, session);
  }
  if (name && !session.name) session.name = name;
  return session;
}

export function saveSession(session: Session): void {
  // Recorta el historial para no crecer sin limite.
  if (session.history.length > MAX_HISTORY) {
    session.history = session.history.slice(-MAX_HISTORY);
  }
  store.set(session.userId, session);
}

export function recordTurn(session: Session, role: Turn["role"], content: string): void {
  session.history.push({ role, content });
}
