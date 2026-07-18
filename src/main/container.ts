/**
 * Composition root: el único lugar que conoce los adapters concretos y los
 * cablea. Elige el adapter de persistencia/sesión según la config y arma las
 * dependencias que se inyectan en el núcleo. Async porque Postgres/Redis se
 * conectan al arrancar. Ver docs/adr/0001-arquitectura-hexagonal.md.
 */
import { createClient } from "redis";
import type {
  AnalyticsReader,
  Dependencies,
  EventSink,
  LeadRepository,
  MessagingProvider,
  SessionStore,
} from "../application/ports.js";
import { config } from "../config/index.js";
import { configureBrand } from "../domain/brand.js";
import { createOpenAiEmbeddings } from "../infrastructure/embeddings/openai.js";
import { createFaqMatcher } from "../infrastructure/faq/faq-matcher.js";
import { createFilesystemKnowledge } from "../infrastructure/knowledge/filesystem.js";
import { createAnthropicLlm } from "../infrastructure/llm/anthropic.js";
import { createAnthropicEmotionClassifier } from "../infrastructure/llm/emotion-classifier.js";
import { CliProvider } from "../infrastructure/messaging/cli.js";
import { MetaProvider } from "../infrastructure/messaging/meta.js";
import { createJsonlAnalyticsReader } from "../infrastructure/persistence/jsonl-analytics.js";
import { createJsonlEventSink } from "../infrastructure/persistence/jsonl-events.js";
import { createJsonlLeadRepository } from "../infrastructure/persistence/jsonl-leads.js";
import { createInMemorySessionStore } from "../infrastructure/persistence/memory-sessions.js";
import {
  createPgPool,
  createPostgresAnalyticsReader,
  createPostgresEventSink,
  createPostgresLeadRepository,
  ensureSchema,
} from "../infrastructure/persistence/postgres.js";
import { createRedisSessionStore } from "../infrastructure/persistence/redis-sessions.js";
import { createLocalQuotingProvider } from "../infrastructure/quoting/local-rating.js";

/**
 * Valida que la config tenga lo que cada driver necesita, y falla con un mensaje
 * claro en vez de arrancar y romper después. Sin esto, PERSISTENCE=postgres con
 * DATABASE_URL vacía cae al localhost de `pg` (ECONNREFUSED opaco).
 */
function assertConfig(): void {
  if (config.persistence.driver === "postgres" && !config.persistence.databaseUrl) {
    throw new Error("PERSISTENCE=postgres requiere DATABASE_URL (está vacía).");
  }
  if (config.session.driver === "redis" && !config.session.redisUrl) {
    throw new Error("SESSION_STORE=redis requiere REDIS_URL (está vacía).");
  }
}

// Callbacks para cerrar recursos (pool de Postgres, cliente de Redis) en un
// shutdown ordenado. Los llena buildDependencies y los corre shutdown().
const cleanups: Array<() => Promise<void>> = [];

/** Cierra los recursos abiertos (conexiones) de forma ordenada. */
export async function shutdown(): Promise<void> {
  for (const close of cleanups.splice(0)) {
    await close().catch((err) => console.error("Error cerrando recurso:", err));
  }
}

/** Arma las dependencias concretas del núcleo. Se llama una vez por proceso. */
export async function buildDependencies(): Promise<Dependencies> {
  assertConfig();
  // La marca es white-label: se configura una vez acá (composition root) y el
  // dominio la lee sin conocer config. Sin BRAND_NAME, identidad neutra.
  configureBrand(config.brand);

  let leads: LeadRepository;
  let events: EventSink;
  if (config.persistence.driver === "postgres") {
    const pool = createPgPool();
    cleanups.push(() => pool.end());
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
    cleanups.push(async () => {
      await client.quit();
    });
    sessions = createRedisSessionStore(client, config.session.ttlSeconds);
  } else {
    sessions = createInMemorySessionStore(config.session.ttlSeconds);
  }

  // FAQ router: embede el corpus del benchmark al arrancar (una vez). Sin
  // OPENAI_API_KEY queda desactivado y toda consulta cae al asistente.
  const faq = await createFaqMatcher(createOpenAiEmbeddings(), config.faq.threshold);

  return {
    leads,
    events,
    sessions,
    faq,
    llm: createAnthropicLlm(),
    emotion: createAnthropicEmotionClassifier(),
    knowledge: createFilesystemKnowledge(),
    // Hoy el modelo local de factores; mañana la API del tarifador real detrás
    // del mismo puerto (ver infrastructure/quoting).
    quoting: createLocalQuotingProvider(),
  };
}

/**
 * Arma el lado de lectura de analytics (para el reporte de funnel). Va aparte de
 * las Dependencies del núcleo porque leer métricas no es asunto del motor de
 * conversación. Para Postgres usa su propio pool (el endpoint es de baja
 * frecuencia); las tablas ya las creó buildDependencies al arrancar.
 */
export function buildAnalyticsReader(): AnalyticsReader {
  if (config.persistence.driver === "postgres") {
    return createPostgresAnalyticsReader(createPgPool());
  }
  return createJsonlAnalyticsReader();
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
