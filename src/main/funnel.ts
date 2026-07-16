/**
 * Reporte de funnel por consola, a partir de los eventos y leads registrados.
 * Usa la misma lógica pura (`computeFunnel`) que el dashboard web (GET /funnel);
 * acá solo cambia la presentación (texto en vez de HTML).
 *
 *   pnpm funnel
 */
import { computeFunnel } from "../domain/analytics/funnel.js";
import { createJsonlAnalyticsReader } from "../infrastructure/persistence/jsonl-analytics.js";

const analytics = createJsonlAnalyticsReader();
const [events, leads] = await Promise.all([analytics.readEvents(), analytics.readLeads()]);

if (events.length === 0) {
  console.log(
    "No hay eventos todavía. Generá conversaciones con `pnpm chat` y volvé a correr esto.",
  );
  process.exit(0);
}

const r = computeFunnel(events, leads);

console.log("\n📊 Funnel del bot\n");
console.log("Etapa                     Usuarios   Tasa");
console.log("------------------------  --------   ----");
console.log(`Saludan                   ${String(r.saludan).padEnd(8)}   -`);
console.log(`Arrancan a cotizar        ${String(r.arrancan).padEnd(8)}   ${r.arrancanTasa}`);
console.log(`Completan (lead)          ${String(r.completan).padEnd(8)}   ${r.completanTasa}`);

console.log("\n🔎 Pasos de la cotización (eventos)");
for (const paso of r.pasos) {
  console.log(`  ${paso.paso.padEnd(12)} ${paso.count}`);
}

if (r.mixPlan.length > 0) {
  console.log("\n🛡️  Mix de plan (leads)");
  for (const m of r.mixPlan) {
    console.log(`  ${m.plan.padEnd(32)} ${m.count} (${m.tasa})`);
  }
}

if (r.emociones.length > 0) {
  console.log("\n🙂 Emociones (consultas abiertas)");
  for (const e of r.emociones) {
    console.log(`  ${e.emocion.padEnd(14)} ${e.count} (${e.tasa})`);
  }
}

console.log("\n💬 Otras señales");
console.log(`  Consultas abiertas (LLM)  ${r.consultasAbiertas}`);
console.log(`  Pedidos de asesor         ${r.pedidosAsesor}`);
console.log("");
