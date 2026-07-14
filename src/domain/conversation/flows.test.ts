import assert from "node:assert/strict";
import { test } from "node:test";
import type { Dependencies, EventType, LeadInput } from "../../application/ports.js";
import { handleFlow } from "./flows.js";
import type { Session } from "./session.js";

function newSession(userId: string): Session {
  return { userId, stage: "idle", data: {}, history: [] };
}

interface LoggedEvent {
  type: EventType;
  userId: string;
  props?: Record<string, string>;
}

/** Dependencias en memoria: el núcleo se testea sin tocar disco. */
function fakeDeps(): Dependencies & { savedLeads: LeadInput[]; events: { logged: LoggedEvent[] } } {
  const savedLeads: LeadInput[] = [];
  const logged: LoggedEvent[] = [];
  return {
    savedLeads,
    leads: {
      save: async (lead) => {
        savedLeads.push(lead);
      },
    },
    events: Object.assign(
      { logged },
      {
        log: async (type: EventType, userId: string, props?: Record<string, string>) => {
          logged.push({ type, userId, props });
        },
      },
    ),
    // handleFlow nunca llama al LLM (eso es responsabilidad del engine); stub.
    llm: { generate: async () => "" },
    // handleFlow tampoco toca el store de sesiones (recibe la sesión directa); stub.
    sessions: { get: async () => undefined, save: async () => {} },
    knowledge: { load: async () => "" },
  };
}

test("un saludo muestra el menú principal y pasa a main_menu", async () => {
  const s = newSession("t-hola");
  const reply = await handleFlow(s, "hola", fakeDeps());
  assert.ok(reply, "debería devolver una respuesta");
  assert.match(reply, /Cotizar mi seguro de auto/);
  assert.equal(s.stage, "main_menu");
});

test("opción 1 arranca la cotización de auto", async () => {
  const s = newSession("t-cotizar");
  const deps = fakeDeps();
  await handleFlow(s, "hola", deps);
  const reply = await handleFlow(s, "1", deps);
  assert.match(reply ?? "", /marca, modelo y año/);
  assert.equal(s.stage, "quoting_auto");
});

test("opción 2 muestra la comparación de los tres planes", async () => {
  const s = newSession("t-comparar");
  const deps = fakeDeps();
  await handleFlow(s, "hola", deps);
  const reply = (await handleFlow(s, "2", deps)) ?? "";
  assert.match(reply, /Terceros Completo/);
  assert.match(reply, /Terceros Completo con Granizo/);
  assert.match(reply, /Todo Riesgo con Franquicia/);
  assert.equal(s.stage, "main_menu");
});

test("el flujo completo termina en un resumen y guarda el lead vía el puerto", async () => {
  const s = newSession("t-flujo");
  const deps = fakeDeps();
  await handleFlow(s, "hola", deps);
  await handleFlow(s, "1", deps);
  await handleFlow(s, "Toyota Corolla 2020", deps);
  await handleFlow(s, "3011", deps);
  await handleFlow(s, "usado", deps);
  const final = (await handleFlow(s, "2", deps)) ?? "";
  assert.match(final, /solicitud de cotización/);
  assert.match(final, /Terceros Completo con Granizo/);
  assert.equal(s.stage, "idle", "vuelve a idle al terminar");
  // El lead se guardó a través del LeadRepository inyectado (sin tocar disco).
  assert.equal(deps.savedLeads.length, 1);
  assert.equal(deps.savedLeads[0]?.plan, "Terceros Completo con Granizo");
  assert.equal(deps.savedLeads[0]?.cp, "3011");
});

test("auto usado dispara la nota de inspección online", async () => {
  const s = newSession("t-usado");
  const deps = fakeDeps();
  await handleFlow(s, "hola", deps);
  await handleFlow(s, "1", deps);
  await handleFlow(s, "Ford Ka 2018", deps);
  await handleFlow(s, "3011", deps);
  const reply = (await handleFlow(s, "usado", deps)) ?? "";
  assert.match(reply, /inspección se hace online/);
});

test("un plan inválido pide reintentar sin romper el flujo", async () => {
  const s = newSession("t-plan-invalido");
  const deps = fakeDeps();
  await handleFlow(s, "hola", deps);
  await handleFlow(s, "1", deps);
  await handleFlow(s, "Fiat Cronos 2021", deps);
  await handleFlow(s, "1425", deps);
  await handleFlow(s, "0km", deps);
  const reply = (await handleFlow(s, "9", deps)) ?? "";
  assert.match(reply, /No te entendí el plan/);
  assert.equal(s.stage, "quoting_auto", "sigue esperando el plan");
  assert.equal(deps.savedLeads.length, 0, "no guarda lead con plan inválido");
});

test("la palabra 'asesor' deriva a un humano desde cualquier punto", async () => {
  const s = newSession("t-asesor");
  const deps = fakeDeps();
  await handleFlow(s, "hola", deps);
  await handleFlow(s, "1", deps);
  const reply = (await handleFlow(s, "asesor", deps)) ?? "";
  assert.match(reply, /asesor/i);
  assert.equal(s.stage, "idle");
});

test("una consulta abierta desde el menú se delega al LLM (devuelve null)", async () => {
  const s = newSession("t-abierta");
  const deps = fakeDeps();
  await handleFlow(s, "hola", deps);
  const reply = await handleFlow(s, "¿el seguro cubre granizo?", deps);
  assert.equal(reply, null, "null indica que responde el LLM");
});

test("el funnel registra los eventos clave a través del EventSink inyectado", async () => {
  const s = newSession("t-eventos");
  const deps = fakeDeps();
  await handleFlow(s, "hola", deps);
  await handleFlow(s, "1", deps);
  const tipos = deps.events.logged.map((e) => e.type);
  assert.ok(tipos.includes("conversation_started"));
  assert.ok(tipos.includes("quote_started"));
});
