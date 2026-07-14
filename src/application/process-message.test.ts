import assert from "node:assert/strict";
import { test } from "node:test";
import type { Session } from "../domain/conversation/session.js";
import type { Dependencies, EventType, LeadInput, SessionStore } from "./ports.js";
import { LlmNotConfiguredError } from "./ports.js";
import { processMessage } from "./process-message.js";

/** Store de sesiones en memoria, inline, para no importar infraestructura. */
function memorySessions(): SessionStore {
  const m = new Map<string, Session>();
  return {
    get: async (id) => m.get(id),
    save: async (s) => {
      m.set(s.userId, s);
    },
  };
}

interface LoggedEvent {
  type: EventType;
  userId: string;
  props?: Record<string, string>;
}

/** Dependencias falsas: el motor se testea sin tocar disco, red ni LLM real. */
function fakeDeps(over: Partial<Dependencies> = {}) {
  const savedLeads: LeadInput[] = [];
  const logged: LoggedEvent[] = [];
  const deps: Dependencies = {
    leads: {
      save: async (lead) => {
        savedLeads.push(lead);
      },
    },
    events: {
      log: async (type, userId, props) => {
        logged.push({ type, userId, props });
      },
    },
    llm: { generate: async () => "respuesta simulada del asistente" },
    sessions: memorySessions(),
    knowledge: { load: async () => "conocimiento de prueba" },
    ...over,
  };
  return { deps, savedLeads, logged };
}

test("un usuario nuevo que saluda recibe el menú", async () => {
  const { deps } = fakeDeps();
  const reply = await processMessage({ from: "u-nuevo", text: "hola", name: "Ana" }, deps);
  assert.match(reply, /Cotizar mi seguro de auto/);
});

test("una consulta abierta cae al fallback cuando el LLM no está configurado", async () => {
  const { deps } = fakeDeps({
    llm: {
      generate: async () => {
        throw new LlmNotConfiguredError();
      },
    },
  });
  await processMessage({ from: "u-llm", text: "hola", name: "Beto" }, deps);
  const reply = await processMessage(
    { from: "u-llm", text: "¿qué es la franquicia?", name: "Beto" },
    deps,
  );
  assert.match(reply, /ANTHROPIC_API_KEY|clave del modelo/);
});

test("completar la cotización guarda el lead vía el repositorio inyectado", async () => {
  const { deps, savedLeads } = fakeDeps();
  for (const text of ["hola", "1", "2020", "Toyota", "Corolla", "XEI", "no", "3011", "2"]) {
    await processMessage({ from: "u-lead", text, name: "Caro" }, deps);
  }
  assert.equal(savedLeads.length, 1);
  assert.equal(savedLeads[0]?.plan, "Terceros Completo con Granizo");
  assert.equal(savedLeads[0]?.marca, "Toyota");
  assert.equal(savedLeads[0]?.cp, "3011");
});

test("el funnel registra el evento lead_captured", async () => {
  const { deps, logged } = fakeDeps();
  for (const text of ["hola", "1", "2019", "VW", "Gol", "no sé", "no", "1425", "1"]) {
    await processMessage({ from: "u-evento", text, name: "Dani" }, deps);
  }
  const captured = logged.filter((e) => e.type === "lead_captured");
  assert.equal(captured.length, 1);
  assert.equal(captured[0]?.props?.plan, "Terceros Completo");
});

test("una consulta abierta registra el evento open_question", async () => {
  const { deps, logged } = fakeDeps();
  await processMessage({ from: "u-open", text: "hola" }, deps);
  await processMessage({ from: "u-open", text: "una pregunta cualquiera" }, deps);
  assert.ok(logged.some((e) => e.type === "open_question"));
});

test("las sesiones de distintos usuarios no se mezclan", async () => {
  const { deps } = fakeDeps();
  // A queda a mitad de una cotización (año + marca cargados).
  await processMessage({ from: "u-a", text: "hola", name: "A" }, deps);
  await processMessage({ from: "u-a", text: "1", name: "A" }, deps);
  await processMessage({ from: "u-a", text: "2021", name: "A" }, deps);
  await processMessage({ from: "u-a", text: "Fiat", name: "A" }, deps);
  // B arranca de cero y no afecta a A.
  const bReply = await processMessage({ from: "u-b", text: "hola", name: "B" }, deps);
  assert.match(bReply, /Cotizar mi seguro de auto/);
  // A retoma donde estaba: le toca informar el modelo.
  const aReply = await processMessage({ from: "u-a", text: "Cronos", name: "A" }, deps);
  assert.match(aReply, /modelo|versión/i);
});
