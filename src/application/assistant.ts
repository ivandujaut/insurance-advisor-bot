/**
 * Respuesta abierta anclada a la base de conocimiento. Es lógica de aplicación:
 * arma el prompt con el conocimiento, delega la generación en el puerto LlmPort
 * inyectado, y traduce las fallas a mensajes útiles para el usuario. No conoce
 * el proveedor de LLM.
 *
 * Solo genera la respuesta (texto plano). La emoción se clasifica aparte, con el
 * puerto EmotionClassifier, en paralelo (ver process-message).
 */

import type { Session } from "../domain/conversation/session.js";
import type { Dependencies } from "./ports.js";
import { LlmNotConfiguredError } from "./ports.js";

function systemPrompt(knowledge: string): string {
  return [
    "Sos el asistente virtual de seguros de La Caja (Argentina) por WhatsApp.",
    "Respondés en español rioplatense, claro y breve (2-4 frases). Sin tecnicismos innecesarios.",
    "Usás SOLO la información de la base de conocimiento de abajo. Si no sabés algo,",
    "lo decís con honestidad y ofrecés derivar a un asesor. No inventes precios ni condiciones.",
    "Cuando tenga sentido, invitás a cotizar o a escribir *menú* para ver las opciones.",
    "",
    "=== BASE DE CONOCIMIENTO ===",
    knowledge,
    "=== FIN BASE DE CONOCIMIENTO ===",
  ].join("\n");
}

export async function answer(session: Session, deps: Dependencies): Promise<string> {
  // El turno actual del usuario ya fue registrado en session.history por
  // processMessage, así que se arma desde ahí (sin volver a pushearlo).
  const messages = session.history.map((t) => ({ role: t.role, content: t.content }));

  try {
    const knowledge = await deps.knowledge.load();
    return (await deps.llm.generate({ system: systemPrompt(knowledge), messages })).trim();
  } catch (err) {
    if (err instanceof LlmNotConfiguredError) {
      return "Todavía no tengo configurada la clave del modelo (ANTHROPIC_API_KEY). Mientras tanto, escribí *menú* para ver las opciones disponibles.";
    }
    console.error("Error en el asistente:", err);
    return "Uy, tuve un problema para procesar tu consulta. ¿Probamos de nuevo, o preferís que te derive a un asesor?";
  }
}
