/**
 * Rate limiter en memoria (ventana fija) para proteger endpoints públicos del
 * abuso: sin esto, POST /chat llama a la API paga del LLM sin límite y cualquiera
 * puede quemar el crédito. Simple a propósito (una sola instancia); con varias
 * instancias haría falta uno compartido (Redis) detrás de la misma interfaz.
 */
export interface RateLimiter {
  /** true si la request se permite; false si superó el límite de la ventana. */
  allow(key: string): boolean;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export function createRateLimiter(opts: {
  windowMs: number;
  max: number;
  now?: () => number;
}): RateLimiter {
  const now = opts.now ?? Date.now;
  const buckets = new Map<string, Bucket>();

  return {
    allow(key: string): boolean {
      const t = now();
      const bucket = buckets.get(key);

      if (!bucket || t >= bucket.resetAt) {
        // Ventana nueva. Aprovechamos para limpiar entradas vencidas y que el
        // Map no crezca sin límite con claves que ya no vuelven.
        if (buckets.size > 10_000) {
          for (const [k, b] of buckets) if (t >= b.resetAt) buckets.delete(k);
        }
        buckets.set(key, { count: 1, resetAt: t + opts.windowMs });
        return true;
      }

      if (bucket.count >= opts.max) return false;
      bucket.count++;
      return true;
    },
  };
}
