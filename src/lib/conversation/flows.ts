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
import type { Dependencies } from "../application/ports.js";
import { AUTO_PLANS, type Session } from "./session.js";

const GREETINGS = ["hola", "buenas", "buenos dias", "buenas tardes", "buenas noches", "hi", "hello"];
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

export function handleFlow(session: Session, text: string, deps: Dependencies): string | null {
  const input = normalize(text);

  // Derivación a asesor: disponible en cualquier momento.
  if (ADVISOR_KEYWORDS.includes(input)) {
    session.stage = "idle";
    deps.events.log("advisor_requested", session.userId);
    return "Te derivo con un asesor de La Caja. 🧑‍💼\n\n(En producción, acá se dispara la derivación al canal oficial / Línea Única 0810-555-2252.)";
  }

  // Saludo, pedido de menú, o primer contacto -> menú principal.
  if (session.stage === "idle" || GREETINGS.includes(input) || MENU_KEYWORDS.includes(input)) {
    // "conversation_started" solo en el primer contacto (desde idle sin datos),
    // para no inflar la metrica cuando el usuario vuelve al menú.
    if (session.stage === "idle" && session.history.length <= 1) {
      deps.events.log("conversation_started", session.userId);
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

function handleMainMenu(session: Session, input: string, deps: Dependencies): string | null {
  switch (input) {
    case "1":
      session.stage = "quoting_auto";
      session.data = {};
      deps.events.log("quote_started", session.userId);
      return "Genial, cotizamos tu *seguro de auto*. 🚗\n\nDecime la *marca, modelo y año* del vehículo (ej: Toyota Corolla 2020).";
    case "2":
      // La comparación es informativa; el usuario sigue en el menú.
      deps.events.log("plan_comparison_viewed", session.userId);
      return `${PLAN_COMPARISON}\n\nEscribí *1* para cotizar, o preguntame lo que quieras.`;
    case "3":
      // Duda abierta -> la responde el LLM con la base de conocimiento.
      return null;
    default:
      // Cualquier otra cosa desde el menú es una consulta abierta -> LLM.
      return null;
  }
}

function handleQuotingAuto(session: Session, rawText: string, deps: Dependencies): string | null {
  const text = rawText.trim();

  if (!session.data.vehiculo) {
    session.data.vehiculo = text;
    deps.events.log("quote_step", session.userId, { step: "vehiculo" });
    return "Perfecto. ¿En qué *código postal* se guarda el auto?";
  }

  if (!session.data.cp) {
    session.data.cp = text;
    deps.events.log("quote_step", session.userId, { step: "cp" });
    return "¿El auto es *0 km* o *usado*?";
  }

  if (!session.data.condicion) {
    const esUsado = /usad/i.test(text);
    session.data.condicion = esUsado ? "usado" : "0km";
    deps.events.log("quote_step", session.userId, { step: "condicion" });
    const notaInspeccion = esUsado
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
    deps.leads.save({
      userId: session.userId,
      name: session.name,
      vehiculo: session.data.vehiculo ?? "",
      cp: session.data.cp ?? "",
      condicion: session.data.condicion ?? "",
      plan,
    });
    deps.events.log("lead_captured", session.userId, { plan });
    return [
      "¡Listo! Con estos datos armo tu solicitud de cotización:",
      "",
      `🚗 Vehículo: ${session.data.vehiculo}`,
      `📍 CP: ${session.data.cp}`,
      `🔧 Condición: ${session.data.condicion}`,
      `🛡️ Plan de interés: ${plan}`,
      "",
      "Un asesor te va a contactar con el precio final y las opciones de pago (online: tarjeta de crédito o débito por CBU, con descuento).",
      "",
      "Escribí *menú* para hacer otra consulta.",
    ].join("\n");
  }

  return null;
}
