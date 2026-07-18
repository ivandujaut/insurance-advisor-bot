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
import type { Dependencies, LeadInput } from "../../application/ports.js";
import { NEGATIVE_EMOTIONS } from "../emotion.js";
import {
  ACCIDENTES_MODALIDADES,
  ACCIDENTES_PLANES,
  AUTO_PLANS,
  MID_FLOW_STAGES,
  type Session,
  STAGE_PRODUCTO,
} from "./session.js";

// Mensaje cuando no se pudo persistir el lead: mejor avisar que fingir éxito.
const LEAD_ERROR =
  "Uy, tuve un problema para registrar tu solicitud. 😔 Probá de nuevo en un momento, o escribí *asesor* para que te contacte una persona.";

/**
 * Guarda el lead y devuelve si se persistió. Si el repositorio falla (ej: la base
 * caída), devuelve false para que el flujo NO le confirme "listo" al usuario por
 * una solicitud que no quedó registrada.
 */
async function persistLead(deps: Dependencies, lead: LeadInput): Promise<boolean> {
  try {
    await deps.leads.save(lead);
    return true;
  } catch (err) {
    console.error("No se pudo guardar el lead:", err);
    return false;
  }
}

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
const ADVISOR_REPLY =
  "Te derivo con un asesor de La Caja. 🧑‍💼\n\n(En producción, acá se dispara la derivación al canal oficial / Línea Única 0810-555-2252.)";

// Sitio público de La Caja para la contratación online (con descuento por CBU).
const LACAJA_ONLINE_URL = "https://www.lacaja.com.ar";

// Cierre post-cotización: en el momento de mayor intención de compra, en vez de
// devolver al menú frío se ofrece avanzar. Es la palanca de conversión del tramo
// final del embudo (ver Decisión 19 en docs/decisiones-de-producto.md).
const POST_QUOTE_CTA = [
  "",
  "✅ *¿Avanzamos?*",
  "1️⃣ Que me llame un asesor (con tu cotización lista)",
  "2️⃣ Contratar online (descuento por CBU)",
  "3️⃣ Comparar otro plan u otra consulta",
].join("\n");

const ONLINE_REPLY = [
  "💻 *Contratación online*",
  "",
  "Los planes se pueden contratar en el sitio de La Caja, con descuento por débito por CBU:",
  LACAJA_ONLINE_URL,
  "",
  "¿Preferís que te acompañe una persona? Escribí *asesor*.",
  "",
  "Escribí *menú* para otra consulta.",
].join("\n");

const MAIN_MENU = [
  "👋 Hola, soy el asistente de seguros de La Caja. Te ayudo a encontrar y cotizar tu cobertura.",
  "",
  "1️⃣ Cotizar mi seguro de auto",
  "2️⃣ Cotizar mi seguro de hogar",
  "3️⃣ Cotizar accidentes personales",
  "4️⃣ Cotizar bici o monopatín",
  "5️⃣ Comparar los planes de auto",
  "",
  "Respondé con el número, o escribime tu consulta o duda directamente. 💬",
].join("\n");

// Resúmenes de cada plan, alineados por índice con AUTO_PLANS (la lista canónica
// que resuelve la elección 1/2/3): una sola fuente para nombres y orden, así el
// número que se muestra y el que se parsea no pueden divergir.
const PLAN_RESUMENES = [
  "Responsabilidad Civil, robo y hurto, incendio, cristales laterales, cerraduras, ruedas y asistencia mecánica (con límite de eventos).",
  "Todo lo anterior + granizo sin tope, luneta y parabrisas, auto sustituto ante pérdida total y asistencia sin límite.",
  "Todo lo anterior + daños parciales por accidente (con una franquicia a cargo tuyo).",
];

/** Lista de planes con la viñeta que corresponda a cada índice. */
function listaDePlanes(bullets: string[]): string {
  return AUTO_PLANS.flatMap((plan, i) => [
    "",
    `${bullets[i] ?? "•"} *${plan}*`,
    PLAN_RESUMENES[i] ?? "",
  ]).join("\n");
}

const PLAN_HEADER = "📋 *Planes de auto de La Caja* (de menor a mayor cobertura):";

// Comparación informativa (opción 5 del menú): viñetas SIN número, a propósito.
// Acá 1/2/3 no eligen un plan (el usuario sigue en el menú, donde 1 cotiza auto y
// 2 hogar); numerarlas invitaría a responder "2" esperando Granizo.
const PLAN_COMPARISON = `${PLAN_HEADER}\n${listaDePlanes(["🔹", "🔸", "🔷"])}`;

// Elección de plan (paso final de la cotización): numerada, para que el mapeo con
// el "Respondé 1, 2 o 3" sea visible de un vistazo.
const PLAN_CHOICES = `${PLAN_HEADER}\n${listaDePlanes(["1️⃣", "2️⃣", "3️⃣"])}`;

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

// Reintentos en un mismo paso antes de ofrecer una salida, aunque no haya enojo.
const MAX_STEP_FAILS = 2;

// Salida genérica cuando el usuario se traba en un paso que no tiene un default
// seguro: no lo dejamos en un loop, le ofrecemos una persona o volver a empezar.
const STUCK_EXIT =
  "Perdón por tanta vuelta. 🙂 Si preferís, escribí *asesor* y te paso con una persona que te ayuda con esto, o *menú* para empezar de nuevo.";

