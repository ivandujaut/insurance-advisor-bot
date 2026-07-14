/**
 * Adapter JSONL del puerto LeadRepository. Agrega cada lead como una línea a
 * data/leads.jsonl. En producción se reemplazaría por un CRM o una base de datos
 * (misma interfaz LeadRepository).
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Lead, LeadRepository } from "../../application/ports.js";

const here = dirname(fileURLToPath(import.meta.url));
// src/lib/leads -> raiz del proyecto. Se puede sobreescribir con LACAJA_DATA_DIR.
const dataDir = process.env.LACAJA_DATA_DIR
  ? resolve(process.env.LACAJA_DATA_DIR)
  : join(here, "..", "..", "..", "data");
const leadsFile = join(dataDir, "leads.jsonl");

/** Crea el adapter JSONL del LeadRepository. Nunca lanza: no debe romper el bot. */
export function createJsonlLeadRepository(): LeadRepository {
  return {
    save(lead) {
      const record: Lead = { ts: new Date().toISOString(), ...lead };
      try {
        mkdirSync(dataDir, { recursive: true });
        appendFileSync(leadsFile, `${JSON.stringify(record)}\n`);
      } catch (err) {
        console.error("No se pudo guardar el lead:", err);
      }
    },
  };
}

export { leadsFile };
