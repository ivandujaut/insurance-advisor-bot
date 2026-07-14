import assert from "node:assert/strict";
import { test } from "node:test";
import { parseRecipientOverrides } from "./index.js";

test("parsea un único mapeo waId=destino", () => {
  const map = parseRecipientOverrides("5491151769708=54111551769708");
  assert.deepEqual(map, { "5491151769708": "54111551769708" });
});

test("soporta múltiples mapeos separados por coma", () => {
  // Cuando se sume otro número (real u otro de prueba), va como un caso más.
  const map = parseRecipientOverrides("5491151769708=54111551769708,5493511234567=543511512345");
  assert.equal(map["5491151769708"], "54111551769708");
  assert.equal(map["5493511234567"], "543511512345");
  assert.equal(Object.keys(map).length, 2);
});

test("recorta espacios alrededor de los valores", () => {
  const map = parseRecipientOverrides(" 549111 = 541115 , 549222 = 541522 ");
  assert.equal(map["549111"], "541115");
  assert.equal(map["549222"], "541522");
});

test("ignora entradas vacías o mal formadas y devuelve objeto vacío si no hay nada", () => {
  assert.deepEqual(parseRecipientOverrides(""), {});
  assert.deepEqual(parseRecipientOverrides("basura-sin-igual"), {});
  assert.deepEqual(parseRecipientOverrides("=solo-destino"), {});
  assert.deepEqual(parseRecipientOverrides("solo-origen="), {});
});
