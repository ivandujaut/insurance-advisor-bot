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
import type {
  AutoQuoteInput,
  BiciQuoteInput,
  HogarQuoteInput,
  QuoteEstimate,
} from "../domain/quoting/rating.js";

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

/**
 * Lado de lectura de eventos y leads, para el reporte de funnel. Separado del
 * EventSink/LeadRepository (que solo escriben) porque leer es otra
 * responsabilidad. Hoy JSONL o Postgres, detrás del mismo puerto.
 */
export interface AnalyticsReader {
  readEvents(): Promise<AnalyticsEvent[]>;
  readLeads(): Promise<Lead[]>;
}

// --- Leads ---

/** Campos comunes a todo lead, sin importar el producto. */
interface LeadBase {
  ts: string;
  userId: string;
  name?: string;
  /** Plan o cobertura de interés. */
  plan: string;
}

/** Lead de una cotización de auto. */
export interface AutoLead extends LeadBase {
  producto: "auto";
  anio: string;
  marca: string;
  modelo: string;
  /** Opcional: mucha gente no la tiene a mano (está en la cédula). */
  version?: string;
  gnc: boolean;
  cp: string;
  /** "0km" o "usado" (se pregunta explícita, no se deriva del año). */
  condicion: string;
}

/** Lead de una cotización de hogar. */
export interface HogarLead extends LeadBase {
  producto: "hogar";
  /** "propietario" o "inquilino". */
  tipoResidente: string;
  /** "casa", "departamento" o "departamento_pb_ph". */
  tipoHogar: string;
  /** "permanente", "temporal" o "alquilo". */
  uso: string;
  /** Metros cuadrados construidos. Solo para propietario (asegura el edificio). */
  m2?: number;
  cp: string;
  /** Suma del contenido, en pesos. Solo para inquilino (no asegura el edificio). */
  sumaContenido?: number;
}

/** Lead de una cotización de accidentes personales (catálogo de planes fijos). */
export interface AccidentesLead extends LeadBase {
  producto: "accidentes";
  /** "familiar", "trabajo-independiente" o "personal-domestico". */
  modalidad: string;
  /** Precio mensual publicado del plan elegido. */
  precio: number;
}

/** Lead de un seguro de bici/monopatín (tasa sobre el valor declarado). */
export interface BiciLead extends LeadBase {
  producto: "bici";
  /** "bicicleta" o "monopatin". */
  tipoRodado: string;
  /** Valor asegurado del rodado, en pesos. */
  valor: number;
}

/** Un lead capturado, discriminado por `producto`. */
export type Lead = AutoLead | HogarLead | AccidentesLead | BiciLead;

/** Un lead antes de persistirse (el adapter le pone el timestamp). */
export type LeadInput =
  | Omit<AutoLead, "ts">
  | Omit<HogarLead, "ts">
  | Omit<AccidentesLead, "ts">
  | Omit<BiciLead, "ts">;

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

// --- Cotización (tarifador) ---

/**
 * Proveedor de cotización: estima la prima. El núcleo no sabe si detrás hay un
 * modelo local de factores o la API del tarifador real de La Caja. Async a
 * propósito: un tarifador remoto hace I/O.
 */
export interface QuotingProvider {
  quote(input: AutoQuoteInput): Promise<QuoteEstimate>;
  quoteHogar(input: HogarQuoteInput): Promise<QuoteEstimate>;
  quoteBici(input: BiciQuoteInput): Promise<QuoteEstimate>;
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
  quoting: QuotingProvider;
}
