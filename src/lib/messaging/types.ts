/**
 * Contrato del proveedor de mensajeria. El motor del bot solo conoce estos
 * tipos, no sabe si detras hay WhatsApp (Meta), Twilio o la consola.
 * Cambiar de proveedor = cambiar el adaptador, no el motor.
 */

/** Mensaje entrante ya normalizado, sin importar el proveedor de origen. */
export interface IncomingMessage {
  /** Identificador estable del usuario (ej: numero de telefono). */
  from: string;
  /** Texto del mensaje. */
  text: string;
  /** Nombre del contacto, si el proveedor lo expone. */
  name?: string;
}

/** Mensaje saliente que el motor pide enviar. */
export interface OutgoingMessage {
  to: string;
  text: string;
}

export interface MessagingProvider {
  /** Nombre para logs. */
  readonly name: string;
  /** Envia un mensaje al usuario. */
  send(message: OutgoingMessage): Promise<void>;
}
