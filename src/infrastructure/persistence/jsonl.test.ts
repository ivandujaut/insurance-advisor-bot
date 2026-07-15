import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { createJsonlEventSink, eventsFile } from "./jsonl-events.js";
import { createJsonlLeadRepository, leadsFile } from "./jsonl-leads.js";

function readLines(path: string): Array<Record<string, unknown>> {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as Record<string, unknown>);
}

test("el LeadRepository JSONL persiste el lead en disco con timestamp", async () => {
  const repo = createJsonlLeadRepository();
  await repo.save({
    producto: "auto",
    userId: "adapter-lead",
    name: "X",
    anio: "2020",
    marca: "Toyota",
    modelo: "Corolla",
    version: "XEI",
    gnc: false,
    cp: "1000",
    condicion: "usado",
    plan: "Terceros Completo",
  });
  const mine = readLines(leadsFile).filter((l) => l.userId === "adapter-lead");
  assert.equal(mine.length, 1);
  assert.equal(mine[0]?.producto, "auto");
  assert.equal(mine[0]?.plan, "Terceros Completo");
  assert.ok(mine[0]?.ts, "el adapter agrega el timestamp");
});

test("el LeadRepository JSONL persiste un lead de hogar", async () => {
  const repo = createJsonlLeadRepository();
  await repo.save({
    producto: "hogar",
    userId: "adapter-hogar",
    name: "Y",
    tipoResidente: "inquilino",
    tipoHogar: "departamento",
    uso: "permanente",
    cp: "1425",
    sumaContenido: 2000000,
    plan: "Seguro de Hogar",
  });
  const mine = readLines(leadsFile).filter((l) => l.userId === "adapter-hogar");
  assert.equal(mine.length, 1);
  assert.equal(mine[0]?.producto, "hogar");
  assert.equal(mine[0]?.sumaContenido, 2000000);
});

test("el LeadRepository JSONL persiste un lead de accidentes personales", async () => {
  const repo = createJsonlLeadRepository();
  await repo.save({
    producto: "accidentes",
    userId: "adapter-ap",
    name: "Z",
    modalidad: "familiar",
    plan: "Plan A",
    precio: 9124,
  });
  const mine = readLines(leadsFile).filter((l) => l.userId === "adapter-ap");
  assert.equal(mine.length, 1);
  assert.equal(mine[0]?.producto, "accidentes");
  assert.equal(mine[0]?.precio, 9124);
});

test("el EventSink JSONL persiste el evento en disco", async () => {
  const sink = createJsonlEventSink();
  await sink.log("lead_captured", "adapter-evt", { plan: "Terceros Completo" });
  const mine = readLines(eventsFile).filter((e) => e.userId === "adapter-evt");
  assert.equal(mine.length, 1);
  assert.equal(mine[0]?.type, "lead_captured");
});
