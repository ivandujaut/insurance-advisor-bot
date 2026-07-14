import assert from "node:assert/strict";
import { test } from "node:test";
import { handleFlow } from "./flows.js";
import type { Session } from "./session.js";

function newSession(userId: string): Session {
  return { userId, stage: "idle", data: {}, history: [] };
}

test("un saludo muestra el menú principal y pasa a main_menu", () => {
  const s = newSession("t-hola");
  const reply = handleFlow(s, "hola");
  assert.ok(reply, "debería devolver una respuesta");
  assert.match(reply, /Cotizar mi seguro de auto/);
  assert.equal(s.stage, "main_menu");
});

test("opción 1 arranca la cotización de auto", () => {
  const s = newSession("t-cotizar");
  handleFlow(s, "hola");
  const reply = handleFlow(s, "1");
  assert.match(reply ?? "", /marca, modelo y año/);
  assert.equal(s.stage, "quoting_auto");
});

test("opción 2 muestra la comparación de los tres planes", () => {
  const s = newSession("t-comparar");
  handleFlow(s, "hola");
  const reply = handleFlow(s, "2") ?? "";
  assert.match(reply, /Terceros Completo/);
  assert.match(reply, /Terceros Completo con Granizo/);
  assert.match(reply, /Todo Riesgo con Franquicia/);
  // Es informativo: el usuario sigue en el menú.
  assert.equal(s.stage, "main_menu");
});

test("el flujo de cotización completo termina en un resumen con el plan elegido", () => {
  const s = newSession("t-flujo");
  handleFlow(s, "hola");
  handleFlow(s, "1");
  handleFlow(s, "Toyota Corolla 2020");
  handleFlow(s, "3011");
  handleFlow(s, "usado");
  const final = handleFlow(s, "2") ?? "";
  assert.match(final, /solicitud de cotización/);
  assert.match(final, /Terceros Completo con Granizo/);
  assert.match(final, /3011/);
  assert.equal(s.stage, "idle", "vuelve a idle al terminar");
});

test("auto usado dispara la nota de inspección online", () => {
  const s = newSession("t-usado");
  handleFlow(s, "hola");
  handleFlow(s, "1");
  handleFlow(s, "Ford Ka 2018");
  handleFlow(s, "3011");
  const reply = handleFlow(s, "usado") ?? "";
  assert.match(reply, /inspección se hace online/);
});

test("un plan inválido pide reintentar sin romper el flujo", () => {
  const s = newSession("t-plan-invalido");
  handleFlow(s, "hola");
  handleFlow(s, "1");
  handleFlow(s, "Fiat Cronos 2021");
  handleFlow(s, "1425");
  handleFlow(s, "0km");
  const reply = handleFlow(s, "9") ?? "";
  assert.match(reply, /No te entendí el plan/);
  assert.equal(s.stage, "quoting_auto", "sigue esperando el plan");
});

test("la palabra 'asesor' deriva a un humano desde cualquier punto", () => {
  const s = newSession("t-asesor");
  handleFlow(s, "hola");
  handleFlow(s, "1");
  const reply = handleFlow(s, "asesor") ?? "";
  assert.match(reply, /asesor/i);
  assert.equal(s.stage, "idle");
});

test("una consulta abierta desde el menú se delega al LLM (devuelve null)", () => {
  const s = newSession("t-abierta");
  handleFlow(s, "hola");
  const reply = handleFlow(s, "¿el seguro cubre granizo?");
  assert.equal(reply, null, "null indica que responde el LLM");
});
