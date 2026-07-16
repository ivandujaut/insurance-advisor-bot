/**
 * Adapter en memoria del puerto SessionStore. Guarda las sesiones en un Map por
 * userId, con TTL: una sesión vencida se descarta (no se retoma una cotización
 * de hace días con datos viejos), y el Map no crece sin límite. Suficiente para
 * una sola instancia (dev/demo); con varias instancias se usa el adapter de
 * Redis/KV con la misma interfaz. El estado igual se pierde en cada redeploy: para
 * eso está Redis.
 */
import type { SessionStore } from "../../application/ports.js";
import type { Session } from "../../domain/conversation/session.js";

interface Entry {
  session: Session;
  expiresAt: number;
}

export function createInMemorySessionStore(
  ttlSeconds: number,
  now: () => number = Date.now,
): SessionStore {
  const store = new Map<string, Entry>();
  const ttlMs = ttlSeconds * 1000;

  return {
    get: async (userId) => {
      const entry = store.get(userId);
      if (!entry) return undefined;
      if (now() >= entry.expiresAt) {
        store.delete(userId);
        return undefined;
      }
      return entry.session;
    },
    save: async (session) => {
      store.set(session.userId, { session, expiresAt: now() + ttlMs });
      // Limpieza oportunista de vencidas para acotar el crecimiento del Map.
      if (store.size > 10_000) {
        const t = now();
        for (const [k, e] of store) if (t >= e.expiresAt) store.delete(k);
      }
    },
  };
}