/**
 * Se llama cuando un input NO matchea lo esperado en un paso del flujo. En vez de
 * repetir la pregunta a lo tonto (el loop que expulsa al cliente), decide si hay
 * que ofrecer una salida: corre la detección de emoción sobre ese mensaje (que NO
 * corría dentro de los flujos) y escapa ante enojo/frustración, o tras reintentos
 * repetidos. El contador es por paso: al avanzar a otro paso se resetea solo.
 * Devuelve true si el flujo debe dar una salida; false para re-preguntar normal.
 */
async function shouldEscape(
  session: Session,
  input: string,
  deps: Dependencies,
  paso: string,
): Promise<boolean> {
  const fails = session.data.stuckStep === paso ? (Number(session.data.fails) || 0) + 1 : 1;
  session.data.stuckStep = paso;
  session.data.fails = String(fails);
  const emocion = await deps.emotion.classify(input);
  if (NEGATIVE_EMOTIONS.includes(emocion) || fails >= MAX_STEP_FAILS) {
    await deps.events.log("flow_stuck", session.userId, {
      paso,
      intentos: String(fails),
      emocion,
    });
    session.data.stuckStep = "";
    session.data.fails = "0";
    return true;
  }
  return false;
}

// Hueco tras el cual, si el usuario vuelve a mitad de un flujo, se le reconoce el
// tiempo y se le re-muestra dónde estábamos, en vez de seguir preguntando sin
// contexto o perder el progreso. Best practice de re-enganche dentro de la ventana
// de 24h de WhatsApp (ver docs/benchmark-timeout-reengagement.md).
const RESUME_GAP_MS = 30 * 60 * 1000; // 30 min

/** Última cosa que dijo el bot: es la pregunta pendiente que hay que re-mostrar. */
function lastAssistantMessage(session: Session): string | null {
  for (let i = session.history.length - 1; i >= 0; i--) {
    const turn = session.history[i];
    if (turn?.role === "assistant") return turn.content;
  }
  return null;
}

/**
 * Si el usuario vuelve a mitad de un flujo tras un hueco largo, devuelve un mensaje
 * de "retomamos" con la pregunta que había quedado pendiente (sacada del historial,
 * así no se duplican los textos de cada paso). Si no aplica, null. Evita el
 * antipatrón de seguir preguntando sin contexto (o perder el progreso si el usuario
 * vuelve con un "hola", que hoy lo manda al menú).
 */
function maybeResume(session: Session, now: Date): string | null {
  if (!session.lastActivityAt || !MID_FLOW_STAGES.has(session.stage)) return null;
  const gapMs = now.getTime() - new Date(session.lastActivityAt).getTime();
  if (Number.isNaN(gapMs) || gapMs < RESUME_GAP_MS) return null;
  const pregunta = lastAssistantMessage(session);
  if (!pregunta) return null;
  const producto = STAGE_PRODUCTO[session.stage];
  const dondeEstabamos = producto ? `tu cotización de *${producto}*` : "donde estábamos";
  return [
    `¡Hola de nuevo! 👋 Seguíamos con ${dondeEstabamos}. Te había preguntado esto:`,
    "",
    pregunta,
    "",
    "Respondé para seguir, o escribí *menú* para arrancar de nuevo.",
  ].join("\n");
}

// Pasos (campos de datos) de cada cotización larga, en orden, para el indicador de
// progreso. Los cortos (accidentes, bici: 2 pasos) no lo llevan: sumaría ruido.
// La condición (0km/usado) no es un paso propio: se deriva del año (un año pasado
// es usado) o se resuelve junto al año (0km, o el año en curso, que es ambiguo).
// Así se evita la pregunta redundante "2009 → ¿0km o usado?" (ver Decisión 21).
const AUTO_STEPS = ["anio", "marca", "modelo", "version", "gnc", "cp", "plan"];

/** Pasos de hogar según el camino (propietario asegura m², inquilino el contenido). */
function hogarSteps(session: Session): string[] {
  return session.data.tipoResidente === "inquilino"
    ? ["tipoResidente", "tipoHogar", "uso", "cp", "sumaContenido"]
    : ["tipoResidente", "tipoHogar", "uso", "m2", "cp"];
}

// Pasos de los flujos cortos, en orden. No llevan indicador de progreso (sumaría
// ruido en 2 pasos), pero sí participan del "volver atrás" para corregir.
const ACCIDENTES_STEPS = ["modalidad", "plan"];
const BICI_STEPS = ["tipoRodado", "valor"];

/** Lista ordenada de campos del flujo activo, o null si no es una cotización. */
function stepsFor(session: Session): string[] | null {
  switch (session.stage) {
    case "quoting_auto":
      return AUTO_STEPS;
    case "quoting_hogar":
      return hogarSteps(session);
    case "quoting_accidentes":
      return ACCIDENTES_STEPS;
    case "quoting_bici":
      return BICI_STEPS;
    default:
      return null;
  }
}

// Pedido de volver un paso para corregir. "volver" a secas también entra acá cuando
// se está a mitad de una cotización (se intercepta antes del reset a menú), así deja
// de significar "perdé todo el progreso" y pasa a "corregí lo último".
const BACK_KEYWORDS = [
  "atras",
  "atrás",
  "volver",
  "volver atras",
  "volver atrás",
  "anterior",
  "corregir",
];
function isBackIntent(input: string): boolean {
  return BACK_KEYWORDS.includes(input) || /equivoqu/.test(input);
}

/** Último campo ya cargado del flujo (el que se re-pregunta al volver atrás). */
function lastFilledStep(session: Session, steps: string[]): string | null {
  for (let i = steps.length - 1; i >= 0; i--) {
    const field = steps[i];
    if (field && session.data[field]) return field;
  }
  return null;
}

