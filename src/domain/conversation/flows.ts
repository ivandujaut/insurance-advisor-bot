/**
 * Flujos determinísticos por menú (la parte estructurada del bot híbrido).
 *
 * Posicionamiento: VENTA ASESORADA. El bot cubre el hueco que dejó La Caja
 * entre su bot de autogestión (Letizia) y los cotizadores web fríos: comparar
 * planes, asesorar y capturar el lead de cotización dentro de WhatsApp.
 *
 * handleFlow() decide si el mensaje se resuelve con un menú.
 * - Devuelve string -> respuesta ya resuelta por el flujo.
 * - Devuelve null    -> no aplica menú; el motor delega en el LLM.
 */
import type { Dependencies } from "../../application/ports.js";
import { AUTO_PLANS, type Session } from "./session.js";

const GREETINGS = [
  "hola",
  "buenas",
  "buenos dias",
  "buenas tardes",
  "buenas noches",
  "hi",
  "hello",
];
const MENU_KEYWORDS = ["menu", "menú", "inicio", "volver", "empezar", "start"];
const ADVISOR_KEYWORDS = ["asesor", "humano", "agente", "persona"];

const MAIN_MENU = [
  "👋 Hola, soy el asistente de seguros de La Caja. Te ayudo a encontrar y cotizar tu cobertura.",
  "",
  "1️⃣ Cotizar mi seguro de auto",
  "2️⃣ Comparar los planes de auto",
  "3️⃣ Tengo una duda",
  "4️⃣ Hablar con un asesor",
  "",
  "Respondé con el número, o escribime tu consulta directamente.",
].join("\n");

const PLAN_COMPARISON = [
  "📋 *Planes de auto de La Caja* (de menor a mayor cobertura):",
  "",
  "🔹 *Terceros Completo*",
  "Responsabilidad Civil, robo y hurto, incendio, cristales laterales, cerraduras, ruedas y asistencia mecánica (con límite de eventos).",
  "",
  "🔸 *Terceros Completo con Granizo*",
  "Todo lo anterior + granizo sin tope, luneta y parabrisas, auto sustituto ante pérdida total y asistencia sin límite.",
  "",
  "🔷 *Todo Riesgo con Franquicia*",
  "Todo lo anterior + daños parciales por accidente (con una franquicia a cargo tuyo).",
].join("\n");

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

export async function handleFlow(
  session: Session,
  text: string,
  deps: Dependencies,
): Promise<string | null> {
  const input = normalize(text);

  // Derivación a asesor: disponible en cualquier momento.
  if (ADVISOR_KEYWORDS.includes(input)) {
    session.stage = "idle";
    await deps.events.log("advisor_requested", session.userId);
    return "Te derivo con un asesor de La Caja. 🧑‍💼\n\n(En producción, acá se dispara la derivación al canal oficial / Línea Única 0810-555-2252.)";
  }

  // Saludo, pedido de menú, o primer contacto -> menú principal.
  if (session.stage === "idle" || GREETINGS.includes(input) || MENU_KEYWORDS.includes(input)) {
    // "conversation_started" solo en el primer contacto (desde idle sin datos),
    // para no inflar la metrica cuando el usuario vuelve al menú.
    if (session.stage === "idle" && session.history.length <= 1) {
      await deps.events.log("conversation_started", session.userId);
    }
    session.stage = "main_menu";
    session.data = {};
    return MAIN_MENU;
  }

  switch (session.stage) {
    case "main_menu":
      return handleMainMenu(session, input, deps);
    case "quoting_auto":
      return handleQuotingAuto(session, text, deps);
    default:
      return null;
  }
}

async function handleMainMenu(
  session: Session,
  input: string,
  deps: Dependencies,
): Promise<string | null> {
  switch (input) {
    case "1":
      session.stage = "quoting_auto";
      session.data = {};
      await deps.events.log("quote_started", session.userId);
      return "Genial, cotizamos tu *seguro de auto*. 🚗\n\nEmpecemos por el *año* del vehículo (entre 2006 y el actual).";
    case "2":
      // La comparación es informativa; el usuario sigue en el menú.
      await deps.events.log("plan_comparison_viewed", session.userId);
      return `${PLAN_COMPARISON}\n\nEscribí *1* para cotizar, o preguntame lo que quieras.`;
    case "3":
      // Duda abierta -> la responde el LLM con la base de conocimiento.
      return null;
    default:
      // Cualquier otra cosa desde el menú es una consulta abierta -> LLM.
      return null;
  }
}

// Rango de años válido para cotizar (como el cotizador web).
const MIN_AUTO_YEAR = 2006;
const CURRENT_YEAR = new Date().getFullYear();

