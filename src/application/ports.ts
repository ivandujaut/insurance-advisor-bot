/**
 * Puertos de la aplicación (interfaces) y los tipos de dominio que exponen.
 *
 * El núcleo depende de estas abstracciones; los adapters concretos las
 * implementan en infraestructura (ver src/lib/leads y src/lib/analytics).
 * Regla: este archivo NO importa nada de un adapter.
 *
 * Ver docs/adr/0001-arquitectura-hexagonal.md.
 */
import type { Session } from "../domain/conversation/session.js";

// --- Mensajería ---

/** Mensaje entrante ya normalizado, sin importar el proveedor de origen. */
export interface IncomingMessage {
  /** Identificador estable del usuario (ej: numero de telefono). */
  from: string;
  /** Texto del mensaje. */
  text: string;
  /** Nombre del contacto, si el proveedor lo expone. */
  name?: string;
}

/** Mensaje saliente que el motor pide enviar. */
export interface OutgoingMessage {
  to: string;
  text: string;
}

/** Proveedor de mensajería. El núcleo no sabe si detrás hay Meta, Twilio o consola. */
export interface MessagingProvider {
  readonly name: string;
  send(message: OutgoingMessage): Promise<void>;
}

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

/** Sink de eventos: registra un momento del funnel. Hoy JSONL, mañana Postgres. */
export interface EventSink {
  log(type: EventType, userId: string, props?: Record<string, string>): Promise<void>;
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
  save(lead: LeadInput): Promise<void>;
}

// --- LLM ---

export interface LlmMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LlmRequest {
  system: string;
  messages: LlmMessage[];
}

/** Puerto del modelo de lenguaje. Hoy Anthropic, mañana el AI Gateway u otro. */
export interface LlmPort {
  generate(request: LlmRequest): Promise<string>;
}

/** El adapter de LLM no tiene credenciales configuradas (caso típico en dev). */
export class LlmNotConfiguredError extends Error {
  constructor() {
    super("El proveedor de LLM no está configurado.");
    this.name = "LlmNotConfiguredError";
  }
}

// --- Sesiones ---

/** Almacenamiento de sesiones. Hoy en memoria, mañana Redis/KV para varias instancias. */
export interface SessionStore {
  get(userId: string): Promise<Session | undefined>;
  save(session: Session): Promise<void>;
}

// --- Conocimiento ---

/**
 * Fuente de la base de conocimiento (grounding del LLM). Hoy archivos markdown,
 * mañana un CMS o una API. Async a propósito: una fuente remota hace I/O.
 */
export interface KnowledgeSource {
  load(): Promise<string>;
}

// --- Dependencias inyectadas en el núcleo ---

/** Puertos que el motor de conversación recibe inyectados. Crece con cada borde. */
export interface Dependencies {
  leads: LeadRepository;
  events: EventSink;
  llm: LlmPort;
  sessions: SessionStore;
  knowledge: KnowledgeSource;
}