/** Re-pregunta de un paso puntual, para cuando el usuario vuelve atrás a corregirlo. */
function preguntaDePaso(session: Session, field: string): string {
  const preguntas: Record<string, string> = {
    anio: `¿Cuál es el *año* del vehículo? (entre ${MIN_AUTO_YEAR} y ${CURRENT_YEAR}). Si es *0km*, escribilo.`,
    marca: "¿De qué *marca* es? (ej: Toyota)",
    modelo: "¿Y el *modelo*? (ej: Corolla)",
    version: "¿La *versión*? Si no la tenés a mano, escribí *no sé*.",
    gnc: "¿Tiene *GNC*? Respondé *sí* o *no*.",
    cp:
      session.stage === "quoting_hogar"
        ? "¿En qué *código postal* está la vivienda?"
        : "¿En qué *código postal* se guarda el auto?",
    tipoResidente: "¿Sos *propietario* o *inquilino*?",
    tipoHogar: "¿La vivienda es una *casa*, un *departamento* o un *departamento en PB o PH*?",
    uso: "¿Qué *uso* tiene? *permanente*, *temporal* o *alquilada*.",
    m2: "¿Cuántos *m² construidos* tiene? (entre 25 y 300)",
    sumaContenido: "¿Cuánto costaría reponer *el contenido*? Un monto aproximado alcanza.",
    modalidad:
      "¿Para quién es? *1* protección familiar, *2* trabajo independiente, *3* personal doméstico.",
    tipoRodado: "¿Es una *bicicleta* o un *monopatín eléctrico*?",
  };
  return preguntas[field] ?? "Contame de nuevo, por favor.";
}

/**
 * Prefija "📋 Dato N de M" a la pregunta de un paso, para que el usuario sepa cuánto
 * falta (baja el abandono en flujos largos). N sale de cuántos campos ya se llenaron.
 */
function conProgreso(session: Session, steps: string[], pregunta: string): string {
  const hechos = steps.filter((k) => session.data[k]).length;
  return `📋 *Dato ${Math.min(hechos + 1, steps.length)} de ${steps.length}*\n${pregunta}`;
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
    return ADVISOR_REPLY;
  }

  // Volver atrás a corregir: si está a mitad de una cotización, deshace el último
  // dato y lo vuelve a preguntar, en vez de mandarlo al menú y perder todo (que es
  // lo que hacía "volver"). Se resuelve antes del reset a menú y del retomar.
  const steps = stepsFor(session);
  if (steps && isBackIntent(input)) {
    const last = lastFilledStep(session, steps);
    if (!last) {
      // Nada que deshacer todavía (recién arrancó): lo llevo al menú a empezar.
      session.stage = "main_menu";
      session.data = {};
      return MAIN_MENU;
    }
    delete session.data[last];
    // Al deshacer un paso, reseteo el contador de "trabado" para no arrastrarlo.
    session.data.stuckStep = "";
    session.data.fails = "0";
    await deps.events.log("quote_step_back", session.userId, { paso: last });
    return `Listo, volvamos atrás. 👇\n\n${conProgreso(session, steps, preguntaDePaso(session, last))}`;
  }

  // Retomar tras un hueco: si volvió a mitad de flujo, reconocer el tiempo y
  // re-mostrar la pregunta pendiente (una sola vez, porque después se actualiza
  // lastActivityAt). El *menú* sigue disponible para arrancar de nuevo.
  if (!MENU_KEYWORDS.includes(input)) {
    const resume = maybeResume(session, new Date());
    if (resume !== null) return resume;
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
    case "quoting_hogar":
      return handleQuotingHogar(session, text, deps);
    case "quoting_accidentes":
      return handleAccidentes(session, text, deps);
    case "quoting_bici":
      return handleBici(session, text, deps);
    case "post_quote":
      return handlePostQuote(session, input, deps);
    case "capturing_contact":
      return handleCapturingContact(session, text, deps);
    default:
      return null;
  }
}

/**
 * Cierre post-cotización. En vez de devolver al menú, empuja hacia adelante: un
 * asesor con la cotización lista, contratación online, o comparar otro plan.
 * Registra `quote_accepted` (con el canal) para cerrar el embudo. Texto libre cae
 * al LLM.
 */
async function handlePostQuote(
  session: Session,
  input: string,
  deps: Dependencies,
): Promise<string | null> {
  const plan = session.data.plan ?? "";
  switch (input) {
    case "1":
      session.stage = "capturing_contact";
      await deps.events.log("quote_accepted", session.userId, { plan, via: "asesor" });
      return "Perfecto. 🙌 Para que un asesor te contacte con tu cotización a mano, pasame *nombre, teléfono y a qué hora te viene bien* (ej: Ana, 11 5555 5555, tardes).";
    case "2":
      session.stage = "idle";
      await deps.events.log("quote_accepted", session.userId, { plan, via: "online" });
      return ONLINE_REPLY;
    case "3":
      session.stage = "main_menu";
      session.data = {};
      return MAIN_MENU;
    default:
      // Cualquier otra cosa es una consulta abierta -> LLM.
      return null;
  }
}

/**
 * Captura el contacto para el llamado del asesor (registra `handoff_requested`) y,
 * en un segundo paso, el opt-in EXPLÍCITO para el re-enganche por WhatsApp. El opt-in
 * va aparte del contacto a propósito: el re-enganche es marketing y la política de
 * WhatsApp exige consentimiento afirmativo y separable, no bundleado. El contacto
 * crudo NO se persiste en analytics (es PII); en producción va al canal del asesor/CRM,
 * y el consentimiento a un registro durable (acá vive en la sesión, alcanza para la demo).
 */
