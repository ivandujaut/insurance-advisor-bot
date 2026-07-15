/**
 * Modelo de tarifación (rating) del seguro de auto: estima un RANGO de prima
 * mensual a partir de factores de riesgo, como lo hace el tarifador de una
 * aseguradora. Es una orientación de pre-venta; el precio final lo confirma el
 * asesor con el tarifador real.
 *
 * Vive en el dominio porque "cómo se arma una prima" es conocimiento de negocio.
 * El puerto QuotingProvider (application) representa DE DÓNDE viene el número:
 * hoy este modelo local, mañana la API del tarifador de La Caja, detrás del
 * mismo puerto y sin tocar el dominio.
 *
 * IMPORTANTE: los factores son supuestos ILUSTRATIVOS y tuneables, no las
 * tarifas reales de La Caja. La estructura (base por plan, ajuste por zona,
 * antigüedad, condición y GNC) sí replica cómo se piensa una prima.
 */

export interface AutoQuoteInput {
  anio: string;
  /** "0km" o "usado". */
  condicion: string;
  gnc: boolean;
  cp: string;
  plan: string;
}

export interface QuoteEstimate {
  plan: string;
  /** Piso del rango estimado, en pesos por mes. */
  desde: number;
  /** Techo del rango estimado, en pesos por mes. */
  hasta: number;
  moneda: "ARS";
}

// Prima base mensual por plan (ARS). Anclada a un quote real del cotizador de La
// Caja: Toyota Corolla 2020, usado, sin GNC, CABA (factor zona 1,25) ->
// Terceros Completo $160.165, con Granizo $202.443, Todo Riesgo $247.847 por mes.
// Cada base es ese precio dividido por el factor de zona (real / 1,25).
// LIMITACIÓN: el precio real escala con el VALOR del auto (la suma asegurada, que
// la web deriva de año/marca/modelo); el modelo no lo captura, así que la base
// queda anclada a un auto de gama media y factorAntiguedad es un proxy grueso.
const BASE_POR_PLAN: Record<string, number> = {
  "Terceros Completo": 128000,
  "Terceros Completo con Granizo": 162000,
  "Todo Riesgo con Franquicia": 198000,
};
const BASE_DEFAULT = 128000;

const CURRENT_YEAR = new Date().getFullYear();

/** Vehículo más nuevo = mayor suma asegurada = más prima. */
function factorAntiguedad(anio: number): number {
  const edad = CURRENT_YEAR - anio;
  if (edad <= 0) return 1.2;
  if (edad <= 5) return 1.1;
  if (edad <= 12) return 1.0;
  return 0.9;
}

/** Un 0km asegura un valor mayor que el mismo modelo usado. */
function factorCondicion(condicion: string): number {
  return condicion === "0km" ? 1.15 : 1.0;
}

/** Riesgo por zona a partir del CP (robo/siniestralidad). AMBA más caro. */
function factorZona(cp: string): number {
  const n = Number(cp.replace(/\D/g, ""));
  if (!n) return 1.0;
  if (n >= 1000 && n <= 1499) return 1.25; // CABA
  if (n >= 1500 && n <= 1900) return 1.15; // GBA
  return 1.0; // interior
}

/** El GNC suma riesgo (incendio) y un recargo de tarifa. */
function factorGnc(gnc: boolean): number {
  return gnc ? 1.08 : 1.0;
}

/** Redondea a la $500 más cercana para un número "de folleto". */
function redondear(monto: number): number {
  return Math.round(monto / 500) * 500;
}

/**
 * Estima el rango de prima mensual. Determinístico: mismos datos, mismo rango.
 * El ± del rango refleja que es una orientación, no una cotización en firme.
 */
export function estimarPrima(input: AutoQuoteInput): QuoteEstimate {
  const base = BASE_POR_PLAN[input.plan] ?? BASE_DEFAULT;
  const anio = Number(input.anio.replace(/\D/g, "")) || CURRENT_YEAR;
  const prima =
    base *
    factorAntiguedad(anio) *
    factorCondicion(input.condicion) *
    factorZona(input.cp) *
    factorGnc(input.gnc);
  return {
    plan: input.plan,
    desde: redondear(prima * 0.9),
    hasta: redondear(prima * 1.15),
    moneda: "ARS",
  };
}

// --- Hogar ---
// La Caja no vende el hogar en niveles fijos como el auto: es un seguro
// "personalizable" cuya variable central es la suma asegurada del contenido.
// El bot captura esa suma y estima con una tasa sobre ella, ajustada por tipo
// de residente, tipo de vivienda y zona.

export interface HogarQuoteInput {
  /** "propietario" o "inquilino". */
  tipoResidente: string;
  /** "casa", "departamento" o "departamento_pb_ph". */
  tipoHogar: string;
  /** "permanente", "temporal" o "alquilo". */
  uso: string;
  /** m² construidos. El propietario deriva de acá la suma de incendio (edificio + bienes). */
  m2: number;
  cp: string;
  /** Suma del contenido. La usa el inquilino (no asegura el edificio). */
  sumaContenido: number;
}

