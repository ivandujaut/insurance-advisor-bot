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
    // handleFlow nunca llama al LLM ni al clasificador (eso es del engine); stubs.
    llm: { generate: async () => "" },
    emotion: { classify: async () => "neutral" },
    // handleFlow tampoco toca el store de sesiones (recibe la sesión directa); stub.
    sessions: { get: async () => undefined, save: async () => {} },
    knowledge: { load: async () => "" },
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

test("opción 2 arranca la cotización de hogar", async () => {
  const s = newSession("t-hogar");
  const deps = fakeDeps();
  await handleFlow(s, "hola", deps);
  const reply = (await handleFlow(s, "2", deps)) ?? "";
  assert.match(reply, /propietario/i);
  assert.equal(s.stage, "quoting_hogar");
});

test("opción 3 arranca accidentes personales", async () => {
  const s = newSession("t-ap");
  const deps = fakeDeps();
  await handleFlow(s, "hola", deps);
  const reply = (await handleFlow(s, "3", deps)) ?? "";
  assert.match(reply, /familiar/i);
  assert.equal(s.stage, "quoting_accidentes");
});

test("el flujo de accidentes guarda el lead con el precio publicado", async () => {
  const s = newSession("t-ap-full");
  const deps = fakeDeps();
  await handleFlow(s, "hola", deps);
  await handleFlow(s, "3", deps); // accidentes personales
  const planes = (await handleFlow(s, "1", deps)) ?? ""; // modalidad familiar -> lista planes
  assert.match(planes, /Plan B/);
  assert.match(planes, /14\.176/);
  const final = (await handleFlow(s, "2", deps)) ?? ""; // Plan B
  assert.match(final, /accidentes personales/i);
  assert.equal(s.stage, "idle");
  const lead = deps.savedLeads[0];
  assert.equal(lead?.producto, "accidentes");
  if (lead?.producto !== "accidentes") throw new Error("esperaba un lead de accidentes");
  assert.equal(lead.modalidad, "familiar");
  assert.equal(lead.plan, "Plan B");
  assert.equal(lead.precio, 14176);
});

test("opción 4 arranca la cotización de bici o monopatín", async () => {
  const s = newSession("t-bici");
  const deps = fakeDeps();
  await handleFlow(s, "hola", deps);
  const reply = (await handleFlow(s, "4", deps)) ?? "";
  assert.match(reply, /bicicleta|monopat/i);
  assert.equal(s.stage, "quoting_bici");
});

test("el flujo de bici guarda el lead con el valor y la cuota estimada", async () => {
  const s = newSession("t-bici-full");
  const deps = fakeDeps();
  await handleFlow(s, "hola", deps);
  await handleFlow(s, "4", deps); // bici
  await handleFlow(s, "bicicleta", deps); // tipo de rodado
  const final = (await handleFlow(s, "500000", deps)) ?? ""; // valor
  assert.match(final, /Cuota estimada/);
  assert.equal(s.stage, "idle");
  const lead = deps.savedLeads[0];
  assert.equal(lead?.producto, "bici");
  if (lead?.producto !== "bici") throw new Error("esperaba un lead de bici");
  assert.equal(lead.tipoRodado, "bicicleta");
  assert.equal(lead.valor, 500000);
});

test("opción 5 muestra la comparación de los tres planes", async () => {
  const s = newSession("t-comparar");
  const deps = fakeDeps();
  await handleFlow(s, "hola", deps);
  const reply = (await handleFlow(s, "5", deps)) ?? "";
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
  assert.equal(lead?.producto, "auto");
  if (lead?.producto !== "auto") throw new Error("esperaba un lead de auto");
  assert.equal(lead.plan, "Terceros Completo con Granizo");
  assert.equal(lead.anio, "2020");
  assert.equal(lead.marca, "Toyota");
  assert.equal(lead.modelo, "Corolla");
  assert.equal(lead.version, "XEI");
  assert.equal(lead.gnc, false);
  assert.equal(lead.condicion, "usado");
  assert.equal(lead.cp, "3011");
});

test('GNC: responder "no tiene" queda como sin GNC (no se invierte)', async () => {
  const s = newSession("t-gnc");
  const deps = fakeDeps();
  await handleFlow(s, "hola", deps);
  await handleFlow(s, "1", deps);
  await handleFlow(s, "2020", deps);
  await handleFlow(s, "usado", deps);
  await handleFlow(s, "Toyota", deps);
  await handleFlow(s, "Corolla", deps);
  await handleFlow(s, "XEI", deps);
  await handleFlow(s, "no tiene", deps); // GNC: negación con la palabra "tiene"
  await handleFlow(s, "3011", deps);
  await handleFlow(s, "1", deps);
  const lead = deps.savedLeads[0];
  if (lead?.producto !== "auto") throw new Error("esperaba un lead de auto");
  assert.equal(lead.gnc, false, '"no tiene" debe ser gnc=false');
});

