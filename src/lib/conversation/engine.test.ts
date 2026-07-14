import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { eventsFile } from "../analytics/events.js";
import type { AnalyticsEvent, Dependencies, Lead, LeadInput } from "../application/ports.js";
import { leadsFile } from "../leads/store.js";
import { processMessage } from "./engine.js";

function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as T);
}

test("un usuario nuevo que saluda recibe el menú", async () => {
  const reply = await processMessage({ from: "e-nuevo", text: "hola", name: "Ana" });
  assert.match(reply, /Cotizar mi seguro de auto/);
});

test("una consulta abierta sin API key cae al fallback del LLM", async () => {
  const from = "e-llm";
  // El primer mensaje siempre muestra el menú; recién el segundo (texto libre
  // que no matchea ningún menú) se delega al LLM.
  await processMessage({ from, text: "hola", name: "Beto" });
  const reply = await processMessage({ from, text: "¿qué es la franquicia?", name: "Beto" });
  assert.match(reply, /ANTHROPIC_API_KEY|clave del modelo/);
});

test("completar la cotización persiste el lead en disco", async () => {
  const from = "e-lead";
  for (const text of ["hola", "1", "Toyota Corolla 2020", "3011", "usado", "2"]) {
    await processMessage({ from, text, name: "Caro" });
  }
  const leads = readJsonl<Lead>(leadsFile);
  const mine = leads.filter((l) => l.userId === from);
  assert.equal(mine.length, 1, "debería haber exactamente un lead");
  assert.equal(mine[0]?.plan, "Terceros Completo con Granizo");
  assert.equal(mine[0]?.cp, "3011");
});

test("el funnel registra el evento lead_captured", async () => {
  const from = "e-evento";
  for (const text of ["hola", "1", "VW Gol 2019", "1425", "0km", "1"]) {
    await processMessage({ from, text, name: "Dani" });
  }
  const events = readJsonl<AnalyticsEvent>(eventsFile);
  const captured = events.filter((e) => e.userId === from && e.type === "lead_captured");
  assert.equal(captured.length, 1);
  assert.equal(captured[0]?.props?.plan, "Terceros Completo");
});

test("processMessage acepta dependencias inyectadas (sin tocar disco)", async () => {
  const savedLeads: LeadInput[] = [];
  const deps: Dependencies = {
    leads: { save: (lead) => savedLeads.push(lead) },
    events: { log: () => {} },
  };
  for (const text of ["hola", "1", "Peugeot 208 2022", "5000", "0km", "3"]) {
    await processMessage({ from: "e-inject", text, name: "Eze" }, deps);
  }
  assert.equal(savedLeads.length, 1);
  assert.equal(savedLeads[0]?.plan, "Todo Riesgo con Franquicia");
});

test("las sesiones de distintos usuarios no se mezclan", async () => {
  // A queda a mitad de una cotización.
  await processMessage({ from: "e-a", text: "hola", name: "A" });
  await processMessage({ from: "e-a", text: "1", name: "A" });
  await processMessage({ from: "e-a", text: "Fiat Cronos 2021", name: "A" });
  // B arranca de cero y no afecta a A.
  const bReply = await processMessage({ from: "e-b", text: "hola", name: "B" });
  assert.match(bReply, /Cotizar mi seguro de auto/);
  // A retoma donde estaba: le toca informar la condición del auto.
  const aReply = await processMessage({ from: "e-a", text: "3011", name: "A" });
  assert.match(aReply, /0 km.*usado|usado/i);
});
