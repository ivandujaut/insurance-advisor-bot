/**
 * Motor de conversación (híbrido).
 * Orquesta: recibe un mensaje entrante, decide menú vs LLM, y devuelve la
 * respuesta. No sabe nada del proveedor de mensajería ni de cómo se persisten
 * leads y eventos: depende de los puertos que recibe inyectados.
 */

import { handleFlow } from "../domain/conversation/flows.js";
import { createSession, recordTurn, trimHistory } from "../domain/conversation/session.js";
import { NEGATIVE_EMOTIONS } from "../domain/emotion.js";
import { answer } from "./assistant.js";
import type { Dependencies, IncomingMessage } from "./ports.js";

const ASESOR_OFFER = "\n\nSi preferís que te ayude una persona, escribí *asesor* y te derivo. 🧑‍💼";

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

  // 2) Si ningún flujo aplica, es una consulta abierta.
  if (reply === null) {
    await deps.events.log("open_question", incoming.from);
    // La emoción se clasifica siempre y en paralelo (tarea barata e independiente):
    // así el aviso de asesor funciona igual con respuesta del FAQ o del asistente.
    const emotionPromise = deps.emotion.classify(incoming.text);

    // FAQ router primero: si la duda es conocida, respondemos con la respuesta
    // canónica SIN llamar al LLM de generación (la palanca de costo). Si no, cae
    // al asistente.
    const hit = await deps.faq.match(incoming.text);
    if (hit) {
      reply = hit.respuesta;
      await deps.events.log("faq_hit", incoming.from, { id: hit.id, score: hit.score.toFixed(3) });
    } else {
      reply = await answer(session, deps);
    }

    const emocion = await emotionPromise;
    await deps.events.log("emotion_detected", incoming.from, { emocion });
    // Regla accionable: ante enojo/frustración, ofrecer un humano.
    if (NEGATIVE_EMOTIONS.includes(emocion)) {
      reply += ASESOR_OFFER;
    }
  }

  recordTurn(session, "assistant", reply);
  trimHistory(session);
  // Sello el momento para detectar, en el próximo mensaje, si el usuario vuelve
  // tras un hueco largo y ofrecerle retomar (ver handleFlow). Se setea al final,
  // después de que handleFlow leyó el valor anterior.
  session.lastActivityAt = new Date().toISOString();
  await deps.sessions.save(session);
  return reply;
}
