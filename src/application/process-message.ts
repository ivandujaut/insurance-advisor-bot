/**
 * Motor de conversación (híbrido).
 * Orquesta: recibe un mensaje entrante, decide menú vs LLM, y devuelve la
 * respuesta. No sabe nada del proveedor de mensajería ni de cómo se persisten
 * leads y eventos: depende de los puertos que recibe inyectados.
 */

import { handleFlow } from "../domain/conversation/flows.js";
import { createSession, recordTurn, trimHistory } from "../domain/conversation/session.js";
import { answer } from "./assistant.js";
import type { Dependencies, IncomingMessage } from "./ports.js";

export async function processMessage(
  incoming: IncomingMessage,
  deps: Dependencies,
): Promise<string> {
  const session =
    (await deps.sessions.get(incoming.from)) ?? createSession(incoming.from, incoming.name);
  if (incoming.name && !session.name) session.name = incoming.name;
  recordTurn(session, "user", incoming.text);

  // 1) Primero intentan resolver los flujos determinísticos (menús).
  let reply = await handleFlow(session, incoming.text, deps);

  // 2) Si ningún flujo aplica, es una consulta abierta: responde el asistente.
  if (reply === null) {
    await deps.events.log("open_question", incoming.from);
    reply = await answer(session, incoming.text, deps);
  }

  recordTurn(session, "assistant", reply);
  trimHistory(session);
  await deps.sessions.save(session);
  return reply;
}
