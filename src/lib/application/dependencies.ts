/**
 * Dependencias por defecto: cablea los adapters JSONL concretos.
 *
 * Es un puente temporal hasta el composition root del paso 5 del refactor
 * (ver docs/adr/0001-arquitectura-hexagonal.md). Permite que los entrypoints
 * actuales sigan llamando a processMessage(incoming) sin cambios, mientras el
 * núcleo ya depende solo de los puertos.
 */
import { createJsonlEventSink } from "../analytics/events.js";
import { createFilesystemKnowledge } from "../knowledge/filesystem.js";
import { createAnthropicLlm } from "../llm/anthropic.js";
import { createJsonlLeadRepository } from "../leads/store.js";
import { createInMemorySessionStore } from "../session/memory.js";
import type { Dependencies } from "./ports.js";

let cached: Dependencies | null = null;

export function defaultDependencies(): Dependencies {
  if (!cached) {
    cached = {
      leads: createJsonlLeadRepository(),
      events: createJsonlEventSink(),
      llm: createAnthropicLlm(),
      sessions: createInMemorySessionStore(),
      knowledge: createFilesystemKnowledge(),
    };
  }
  return cached;
}
