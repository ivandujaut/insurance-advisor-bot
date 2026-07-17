/**
 * Adaptador de consola: imprime las respuestas del bot en la terminal.
 * Permite desarrollar y probar todo el motor sin credenciales ni WhatsApp.
 */
import type {
  MessagingProvider,
  OutgoingMessage,
  TemplateMessage,
} from "../../application/ports.js";

export class CliProvider implements MessagingProvider {
  readonly name = "cli";

  async send(message: OutgoingMessage): Promise<void> {
    console.log(`\n🤖 Bot:\n${message.text}\n`);
  }

  // En consola no hay WhatsApp, así que la plantilla se muestra como texto.
  async sendTemplate(message: TemplateMessage): Promise<void> {
    console.log(`\n🤖 Bot [plantilla ${message.template}]:\n${message.params.join(" | ")}\n`);
  }
}
