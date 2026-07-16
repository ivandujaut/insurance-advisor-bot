/**
 * Adapter JSONL del puerto AnalyticsReader: lee eventos y leads de los archivos
 * .jsonl. Es el default sin dependencias, para desarrollo y demo. En producción
 * (Render) los archivos son efímeros, así que ahí se usa el reader de Postgres.
 */
import { existsSync, readFileSync } from "node:fs";
import type { AnalyticsEvent, AnalyticsReader, Lead } from "../../application/ports.js";
import { eventsFile } from "./jsonl-events.js";
import { leadsFile } from "./jsonl-leads.js";

function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as T);
}

export function createJsonlAnalyticsReader(): AnalyticsReader {
  return {
    async readEvents() {
      return readJsonl<AnalyticsEvent>(eventsFile);
    },
    async readLeads() {
      return readJsonl<Lead>(leadsFile);
    },
  };
}
