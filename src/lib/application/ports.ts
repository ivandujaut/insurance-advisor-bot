/**
 * Puertos de la aplicación (interfaces) y los tipos de dominio que exponen.
 *
 * El núcleo depende de estas abstracciones; los adapters concretos las
 * implementan en infraestructura (ver src/lib/leads y src/lib/analytics).
 * Regla: este archivo NO importa nada de un adapter.
 *
 * Ver docs/adr/0001-arquitectura-hexagonal.md.
 */

// --- Eventos del funnel ---

export type EventType =
  | "conversation_started"
  | "quote_started"
  | "quote_step"
  | "plan_comparison_viewed"
  | "lead_captured"
  | "advisor_requested"
  | "open_question";

export interface AnalyticsEvent {
  ts: string;
  type: EventType;
  userId: string;
  props?: Record<string, string>;
}

/** Sink de eventos: registra un momento del funnel. Hoy JSONL, mañana un sink real. */
export interface EventSink {
  log(type: EventType, userId: string, props?: Record<string, string>): void;
}

// --- Leads ---

export interface Lead {
  ts: string;
  userId: string;
  name?: string;
  vehiculo: string;
  cp: string;
  condicion: string;
  plan: string;
}

/** Un lead antes de persistirse (el adapter le pone el timestamp). */
export type LeadInput = Omit<Lead, "ts">;

/** Repositorio de leads. Hoy JSONL, mañana un CRM o una base de datos. */
export interface LeadRepository {
  save(lead: LeadInput): void;
}

// --- Dependencias inyectadas en el núcleo ---

/** Puertos que el motor de conversación recibe inyectados. Crece con cada borde. */
export interface Dependencies {
  leads: LeadRepository;
  events: EventSink;
}
