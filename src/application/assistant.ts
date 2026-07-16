/**
 * Respuesta abierta anclada a la base de conocimiento. Es lógica de aplicación:
 * arma el prompt con el conocimiento, delega la generación en el puerto LlmPort
 * inyectado, y traduce las fallas a mensajes útiles para el usuario. No conoce
 * el proveedor de LLM.
 *
 * En la MISMA llamada, el modelo devuelve la respuesta y la emoción percibida en
 * el último mensaje del usuario (salida estructurada JSON). Así la detección de
 * emoción no cuesta una llamada extra.
 */

import type { Session } from "../domain/conversation/session.js";
import { EMOTION_GUIDE, EMOTIONS, type Emotion, parseEmotion } from "../domain/emotion.js";
import type { Dependencies } from "./ports.js";
import { LlmNotConfiguredError } from "./ports.js";

export interface AnswerResult {
  reply: string;
  emocion: Emotion;
}

function systemPrompt(knowledge: string): string {
  return [
    "Sos el asistente virtual de seguros de La Caja (Argentina) por WhatsApp.",
    "Respondés en español rioplatense, claro y breve (2-4 frases). Sin tecnicismos innecesarios.",
    "Usás SOLO la información de la base de conocimiento de abajo. Si no sabés algo,",
    "lo decís con honestidad y ofrecés derivar a un asesor. No inventes precios ni condiciones.",
    "Cuando tenga sentido, invitás a cotizar o a escribir *menú* para ver las opciones.",
    "",
    "Respondé SIEMPRE con este JSON exacto y NADA de texto fuera del JSON:",
    `{"respuesta": "<tu respuesta al usuario>", "emocion": "<una de: ${EMOTIONS.join(", ")}>"}`,
    'La "emocion" es la que percibís en el ÚLTIMO mensaje del usuario (no en el tuyo).',
    EMOTION_GUIDE,
    "",
    "=== BASE DE CONOCIMIENTO ===",
    knowledge,
    "=== FIN BASE DE CONOCIMIENTO ===",
  ].join("\n");
}

/** Extrae el objeto JSON de la salida del modelo, tolerando texto o fences alrededor. */
function extractJson(raw: string): { respuesta?: unknown; emocion?: unknown } | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function answer(session: Session, deps: Dependencies): Promise<AnswerResult> {
  // El turno actual del usuario ya fue registrado en session.history por
  // processMessage, así que se arma desde ahí (sin volver a pushearlo).
  const messages = session.history.map((t) => ({ role: t.role, content: t.content }));

  try {
    const knowledge = await deps.knowledge.load();
    const raw = await deps.llm.generate({ system: systemPrompt(knowledge), messages });
    const parsed = extractJson(raw);
    if (parsed && typeof parsed.respuesta === "string" && parsed.respuesta.trim()) {
      return {
        reply: parsed.respuesta.trim(),
        emocion: parseEmotion(String(parsed.emocion ?? "")),
      };
    }
    // Si el modelo no devolvió el JSON esperado, usamos el texto crudo igual.
    return { reply: raw.trim(), emocion: "neutral" };
  } catch (err) {
    if (err instanceof LlmNotConfiguredError) {
      return {
        reply:
          "Todavía no tengo configurada la clave del modelo (ANTHROPIC_API_KEY). Mientras tanto, escribí *menú* para ver las opciones disponibles.",
        emocion: "neutral",
      };
    }
    console.error("Error en el asistente:", err);
    return {
      reply:
        "Uy, tuve un problema para procesar tu consulta. ¿Probamos de nuevo, o preferís que te derive a un asesor?",
      emocion: "neutral",
    };
  }
}
