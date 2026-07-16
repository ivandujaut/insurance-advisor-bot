import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateEmotions } from "./emotion-eval.js";

const round = (x: number) => Math.round(x * 1000) / 1000;

test("evaluateEmotions: métricas sobre un caso conocido", () => {
  const pares = [
    { gold: "a", pred: "a" },
    { gold: "a", pred: "a" },
    { gold: "a", pred: "b" }, // a mal clasificada
    { gold: "b", pred: "b" },
    { gold: "b", pred: "a" }, // b mal clasificada
  ];
  const m = evaluateEmotions(pares, ["a", "b"]);

  assert.equal(m.total, 5);
  assert.equal(m.aciertos, 3);
  assert.equal(round(m.accuracy), 0.6);

  const a = m.perClass.find((c) => c.clase === "a");
  assert.equal(a?.support, 3);
  assert.equal(round(a?.precision ?? -1), 0.667); // 2/3
  assert.equal(round(a?.recall ?? -1), 0.667);

  const b = m.perClass.find((c) => c.clase === "b");
  assert.equal(round(b?.f1 ?? -1), 0.5); // p=r=0.5

  assert.equal(round(m.macroF1), 0.583); // (0.667 + 0.5) / 2
  assert.equal(m.confusion.matrix[0]?.[1], 1); // gold a, pred b
});

test("evaluateEmotions: sin datos no explota", () => {
  const m = evaluateEmotions([], ["a", "b"]);
  assert.equal(m.total, 0);
  assert.equal(m.accuracy, 0);
  assert.equal(m.macroF1, 0);
});