async function handleCapturingContact(
  session: Session,
  text: string,
  deps: Dependencies,
): Promise<string | null> {
  // Fase 2: respuesta al opt-in de re-enganche.
  if (session.data.awaitingOptIn === "1") {
    const acepta = /^(s[ií]|dale|ok|acepto|claro|bueno|de una)/.test(normalize(text));
    session.data.optIn = acepta ? "1" : "0";
    delete session.data.awaitingOptIn;
    session.stage = "idle";
    const aviso = acepta
      ? "Genial, te aviso por acá si dejás una cotización a medias. "
      : "Perfecto, no te escribo de más. ";
    return [
      `¡Listo! 🙌 ${aviso}Un asesor de La Caja te va a contactar con tu cotización lista, así no repetís nada.`,
      "",
      "(En la demo no hay un contacto real detrás; en producción, acá se agenda el llamado en el canal oficial.)",
      "",
      "Escribí *menú* si querés hacer otra consulta.",
    ].join("\n");
  }

  // Fase 1: el contacto.
  const contacto = text.trim();
  if (contacto.length < 5) {
    return "Necesito al menos un nombre y un teléfono para que un asesor te llame. ¿Me los pasás?";
  }
  await deps.events.log("handoff_requested", session.userId, {
    plan: session.data.plan ?? "",
    resumen: session.data.resumen ?? "",
  });
  session.data.awaitingOptIn = "1";
  return "¡Anotado! 🙌 Una última: ¿te puedo escribir por acá si dejás una cotización a medias, para retomarla? Respondé *sí* o *no*.";
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
      return `Genial, cotizamos tu *seguro de auto*. 🚗\n\n${conProgreso(session, AUTO_STEPS, `Empecemos por el *año* del vehículo (entre ${MIN_AUTO_YEAR} y ${CURRENT_YEAR}). Si es *0km*, escribilo.`)}`;
    case "2":
      session.stage = "quoting_hogar";
      session.data = {};
      await deps.events.log("quote_started", session.userId);
      return `Buenísimo, cotizamos tu *seguro de hogar*. 🏠\n\n${conProgreso(session, hogarSteps(session), "¿Sos *propietario* o *inquilino*?")}`;
    case "3":
      session.stage = "quoting_accidentes";
      session.data = {};
      await deps.events.log("quote_started", session.userId);
      return "Genial, *accidentes personales*. 🩹\n\n¿Para quién es? Respondé:\n*1* Protección familiar\n*2* Trabajo independiente\n*3* Personal doméstico";
    case "4":
      session.stage = "quoting_bici";
      session.data = {};
      await deps.events.log("quote_started", session.userId);
      return "Buenísimo, cotizamos tu rodado. 🚲\n\n¿Es una *bicicleta* o un *monopatín eléctrico*?";
    case "5":
      // La comparación es informativa; el usuario sigue en el menú.
      await deps.events.log("plan_comparison_viewed", session.userId);
      return `${PLAN_COMPARISON}\n\nEscribí *1* para cotizar, o preguntame lo que quieras.`;
    default:
      // Cualquier otra cosa (incluida una duda escrita) es una consulta abierta:
      // la resuelve el FAQ router o el LLM. El asesor NO se lista en el menú a
      // propósito: listarlo primero canibaliza el flujo automatizado (todos lo
      // elegirían). Se ofrece cuando el motor de emociones detecta malestar
      // sostenido (ver Decisión 22), y escribir *asesor* sigue funcionando siempre.
      return null;
  }
}

// Rango de años válido para cotizar (como el cotizador web).
const MIN_AUTO_YEAR = 2006;
const CURRENT_YEAR = new Date().getFullYear();

// Aclaración de condición para el año en curso, por el criterio objetivo: 0km =
// sin patentar. "¿Tiene patente?" es un hecho verificable; "¿es 0km o usado?" es un
// juicio que confunde a quien tiene un auto del año con pocos km (ver Decisión 21).
const PATENTE_QUESTION =
  "¿Ya está *patentado*? Respondé *sí* o *no* (si todavía no tiene patente, es 0km).";

