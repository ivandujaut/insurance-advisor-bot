/**
 * Adaptador de consola: imprime las respuestas del bot en la terminal.
 * Permite desarrollar y probar todo el motor sin credenciales ni WhatsApp.
 */
import type { MessagingProvider, OutgoingMessage } from "./types.js";

export class CliProvider implements MessagingProvider {
  readonly name = "cli";

  async send(message: OutgoingMessage): Promise<void> {
    console.log(`\n🤖 Bot:\n${message.text}\n`);
  }
}
