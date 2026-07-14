/**
 * Adapter en memoria del puerto SessionStore. Guarda las sesiones en un Map por
 * userId. Suficiente para una sola instancia (dev/demo). Para varias instancias
 * se reemplaza por un adapter de Redis/KV con la misma interfaz.
 */
import type { SessionStore } from "../../application/ports.js";
import type { Session } from "../../domain/conversation/session.js";

export function createInMemorySessionStore(): SessionStore {
  const store = new Map<string, Session>();
  return {
    get: async (userId) => store.get(userId),
    save: async (session) => {
      store.set(session.userId, session);
    },
  };
}
