/**
 * Re-enganche proactivo: el bot escribe primero. Barre las sesiones activas y, a las
 * que quedaron a mitad de un flujo e inactivas más de N minutos (pero dentro de la
 * ventana de 24h de WhatsApp), les manda un "¿seguís ahí?" con contexto. Es el paso
 * de reactivo a proactivo; solo tiene canal en WhatsApp (ver
 * docs/benchmark-timeout-reengagement.md). La lógica de "a quién" (shouldNudge) y
 * "qué" (buildNudge) es pura y testeable; runReengagement hace el I/O por los puertos.
 */
import { MID_FLOW_STAGES, type Session, STAGE_PRODUCTO } from "../domain/conversation/session.js";
import type { EventSink, MessagingProvider, SessionStore, TemplateMessage } from "./ports.js";

export interface ReengagementOptions {
  /** Inactividad mínima para nudgear (ms). */
  afterMs: number;
  /** Ventana máxima: pasada la de 24h de WhatsApp no se puede mandar mensaje libre. */
  windowMs: number;
}

/** True si a esta sesión le corresponde un nudge ahora. Pura. */
export function shouldNudge(session: Session, now: Date, opts: ReengagementOptions): boolean {
  if (!MID_FLOW_STAGES.has(session.stage)) return false;
  if (session.data.nudged === "1") return false; // ya se nudgeó en este hueco
  if (!session.lastActivityAt) return false;
  const gapMs = now.getTime() - new Date(session.lastActivityAt).getTime();
  if (Number.isNaN(gapMs)) return false;
  return gapMs >= opts.afterMs && gapMs < opts.windowMs;
}

/** El texto del nudge para una sesión (o null si no aplica). Pura. */
export function buildNudge(session: Session): string | null {
  if (!MID_FLOW_STAGES.has(session.stage)) return null;
  const producto = STAGE_PRODUCTO[session.stage];
  const que = producto ? `tu cotización de *${producto}*` : "tu consulta";
  return `¿Seguís por ahí? 👋 Quedó ${que} a medias. Cuando quieras la seguimos: respondeme, o escribí *menú* para arrancar de nuevo. 🙂`;
}

export interface ReengagementPorts {
  sessions: SessionStore;
  messaging: MessagingProvider;
  events: EventSink;
}

/**
 * Un pase del barrido: nudgea a las sesiones que corresponde y marca cada una para
 * no repetir. Devuelve cuántos nudges se enviaron. Best-effort por sesión: un fallo
 * de envío se loguea y no frena al resto.
 */
export async function runReengagement(
  ports: ReengagementPorts,
  now: Date,
  opts: ReengagementOptions,
): Promise<number> {
  const listActive = ports.sessions.listActive;
  if (!listActive) return 0; // el store no soporta barrido (ej: un fake de test)
  const sessions = await listActive.call(ports.sessions);

  let enviados = 0;
  for (const session of sessions) {
    if (!shouldNudge(session, now, opts)) continue;
    const text = buildNudge(session);
    if (!text) continue;
    try {
      await ports.messaging.send({ to: session.userId, text });
      session.data.nudged = "1";
      await ports.sessions.save(session);
      await ports.events.log("nudge_sent", session.userId, { stage: session.stage });
      enviados++;
    } catch (err) {
      console.error("No se pudo enviar el nudge de re-enganche:", err);
    }
  }
  return enviados;
}

// --- C: re-enganche FUERA de la ventana de 24h (con plantilla) ---

export interface TemplateReengagementOptions {
  /** Inicio de la ventana out-of-window: la de 24h de WhatsApp (ms). */
  windowMs: number;
  /** Corte: pasado esto el lead está frío y no se insiste (ms). */
  maxMs: number;
  templateName: string;
  templateLanguage: string;
}

/**
 * True si a esta sesión le corresponde una plantilla de re-enganche. Pura.
 * Requiere **opt-in** (`data.optIn`): mandar marketing sin consentimiento viola la
 * política de WhatsApp y puede banear el número. Capturar el opt-in (ej: una línea de
 * consentimiento al dejar el contacto) es un prerequisito aparte, todavía no hecho.
 */
export function shouldSendTemplate(
  session: Session,
  now: Date,
  opts: TemplateReengagementOptions,
): boolean {
  if (!MID_FLOW_STAGES.has(session.stage)) return false;
  if (session.data.optIn !== "1") return false; // marketing: sin opt-in, no se manda
  if (session.data.templateSent === "1") return false;
  if (!session.lastActivityAt) return false;
  const gapMs = now.getTime() - new Date(session.lastActivityAt).getTime();
  if (Number.isNaN(gapMs)) return false;
  return gapMs >= opts.windowMs && gapMs < opts.maxMs;
}

/** Arma el TemplateMessage para una sesión (o null si no aplica). Pura. */
export function buildTemplateMessage(
  session: Session,
  opts: Pick<TemplateReengagementOptions, "templateName" | "templateLanguage">,
): TemplateMessage | null {
  if (!MID_FLOW_STAGES.has(session.stage)) return null;
  const producto = STAGE_PRODUCTO[session.stage] ?? "seguro";
  // La plantilla aprobada en Meta tiene una variable {{1}} = producto. Ej de cuerpo:
  // "Quedó tu cotización de {{1}} a medias en La Caja. ¿La terminamos? Respondé este mensaje."
  return {
    to: session.userId,
    template: opts.templateName,
    language: opts.templateLanguage,
    params: [producto],
  };
}

/**
 * Un pase del barrido out-of-window: manda la plantilla a las sesiones a mitad de
 * flujo que quedaron fuera de la ventana de 24h (y con opt-in). Sin `sendTemplate` en
 * el proveedor (ej: un canal que no es WhatsApp), no hace nada.
 */
export async function runTemplateReengagement(
  ports: ReengagementPorts,
  now: Date,
  opts: TemplateReengagementOptions,
): Promise<number> {
  const listActive = ports.sessions.listActive;
  const sendTemplate = ports.messaging.sendTemplate;
  if (!listActive || !sendTemplate) return 0;
  const sessions = await listActive.call(ports.sessions);

  let enviados = 0;
  for (const session of sessions) {
    if (!shouldSendTemplate(session, now, opts)) continue;
    const message = buildTemplateMessage(session, opts);
    if (!message) continue;
    try {
      await sendTemplate.call(ports.messaging, message);
      session.data.templateSent = "1";
      await ports.sessions.save(session);
      await ports.events.log("reengage_template_sent", session.userId, {
        stage: session.stage,
        template: opts.templateName,
      });
      enviados++;
    } catch (err) {
      console.error("No se pudo enviar la plantilla de re-enganche:", err);
    }
  }
  return enviados;
}
