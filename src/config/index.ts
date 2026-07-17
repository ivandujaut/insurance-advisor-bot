/**
 * Configuracion centralizada leida de variables de entorno.
 * Se lee una sola vez al arrancar.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno requerida: ${name}`);
  }
  return value;
}

export type MessagingProviderName = "cli" | "meta";
export type PersistenceDriver = "jsonl" | "postgres";
export type SessionDriver = "memory" | "redis";

/**
 * Parsea overrides de destinatario ("waId=aQuienEnviar,...").
 * Escape hatch para el número de PRUEBA de Meta cuando la lista de autorizados
 * guarda el número en un formato distinto al wa_id del webhook (ej: Argentina,
 * que llega con "9" pero el sandbox lo tiene con "15"). Vacío en producción.
 */
export function parseRecipientOverrides(raw: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const pair of raw.split(",")) {
    const [from, to] = pair.split("=");
    if (from?.trim() && to?.trim()) map[from.trim()] = to.trim();
  }
  return map;
}

export const config = {
  llm: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? "",
    model: process.env.AI_MODEL ?? "claude-sonnet-5",
    // Modelo del clasificador de emoción (llamada aparte, en paralelo). Haiku por
    // default: clasificar es tarea simple y es ~3-5x más rápido y barato que sonnet.
    // El eval (v2, definiciones + few-shot) dio macro-F1 0.869 vs 0.909 de sonnet; la
    // caída es confusión enojo↔frustración (ambas negativas → el aviso de asesor
    // dispara igual) y algún neutral, no en la señal accionable. Overridable por env.
    emotionModel: process.env.EMOTION_MODEL ?? "claude-haiku-4-5",
  },
  messaging: {
    provider: (process.env.MESSAGING_PROVIDER ?? "cli") as MessagingProviderName,
  },
  meta: {
    // Se validan solo cuando el proveedor meta esta activo (ver getMetaConfig).
    accessToken: process.env.META_ACCESS_TOKEN ?? "",
    phoneNumberId: process.env.META_PHONE_NUMBER_ID ?? "",
    verifyToken: process.env.META_VERIFY_TOKEN ?? "",
    // Opcional: si esta seteado, se verifica la firma del webhook (recomendado).
    appSecret: process.env.META_APP_SECRET ?? "",
    // Opcional: overrides de destinatario para el numero de prueba (ver parseRecipientOverrides).
    recipientOverrides: parseRecipientOverrides(process.env.META_RECIPIENT_OVERRIDES ?? ""),
  },
  persistence: {
    // Adapter de leads/eventos. Default JSONL (sin dependencias).
    driver: (process.env.PERSISTENCE ?? "jsonl") as PersistenceDriver,
    // Cualquier Postgres sirve (Render, Supabase, Neon, RDS): cambiar el proveedor
    // es cambiar esta URL. Los managed externos exigen SSL (ver databaseSsl).
    databaseUrl: process.env.DATABASE_URL ?? "",
    // SSL para la conexión. Render interno no lo necesita; Supabase/Neon sí.
    // Se activa con DATABASE_SSL=true o si la URL trae sslmode=require.
    databaseSsl: process.env.DATABASE_SSL === "true",
  },
  embeddings: {
    // Clave de OpenAI para el FAQ router (búsqueda semántica). Sin clave, el
    // router queda desactivado (no-op) y todo cae al asistente: degrada, no rompe.
    apiKey: process.env.OPENAI_API_KEY ?? "",
    // text-embedding-3-small: barato y suficiente para decenas de dudas.
    model: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
  },
  faq: {
    // Umbral de similitud coseno para dar por buena una duda conocida. Calibrado
    // con `pnpm eval:faq` (text-embedding-3-small, método leave-one-out sobre el
    // corpus real): 0.65 da ~64% de cobertura con ~99-100% de aciertos y cero
    // falsos positivos, tras enriquecer y desambiguar el benchmark. Por debajo la
    // precisión cae; lo que no supera el umbral cae al LLM (la red de seguridad).
    threshold: Number(process.env.FAQ_THRESHOLD ?? 0.65),
  },
  session: {
    // Adapter de sesiones. Default en memoria.
    driver: (process.env.SESSION_STORE ?? "memory") as SessionDriver,
    redisUrl: process.env.REDIS_URL ?? "",
    // TTL de una sesión inactiva en Redis (segundos). Default 24h.
    ttlSeconds: Number(process.env.SESSION_TTL_SECONDS ?? 86400),
  },
  reengagement: {
    // Barrido proactivo "¿seguís ahí?" para cotizaciones a medias. Apagado por
    // default: solo tiene sentido en WhatsApp (la web no tiene canal para push) y
    // así no mete ruido en dev/demo. Ver docs/benchmark-timeout-reengagement.md.
    enabled: process.env.REENGAGEMENT_ENABLED === "true",
    // Minutos de inactividad tras los que se manda el nudge (dentro de la ventana de 24h).
    afterMinutes: Number(process.env.REENGAGEMENT_AFTER_MINUTES ?? 30),
    // Cada cuántos minutos corre el barrido.
    intervalMinutes: Number(process.env.REENGAGEMENT_INTERVAL_MINUTES ?? 5),
  },
  server: {
    port: Number(process.env.PORT ?? 3000),
  },
};

/** Valida y devuelve la config de Meta, fallando temprano si algo falta. */
export function getMetaConfig() {
  return {
    accessToken: required("META_ACCESS_TOKEN"),
    phoneNumberId: required("META_PHONE_NUMBER_ID"),
    verifyToken: required("META_VERIFY_TOKEN"),
  };
}
