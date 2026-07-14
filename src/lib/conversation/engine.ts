/**
 * Motor de conversación (híbrido).
 * Orquesta: recibe un mensaje entrante, decide menú vs LLM, y devuelve la
 * respuesta. No sabe nada del proveedor de mensajería ni de cómo se persisten
 * leads y eventos: depende de los puertos que recibe inyectados.
 */
import { defaultDependencies } from "../application/dependencies.js";
import type { Dependencies } from "../application/ports.js";
import type { IncomingMessage } from "../messaging/types.js";
import { answer } from "./assistant.js";
import { handleFlow } from "./flows.js";
import { createSession, recordTurn, trimHistory } from "./session.js";

export async function processMessage(
  incoming: IncomingMessage,
  deps: Dependencies = defaultDependencies(),
): Promise<string> {
  const session = deps.sessions.get(incoming.from) ?? createSession(incoming.from, incoming.name);
  if (incoming.name && !session.name) session.name = incoming.name;
  recordTurn(session, "user", incoming.text);

  // 1) Primero intentan resolver los flujos determinísticos (menús).
  let reply = handleFlow(session, incoming.text, deps);

  // 2) Si ningún flujo aplica, es una consulta abierta: responde el asistente.
  if (reply === null) {
    deps.events.log("open_question", incoming.from);
    reply = await answer(session, incoming.text, deps);
  }

  recordTurn(session, "assistant", reply);
  trimHistory(session);
  deps.sessions.save(session);
  return reply;
}
