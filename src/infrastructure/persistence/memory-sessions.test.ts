import assert from "node:assert/strict";
import { test } from "node:test";
import type { Session } from "../../domain/conversation/session.js";
import { createInMemorySessionStore } from "./memory-sessions.js";

function session(userId: string): Session {
  return { userId, stage: "idle", data: {}, history: [] };
}

test("hace roundtrip de una sesión dentro del TTL", async () => {
  let t = 0;
  const store = createInMemorySessionStore(60, () => t);
  await store.save(session("u1"));
  t = 30_000; // dentro de los 60s
  assert.equal((await store.get("u1"))?.userId, "u1");
});

test("descarta la sesión vencida", async () => {
  let t = 0;
  const store = createInMemorySessionStore(60, () => t);
  await store.save(session("u1"));
  t = 61_000; // pasó el TTL
  assert.equal(await store.get("u1"), undefined);
});

test("save renueva el vencimiento", async () => {
  let t = 0;
  const store = createInMemorySessionStore(60, () => t);
  await store.save(session("u1"));
  t = 50_000;
  await store.save(session("u1")); // renueva
  t = 100_000; // 50s desde el último save: sigue vigente
  assert.equal((await store.get("u1"))?.userId, "u1");
});
