/**
 * Composition root: el único lugar que conoce los adapters concretos y los
 * cablea. Arma las dependencias que se inyectan en el núcleo y elige el
 * proveedor de mensajería según la config. Ver docs/adr/0001-arquitectura-hexagonal.md.
 */
import type { Dependencies, MessagingProvider } from "../application/ports.js";
import { config } from "../config/index.js";
import { createFilesystemKnowledge } from "../infrastructure/knowledge/filesystem.js";
import { createAnthropicLlm } from "../infrastructure/llm/anthropic.js";
import { CliProvider } from "../infrastructure/messaging/cli.js";
import { MetaProvider } from "../infrastructure/messaging/meta.js";
import { createJsonlEventSink } from "../infrastructure/persistence/jsonl-events.js";
import { createJsonlLeadRepository } from "../infrastructure/persistence/jsonl-leads.js";
import { createInMemorySessionStore } from "../infrastructure/persistence/memory-sessions.js";

/** Arma las dependencias concretas del núcleo. Se llama una vez por proceso. */
export function buildDependencies(): Dependencies {
  return {
    leads: createJsonlLeadRepository(),
    events: createJsonlEventSink(),
    llm: createAnthropicLlm(),
    sessions: createInMemorySessionStore(),
    knowledge: createFilesystemKnowledge(),
  };
}

/** Elige el proveedor de mensajería según la config. */
export function buildMessagingProvider(): MessagingProvider {
  switch (config.messaging.provider) {
    case "meta":
      return new MetaProvider();
    case "cli":
      return new CliProvider();
    default:
      throw new Error(`Proveedor de mensajería desconocido: ${config.messaging.provider}`);
  }
}
