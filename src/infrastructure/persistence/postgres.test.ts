import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createPgPool,
  createPostgresEventSink,
  createPostgresLeadRepository,
  ensureSchema,
} from "./postgres.js";

// Tests de integración: requieren un Postgres real (DATABASE_URL). Sin él se
// saltean, así que `pnpm test` local sigue verde. En CI corren contra un
// service container.
const url = process.env.DATABASE_URL;

test("Postgres LeadRepository persiste el lead", { skip: !url }, async () => {
  const pool = createPgPool(url);
  await ensureSchema(pool);
  const repo = createPostgresLeadRepository(pool);
  const userId = "pg-lead-test";
  await pool.query("DELETE FROM leads WHERE user_id = $1", [userId]);

  await repo.save({
    producto: "auto",
    userId,
    name: "Test",
    anio: "2020",
    marca: "Toyota",
    modelo: "Corolla",
    version: "XEI",
    gnc: true,
    cp: "1000",
    condicion: "usado",
    plan: "Terceros Completo",
  });

  const { rows } = await pool.query("SELECT * FROM leads WHERE user_id = $1", [userId]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.producto, "auto");
  assert.equal(rows[0]?.plan, "Terceros Completo");
  assert.equal(rows[0]?.detalle?.marca, "Toyota");
  assert.equal(rows[0]?.detalle?.gnc, true);
  assert.ok(rows[0]?.ts, "la fila tiene timestamp");

  await pool.query("DELETE FROM leads WHERE user_id = $1", [userId]);
  await pool.end();
});

test("Postgres persiste un lead de hogar en detalle jsonb", { skip: !url }, async () => {
  const pool = createPgPool(url);
  await ensureSchema(pool);
  const repo = createPostgresLeadRepository(pool);
  const userId = "pg-hogar-test";
  await pool.query("DELETE FROM leads WHERE user_id = $1", [userId]);

  await repo.save({
    producto: "hogar",
    userId,
    name: "Test",
    tipoResidente: "propietario",
    tipoHogar: "casa",
    uso: "permanente",
    m2: 120,
    cp: "1425",
    plan: "Seguro de Hogar",
  });

  const { rows } = await pool.query("SELECT * FROM leads WHERE user_id = $1", [userId]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.producto, "hogar");
  assert.equal(rows[0]?.detalle?.tipoResidente, "propietario");
  assert.equal(rows[0]?.detalle?.m2, 120);
  assert.equal(rows[0]?.detalle?.uso, "permanente");

  await pool.query("DELETE FROM leads WHERE user_id = $1", [userId]);
  await pool.end();
});

test("Postgres EventSink persiste el evento con props jsonb", { skip: !url }, async () => {
  const pool = createPgPool(url);
  await ensureSchema(pool);
  const sink = createPostgresEventSink(pool);
  const userId = "pg-evt-test";
  await pool.query("DELETE FROM events WHERE user_id = $1", [userId]);

  await sink.log("lead_captured", userId, { plan: "Terceros Completo" });

  const { rows } = await pool.query("SELECT * FROM events WHERE user_id = $1", [userId]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.type, "lead_captured");
  assert.equal(rows[0]?.props?.plan, "Terceros Completo");

  await pool.query("DELETE FROM events WHERE user_id = $1", [userId]);
  await pool.end();
});
