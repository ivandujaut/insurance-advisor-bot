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
    emotion: { classify: async () => "neutral" },
    sessions: { get: async () => undefined, save: async () => {} },
    knowledge: { load: async () => "base de conocimiento" },
    quoting: {
      quote: async () => ({ plan: "x", desde: 1, hasta: 2, moneda: "ARS" }),
      quoteHogar: async () => ({ plan: "x", desde: 1, hasta: 2, moneda: "ARS" }),
      quoteBici: async () => ({ plan: "x", desde: 1, hasta: 2, moneda: "ARS" }),
    },
  };
}

test("devuelve la respuesta del modelo (texto plano, sin JSON)", async () => {
  const d = deps(async () => "  La franquicia es un monto a tu cargo.  ");
  const reply = await answer(sessionWith("¿qué es la franquicia?"), d);
  assert.equal(reply, "La franquicia es un monto a tu cargo."); // trim
});

test("sin LLM configurado, devuelve el fallback", async () => {
  const d = deps(async () => {
    throw new LlmNotConfiguredError();
  });
  const reply = await answer(sessionWith("hola"), d);
  assert.match(reply, /ANTHROPIC_API_KEY/);
});

test("ante un error del LLM, devuelve un mensaje de reintento", async () => {
  const d = deps(async () => {
    throw new Error("boom");
  });
  const reply = await answer(sessionWith("hola"), d);
  assert.match(reply, /problema para procesar/);
});
