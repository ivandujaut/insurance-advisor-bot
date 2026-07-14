/**
 * Reporte de funnel a partir de los eventos registrados.
 * Lee data/events.jsonl y data/leads.jsonl y arma las métricas del caso de
 * estudio: activación, drop-off por paso y mix de plan.
 *
 *   pnpm funnel
 */
import { existsSync, readFileSync } from "node:fs";
import type { AnalyticsEvent, Lead } from "../application/ports.js";
import { eventsFile } from "../infrastructure/persistence/jsonl-events.js";
import { leadsFile } from "../infrastructure/persistence/jsonl-leads.js";

function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as T);
}

/** Usuarios únicos que dispararon un tipo de evento. */
function uniqueUsers(events: AnalyticsEvent[], type: AnalyticsEvent["type"]): number {
  const users = new Set(events.filter((e) => e.type === type).map((e) => e.userId));
  return users.size;
}

function pct(part: number, total: number): string {
  if (total === 0) return "-";
  return `${Math.round((part / total) * 100)}%`;
}

const events = readJsonl<AnalyticsEvent>(eventsFile);
const leads = readJsonl<Lead>(leadsFile);

if (events.length === 0) {
  console.log(
    "No hay eventos todavía. Generá conversaciones con `pnpm chat` y volvé a correr esto.",
  );
  process.exit(0);
}

const started = uniqueUsers(events, "conversation_started");
const quoting = uniqueUsers(events, "quote_started");
const leadUsers = uniqueUsers(events, "lead_captured");

console.log("\n📊 Funnel del bot\n");
console.log("Etapa                     Usuarios   Tasa");
console.log("------------------------  --------   ----");
console.log(`Saludan                   ${String(started).padEnd(8)}   -`);
console.log(`Arrancan a cotizar        ${String(quoting).padEnd(8)}   ${pct(quoting, started)}`);
console.log(
  `Completan (lead)          ${String(leadUsers).padEnd(8)}   ${pct(leadUsers, quoting)}`,
);

// Drop-off por paso de la cotización.
const steps = ["anio", "marca", "modelo", "version", "gnc", "cp"] as const;
console.log("\n🔎 Pasos de la cotización (eventos)");
for (const step of steps) {
  const count = events.filter((e) => e.type === "quote_step" && e.props?.step === step).length;
  console.log(`  ${step.padEnd(12)} ${count}`);
}

// Mix de plan a partir de los leads.
if (leads.length > 0) {
  console.log("\n🛡️  Mix de plan (leads)");
  const byPlan = new Map<string, number>();
  for (const lead of leads) {
    byPlan.set(lead.plan, (byPlan.get(lead.plan) ?? 0) + 1);
  }
  for (const [plan, count] of byPlan) {
    console.log(`  ${plan.padEnd(32)} ${count} (${pct(count, leads.length)})`);
  }
}

// Otras señales.
const openQuestions = events.filter((e) => e.type === "open_question").length;
const advisor = events.filter((e) => e.type === "advisor_requested").length;
console.log("\n💬 Otras señales");
console.log(`  Consultas abiertas (LLM)  ${openQuestions}`);
console.log(`  Pedidos de asesor         ${advisor}`);
console.log("");
