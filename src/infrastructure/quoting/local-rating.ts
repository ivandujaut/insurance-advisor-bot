/**
 * Proveedor de cotización local: envuelve el modelo de factores del dominio
 * detrás del puerto QuotingProvider. Es el default, sin dependencias externas.
 *
 * El seam queda listo: para usar el tarifador real de La Caja, se agrega un
 * createLacajaApiQuotingProvider() que implemente el mismo puerto, y se elige
 * por config. El dominio y el flujo no cambian.
 */
import type { QuotingProvider } from "../../application/ports.js";
import { estimarPrima, estimarPrimaBici, estimarPrimaHogar } from "../../domain/quoting/rating.js";

export function createLocalQuotingProvider(): QuotingProvider {
  return {
    async quote(input) {
      return estimarPrima(input);
    },
    async quoteHogar(input) {
      return estimarPrimaHogar(input);
    },
    async quoteBici(input) {
      return estimarPrimaBici(input);
    },
  };
}
