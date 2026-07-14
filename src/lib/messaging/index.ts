/** Factory: elige el adaptador segun la config. */
import { config } from "../config.js";
import { CliProvider } from "./cli.js";
import { MetaProvider } from "./meta.js";
import type { MessagingProvider } from "./types.js";

export function createMessagingProvider(): MessagingProvider {
  switch (config.messaging.provider) {
    case "meta":
      return new MetaProvider();
    case "cli":
      return new CliProvider();
    default:
      throw new Error(`Proveedor de mensajeria desconocido: ${config.messaging.provider}`);
  }
}

export type { MessagingProvider } from "./types.js";
export { parseMetaWebhook } from "./meta.js";
