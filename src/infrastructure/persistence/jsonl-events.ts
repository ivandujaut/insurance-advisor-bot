/**
 * Adapter JSONL del puerto EventSink. Agrega cada evento como una línea a
 * data/events.jsonl. En producción se reemplazaría por un sink de analítica real
 * (misma interfaz EventSink).
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AnalyticsEvent, EventSink } from "../../application/ports.js";

const here = dirname(fileURLToPath(import.meta.url));
// src/lib/analytics -> raiz del proyecto. Se puede sobreescribir con
// LACAJA_DATA_DIR (util para tests o para apuntar a un volumen en deploy).
const dataDir = process.env.LACAJA_DATA_DIR
  ? resolve(process.env.LACAJA_DATA_DIR)
  : join(here, "..", "..", "..", "data");
const eventsFile = join(dataDir, "events.jsonl");

/** Crea el adapter JSONL del EventSink. Nunca lanza: la analítica no debe romper el bot. */
export function createJsonlEventSink(): EventSink {
  return {
    log(type, userId, props) {
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
    },
  };
}

export { eventsFile };
