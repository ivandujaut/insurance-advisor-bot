import assert from "node:assert/strict";
import { test } from "node:test";
import { rocAuc, rocCurve } from "./roc.js";

test("rocAuc: separación perfecta = 1", () => {
  // Todos los positivos puntúan por encima de todos los negativos.
  assert.equal(rocAuc([0.8, 0.9, 1.0], [0.1, 0.2, 0.3]), 1);
});

test("rocAuc: orden invertido = 0", () => {
  assert.equal(rocAuc([0.1, 0.2], [0.8, 0.9]), 0);
});

test("rocAuc: solapamiento total (mismos scores) = 0.5", () => {
  // Cada par positivo-negativo empata: 0.5 cada uno.
  assert.equal(rocAuc([0.5, 0.5], [0.5, 0.5]), 0.5);
});

test("rocAuc: caso intermedio conocido", () => {
  // pos=[0.6,0.4], neg=[0.5,0.3]. Pares (p>n): 0.6>0.5,0.6>0.3,0.4>0.3 = 3; 0.4>0.5 no.
  // AUC = 3/4 = 0.75.
  assert.equal(rocAuc([0.6, 0.4], [0.5, 0.3]), 0.75);
});

test("rocAuc: sin positivos o sin negativos devuelve 0", () => {
  assert.equal(rocAuc([], [0.5]), 0);
  assert.equal(rocAuc([0.5], []), 0);
});

test("rocCurve: arranca en (0,0) y termina cubriendo todo", () => {
  const curve = rocCurve([0.8, 0.9], [0.1, 0.2]);
  assert.deepEqual(curve[0], { threshold: Number.POSITIVE_INFINITY, tpr: 0, fpr: 0 });
  const last = curve[curve.length - 1];
  // En el umbral más bajo (0.1) todos superan: TPR=1, FPR=1.
  assert.equal(last?.tpr, 1);
  assert.equal(last?.fpr, 1);
});

test("rocCurve: separación perfecta pasa por la esquina (0,1)", () => {
  const curve = rocCurve([0.8, 0.9], [0.1, 0.2]);
  // Debe existir un punto con TPR=1 y FPR=0 (todos los positivos, ningún negativo).
  assert.ok(curve.some((p) => p.tpr === 1 && p.fpr === 0));
});

test("rocCurve: sin datos devuelve vacío", () => {
  assert.deepEqual(rocCurve([], [0.5]), []);
});
