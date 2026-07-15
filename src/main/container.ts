/**
 * Composition root: el único lugar que conoce los adapters concretos y los
 * cablea. Elige el adapter de persistencia/sesión según la config y arma las
 * dependencias que se inyectan en el núcleo. Async porque Postgres/Redis se
 * conectan al arrancar. Ver docs/adr/0001-arquitectura-hexagonal.md.
 */
import { createClient } from "redis";
import type {
  Dependencies,
  EventSink,
  LeadRepository,
  MessagingProvider,
  SessionStore,
} from "../application/ports.js";
import { config } from "../config/index.js";
import { createFilesystemKnowledge } from "../infrastructure/knowledge/filesystem.js";
import { createAnthropicLlm } from "../infrastructure/llm/anthropic.js";
import { CliProvider } from "../infrastructure/messaging/cli.js";
import { MetaProvider } from "../infrastructure/messaging/meta.js";
import { createJsonlEventSink } from "../infrastructure/persistence/jsonl-events.js";
import { createJsonlLeadRepository } from "../infrastructure/persistence/jsonl-leads.js";
import { createInMemorySessionStore } from "../infrastructure/persistence/memory-sessions.js";
import {
  createPgPool,
  createPostgresEventSink,
  createPostgresLeadRepository,
  ensureSchema,
} from "../infrastructure/persistence/postgres.js";
import { createRedisSessionStore } from "../infrastructure/persistence/redis-sessions.js";
import { createLocalQuotingProvider } from "../infrastructure/quoting/local-rating.js";

/** Arma las dependencias concretas del núcleo. Se llama una vez por proceso. */
export async function buildDependencies(): Promise<Dependencies> {
  let leads: LeadRepository;
  let events: EventSink;
  if (config.persistence.driver === "postgres") {
    const pool = createPgPool();
    await ensureSchema(pool);
    leads = createPostgresLeadRepository(pool);
    events = createPostgresEventSink(pool);
  } else {
    leads = createJsonlLeadRepository();
    events = createJsonlEventSink();
  }

  let sessions: SessionStore;
  if (config.session.driver === "redis") {
    const client = createClient({ url: config.session.redisUrl });
    client.on("error", (err) => console.error("Error de Redis:", err));
    await client.connect();
    sessions = createRedisSessionStore(client, config.session.ttlSeconds);
  } else {
    sessions = createInMemorySessionStore();
  }

  return {
    leads,
    events,
    sessions,
    llm: createAnthropicLlm(),
    knowledge: createFilesystemKnowledge(),
    // Hoy el modelo local de factores; mañana la API del tarifador real detrás
    // del mismo puerto (ver infrastructure/quoting).
    quoting: createLocalQuotingProvider(),
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
