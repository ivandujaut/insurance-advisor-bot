import assert from "node:assert/strict";
import { test } from "node:test";
import { createRateLimiter } from "./rate-limit.js";

test("permite hasta el máximo y luego bloquea dentro de la ventana", () => {
  const t = 1000;
  const rl = createRateLimiter({ windowMs: 60_000, max: 3, now: () => t });
  assert.equal(rl.allow("ip1"), true);
  assert.equal(rl.allow("ip1"), true);
  assert.equal(rl.allow("ip1"), true);
  assert.equal(rl.allow("ip1"), false); // 4to en la misma ventana
});

test("cuentas por clave son independientes", () => {
  const t = 1000;
  const rl = createRateLimiter({ windowMs: 60_000, max: 1, now: () => t });
  assert.equal(rl.allow("a"), true);
  assert.equal(rl.allow("b"), true); // otra clave, ventana propia
  assert.equal(rl.allow("a"), false);
});

test("la ventana se reinicia al pasar el tiempo", () => {
  let t = 1000;
  const rl = createRateLimiter({ windowMs: 1000, max: 1, now: () => t });
  assert.equal(rl.allow("ip1"), true);
  assert.equal(rl.allow("ip1"), false);
  t += 1000; // ventana vencida
  assert.equal(rl.allow("ip1"), true);
});
