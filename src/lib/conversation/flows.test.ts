import assert from "node:assert/strict";
import { test } from "node:test";
import type { Dependencies, EventType, LeadInput } from "../application/ports.js";
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
    leads: { save: (lead) => savedLeads.push(lead) },
    events: Object.assign(
      { logged },
      { log: (type: EventType, userId: string, props?: Record<string, string>) => logged.push({ type, userId, props }) },
    ),
  };
}

test("un saludo muestra el menú principal y pasa a main_menu", () => {
  const s = newSession("t-hola");
  const reply = handleFlow(s, "hola", fakeDeps());
  assert.ok(reply, "debería devolver una respuesta");
  assert.match(reply, /Cotizar mi seguro de auto/);
  assert.equal(s.stage, "main_menu");
});

test("opción 1 arranca la cotización de auto", () => {
  const s = newSession("t-cotizar");
  const deps = fakeDeps();
  handleFlow(s, "hola", deps);
  const reply = handleFlow(s, "1", deps);
  assert.match(reply ?? "", /marca, modelo y año/);
  assert.equal(s.stage, "quoting_auto");
});

test("opción 2 muestra la comparación de los tres planes", () => {
  const s = newSession("t-comparar");
  const deps = fakeDeps();
  handleFlow(s, "hola", deps);
  const reply = handleFlow(s, "2", deps) ?? "";
  assert.match(reply, /Terceros Completo/);
  assert.match(reply, /Terceros Completo con Granizo/);
  assert.match(reply, /Todo Riesgo con Franquicia/);
  assert.equal(s.stage, "main_menu");
});

test("el flujo completo termina en un resumen y guarda el lead vía el puerto", () => {
  const s = newSession("t-flujo");
  const deps = fakeDeps();
  handleFlow(s, "hola", deps);
  handleFlow(s, "1", deps);
  handleFlow(s, "Toyota Corolla 2020", deps);
  handleFlow(s, "3011", deps);
  handleFlow(s, "usado", deps);
  const final = handleFlow(s, "2", deps) ?? "";
  assert.match(final, /solicitud de cotización/);
  assert.match(final, /Terceros Completo con Granizo/);
  assert.equal(s.stage, "idle", "vuelve a idle al terminar");
  // El lead se guardó a través del LeadRepository inyectado (sin tocar disco).
  assert.equal(deps.savedLeads.length, 1);
  assert.equal(deps.savedLeads[0]?.plan, "Terceros Completo con Granizo");
  assert.equal(deps.savedLeads[0]?.cp, "3011");
});

test("auto usado dispara la nota de inspección online", () => {
  const s = newSession("t-usado");
  const deps = fakeDeps();
  handleFlow(s, "hola", deps);
  handleFlow(s, "1", deps);
  handleFlow(s, "Ford Ka 2018", deps);
  handleFlow(s, "3011", deps);
  const reply = handleFlow(s, "usado", deps) ?? "";
  assert.match(reply, /inspección se hace online/);
});

test("un plan inválido pide reintentar sin romper el flujo", () => {
  const s = newSession("t-plan-invalido");
  const deps = fakeDeps();
  handleFlow(s, "hola", deps);
  handleFlow(s, "1", deps);
  handleFlow(s, "Fiat Cronos 2021", deps);
  handleFlow(s, "1425", deps);
  handleFlow(s, "0km", deps);
  const reply = handleFlow(s, "9", deps) ?? "";
  assert.match(reply, /No te entendí el plan/);
  assert.equal(s.stage, "quoting_auto", "sigue esperando el plan");
  assert.equal(deps.savedLeads.length, 0, "no guarda lead con plan inválido");
});

test("la palabra 'asesor' deriva a un humano desde cualquier punto", () => {
  const s = newSession("t-asesor");
  const deps = fakeDeps();
  handleFlow(s, "hola", deps);
  handleFlow(s, "1", deps);
  const reply = handleFlow(s, "asesor", deps) ?? "";
  assert.match(reply, /asesor/i);
  assert.equal(s.stage, "idle");
});

test("una consulta abierta desde el menú se delega al LLM (devuelve null)", () => {
  const s = newSession("t-abierta");
  const deps = fakeDeps();
  handleFlow(s, "hola", deps);
  const reply = handleFlow(s, "¿el seguro cubre granizo?", deps);
  assert.equal(reply, null, "null indica que responde el LLM");
});

test("el funnel registra los eventos clave a través del EventSink inyectado", () => {
  const s = newSession("t-eventos");
  const deps = fakeDeps();
  handleFlow(s, "hola", deps);
  handleFlow(s, "1", deps);
  const tipos = deps.events.logged.map((e) => e.type);
  assert.ok(tipos.includes("conversation_started"));
  assert.ok(tipos.includes("quote_started"));
});
