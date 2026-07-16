/**
 * Adapters de Postgres para los puertos LeadRepository y EventSink.
 * Comparten un pool de conexiones y el schema. Es la vía de persistencia para
 * producción; los adapters JSONL siguen siendo el default sin dependencias.
 */
import { Pool } from "pg";
import type {
  AnalyticsEvent,
  AnalyticsReader,
  EventSink,
  Lead,
  LeadRepository,
} from "../../application/ports.js";
import { config } from "../../config/index.js";

/**
 * Crea el pool de conexiones. Por defecto usa DATABASE_URL de la config, que
 * puede apuntar a cualquier Postgres (Render, Supabase, Neon, RDS): cambiar de
 * proveedor es cambiar esa URL, sin tocar los adapters. El SSL se activa para los
 * managed externos (Supabase/Neon) vía DATABASE_SSL=true o sslmode=require en la
 * URL; el Postgres interno de Render no lo necesita.
 */
export function createPgPool(connectionString: string = config.persistence.databaseUrl): Pool {
  const needsSsl = config.persistence.databaseSsl || /[?&]sslmode=require/.test(connectionString);
  return new Pool({
    connectionString,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  });
}

// Errores de conexión que son transitorios al arrancar: la base free puede estar
// dormida o inaccesible por unos segundos (spin-down, blip de red, DNS todavía sin
// resolver). Reintentar tiene sentido. Un error de credenciales o de SQL, no: falla
// rápido para no enmascarar un problema real detrás de 30s de reintentos.
const TRANSIENT_CONN_CODES = new Set(["ETIMEDOUT", "ECONNREFUSED", "ECONNRESET", "EAI_AGAIN"]);

/** True si el error es una falla de conexión transitoria (vale la pena reintentar). */
export function isTransientConnError(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code;
  return typeof code === "string" && TRANSIENT_CONN_CODES.has(code);
}

interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Inyectable para testear sin esperas reales. */
  sleep?: (ms: number) => Promise<void>;
  onRetry?: (attempt: number, delayMs: number, err: unknown) => void;
}

/**
 * Corre `fn` reintentando SOLO fallas de conexión transitorias, con backoff
 * exponencial acotado. Cualquier otro error (o agotar los intentos) se propaga.
 */
export async function retryTransient<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const attempts = opts.attempts ?? 6;
  const base = opts.baseDelayMs ?? 1000;
  const max = opts.maxDelayMs ?? 16000;
  const sleep = opts.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));

  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransientConnError(err) || attempt === attempts) throw err;
      const delayMs = Math.min(base * 2 ** (attempt - 1), max);
      opts.onRetry?.(attempt, delayMs, err);
      await sleep(delayMs);
    }
  }
  throw lastErr;
}

/**
 * Crea las tablas si no existen. Se corre una vez al arrancar y es el primer toque
 * a la base, así que reintenta si Postgres todavía no está accesible: sin esto, un
 * blip transitorio al bootear tira el deploy (visto en Render free: connect ETIMEDOUT).
 */
export async function ensureSchema(pool: Pool, retry: RetryOptions = {}): Promise<void> {
  // Esquema por producto: columnas comunes + `detalle` jsonb con los campos
  // específicos (auto: anio/marca/...; hogar: tipoResidente/vivienda/...). Escala
  // a nuevos productos sin migrar columnas. El CREATE ... IF NOT EXISTS es
  // idempotente, así que reintentarlo es seguro.
  await retryTransient(
    () =>
      pool.query(`
        CREATE TABLE IF NOT EXISTS leads (
          id        SERIAL PRIMARY KEY,
          ts        TIMESTAMPTZ NOT NULL DEFAULT now(),
          user_id   TEXT NOT NULL,
          name      TEXT,
          producto  TEXT NOT NULL,
          plan      TEXT NOT NULL,
          detalle   JSONB NOT NULL
        );
        CREATE TABLE IF NOT EXISTS events (
          id      SERIAL PRIMARY KEY,
          ts      TIMESTAMPTZ NOT NULL DEFAULT now(),
          type    TEXT NOT NULL,
          user_id TEXT NOT NULL,
          props   JSONB
        );
      `),
    {
      onRetry: (attempt, delayMs, err) =>
        console.warn(
          `Postgres no accesible al arrancar (intento ${attempt}: ${(err as Error).message}). Reintento en ${delayMs}ms...`,
        ),
      ...retry,
    },
  );
}

export function createPostgresLeadRepository(pool: Pool): LeadRepository {
  return {
    async save(lead) {
      // El error se PROPAGA a propósito: un lead es el valor del producto; si el
      // insert falla, el flujo debe enterarse y no confirmarle "listo" al usuario.
      const { userId, name, producto, plan, ...detalle } = lead;
      await pool.query(
        `INSERT INTO leads (user_id, name, producto, plan, detalle)
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [userId, name ?? null, producto, plan, JSON.stringify(detalle)],
      );
    },
  };
}

export function createPostgresEventSink(pool: Pool): EventSink {
  return {
    async log(type, userId, props) {
      try {
        await pool.query(`INSERT INTO events (type, user_id, props) VALUES ($1, $2, $3::jsonb)`, [
          type,
          userId,
          JSON.stringify(props ?? {}),
        ]);
      } catch (err) {
        console.error("No se pudo registrar el evento en Postgres:", err);
      }
    },
  };
}

export function createPostgresAnalyticsReader(pool: Pool): AnalyticsReader {
  return {
    async readEvents() {
      const { rows } = await pool.query(`SELECT ts, type, user_id, props FROM events ORDER BY ts`);
      return rows.map((r) => ({
        ts: (r.ts as Date).toISOString(),
        type: r.type,
        userId: r.user_id,
        props: r.props ?? undefined,
      })) as AnalyticsEvent[];
    },
    async readLeads() {
      const { rows } = await pool.query(
        `SELECT ts, user_id, name, producto, plan, detalle FROM leads ORDER BY ts`,
      );
      // Se reconstruye el lead: columnas comunes + lo específico del `detalle` jsonb.
      return rows.map((r) => ({
        ts: (r.ts as Date).toISOString(),
        userId: r.user_id,
        name: r.name ?? undefined,
        producto: r.producto,
        plan: r.plan,
        ...(r.detalle as Record<string, unknown>),
      })) as Lead[];
    },
  };
}