test("si falla el guardado del lead, NO confirma la solicitud", async () => {
  const s = newSession("t-savefail");
  const deps = fakeDeps();
  deps.leads.save = async () => {
    throw new Error("base caída");
  };
  await handleFlow(s, "hola", deps);
  await handleFlow(s, "1", deps);
  await handleFlow(s, "2020", deps);
  await handleFlow(s, "usado", deps);
  await handleFlow(s, "Toyota", deps);
  await handleFlow(s, "Corolla", deps);
  await handleFlow(s, "no sé", deps);
  await handleFlow(s, "no", deps);
  await handleFlow(s, "3011", deps);
  const final = (await handleFlow(s, "1", deps)) ?? "";
  assert.match(final, /problema para registrar/);
  assert.doesNotMatch(final, /solicitud de cotización/);
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

test("el flujo de hogar de propietario estima con el m² (sin pedir contenido)", async () => {
  const s = newSession("t-hogar-prop");
  const deps = fakeDeps();
  await handleFlow(s, "hola", deps);
  await handleFlow(s, "2", deps); // cotizar hogar
  await handleFlow(s, "propietario", deps);
  await handleFlow(s, "casa", deps); // tipo de hogar
  await handleFlow(s, "permanente", deps); // uso
  await handleFlow(s, "120", deps); // m² (solo propietario)
  const final = (await handleFlow(s, "1425", deps)) ?? ""; // CP -> estima ya (no pide contenido)
  assert.match(final, /seguro de hogar/i);
  assert.match(final, /Estimación orientativa/);
  assert.match(final, /120 m²/);
  assert.doesNotMatch(final, /Contenido asegurado/, "al propietario no le pide contenido");
  assert.equal(s.stage, "idle", "vuelve a idle al terminar");
  assert.equal(deps.savedLeads.length, 1);
  const lead = deps.savedLeads[0];
  assert.equal(lead?.producto, "hogar");
  if (lead?.producto !== "hogar") throw new Error("esperaba un lead de hogar");
  assert.equal(lead.tipoResidente, "propietario");
  assert.equal(lead.tipoHogar, "casa");
  assert.equal(lead.uso, "permanente");
  assert.equal(lead.m2, 120);
  assert.equal(lead.cp, "1425");
  assert.equal(lead.sumaContenido, undefined, "el propietario no da contenido");
  assert.equal(lead.plan, "Seguro de Hogar");
});

test("el flujo de hogar de inquilino usa el contenido (sin m²)", async () => {
  const s = newSession("t-hogar-inq-full");
  const deps = fakeDeps();
  await handleFlow(s, "hola", deps);
  await handleFlow(s, "2", deps);
  await handleFlow(s, "inquilino", deps);
  await handleFlow(s, "departamento", deps); // tipo de hogar
  await handleFlow(s, "permanente", deps); // uso -> salta m², pide CP
  await handleFlow(s, "1425", deps); // CP -> pide contenido
  const final = (await handleFlow(s, "2000000", deps)) ?? ""; // contenido -> estima
  assert.match(final, /Contenido asegurado/);
  assert.equal(s.stage, "idle");
  assert.equal(deps.savedLeads.length, 1);
  const lead = deps.savedLeads[0];
  assert.equal(lead?.producto, "hogar");
  if (lead?.producto !== "hogar") throw new Error("esperaba un lead de hogar");
  assert.equal(lead.tipoResidente, "inquilino");
  assert.equal(lead.sumaContenido, 2000000);
  assert.equal(lead.m2, undefined, "el inquilino no da m²");
});

test("hogar: al inquilino no le pide m² (no asegura el edificio)", async () => {
  const s = newSession("t-hogar-inq");
  const deps = fakeDeps();
  await handleFlow(s, "hola", deps);
  await handleFlow(s, "2", deps);
  await handleFlow(s, "inquilino", deps);
  await handleFlow(s, "departamento", deps); // tipo de hogar
  const reply = (await handleFlow(s, "permanente", deps)) ?? ""; // uso -> salta m², pide CP
  assert.match(reply, /código postal/i);
  assert.equal(s.data.m2, undefined, "no le pide m² al inquilino");
});

test("hogar pide m² válidos a propietario y rechaza fuera de rango", async () => {
  const s = newSession("t-hogar-m2");
  const deps = fakeDeps();
  await handleFlow(s, "hola", deps);
  await handleFlow(s, "2", deps);
  await handleFlow(s, "propietario", deps);
  await handleFlow(s, "casa", deps);
  await handleFlow(s, "permanente", deps);
  const reply = (await handleFlow(s, "1000", deps)) ?? ""; // 1000 m² fuera de rango
  assert.match(reply, /25 y 300/);
  assert.equal(s.data.m2, undefined, "no guarda m² inválidos");
  assert.equal(s.stage, "quoting_hogar");
});

test("hogar rechaza una suma de contenido demasiado baja y no guarda lead", async () => {
  const s = newSession("t-hogar-suma");
  const deps = fakeDeps();
  await handleFlow(s, "hola", deps);
  await handleFlow(s, "2", deps);
  await handleFlow(s, "inquilino", deps);
  await handleFlow(s, "departamento", deps);
  await handleFlow(s, "permanente", deps); // uso
  await handleFlow(s, "1425", deps); // CP (inquilino no da m²)
  const reply = (await handleFlow(s, "1000", deps)) ?? "";
  assert.match(reply, /contenido/i);
  assert.equal(s.data.sumaContenido, undefined, "no guarda una suma inválida");
  assert.equal(s.stage, "quoting_hogar", "sigue esperando la suma");
  assert.equal(deps.savedLeads.length, 0);
});
