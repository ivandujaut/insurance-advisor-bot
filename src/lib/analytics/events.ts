/**
 * Log de eventos del funnel. Cada evento se agrega como una linea JSON a
 * data/events.jsonl. Es la instrumentacion minima para medir el embudo
 * (activacion, drop-off por paso, mix de plan), como se describe en el caso de
 * estudio. En produccion se reemplazaria por un sink de analitica real.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
// src/lib/analytics -> raiz del proyecto. Se puede sobreescribir con
// LACAJA_DATA_DIR (util para tests o para apuntar a un volumen en deploy).
const dataDir = process.env.LACAJA_DATA_DIR
  ? resolve(process.env.LACAJA_DATA_DIR)
  : join(here, "..", "..", "..", "data");
const eventsFile = join(dataDir, "events.jsonl");

export type EventType =
  | "conversation_started"
  | "quote_started"
  | "quote_step"
  | "plan_comparison_viewed"
  | "lead_captured"
  | "advisor_requested"
  | "open_question";

export interface AnalyticsEvent {
  ts: string;
  type: EventType;
  userId: string;
  props?: Record<string, string>;
}

/** Registra un evento del funnel. Nunca lanza: la analitica no debe romper el bot. */
export function logEvent(type: EventType, userId: string, props?: Record<string, string>): void {
  const event: AnalyticsEvent = {
    ts: new Date().toISOString(),
    type,
    userId,
    ...(props ? { props } : {}),
  };
  try {
    mkdirSync(dataDir, { recursive: true });
    appendFileSync(eventsFile, `${JSON.stringify(event)}\n`);
  } catch (err) {
    console.error("No se pudo registrar el evento:", err);
  }
}

export { eventsFile };
