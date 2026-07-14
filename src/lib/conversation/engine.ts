/**
 * Motor de conversación (híbrido).
 * Orquesta: recibe un mensaje entrante, decide menú vs LLM, y devuelve la
 * respuesta. No sabe nada del proveedor de mensajería.
 */
import { logEvent } from "../analytics/events.js";
import type { IncomingMessage } from "../messaging/types.js";
import { handleFlow } from "./flows.js";
import { answerWithLLM } from "./llm.js";
import { getSession, recordTurn, saveSession } from "./session.js";

export async function processMessage(incoming: IncomingMessage): Promise<string> {
  const session = getSession(incoming.from, incoming.name);
  recordTurn(session, "user", incoming.text);

  // 1) Primero intentan resolver los flujos determinísticos (menús).
  let reply = handleFlow(session, incoming.text);

  // 2) Si ningún flujo aplica, es una consulta abierta: responde el LLM.
  if (reply === null) {
    logEvent("open_question", incoming.from);
    reply = await answerWithLLM(session, incoming.text);
  }

  recordTurn(session, "assistant", reply);
  saveSession(session);
  return reply;
}
