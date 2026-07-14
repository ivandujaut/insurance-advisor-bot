import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "redis";
import type { Session } from "../../domain/conversation/session.js";
import { createRedisSessionStore } from "./redis-sessions.js";

// Test de integración: requiere un Redis real (REDIS_URL). Sin él se saltea.
const url = process.env.REDIS_URL;

test("Redis SessionStore hace roundtrip de la sesión", { skip: !url }, async () => {
  const client = createClient({ url });
  await client.connect();
  const store = createRedisSessionStore(client, 60);

  const session: Session = {
    userId: "redis-sess-test",
    name: "Test",
    stage: "quoting_auto",
    data: { vehiculo: "Toyota Corolla 2020" },
    history: [{ role: "user", content: "hola" }],
  };
  await store.save(session);

  const got = await store.get("redis-sess-test");
  assert.equal(got?.stage, "quoting_auto");
  assert.equal(got?.data.vehiculo, "Toyota Corolla 2020");
  assert.equal(got?.history.length, 1);

  const missing = await store.get("no-existe");
  assert.equal(missing, undefined);

  await client.del("session:redis-sess-test");
  await client.quit();
});
