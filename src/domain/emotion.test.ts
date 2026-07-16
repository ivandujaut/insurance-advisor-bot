import assert from "node:assert/strict";
import { test } from "node:test";
import { parseEmotion } from "./emotion.js";

test("parseEmotion acepta un valor válido", () => {
  assert.equal(parseEmotion("enojo"), "enojo");
  assert.equal(parseEmotion("  Frustracion "), "frustracion"); // trim + lowercase
});

test("parseEmotion cae a neutral ante algo desconocido o vacío", () => {
  assert.equal(parseEmotion("felicidad"), "neutral");
  assert.equal(parseEmotion(undefined), "neutral");
  assert.equal(parseEmotion(""), "neutral");
});