// Calibrado con precios reales del cotizador de La Caja. Base: caso "alquilada"
// (edificio solo), propietario, departamento, Posadas: 168M de incendio ->
// $11.760/mes y 252M -> $16.683/mes. De esa regresión salen la tasa sobre la suma
// de incendio, el cargo fijo (RC + cristales + asistencias) y el costo de
// reconstrucción ~$2,1M/m². Siguen siendo aproximaciones, pero ancladas a datos.
const COSTO_RECONSTRUCCION_M2 = 2100000;
const TASA_INCENDIO_MENSUAL = 0.0000586;
const CARGO_FIJO_MENSUAL = 1915;

/**
 * Una casa cuesta más que un depto, y no solo por riesgo: se reconstruye más
 * cara por m² (estructura propia, techo, cimientos) que un depto (que comparte
 * la del edificio). Dato real: mismo caso como casa salió $13.665 vs $11.502
 * depto (ratio ~1,19). PB/PH queda entre ambos (sin dato real, ilustrativo).
 */
function factorTipoHogar(tipoHogar: string): number {
  if (tipoHogar === "casa") return 1.19; // dato real
  if (tipoHogar === "departamento_pb_ph") return 1.1; // ilustrativo
  return 1.0; // departamento en piso (base)
}

/**
 * El uso NO es un multiplicador de riesgo: define QUÉ se cubre. Alquilada (a un
 * tercero) asegura solo el edificio. Habitada por el dueño suma el contenido
 * (robo, TV, mayor suma de incendio), casi el doble. Dato real: mismo caso
 * permanente en CABA salió $22.062 vs $11.502 alquilado.
 */
function factorUso(uso: string): number {
  if (uso === "temporal") return 2.0; // ilustrativo: contenido + riesgo de vacancia
  if (uso === "permanente") return 1.91; // dato real
  return 1.0; // alquilo (base: edificio solo)
}

/**
 * Zona para hogar: NO es la de auto. En auto CABA es mucho más cara (robo); en
 * hogar el riesgo (incendio, edificio) no está dominado por el robo, así que la
 * zona es casi plana. Dato real relevado: mismo caso en CABA salió ~2% MÁS BARATO
 * que en el interior (Posadas). Solo CABA tiene un punto real; GBA se asume neutro.
 */
function factorZonaHogar(cp: string): number {
  const n = Number(cp.replace(/\D/g, ""));
  if (!n) return 1.0;
  if (n >= 1000 && n <= 1499) return 0.98; // CABA (dato real)
  return 1.0; // GBA e interior (sin dato: neutro)
}

/**
 * Estima el rango de prima mensual del seguro de hogar, replicando la estructura
 * del cotizador real: una tasa sobre la suma de incendio (edificio + bienes) más
 * un cargo fijo (RC, cristales, asistencias). El propietario deriva la suma de
 * incendio de los m² (a costo de reconstrucción); el inquilino, que no asegura el
 * edificio, usa la suma de su contenido. Ajusta por tipo de hogar, uso y zona.
 */
export function estimarPrimaHogar(input: HogarQuoteInput): QuoteEstimate {
  const sumaIncendio =
    input.tipoResidente === "propietario"
      ? input.m2 * COSTO_RECONSTRUCCION_M2
      : input.sumaContenido;
  const prima =
    (CARGO_FIJO_MENSUAL + sumaIncendio * TASA_INCENDIO_MENSUAL) *
    factorTipoHogar(input.tipoHogar) *
    factorUso(input.uso) *
    factorZonaHogar(input.cp);
  return {
    plan: "Seguro de Hogar",
    desde: redondear(prima * 0.9),
    hasta: redondear(prima * 1.15),
    moneda: "ARS",
  };
}

// --- Bici / Monopatín ---
// Un cuarto shape de precio: una tasa sobre el VALOR declarado del rodado (la
// suma asegurada). Derivada de tres tarifas reales del cotizador de bici, muy
// consistentes: $370.800 -> $6.894, $539.400 -> $9.959, $1.012.000 -> $18.549
// (1,83% a 1,86% mensual). El bot pide el valor del rodado y estima con esa tasa.

export interface BiciQuoteInput {
  /** "bicicleta" o "monopatin". */
  tipoRodado: string;
  /** Valor asegurado del rodado, en pesos. */
  valor: number;
}

const TASA_BICI_MIN = 0.0183;
const TASA_BICI_MAX = 0.0186;

/** Estima la cuota mensual del seguro de bici/monopatín: una tasa sobre el valor. */
export function estimarPrimaBici(input: BiciQuoteInput): QuoteEstimate {
  const r = (x: number) => Math.round(x / 100) * 100;
  return {
    plan: input.tipoRodado === "monopatin" ? "Seguro de Monopatín" : "Seguro de Bicicleta",
    desde: r(input.valor * TASA_BICI_MIN),
    hasta: r(input.valor * TASA_BICI_MAX),
    moneda: "ARS",
  };
}
