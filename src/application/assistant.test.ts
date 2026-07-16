import assert from "node:assert/strict";
import { test } from "node:test";
import type { Session } from "../domain/conversation/session.js";
import { answer } from "./assistant.js";
import { type Dependencies, LlmNotConfiguredError } from "./ports.js";

function sessionWith(userText: string): Session {
  return {
    userId: "u1",
    stage: "main_menu",
    data: {},
    history: [{ role: "user", content: userText }],
  };
}

/** Dependencias con un LLM stub que devuelve lo que le indiquemos. */
function deps(llmReturn: () => Promise<string>): Dependencies {
  return {
    leads: { save: async () => {} },
    events: { log: async () => {} },
    llm: { generate: llmReturn },
    sessions: { get: async () => undefined, save: async () => {} },
    knowledge: { load: async () => "base de conocimiento" },
    quoting: {
      quote: async () => ({ plan: "x", desde: 1, hasta: 2, moneda: "ARS" }),
      quoteHogar: async () => ({ plan: "x", desde: 1, hasta: 2, moneda: "ARS" }),
      quoteBici: async () => ({ plan: "x", desde: 1, hasta: 2, moneda: "ARS" }),
    },
  };
}

test("parsea la respuesta y la emoción del JSON del modelo", async () => {
  const d = deps(async () => '{"respuesta": "La franquicia es...", "emocion": "confusion"}');
  const r = await answer(sessionWith("no entiendo la franquicia"), d);
  assert.equal(r.reply, "La franquicia es...");
  assert.equal(r.emocion, "confusion");
});

test("tolera fences/texto alrededor del JSON", async () => {
  const d = deps(async () => 'Claro:\n```json\n{"respuesta":"Hola","emocion":"neutral"}\n```');
  const r = await answer(sessionWith("hola"), d);
  assert.equal(r.reply, "Hola");
  assert.equal(r.emocion, "neutral");
});

test("si el modelo no devuelve JSON, usa el texto crudo con emoción neutral", async () => {
  const d = deps(async () => "Respuesta en texto plano sin json");
  const r = await answer(sessionWith("hola"), d);
  assert.equal(r.reply, "Respuesta en texto plano sin json");
  assert.equal(r.emocion, "neutral");
});

test("emoción inválida del modelo cae a neutral", async () => {
  const d = deps(async () => '{"respuesta":"ok","emocion":"euforia"}');
  const r = await answer(sessionWith("hola"), d);
  assert.equal(r.emocion, "neutral");
});

test("sin LLM configurado, devuelve el fallback y emoción neutral", async () => {
  const d = deps(async () => {
    throw new LlmNotConfiguredError();
  });
  const r = await answer(sessionWith("hola"), d);
  assert.match(r.reply, /ANTHROPIC_API_KEY/);
  assert.equal(r.emocion, "neutral");
});
