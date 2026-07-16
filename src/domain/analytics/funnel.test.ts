import assert from "node:assert/strict";
import { test } from "node:test";
import type { AnalyticsEvent, AutoLead } from "../../application/ports.js";
import { computeFunnel } from "./funnel.js";

function ev(type: AnalyticsEvent["type"], userId: string, step?: string): AnalyticsEvent {
  return { ts: "2026-07-15T00:00:00.000Z", type, userId, props: step ? { step } : undefined };
}

function autoLead(userId: string, plan: string): AutoLead {
  return {
    ts: "2026-07-15T00:00:00.000Z",
    userId,
    producto: "auto",
    plan,
    anio: "2020",
    marca: "Toyota",
    modelo: "Corolla",
    gnc: false,
    cp: "1000",
    condicion: "usado",
  };
}

test("computeFunnel: activación y tasas por usuarios únicos", () => {
  const events: AnalyticsEvent[] = [
    ev("conversation_started", "a"),
    ev("conversation_started", "b"),
    ev("conversation_started", "c"),
    ev("quote_started", "a"),
    ev("quote_started", "b"),
    ev("lead_captured", "a"),
    ev("quote_accepted", "a"),
    // un mismo usuario no infla el conteo:
    ev("conversation_started", "a"),
  ];
  const r = computeFunnel(events, []);
  assert.equal(r.saludan, 3);
  assert.equal(r.arrancan, 2);
  assert.equal(r.arrancanTasa, "67%"); // 2/3
  assert.equal(r.completan, 1);
  assert.equal(r.completanTasa, "50%"); // 1/2
  assert.equal(r.aceptan, 1);
  assert.equal(r.aceptanTasa, "100%"); // 1/1 de los que cotizaron
});

test("computeFunnel: drop-off por paso y otras señales", () => {
  const events: AnalyticsEvent[] = [
    ev("quote_step", "a", "anio"),
    ev("quote_step", "b", "anio"),
    ev("quote_step", "a", "cp"),
    ev("open_question", "a"),
    ev("open_question", "b"),
    ev("faq_hit", "a"),
    ev("advisor_requested", "b"),
  ];
  const r = computeFunnel(events, []);
  assert.equal(r.pasos.find((p) => p.paso === "anio")?.count, 2);
  assert.equal(r.pasos.find((p) => p.paso === "cp")?.count, 1);
  assert.equal(r.pasos.find((p) => p.paso === "modelo")?.count, 0);
  assert.equal(r.consultasAbiertas, 2);
  assert.equal(r.resueltasFaq, 1);
  assert.equal(r.resueltasFaqTasa, "50%"); // 1 de 2 consultas abiertas
  assert.equal(r.pedidosAsesor, 1);
});

test("computeFunnel: mix de plan ordenado por cantidad", () => {
  const leads: AutoLead[] = [
    autoLead("a", "Terceros Completo"),
    autoLead("b", "Todo Riesgo con Franquicia"),
    autoLead("c", "Todo Riesgo con Franquicia"),
  ];
  const r = computeFunnel([ev("conversation_started", "a")], leads);
  assert.equal(r.mixPlan[0]?.plan, "Todo Riesgo con Franquicia");
  assert.equal(r.mixPlan[0]?.count, 2);
  assert.equal(r.mixPlan[0]?.tasa, "67%"); // 2/3
  assert.equal(r.mixPlan[1]?.plan, "Terceros Completo");
});

test("computeFunnel: sin datos devuelve ceros y tasas vacías", () => {
  const r = computeFunnel([], []);
  assert.equal(r.totalEventos, 0);
  assert.equal(r.saludan, 0);
  assert.equal(r.arrancanTasa, "-");
  assert.equal(r.mixPlan.length, 0);
});
