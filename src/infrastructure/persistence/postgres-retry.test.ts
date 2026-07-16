import assert from "node:assert/strict";
import { test } from "node:test";
import { isTransientConnError, retryTransient } from "./postgres.js";

const transient = (code: string) => Object.assign(new Error(`falla ${code}`), { code });
const noSleep = async () => {};

test("isTransientConnError: reconoce las fallas de conexión transitorias", () => {
  for (const code of ["ETIMEDOUT", "ECONNREFUSED", "ECONNRESET", "EAI_AGAIN"]) {
    assert.equal(isTransientConnError(transient(code)), true, code);
  }
});

test("isTransientConnError: no reintenta credenciales, SQL ni errores sin code", () => {
  assert.equal(isTransientConnError(transient("28P01")), false); // auth
  assert.equal(isTransientConnError(new Error("syntax error")), false);
  assert.equal(isTransientConnError({ code: 42 }), false);
  assert.equal(isTransientConnError(null), false);
});

test("retryTransient: devuelve al primer intento sin reintentar", async () => {
  let calls = 0;
  const out = await retryTransient(
    async () => {
      calls++;
      return "ok";
    },
    { sleep: noSleep },
  );
  assert.equal(out, "ok");
  assert.equal(calls, 1);
});

test("retryTransient: reintenta un transitorio y después tiene éxito", async () => {
  let calls = 0;
  const out = await retryTransient(
    async () => {
      calls++;
      if (calls < 3) throw transient("ETIMEDOUT");
      return "ok";
    },
    { sleep: noSleep },
  );
  assert.equal(out, "ok");
  assert.equal(calls, 3);
});

test("retryTransient: agota los intentos y propaga el último error", async () => {
  let calls = 0;
  await assert.rejects(
    retryTransient(
      async () => {
        calls++;
        throw transient("ECONNREFUSED");
      },
      { attempts: 4, sleep: noSleep },
    ),
    /ECONNREFUSED/,
  );
  assert.equal(calls, 4);
});

test("retryTransient: un error no transitorio se propaga sin reintentar", async () => {
  let calls = 0;
  await assert.rejects(
    retryTransient(
      async () => {
        calls++;
        throw transient("28P01"); // credenciales
      },
      { sleep: noSleep },
    ),
    /28P01/,
  );
  assert.equal(calls, 1);
});

test("retryTransient: backoff exponencial acotado al máximo", async () => {
  const delays: number[] = [];
  await assert.rejects(
    retryTransient(async () => Promise.reject(transient("ETIMEDOUT")), {
      attempts: 6,
      baseDelayMs: 1000,
      maxDelayMs: 16000,
      sleep: async (ms) => {
        delays.push(ms);
      },
    }),
  );
  // Se duerme tras los primeros 5 intentos (el 6º ya no reintenta).
  assert.deepEqual(delays, [1000, 2000, 4000, 8000, 16000]);
});
