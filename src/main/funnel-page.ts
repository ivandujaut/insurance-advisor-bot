/**
 * Dashboard HTML del funnel del bot, para mostrarlo en una URL (GET /funnel) en
 * vez de solo por CLI. Autocontenido (sin assets externos). Recibe el reporte ya
 * calculado; acá solo se presenta.
 */
import { config } from "../config/index.js";
import type { FunnelReport } from "../domain/analytics/funnel.js";

// Identidad white-label: con BRAND_NAME el titulo la nombra; sin marca, neutro.
const NOMBRE_FUNNEL = config.brand.name
  ? `Asistente de ${config.brand.name}`
  : "Asistente de seguros";

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);
}

/** Barra de una etapa del funnel, con ancho proporcional al tope (saludan). */
function etapa(nombre: string, valor: number, tope: number, tasa: string): string {
  const ancho = tope > 0 ? Math.max(4, Math.round((valor / tope) * 100)) : 0;
  return `<div class="etapa">
    <div class="etapa-top"><span>${esc(nombre)}</span><span class="n">${valor}${tasa !== "-" ? ` · <b>${tasa}</b>` : ""}</span></div>
    <div class="bar"><div class="fill" style="width:${ancho}%"></div></div>
  </div>`;
}

export function renderFunnelHtml(r: FunnelReport): string {
  const vacio = r.totalEventos === 0;

  const pasos = r.pasos
    .map((p) => `<tr><td>${esc(p.paso)}</td><td class="num">${p.count}</td></tr>`)
    .join("");

  const mix = r.mixPlan.length
    ? r.mixPlan
        .map(
          (m) =>
            `<tr><td>${esc(m.plan)}</td><td class="num">${m.count}</td><td class="num">${m.tasa}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="3" class="muted">Todavía no hay leads.</td></tr>`;

  const emociones = r.emociones.length
    ? r.emociones
        .map(
          (e) =>
            `<tr><td>${esc(e.emocion)}</td><td class="num">${e.count}</td><td class="num">${e.tasa}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="3" class="muted">Todavía no hay consultas abiertas.</td></tr>`;

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Funnel · ${NOMBRE_FUNNEL} (demo)</title>
<style>
  :root { --rojo:#c8102e; --bg:#f4f5f7; --card:#fff; --texto:#111b21; --muted:#667781; --linea:#e6e8eb; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif; background:var(--bg); color:var(--texto); }
  .wrap { max-width:720px; margin:0 auto; padding:0 16px 40px; }
  header { background:var(--rojo); color:#fff; padding:20px 16px; }
  header .in { max-width:720px; margin:0 auto; }
  header h1 { margin:0; font-size:20px; }
  header p { margin:4px 0 0; font-size:13px; opacity:.9; }
  .card { background:var(--card); border:1px solid var(--linea); border-radius:12px; padding:18px 20px; margin-top:18px; }
  .card h2 { margin:0 0 14px; font-size:15px; letter-spacing:.02em; text-transform:uppercase; color:var(--muted); }
  .etapa { margin:12px 0; }
  .etapa-top { display:flex; justify-content:space-between; font-size:14.5px; margin-bottom:5px; }
  .etapa-top .n { color:var(--muted); }
  .etapa-top .n b { color:var(--rojo); }
  .bar { height:12px; background:var(--bg); border-radius:6px; overflow:hidden; }
  .fill { height:100%; background:var(--rojo); border-radius:6px; }
  table { width:100%; border-collapse:collapse; font-size:14.5px; }
  th, td { text-align:left; padding:8px 6px; border-bottom:1px solid var(--linea); }
  th { font-size:12px; text-transform:uppercase; letter-spacing:.03em; color:var(--muted); font-weight:600; }
  td.num, th.num { text-align:right; font-variant-numeric:tabular-nums; }
  .muted { color:var(--muted); }
  .señales { display:flex; gap:14px; flex-wrap:wrap; }
  .señal { flex:1; min-width:140px; background:var(--bg); border-radius:10px; padding:12px 14px; }
  .señal .v { font-size:24px; font-weight:700; }
  .señal .k { font-size:12.5px; color:var(--muted); }
  .foot { text-align:center; color:var(--muted); font-size:12px; margin-top:20px; }
  .empty { text-align:center; color:var(--muted); padding:30px 10px; }
</style>
</head>
<body>
<header><div class="in">
  <h1>Funnel del bot</h1>
  <p>${NOMBRE_FUNNEL} · demo · ${r.totalEventos} eventos registrados</p>
</div></header>
<div class="wrap">
${
  vacio
    ? `<div class="card"><div class="empty">Todavía no hay actividad. Probá la <a href="/">demo</a> y volvé a esta página.</div></div>`
    : `
  <div class="card">
    <h2>Embudo</h2>
    ${etapa("Saludan", r.saludan, r.saludan, "-")}
    ${etapa("Arrancan a cotizar", r.arrancan, r.saludan, r.arrancanTasa)}
    ${etapa("Completan (lead)", r.completan, r.saludan, r.completanTasa)}
    ${etapa("Aceptan (asesor/online)", r.aceptan, r.saludan, r.aceptanTasa)}
  </div>

  <div class="card">
    <h2>Pasos de la cotización de auto</h2>
    <table>
      <thead><tr><th>Paso</th><th class="num">Eventos</th></tr></thead>
      <tbody>${pasos}</tbody>
    </table>
  </div>

  <div class="card">
    <h2>Mix de plan (leads)</h2>
    <table>
      <thead><tr><th>Plan</th><th class="num">Leads</th><th class="num">Share</th></tr></thead>
      <tbody>${mix}</tbody>
    </table>
  </div>

  <div class="card">
    <h2>Emociones (consultas abiertas)</h2>
    <table>
      <thead><tr><th>Emoción</th><th class="num">Detecciones</th><th class="num">Share</th></tr></thead>
      <tbody>${emociones}</tbody>
    </table>
  </div>

  <div class="card">
    <h2>Otras señales</h2>
    <div class="señales">
      <div class="señal"><div class="v">${r.consultasAbiertas}</div><div class="k">Consultas abiertas</div></div>
      <div class="señal"><div class="v">${r.resueltasFaq}</div><div class="k">Resueltas por FAQ (${r.resueltasFaqTasa}, sin IA)</div></div>
      <div class="señal"><div class="v">${r.pedidosAsesor}</div><div class="k">Pedidos de asesor</div></div>
    </div>
  </div>`
}
  <div class="foot">Datos de la demo pública. Caso de estudio con datos públicos de La Caja; no es un canal oficial.</div>
</div>
</body>
</html>`;
}
