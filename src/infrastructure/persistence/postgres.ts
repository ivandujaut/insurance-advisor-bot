/**
 * Adapters de Postgres para los puertos LeadRepository y EventSink.
 * Comparten un pool de conexiones y el schema. Es la vía de persistencia para
 * producción; los adapters JSONL siguen siendo el default sin dependencias.
 */
import { Pool } from "pg";
import type { EventSink, LeadRepository } from "../../application/ports.js";
import { config } from "../../config/index.js";

/** Crea el pool de conexiones. Por defecto usa DATABASE_URL de la config. */
export function createPgPool(connectionString: string = config.persistence.databaseUrl): Pool {
  return new Pool({ connectionString });
}

/** Crea las tablas si no existen. Se corre una vez al arrancar. */
export async function ensureSchema(pool: Pool): Promise<void> {
  // Esquema por producto: columnas comunes + `detalle` jsonb con los campos
  // específicos (auto: anio/marca/...; hogar: tipoResidente/vivienda/...). Escala
  // a nuevos productos sin migrar columnas.
  await pool.query(`
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
  `);
}

export function createPostgresLeadRepository(pool: Pool): LeadRepository {
  return {
    async save(lead) {
      try {
        // Campos comunes en columnas; el resto (específico del producto) va a jsonb.
        const { userId, name, producto, plan, ...detalle } = lead;
        await pool.query(
          `INSERT INTO leads (user_id, name, producto, plan, detalle)
           VALUES ($1, $2, $3, $4, $5::jsonb)`,
          [userId, name ?? null, producto, plan, JSON.stringify(detalle)],
        );
      } catch (err) {
        console.error("No se pudo guardar el lead en Postgres:", err);
      }
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
