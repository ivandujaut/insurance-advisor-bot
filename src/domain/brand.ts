/**
 * Marca configurable (white-label). El motor del bot es genérico: la identidad
 * de la aseguradora es configuración, no código. Con la marca vacía (default),
 * los textos quedan neutros ("soy tu asistente de seguros", "un asesor te va a
 * contactar"); con BRAND_NAME seteado, se instancian para esa aseguradora
 * ("...de La Caja"). Es la Decisión 6 (bordes intercambiables) aplicada a la
 * identidad: mismo núcleo, otra marca y otra base de conocimiento.
 *
 * Vive en el dominio como estado configurado UNA vez al arrancar (desde main,
 * con los valores de config), así los textos del dominio la leen sin importar
 * config ni infraestructura.
 */

export interface Brand {
  /** Nombre de la aseguradora (ej: "La Caja"). Vacío = demo neutra. */
  name: string;
  /** Sitio de contratación online. Vacío = no se ofrece link externo. */
  onlineUrl: string;
  /** Teléfono de atención (ej: "0810-555-2252"). Vacío = sin teléfono. */
  phone: string;
}

const brand: Brand = { name: "", onlineUrl: "", phone: "" };

/** Configura la marca al arrancar (main). Llamar antes de procesar mensajes. */
export function configureBrand(overrides: Partial<Brand>): void {
  Object.assign(brand, overrides);
}

export function brandName(): string {
  return brand.name;
}

export function brandOnlineUrl(): string {
  return brand.onlineUrl;
}

export function brandPhone(): string {
  return brand.phone;
}

/** " de La Caja" con marca, "" sin marca. Para componer frases naturales. */
export function deMarca(): string {
  return brand.name ? ` de ${brand.name}` : "";
}
