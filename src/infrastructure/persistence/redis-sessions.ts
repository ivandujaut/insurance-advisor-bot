/**
 * Adapter de Redis para el puerto SessionStore. Guarda cada sesión como JSON
 * bajo `session:<userId>` con un TTL (la sesión inactiva expira sola).
 * Permite compartir estado entre varias instancias del bot.
 */
import type { SessionStore } from "../../application/ports.js";
import type { Session } from "../../domain/conversation/session.js";

/** Interfaz mínima del cliente Redis que usa el adapter (desacopla de node-redis). */
export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { EX?: number }): Promise<unknown>;
}

export function createRedisSessionStore(client: RedisLike, ttlSeconds: number): SessionStore {
  return {
    async get(userId) {
      const raw = await client.get(`session:${userId}`);
      return raw ? (JSON.parse(raw) as Session) : undefined;
    },
    async save(session) {
      await client.set(`session:${session.userId}`, JSON.stringify(session), { EX: ttlSeconds });
    },
  };
}
