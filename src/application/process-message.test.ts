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
    emotion: { classify: async () => "neutral" },
    faq: { match: async () => null },
    sessions: memorySessions(),
    knowledge: { load: async () => "conocimiento de prueba" },
    quoting: {
      quote: async (input) => ({ plan: input.plan, desde: 10000, hasta: 15000, moneda: "ARS" }),
      quoteHogar: async () => ({
        plan: "Seguro de Hogar",
        desde: 8000,
        hasta: 12000,
        moneda: "ARS",
      }),
      quoteBici: async () => ({
        plan: "Seguro de Bicicleta",
        desde: 4000,
        hasta: 5000,
        moneda: "ARS",
      }),
    },
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
  for (const text of [
    "hola",
    "1",
    "2020",
    "usado",
    "Toyota",
    "Corolla",
    "XEI",
    "no",
    "3011",
    "2",
  ]) {
    await processMessage({ from: "u-lead", text, name: "Caro" }, deps);
  }
  assert.equal(savedLeads.length, 1);
  const lead = savedLeads[0];
  assert.equal(lead?.producto, "auto");
  if (lead?.producto !== "auto") throw new Error("esperaba un lead de auto");
  assert.equal(lead.plan, "Terceros Completo con Granizo");
  assert.equal(lead.marca, "Toyota");
  assert.equal(lead.cp, "3011");
});

test("el funnel registra el evento lead_captured", async () => {
  const { deps, logged } = fakeDeps();
  for (const text of ["hola", "1", "2019", "usado", "VW", "Gol", "no sé", "no", "1425", "1"]) {
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

test("emoción negativa ofrece un asesor y registra emotion_detected", async () => {
  const { deps, logged } = fakeDeps({
    llm: { generate: async () => "Entiendo tu molestia." },
    emotion: { classify: async () => "enojo" },
  });
  await processMessage({ from: "u-enojo", text: "hola" }, deps);
  const reply = await processMessage({ from: "u-enojo", text: "esto es un desastre" }, deps);
  assert.match(reply, /asesor/);
  const emo = logged.find((e) => e.type === "emotion_detected");
  assert.equal(emo?.props?.emocion, "enojo");
});

test("una duda conocida la responde el FAQ router sin llamar al LLM", async () => {
  let llmCalls = 0;
  const { deps, logged } = fakeDeps({
    llm: {
      generate: async () => {
        llmCalls++;
        return "respuesta cara del LLM";
      },
    },
    faq: {
      match: async () => ({ id: "franquicia", respuesta: "La franquicia es...", score: 0.91 }),
    },
  });
  await processMessage({ from: "u-faq", text: "hola" }, deps);
  const reply = await processMessage({ from: "u-faq", text: "¿qué es la franquicia?" }, deps);
  assert.match(reply, /La franquicia es/);
  assert.equal(llmCalls, 0); // no se llamó al LLM de generación
  const hit = logged.find((e) => e.type === "faq_hit");
  assert.equal(hit?.props?.id, "franquicia");
});

const AUTO_QUOTE = ["hola", "1", "2020", "usado", "Toyota", "Corolla", "XEI", "no", "3011", "2"];

test("tras cotizar, el cierre ofrece avanzar (no vuelve al menú frío)", async () => {
  const { deps } = fakeDeps();
  let reply = "";
  for (const text of AUTO_QUOTE) {
    reply = await processMessage({ from: "u-cta", text }, deps);
  }
  // La última respuesta (post-cotización) ofrece avanzar, no "escribí menú".
  assert.match(reply, /¿Avanzamos\?/);
  assert.match(reply, /me llame un asesor/i);
  assert.match(reply, /online/i);
});

test("aceptar con asesor captura el contacto y registra el handoff", async () => {
  const { deps, logged } = fakeDeps();
  for (const text of AUTO_QUOTE) await processMessage({ from: "u-close", text }, deps);
  const r1 = await processMessage({ from: "u-close", text: "1" }, deps);
  assert.match(r1, /nombre.*tel[eé]fono/i);
  const accepted = logged.find((e) => e.type === "quote_accepted");
  assert.equal(accepted?.props?.via, "asesor");
  const r2 = await processMessage({ from: "u-close", text: "Ana, 11 5555 5555, tardes" }, deps);
  assert.match(r2, /asesor de La Caja te va a contactar/i);
  assert.ok(logged.some((e) => e.type === "handoff_requested"));
});

test("contratar online registra quote_accepted con canal online", async () => {
  const { deps, logged } = fakeDeps();
  for (const text of AUTO_QUOTE) await processMessage({ from: "u-online", text }, deps);
  const r = await processMessage({ from: "u-online", text: "2" }, deps);
  assert.match(r, /online/i);
  const accepted = logged.find((e) => e.type === "quote_accepted");
  assert.equal(accepted?.props?.via, "online");
});

test("trabado en GNC: default inteligente y avanza en vez de loopear", async () => {
  const { deps, logged } = fakeDeps(); // emoción neutral: escapa por reintentos
  for (const t of ["hola", "1", "2020", "usado", "Toyota", "Corolla", "XEI"]) {
    await processMessage({ from: "u-gnc", text: t }, deps);
  }
  // Ahora pregunta GNC. Primer fallo: re-pregunta.
  const r1 = await processMessage({ from: "u-gnc", text: "que se yo" }, deps);
  assert.match(r1, /No te entend/i);
  // Segundo fallo (reintentos): pone el default "no" y avanza al CP.
  const r2 = await processMessage({ from: "u-gnc", text: "basta" }, deps);
  assert.match(r2, /pongo que \*no\*/i);
  assert.match(r2, /c[oó]digo postal/i);
  const stuck = logged.find((e) => e.type === "flow_stuck");
  assert.equal(stuck?.props?.paso, "gnc");
});

test("un mensaje frustrado en un flujo corta el loop al instante", async () => {
  const { deps, logged } = fakeDeps({ emotion: { classify: async () => "frustracion" } });
  for (const t of ["hola", "1", "2020"]) await processMessage({ from: "u-frust", text: t }, deps);
  // En el paso condición (0km/usado): un mensaje frustrado escapa ya (sin esperar).
  const r = await processMessage({ from: "u-frust", text: "basta de preguntas" }, deps);
  assert.match(r, /asesor|menú/i);
  const stuck = logged.find((e) => e.type === "flow_stuck");
  assert.equal(stuck?.props?.emocion, "frustracion");
});

test("las sesiones de distintos usuarios no se mezclan", async () => {
  const { deps } = fakeDeps();
  // A queda a mitad de una cotización (año + condición + marca cargados).
  await processMessage({ from: "u-a", text: "hola", name: "A" }, deps);
  await processMessage({ from: "u-a", text: "1", name: "A" }, deps);
  await processMessage({ from: "u-a", text: "2021", name: "A" }, deps);
  await processMessage({ from: "u-a", text: "usado", name: "A" }, deps);
  await processMessage({ from: "u-a", text: "Fiat", name: "A" }, deps);
  // B arranca de cero y no afecta a A.
  const bReply = await processMessage({ from: "u-b", text: "hola", name: "B" }, deps);
  assert.match(bReply, /Cotizar mi seguro de auto/);
  // A retoma donde estaba: le toca informar el modelo.
  const aReply = await processMessage({ from: "u-a", text: "Cronos", name: "A" }, deps);
  assert.match(aReply, /modelo|versión/i);
});