async function handleQuotingAuto(
  session: Session,
  rawText: string,
  deps: Dependencies,
): Promise<string | null> {
  const text = rawText.trim();

  // 1) Año (validado).
  if (!session.data.anio) {
    const anio = Number(text.replace(/\D/g, ""));
    if (!anio || anio < MIN_AUTO_YEAR || anio > CURRENT_YEAR) {
      return `Necesito un *año* válido, entre ${MIN_AUTO_YEAR} y ${CURRENT_YEAR}.`;
    }
    session.data.anio = String(anio);
    await deps.events.log("quote_step", session.userId, { step: "anio" });
    return "¿Es *0km* o *usado*? (un modelo de años anteriores también puede ser 0km si es stock sin patentar)";
  }

  // 2) Condición (0km / usado). No se deriva del año: un modelo viejo puede ser
  // 0km de stock, y la condición define si hace falta inspección.
  if (!session.data.condicion) {
    const t = normalize(text);
    const es0km = /0\s*km|cero|nuev/.test(t);
    const esUsado = /usad|segunda|used/.test(t);
    if (!es0km && !esUsado) {
      return "No te entendí. ¿El auto es *0km* o *usado*?";
    }
    session.data.condicion = es0km ? "0km" : "usado";
    await deps.events.log("quote_step", session.userId, { step: "condicion" });
    return "¿De qué *marca* es? (ej: Toyota)";
  }

  // 3) Marca
  if (!session.data.marca) {
    session.data.marca = text;
    await deps.events.log("quote_step", session.userId, { step: "marca" });
    return "¿Y el *modelo*? (ej: Corolla)";
  }

  // 4) Modelo
  if (!session.data.modelo) {
    session.data.modelo = text;
    await deps.events.log("quote_step", session.userId, { step: "modelo" });
    return "¿La *versión*? (la encontrás en la cédula). Si no la tenés a mano, escribí *no sé*.";
  }

  // 5) Versión (opcional: se puede saltar)
  if (!session.data.version) {
    const noLaSabe = /no s[eé]|ni idea|skip|saltar|omitir/.test(normalize(text));
    session.data.version = noLaSabe ? "no especificada" : text;
    await deps.events.log("quote_step", session.userId, { step: "version" });
    return "¿Tiene *GNC*? Respondé *sí* o *no*.";
  }

  // 6) GNC (sí/no)
  if (!session.data.gnc) {
    const t = normalize(text);
    const esSi = /^s[ií]/.test(t) || t.includes("tiene");
    const esNo = /^no/.test(t);
    if (!esSi && !esNo) {
      return "No te entendí. ¿Tiene *GNC*? Respondé *sí* o *no*.";
    }
    session.data.gnc = esSi ? "si" : "no";
    await deps.events.log("quote_step", session.userId, { step: "gnc" });
    return "Último dato: ¿en qué *código postal* se guarda el auto?";
  }

  // 7) CP -> muestra los planes con la nota de inspección (según la condición).
  if (!session.data.cp) {
    session.data.cp = text;
    await deps.events.log("quote_step", session.userId, { step: "cp" });
    const notaInspeccion =
      session.data.condicion === "usado"
        ? "Al ser usado, la inspección se hace online cargando fotos (no hace falta llevarlo).\n\n"
        : "Al ser 0 km, no necesitás inspección.\n\n";
    return `${notaInspeccion}${PLAN_COMPARISON}\n\n¿Qué plan te interesa? Respondé *1*, *2* o *3*.`;
  }

  if (!session.data.plan) {
    const index = Number(text) - 1;
    const plan = AUTO_PLANS[index];
    if (!plan) {
      return "No te entendí el plan. Respondé *1* (Terceros Completo), *2* (con Granizo) o *3* (Todo Riesgo).";
    }
    session.data.plan = plan;
    session.stage = "idle";
    const version =
      session.data.version && session.data.version !== "no especificada"
        ? session.data.version
        : undefined;
    await deps.leads.save({
      userId: session.userId,
      name: session.name,
      anio: session.data.anio ?? "",
      marca: session.data.marca ?? "",
      modelo: session.data.modelo ?? "",
      version,
      gnc: session.data.gnc === "si",
      cp: session.data.cp ?? "",
      condicion: session.data.condicion ?? "",
      plan,
    });
    await deps.events.log("lead_captured", session.userId, { plan });
    const autoLinea = `${session.data.marca} ${session.data.modelo} ${session.data.anio}${version ? ` (${version})` : ""}`;
    return [
      "¡Listo! Con estos datos armo tu solicitud de cotización:",
      "",
      `🚗 Auto: ${autoLinea}`,
      `⛽ GNC: ${session.data.gnc === "si" ? "sí" : "no"}`,
      `🔧 Condición: ${session.data.condicion}`,
      `📍 CP: ${session.data.cp}`,
      `🛡️ Plan de interés: ${plan}`,
      "",
      "Un asesor te va a contactar con el precio final y las opciones de pago (online: tarjeta de crédito o débito por CBU, con descuento).",
      "",
      "Escribí *menú* para hacer otra consulta.",
    ].join("\n");
  }

  return null;
}
