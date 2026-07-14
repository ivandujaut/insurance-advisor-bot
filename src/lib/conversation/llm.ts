/**
 * Respuesta abierta con Claude (AI SDK), anclada a la base de conocimiento.
 * Se usa cuando el mensaje no encaja en un flujo de menú.
 */
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { config } from "../config.js";
import { loadKnowledge } from "../knowledge/index.js";
import type { Session } from "./session.js";

const anthropic = createAnthropic({ apiKey: config.llm.apiKey });

function systemPrompt(): string {
  return [
    "Sos el asistente virtual de seguros de La Caja (Argentina) por WhatsApp.",
    "Respondés en español rioplatense, claro y breve (2-4 frases). Sin tecnicismos innecesarios.",
    "Usás SOLO la información de la base de conocimiento de abajo. Si no sabés algo,",
    "lo decís con honestidad y ofrecés derivar a un asesor. No inventes precios ni condiciones.",
    "Cuando tenga sentido, invitás a cotizar o a escribir *menú* para ver las opciones.",
    "",
    "=== BASE DE CONOCIMIENTO ===",
    loadKnowledge(),
    "=== FIN BASE DE CONOCIMIENTO ===",
  ].join("\n");
}

export async function answerWithLLM(session: Session, userText: string): Promise<string> {
  if (!config.llm.apiKey) {
    return "Todavía no tengo configurada la clave del modelo (ANTHROPIC_API_KEY). Mientras tanto, escribí *menú* para ver las opciones disponibles.";
  }

  const messages = session.history.map((t) => ({ role: t.role, content: t.content }));
  messages.push({ role: "user" as const, content: userText });

  try {
    const { text } = await generateText({
      model: anthropic(config.llm.model),
      system: systemPrompt(),
      messages,
      maxTokens: 400,
    });
    return text.trim();
  } catch (err) {
    console.error("Error en LLM:", err);
    return "Uy, tuve un problema para procesar tu consulta. ¿Probamos de nuevo, o preferís que te derive a un asesor?";
  }
}
