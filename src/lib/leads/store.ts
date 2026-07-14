/**
 * Persistencia de leads de cotización. Cada lead se agrega como una linea JSON a
 * data/leads.jsonl. Suficiente para el prototipo; en produccion se reemplazaria
 * por un CRM o una base de datos (misma interfaz saveLead()).
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
// src/lib/leads -> raiz del proyecto
const dataDir = join(here, "..", "..", "..", "data");
const leadsFile = join(dataDir, "leads.jsonl");

export interface Lead {
  ts: string;
  userId: string;
  name?: string;
  vehiculo: string;
  cp: string;
  condicion: string;
  plan: string;
}

/** Guarda un lead y lo devuelve con timestamp. Nunca lanza: no debe romper el bot. */
export function saveLead(lead: Omit<Lead, "ts">): Lead {
  const record: Lead = { ts: new Date().toISOString(), ...lead };
  try {
    mkdirSync(dataDir, { recursive: true });
    appendFileSync(leadsFile, `${JSON.stringify(record)}\n`);
  } catch (err) {
    console.error("No se pudo guardar el lead:", err);
  }
  return record;
}

export { leadsFile };
