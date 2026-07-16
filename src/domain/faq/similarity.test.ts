import assert from "node:assert/strict";
import { test } from "node:test";
import { bestMatch, cosineSimilarity, type FaqDoc } from "./similarity.js";

const round = (x: number) => Math.round(x * 1000) / 1000;

test("cosineSimilarity: idénticos = 1, ortogonales = 0, opuestos = -1", () => {
  assert.equal(round(cosineSimilarity([1, 0], [1, 0])), 1);
  assert.equal(round(cosineSimilarity([1, 0], [0, 1])), 0);
  assert.equal(round(cosineSimilarity([1, 0], [-1, 0])), -1);
});

test("cosineSimilarity: no depende de la magnitud, solo de la dirección", () => {
  assert.equal(round(cosineSimilarity([1, 1], [2, 2])), 1);
});

test("cosineSimilarity: vector cero devuelve 0 (no NaN)", () => {
  assert.equal(cosineSimilarity([0, 0], [1, 1]), 0);
});

test("bestMatch: elige el documento más cercano", () => {
  const docs: FaqDoc[] = [
    { id: "a", respuesta: "RA", vector: [1, 0] },
    { id: "b", respuesta: "RB", vector: [0, 1] },
  ];
  const m = bestMatch([0.9, 0.1], docs);
  assert.equal(m?.id, "a");
  assert.ok((m?.score ?? 0) > 0.9);
});

test("bestMatch: sin documentos devuelve null", () => {
  assert.equal(bestMatch([1, 0], []), null);
});
