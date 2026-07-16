/**
 * Cálculo del funnel a partir de los eventos y leads registrados. Pura: recibe
 * los datos y devuelve el reporte, sin leer disco ni base. El "de dónde salen"
 * los datos es un borde (AnalyticsReader); esto es la regla de negocio de "cómo
 * se lee el embudo", así que vive en el dominio.
 */
import type { AnalyticsEvent, EventType, Lead } from "../../application/ports.js";

export interface FunnelStep {
  paso: string;
  count: number;
}

export interface PlanMix {
  plan: string;
  count: number;
  tasa: string;
}

export interface EmotionCount {
  emocion: string;
  count: number;
  tasa: string;
}

export interface FunnelReport {
  totalEventos: number;
  saludan: number;
  arrancan: number;
  arrancanTasa: string;
  completan: number;
  completanTasa: string;
  pasos: FunnelStep[];
  mixPlan: PlanMix[];
  emociones: EmotionCount[];
  consultasAbiertas: number;
  pedidosAsesor: number;
}

/** Pasos de la cotización de auto, en orden, para medir el drop-off. */
const PASOS_AUTO = ["anio", "condicion", "marca", "modelo", "version", "gnc", "cp"] as const;

/** Usuarios únicos que dispararon un tipo de evento. */
function uniqueUsers(events: AnalyticsEvent[], type: EventType): number {
  return new Set(events.filter((e) => e.type === type).map((e) => e.userId)).size;
}

/** Porcentaje "de folleto": "-" si no hay base, si no "NN%". */
export function pct(part: number, total: number): string {
  if (total === 0) return "-";
  return `${Math.round((part / total) * 100)}%`;
}

export function computeFunnel(events: AnalyticsEvent[], leads: Lead[]): FunnelReport {
  const saludan = uniqueUsers(events, "conversation_started");
  const arrancan = uniqueUsers(events, "quote_started");
  const completan = uniqueUsers(events, "lead_captured");

  const pasos: FunnelStep[] = PASOS_AUTO.map((paso) => ({
    paso,
    count: events.filter((e) => e.type === "quote_step" && e.props?.step === paso).length,
  }));

  const byPlan = new Map<string, number>();
  for (const lead of leads) {
    byPlan.set(lead.plan, (byPlan.get(lead.plan) ?? 0) + 1);
  }
  const mixPlan: PlanMix[] = [...byPlan.entries()]
    .map(([plan, count]) => ({ plan, count, tasa: pct(count, leads.length) }))
    .sort((a, b) => b.count - a.count);

  // Emociones detectadas en las respuestas abiertas (evento emotion_detected).
  const emotionEvents = events.filter((e) => e.type === "emotion_detected");
  const byEmotion = new Map<string, number>();
  for (const e of emotionEvents) {
    const emocion = e.props?.emocion ?? "neutral";
    byEmotion.set(emocion, (byEmotion.get(emocion) ?? 0) + 1);
  }
  const emociones: EmotionCount[] = [...byEmotion.entries()]
    .map(([emocion, count]) => ({ emocion, count, tasa: pct(count, emotionEvents.length) }))
    .sort((a, b) => b.count - a.count);

  return {
    totalEventos: events.length,
    saludan,
    arrancan,
    arrancanTasa: pct(arrancan, saludan),
    completan,
    completanTasa: pct(completan, arrancan),
    pasos,
    mixPlan,
    emociones,
    consultasAbiertas: events.filter((e) => e.type === "open_question").length,
    pedidosAsesor: events.filter((e) => e.type === "advisor_requested").length,
  };
}
