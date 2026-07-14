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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leads (
      id        SERIAL PRIMARY KEY,
      ts        TIMESTAMPTZ NOT NULL DEFAULT now(),
      user_id   TEXT NOT NULL,
      name      TEXT,
      anio      TEXT NOT NULL,
      marca     TEXT NOT NULL,
      modelo    TEXT NOT NULL,
      version   TEXT,
      gnc       BOOLEAN NOT NULL,
      cp        TEXT NOT NULL,
      condicion TEXT NOT NULL,
      plan      TEXT NOT NULL
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
        await pool.query(
          `INSERT INTO leads (user_id, name, anio, marca, modelo, version, gnc, cp, condicion, plan)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            lead.userId,
            lead.name ?? null,
            lead.anio,
            lead.marca,
            lead.modelo,
            lead.version ?? null,
            lead.gnc,
            lead.cp,
            lead.condicion,
            lead.plan,
          ],
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
