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

export const config = {
  llm: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? "",
    model: process.env.AI_MODEL ?? "claude-sonnet-5",
  },
  messaging: {
    provider: (process.env.MESSAGING_PROVIDER ?? "cli") as MessagingProviderName,
  },
  meta: {
    // Se validan solo cuando el proveedor meta esta activo (ver getMetaConfig).
    accessToken: process.env.META_ACCESS_TOKEN ?? "",
    phoneNumberId: process.env.META_PHONE_NUMBER_ID ?? "",
    verifyToken: process.env.META_VERIFY_TOKEN ?? "",
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