/** Formatea un monto en pesos con separador de miles ("$16.200"). */
function pesos(monto: number): string {
  return `$${monto.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

async function handleQuotingAuto(
  session: Session,
  rawText: string,
  deps: Dependencies,
): Promise<string | null> {
  const text = rawText.trim();

  // 1) Año + condición fusionados, como el cotizador real de La Caja: el año lleva
  // la condición. Un año pasado es usado (no repreguntamos: esa era la fricción);
  // "0km" se resuelve acá; solo el año en curso es ambiguo (0km o usado del año) y
  // pasa al paso 2. Ver docs/benchmark-anio-condicion.md y Decisión 21.
  if (!session.data.anio) {
    // Al (re)preguntar el año, la condición se re-deriva; limpiamos cualquier valor
    // previo (ej: si se vuelve atrás para corregir el año).
    delete session.data.condicion;
    const t = normalize(text);
    if (/0\s*km|cero|nuev/.test(t)) {
      session.data.anio = String(CURRENT_YEAR);
      session.data.condicion = "0km";
      await deps.events.log("quote_step", session.userId, { step: "anio" });
      return conProgreso(session, AUTO_STEPS, "¿De qué *marca* es? (ej: Toyota)");
    }
    const anio = Number(t.replace(/\D/g, ""));
    if (!anio || anio < MIN_AUTO_YEAR || anio > CURRENT_YEAR) {
      return `Necesito un *año* válido, entre ${MIN_AUTO_YEAR} y ${CURRENT_YEAR} (o escribí *0km*).`;
    }
    session.data.anio = String(anio);
    await deps.events.log("quote_step", session.userId, { step: "anio" });
    // Un año pasado implica usado: se asume y se avanza, sin repreguntar.
    if (anio < CURRENT_YEAR) {
      session.data.condicion = "usado";
      return conProgreso(session, AUTO_STEPS, "¿De qué *marca* es? (ej: Toyota)");
    }
    // Solo el año en curso es genuinamente ambiguo: ahí sí preguntamos, pero por el
    // criterio objetivo (la patente) y no por el juicio "¿0km o usado?", que confunde
    // a quien tiene un auto del año con pocos km. 0km = sin patentar: es la definición
    // real del negocio y decide la inspección. (Sin número de paso: es una aclaración
    // del año, no un paso propio del recorrido.)
    return PATENTE_QUESTION;
  }

  // 2) Condición: solo se llega acá para el año en curso (ambiguo). Para el resto
  // ya quedó resuelta junto al año. Se resuelve por la patente (sí = usado, no = 0km),
  // aceptando también 0km/usado por si responden con el término de siempre.
  if (!session.data.condicion) {
    const t = normalize(text);
    // "no sé" / "ni idea" es duda, no una negación: cae al reintento, no a 0km.
    const esDuda = /no\s*s[eé]|ni idea/.test(t);
    // La negación va primero: "no está patentado" empieza con "no" y NO debe
    // matchear el "patentad" del sí (invertiría la condición).
    const esNo = !esDuda && /^no/.test(t);
    const es0km = esNo || /0\s*km|cero|nuev|sin patent/.test(t);
    const esUsado = !es0km && !esDuda && (/^s[ií]/.test(t) || /patentad|usad|segunda|rod/.test(t));
    if (!es0km && !esUsado) {
      if (await shouldEscape(session, text, deps, "condicion")) return STUCK_EXIT;
      return `No te entendí. ${PATENTE_QUESTION}`;
    }
    session.data.condicion = es0km ? "0km" : "usado";
    await deps.events.log("quote_step", session.userId, { step: "condicion" });
    return conProgreso(session, AUTO_STEPS, "¿De qué *marca* es? (ej: Toyota)");
  }

  // 3) Marca
  if (!session.data.marca) {
    session.data.marca = text;
    await deps.events.log("quote_step", session.userId, { step: "marca" });
    return conProgreso(session, AUTO_STEPS, "¿Y el *modelo*? (ej: Corolla)");
  }

  // 4) Modelo
  if (!session.data.modelo) {
    session.data.modelo = text;
    await deps.events.log("quote_step", session.userId, { step: "modelo" });
    return conProgreso(
      session,
      AUTO_STEPS,
      "¿La *versión*? (la encontrás en la cédula). Si no la tenés a mano, escribí *no sé*.",
    );
  }

  // 5) Versión (opcional: se puede saltar)
  if (!session.data.version) {
    const noLaSabe = /no s[eé]|ni idea|skip|saltar|omitir/.test(normalize(text));
    session.data.version = noLaSabe ? "no especificada" : text;
    await deps.events.log("quote_step", session.userId, { step: "version" });
    return conProgreso(session, AUTO_STEPS, "¿Tiene *GNC*? Respondé *sí* o *no*.");
  }

  // 6) GNC (sí/no)
  if (!session.data.gnc) {
    const t = normalize(text);
    // La negación se evalúa primero: "no tiene" empieza con "no" y NO debe
    // matchear el "tiene" del sí (si no, invierte el GNC y el precio).
    const esNo = /^no/.test(t);
    const esSi = !esNo && (/^s[ií]/.test(t) || t.includes("tiene"));
    if (!esSi && !esNo) {
      if (await shouldEscape(session, text, deps, "gnc")) {
        // Default seguro para destrabar (la mayoría no tiene GNC); el asesor lo
        // confirma. Mejor mantenerlo en el embudo que perderlo en un loop.
        session.data.gnc = "no";
        await deps.events.log("quote_step", session.userId, { step: "gnc" });
        return conProgreso(
          session,
          AUTO_STEPS,
          "Tranqui, no te compliques. 🙂 Como la mayoría no tiene GNC, pongo que *no* (el asesor lo confirma). ¿En qué *código postal* se guarda el auto?",
        );
      }
      return "No te entendí. ¿Tiene *GNC*? Respondé *sí* o *no*.";
    }
    session.data.gnc = esSi ? "si" : "no";
    await deps.events.log("quote_step", session.userId, { step: "gnc" });
    return conProgreso(session, AUTO_STEPS, "¿En qué *código postal* se guarda el auto?");
  }

  // 7) CP -> muestra los planes con la nota de inspección (según la condición).
  if (!session.data.cp) {
    session.data.cp = text;
    await deps.events.log("quote_step", session.userId, { step: "cp" });
    const notaInspeccion =
      session.data.condicion === "usado"
        ? "Al ser usado, la inspección se hace online cargando fotos (no hace falta llevarlo).\n\n"
        : "Al ser 0 km, no necesitás inspección.\n\n";
    return conProgreso(
      session,
      AUTO_STEPS,
      `${notaInspeccion}${PLAN_CHOICES}\n\n¿Qué plan te interesa? Respondé *1*, *2* o *3*.`,
    );
  }

  if (!session.data.plan) {
    const index = Number(text) - 1;
    const plan = AUTO_PLANS[index];
    if (!plan) {
      if (await shouldEscape(session, text, deps, "plan_auto")) return STUCK_EXIT;
      return "No te entendí el plan. Respondé *1* (Terceros Completo), *2* (con Granizo) o *3* (Todo Riesgo).";
    }
    const version =
      session.data.version && session.data.version !== "no especificada"
        ? session.data.version
        : undefined;
    const saved = await persistLead(deps, {
      producto: "auto",
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
    if (!saved) return LEAD_ERROR;
    session.data.plan = plan;
    session.stage = "post_quote";
    await deps.events.log("lead_captured", session.userId, { plan });
    // Estimación orientativa vía el puerto de cotización (hoy modelo local de
    // factores; mañana el tarifador real). El precio final lo cierra el asesor.
    const estimate = await deps.quoting.quote({
      anio: session.data.anio ?? "",
      marca: session.data.marca ?? "",
      modelo: session.data.modelo ?? "",
      condicion: session.data.condicion ?? "",
      gnc: session.data.gnc === "si",
      cp: session.data.cp ?? "",
      plan,
    });
    const autoLinea = `${session.data.marca} ${session.data.modelo} ${session.data.anio}${version ? ` (${version})` : ""}`;
    session.data.resumen = `🚗 ${autoLinea} · ${plan} · ${pesos(estimate.desde)} a ${pesos(estimate.hasta)}/mes`;
    return [
      "¡Listo! Con estos datos armo tu solicitud de cotización:",
      "",
      `🚗 Auto: ${autoLinea}`,
      `⛽ GNC: ${session.data.gnc === "si" ? "sí" : "no"}`,
      `🔧 Condición: ${session.data.condicion}`,
      `📍 CP: ${session.data.cp}`,
      `🛡️ Plan de interés: ${plan}`,
      `💰 Estimación orientativa: ${pesos(estimate.desde)} a ${pesos(estimate.hasta)} por mes`,
      "",
      "Es un rango orientativo según tu perfil. El precio final lo confirma un asesor.",
      POST_QUOTE_CTA,
    ].join("\n");
  }

  return null;
}

// Beneficios reales que La Caja incluye en el plan de hogar (relevado del sitio).
const HOGAR_INCLUYE = [
  "🐾 Asistencia y beneficios para tu mascota",
  "🔧 Emergencias: plomería, electricidad, cerrajería y gasista",
  "🧊 Alimentos por corte de luz (+12 h)",
  "🚚 Servicios: mudanza, limpieza y desinfección",
].join("\n");

// Piso razonable para la suma asegurada del contenido (ilustrativo).
const MIN_SUMA_HOGAR = 500000;

async function handleQuotingHogar(
  session: Session,
  rawText: string,
  deps: Dependencies,
): Promise<string | null> {
  const text = rawText.trim();

  // 1) Propietario o inquilino. Define si se asegura el edificio o solo el
  //    contenido (primera pregunta del cotizador real de La Caja).
  if (!session.data.tipoResidente) {
    const t = normalize(text);
    const esProp = /propiet|dueñ|dueno/.test(t);
    const esInq = /inquil|alquil|arriend/.test(t);
    if (!esProp && !esInq) {
      if (await shouldEscape(session, text, deps, "residente")) return STUCK_EXIT;
      return "No te entendí. ¿Sos *propietario* o *inquilino*?";
    }
    session.data.tipoResidente = esProp ? "propietario" : "inquilino";
    await deps.events.log("quote_step", session.userId, { step: "tipo_residente" });
    return conProgreso(
      session,
      hogarSteps(session),
      "¿La vivienda es una *casa*, un *departamento* o un *departamento en PB o PH*?",
    );
  }

  // 2) Tipo de hogar (3 opciones, como el cotizador real).
  if (!session.data.tipoHogar) {
    const t = normalize(text);
    if (/\bpb\b|\bph\b|planta baja/.test(t)) {
      session.data.tipoHogar = "departamento_pb_ph";
    } else if (/casa|chalet|duplex/.test(t)) {
      session.data.tipoHogar = "casa";
    } else if (/depto|departa|dpto|piso|monoamb/.test(t)) {
      session.data.tipoHogar = "departamento";
    } else {
      if (await shouldEscape(session, text, deps, "tipo_hogar")) return STUCK_EXIT;
      return "No te entendí. ¿Es una *casa*, un *departamento* o un *departamento en PB o PH*?";
    }
    await deps.events.log("quote_step", session.userId, { step: "tipo_hogar" });
    return conProgreso(
      session,
      hogarSteps(session),
      "¿Qué *uso* tiene? Respondé *permanente* (se vive ahí), *temporal* o *alquilada*.",
    );
  }

  // 3) Uso (ocupación: una vivienda vacía o alquilada tiene más riesgo).
  if (!session.data.uso) {
    const t = normalize(text);
    if (/tempora|transitor|fin de semana|veran/.test(t)) {
      session.data.uso = "temporal";
    } else if (/alquil|renta|arriend/.test(t)) {
      session.data.uso = "alquilo";
    } else if (/permanen|vivo|siempre/.test(t)) {
      session.data.uso = "permanente";
    } else {
      if (await shouldEscape(session, text, deps, "uso")) return STUCK_EXIT;
      return "No te entendí. ¿El uso es *permanente*, *temporal* o *alquilada*?";
    }
    await deps.events.log("quote_step", session.userId, { step: "uso" });
    // Los m² solo se piden a propietario: el inquilino no asegura el edificio.
    if (session.data.tipoResidente === "propietario") {
      return conProgreso(
        session,
        hogarSteps(session),
        "¿Cuántos *m² construidos* tiene? (entre 25 y 300)",
      );
    }
    return conProgreso(session, hogarSteps(session), "¿En qué *código postal* está la vivienda?");
  }

  // 4) Metros cuadrados (solo propietario, para estimar el edificio).
  if (session.data.tipoResidente === "propietario" && !session.data.m2) {
    const m2 = Number(text.replace(/\D/g, ""));
    if (!m2 || m2 < 25 || m2 > 300) {
      return "Necesito los *m² construidos*, entre 25 y 300.";
    }
    session.data.m2 = String(m2);
    await deps.events.log("quote_step", session.userId, { step: "m2" });
    return conProgreso(session, hogarSteps(session), "¿En qué *código postal* está la vivienda?");
  }

  // 5) Código postal (zona). Al inquilino le pedimos el contenido; al propietario
  //    no le falta nada (la suma de incendio sale de los m², como en el cotizador).
  if (!session.data.cp) {
    session.data.cp = text;
    await deps.events.log("quote_step", session.userId, { step: "cp" });
    if (session.data.tipoResidente === "inquilino") {
      return conProgreso(
        session,
        hogarSteps(session),
        "¿Cuánto costaría reponer *el contenido* (muebles, electro, etc.)? Un monto aproximado en pesos alcanza.",
      );
    }
  }

  // 6) Suma del contenido (solo inquilino).
  if (session.data.tipoResidente === "inquilino" && !session.data.sumaContenido) {
    const suma = Number(text.replace(/\D/g, ""));
    if (!suma || suma < MIN_SUMA_HOGAR) {
      return `Necesito un monto aproximado del *contenido* (desde ${pesos(MIN_SUMA_HOGAR)}).`;
    }
    session.data.sumaContenido = String(suma);
    await deps.events.log("quote_step", session.userId, { step: "suma_contenido" });
  }

  // 7) Ya tenemos todo -> estimación + lead.
  const m2 = session.data.m2 ? Number(session.data.m2) : undefined;
  const sumaContenido = session.data.sumaContenido ? Number(session.data.sumaContenido) : undefined;
  const plan = "Seguro de Hogar";
  const saved = await persistLead(deps, {
    producto: "hogar",
    userId: session.userId,
    name: session.name,
    tipoResidente: session.data.tipoResidente ?? "",
    tipoHogar: session.data.tipoHogar ?? "",
    uso: session.data.uso ?? "",
    m2,
    cp: session.data.cp ?? "",
    sumaContenido,
    plan,
  });
  if (!saved) return LEAD_ERROR;
  session.stage = "post_quote";
  session.data.plan = plan;
  await deps.events.log("lead_captured", session.userId, { plan });
  const estimate = await deps.quoting.quoteHogar({
    tipoResidente: session.data.tipoResidente ?? "",
    tipoHogar: session.data.tipoHogar ?? "",
    uso: session.data.uso ?? "",
    m2: m2 ?? 0,
    cp: session.data.cp ?? "",
    sumaContenido: sumaContenido ?? 0,
  });
  const hogarLabel =
    session.data.tipoHogar === "departamento_pb_ph"
      ? "departamento (PB o PH)"
      : (session.data.tipoHogar ?? "");
  const lineas = [
    "¡Listo! Con estos datos armo tu solicitud de *seguro de hogar*:",
    "",
    `🏠 ${hogarLabel} · ${session.data.tipoResidente} · uso ${session.data.uso}`,
  ];
  if (m2) lineas.push(`📐 ${m2} m² construidos`);
  lineas.push(`📍 CP: ${session.data.cp}`);
  if (sumaContenido) lineas.push(`📦 Contenido asegurado: ${pesos(sumaContenido)}`);
  session.data.resumen = `🏠 ${hogarLabel} · ${session.data.tipoResidente} · ${pesos(estimate.desde)} a ${pesos(estimate.hasta)}/mes`;
  lineas.push(
    `💰 Estimación orientativa: ${pesos(estimate.desde)} a ${pesos(estimate.hasta)} por mes`,
    "",
    "*Incluye:*",
    HOGAR_INCLUYE,
    "",
    "Es un rango orientativo. El valor final lo confirma un asesor.",
    POST_QUOTE_CTA,
  );
  return lineas.join("\n");
}

// Asistencias que La Caja incluye en todos los planes de AP (relevado del sitio).
const ACCIDENTES_ASISTENCIAS = [
  "🩺 Telemedicina 24 h",
  "👨‍👩‍👧 Cobertura familiar (cónyuge e hijos menores de 21)",
  "🚑 Ambulancia ilimitada",
  "🏠 Consulta médica a domicilio",
].join("\n");

/**
 * Accidentes personales: no es una cotización con factores como auto/hogar, es un
 * catálogo de planes con precio publicado. El flujo elige modalidad y plan; el
 * "precio" sale del catálogo (session.ts), no de un tarifador.
 */
async function handleAccidentes(
  session: Session,
  rawText: string,
  deps: Dependencies,
): Promise<string | null> {
  const text = rawText.trim();

  // 1) Modalidad (para quién es).
  if (!session.data.modalidad) {
    const t = normalize(text);
    let modalidad: string | undefined;
    if (t === "1" || /familiar|familia/.test(t)) modalidad = "familiar";
    else if (t === "2" || /independiente|profesional|trabajo/.test(t))
      modalidad = "trabajo-independiente";
    else if (t === "3" || /dom[eé]stic|emplead|casera/.test(t)) modalidad = "personal-domestico";
    if (!modalidad) {
      if (await shouldEscape(session, text, deps, "modalidad")) return STUCK_EXIT;
      return "No te entendí. Respondé *1* (protección familiar), *2* (trabajo independiente) o *3* (personal doméstico).";
    }
    session.data.modalidad = modalidad;
    await deps.events.log("quote_step", session.userId, { step: "modalidad" });
    const planes = ACCIDENTES_PLANES[modalidad] ?? [];
    const lista = planes
      .map((p, i) => `*${i + 1}.* ${p.nombre}: ${pesos(p.precio)}/mes\n   ${p.resumen}`)
      .join("\n\n");
    return `Planes de *${ACCIDENTES_MODALIDADES[modalidad] ?? modalidad}*:\n\n${lista}\n\n¿Cuál te interesa? Respondé el número.`;
  }

  // 2) Plan elegido -> lead con el precio publicado.
  if (!session.data.plan) {
    const modalidad = session.data.modalidad ?? "";
    const planes = ACCIDENTES_PLANES[modalidad] ?? [];
    const plan = planes[Number(text) - 1];
    if (!plan) {
      if (await shouldEscape(session, text, deps, "plan_ap")) return STUCK_EXIT;
      return "No te entendí el plan. Respondé el *número* del plan de la lista.";
    }
    const saved = await persistLead(deps, {
      producto: "accidentes",
      userId: session.userId,
      name: session.name,
      modalidad,
      plan: plan.nombre,
      precio: plan.precio,
    });
    if (!saved) return LEAD_ERROR;
    session.data.plan = plan.nombre;
    session.stage = "post_quote";
    session.data.resumen = `🛡️ ${ACCIDENTES_MODALIDADES[modalidad] ?? modalidad}: ${plan.nombre} · ${pesos(plan.precio)}/mes`;
    await deps.events.log("lead_captured", session.userId, { plan: plan.nombre });
    return [
      "¡Listo! Con esto armo tu solicitud de *accidentes personales*:",
      "",
      `🛡️ ${ACCIDENTES_MODALIDADES[modalidad] ?? modalidad}: ${plan.nombre}`,
      `💰 ${pesos(plan.precio)} por mes`,
      "",
      "*Incluye:*",
      ACCIDENTES_ASISTENCIAS,
      "",
      "Es el precio publicado (débito automático de tarjeta).",
      POST_QUOTE_CTA,
    ].join("\n");
  }

  return null;
}

// Asistencias que incluye el seguro de bici/monopatín (relevado del sitio).
const BICI_INCLUYE = [
  "🛡️ Responsabilidad civil ante terceros",
  "🔧 Mantenimiento y asistencia 24 h",
  "🚕 Traslado tuyo y del rodado ante robo o accidente",
  "🚑 Ambulancia y reposición de llaves",
].join("\n");

// Valor mínimo razonable para asegurar un rodado (ilustrativo).
const MIN_VALOR_BICI = 50000;

/**
 * Bici / monopatín: el precio es una tasa sobre el VALOR declarado del rodado
 * (~1,85% mensual, relevado del cotizador real). Un cuarto shape: pricing por
 * valor asegurado, un solo factor.
 */
async function handleBici(
  session: Session,
  rawText: string,
  deps: Dependencies,
): Promise<string | null> {
  const text = rawText.trim();

  // 1) Tipo de rodado.
  if (!session.data.tipoRodado) {
    const t = normalize(text);
    if (/monopat|scooter/.test(t)) session.data.tipoRodado = "monopatin";
    else if (/bici|bicicleta|rodado/.test(t)) session.data.tipoRodado = "bicicleta";
    else {
      if (await shouldEscape(session, text, deps, "rodado")) return STUCK_EXIT;
      return "No te entendí. ¿Es una *bicicleta* o un *monopatín eléctrico*?";
    }
    await deps.events.log("quote_step", session.userId, { step: "tipo_rodado" });
    return "¿Cuánto vale tu rodado? Un valor aproximado en pesos (es la suma que se asegura ante robo).";
  }

  // 2) Valor -> estimación + lead.
  if (!session.data.valor) {
    const valor = Number(text.replace(/\D/g, ""));
    if (!valor || valor < MIN_VALOR_BICI) {
      return `Necesito el *valor* aproximado del rodado (desde ${pesos(MIN_VALOR_BICI)}).`;
    }
    await deps.events.log("quote_step", session.userId, { step: "valor" });
    const tipoRodado = session.data.tipoRodado ?? "bicicleta";
    const estimate = await deps.quoting.quoteBici({ tipoRodado, valor });
    const saved = await persistLead(deps, {
      producto: "bici",
      userId: session.userId,
      name: session.name,
      tipoRodado,
      valor,
      plan: estimate.plan,
    });
    if (!saved) return LEAD_ERROR;
    session.data.valor = String(valor);
    session.data.plan = estimate.plan;
    session.stage = "post_quote";
    const rodadoLabel = tipoRodado === "monopatin" ? "Monopatín eléctrico" : "Bicicleta";
    session.data.resumen = `🚲 ${rodadoLabel} · ${pesos(estimate.desde)} a ${pesos(estimate.hasta)}/mes`;
    await deps.events.log("lead_captured", session.userId, { plan: estimate.plan });
    return [
      "¡Listo! Con esto armo tu solicitud:",
      "",
      `🚲 ${rodadoLabel}`,
      `💵 Valor asegurado: ${pesos(valor)}`,
      `💰 Cuota estimada: ${pesos(estimate.desde)} a ${pesos(estimate.hasta)} por mes`,
      "",
      "*Incluye:*",
      BICI_INCLUYE,
      "",
      "Es una estimación sobre el valor declarado. La cuota final la confirma un asesor.",
      POST_QUOTE_CTA,
    ].join("\n");
  }

  return null;
}
