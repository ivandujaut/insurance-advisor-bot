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
    quoting: {
      quote: async (input) => ({ plan: input.plan, desde: 10000, hasta: 15000, moneda: "ARS" }),
    },
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
  assert.match(reply ?? "", /año/i);
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
  await handleFlow(s, "2020", deps); // año
  await handleFlow(s, "usado", deps); // condición
  await handleFlow(s, "Toyota", deps);
  await handleFlow(s, "Corolla", deps);
  await handleFlow(s, "XEI", deps); // versión
  await handleFlow(s, "no", deps); // GNC
  await handleFlow(s, "3011", deps); // CP
  const final = (await handleFlow(s, "2", deps)) ?? "";
  assert.match(final, /solicitud de cotización/);
  assert.match(final, /Terceros Completo con Granizo/);
  assert.equal(s.stage, "idle", "vuelve a idle al terminar");
  // El lead se guardó estructurado, a través del puerto inyectado (sin tocar disco).
  assert.equal(deps.savedLeads.length, 1);
  const lead = deps.savedLeads[0];
  assert.equal(lead?.plan, "Terceros Completo con Granizo");
  assert.equal(lead?.anio, "2020");
  assert.equal(lead?.marca, "Toyota");
  assert.equal(lead?.modelo, "Corolla");
  assert.equal(lead?.version, "XEI");
  assert.equal(lead?.gnc, false);
  assert.equal(lead?.condicion, "usado");
  assert.equal(lead?.cp, "3011");
});

test("auto usado dispara la nota de inspección online", async () => {
  const s = newSession("t-usado");
  const deps = fakeDeps();
  await handleFlow(s, "hola", deps);
  await handleFlow(s, "1", deps);
  await handleFlow(s, "2018", deps); // año
  await handleFlow(s, "usado", deps); // condición
  await handleFlow(s, "Ford", deps);
  await handleFlow(s, "Ka", deps);
  await handleFlow(s, "no sé", deps); // versión salteada
  await handleFlow(s, "no", deps); // GNC
  const reply = (await handleFlow(s, "3011", deps)) ?? ""; // CP -> muestra la nota
  assert.match(reply, /inspección se hace online/);
});

test("un 0km de un año anterior no pide inspección (condición explícita, no derivada del año)", async () => {
  const s = newSession("t-0km-viejo");
  const deps = fakeDeps();
  await handleFlow(s, "hola", deps);
  await handleFlow(s, "1", deps);
  await handleFlow(s, "2023", deps); // año anterior...
  await handleFlow(s, "0km", deps); // ...pero es 0km de stock
  await handleFlow(s, "Fiat", deps);
  await handleFlow(s, "Cronos", deps);
  await handleFlow(s, "no sé", deps); // versión
  await handleFlow(s, "no", deps); // GNC
  const reply = (await handleFlow(s, "1425", deps)) ?? ""; // CP -> muestra la nota
  assert.match(reply, /0 km, no necesitás inspección/);
  assert.equal(s.data.condicion, "0km");
});

test("no acepta una condición ambigua y la vuelve a pedir", async () => {
  const s = newSession("t-cond-invalida");
  const deps = fakeDeps();
  await handleFlow(s, "hola", deps);
  await handleFlow(s, "1", deps);
  await handleFlow(s, "2020", deps);
  const reply = (await handleFlow(s, "no sé", deps)) ?? "";
  assert.match(reply, /0km.*usado/i);
  assert.equal(s.data.condicion, undefined, "no guarda una condición ambigua");
  assert.equal(s.stage, "quoting_auto", "sigue esperando la condición");
});

test("un plan inválido pide reintentar sin romper el flujo", async () => {
  const s = newSession("t-plan-invalido");
  const deps = fakeDeps();
  await handleFlow(s, "hola", deps);
  await handleFlow(s, "1", deps);
  await handleFlow(s, "2021", deps);
  await handleFlow(s, "usado", deps); // condición
  await handleFlow(s, "Fiat", deps);
  await handleFlow(s, "Cronos", deps);
  await handleFlow(s, "no sé", deps);
  await handleFlow(s, "sí", deps); // GNC
  await handleFlow(s, "1425", deps); // CP
  const reply = (await handleFlow(s, "9", deps)) ?? "";
  assert.match(reply, /No te entendí el plan/);
  assert.equal(s.stage, "quoting_auto", "sigue esperando el plan");
  assert.equal(deps.savedLeads.length, 0, "no guarda lead con plan inválido");
});

test("rechaza un año fuera de rango y lo vuelve a pedir", async () => {
  const s = newSession("t-anio-invalido");
  const deps = fakeDeps();
  await handleFlow(s, "hola", deps);
  await handleFlow(s, "1", deps);
  const reply = (await handleFlow(s, "1990", deps)) ?? "";
  assert.match(reply, /año.*válido/i);
  assert.equal(s.stage, "quoting_auto", "sigue esperando el año");
  assert.equal(s.data.anio, undefined, "no guarda el año inválido");
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
