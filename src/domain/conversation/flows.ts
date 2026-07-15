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
import { ACCIDENTES_MODALIDADES, ACCIDENTES_PLANES, AUTO_PLANS, type Session } from "./session.js";

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

const MAIN_MENU = [
  "👋 Hola, soy el asistente de seguros de La Caja. Te ayudo a encontrar y cotizar tu cobertura.",
  "",
  "1️⃣ Cotizar mi seguro de auto",
  "2️⃣ Cotizar mi seguro de hogar",
  "3️⃣ Cotizar accidentes personales",
  "4️⃣ Comparar los planes de auto",
  "5️⃣ Tengo una duda",
  "6️⃣ Hablar con un asesor",
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
    return ADVISOR_REPLY;
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
      session.stage = "quoting_hogar";
      session.data = {};
      await deps.events.log("quote_started", session.userId);
      return "Buenísimo, cotizamos tu *seguro de hogar*. 🏠\n\n¿Sos *propietario* o *inquilino*?";
    case "3":
      session.stage = "quoting_accidentes";
      session.data = {};
      await deps.events.log("quote_started", session.userId);
      return "Genial, *accidentes personales*. 🩹\n\n¿Para quién es? Respondé:\n*1* Protección familiar\n*2* Trabajo independiente\n*3* Personal doméstico";
    case "4":
      // La comparación es informativa; el usuario sigue en el menú.
      await deps.events.log("plan_comparison_viewed", session.userId);
      return `${PLAN_COMPARISON}\n\nEscribí *1* para cotizar, o preguntame lo que quieras.`;
    case "5":
      // Duda abierta -> la responde el LLM con la base de conocimiento.
      return null;
    case "6":
      session.stage = "idle";
      await deps.events.log("advisor_requested", session.userId);
      return ADVISOR_REPLY;
    default:
      // Cualquier otra cosa desde el menú es una consulta abierta -> LLM.
      return null;
  }
}

// Rango de años válido para cotizar (como el cotizador web).
const MIN_AUTO_YEAR = 2006;
const CURRENT_YEAR = new Date().getFullYear();

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
    await deps.events.log("lead_captured", session.userId, { plan });
    // Estimación orientativa vía el puerto de cotización (hoy modelo local de
    // factores; mañana el tarifador real). El precio final lo cierra el asesor.
    const estimate = await deps.quoting.quote({
      anio: session.data.anio ?? "",
      condicion: session.data.condicion ?? "",
      gnc: session.data.gnc === "si",
      cp: session.data.cp ?? "",
      plan,
    });
    const autoLinea = `${session.data.marca} ${session.data.modelo} ${session.data.anio}${version ? ` (${version})` : ""}`;
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
      "Es un rango orientativo según tu perfil. Un asesor te confirma el precio final y las opciones de pago (online: tarjeta de crédito o débito por CBU, con descuento).",
      "",
      "Escribí *menú* para hacer otra consulta.",
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
      return "No te entendí. ¿Sos *propietario* o *inquilino*?";
    }
    session.data.tipoResidente = esProp ? "propietario" : "inquilino";
    await deps.events.log("quote_step", session.userId, { step: "tipo_residente" });
    return "¿La vivienda es una *casa*, un *departamento* o un *departamento en PB o PH*?";
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
      return "No te entendí. ¿Es una *casa*, un *departamento* o un *departamento en PB o PH*?";
    }
    await deps.events.log("quote_step", session.userId, { step: "tipo_hogar" });
    return "¿Qué *uso* tiene? Respondé *permanente* (se vive ahí), *temporal* o *alquilada*.";
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
      return "No te entendí. ¿El uso es *permanente*, *temporal* o *alquilada*?";
    }
    await deps.events.log("quote_step", session.userId, { step: "uso" });
    // Los m² solo se piden a propietario: el inquilino no asegura el edificio.
    if (session.data.tipoResidente === "propietario") {
      return "¿Cuántos *m² construidos* tiene? (entre 25 y 300)";
    }
    return "¿En qué *código postal* está la vivienda?";
  }

  // 4) Metros cuadrados (solo propietario, para estimar el edificio).
  if (session.data.tipoResidente === "propietario" && !session.data.m2) {
    const m2 = Number(text.replace(/\D/g, ""));
    if (!m2 || m2 < 25 || m2 > 300) {
      return "Necesito los *m² construidos*, entre 25 y 300.";
    }
    session.data.m2 = String(m2);
    await deps.events.log("quote_step", session.userId, { step: "m2" });
    return "¿En qué *código postal* está la vivienda?";
  }

  // 5) Código postal (zona). Al inquilino le pedimos el contenido; al propietario
  //    no le falta nada (la suma de incendio sale de los m², como en el cotizador).
  if (!session.data.cp) {
    session.data.cp = text;
    await deps.events.log("quote_step", session.userId, { step: "cp" });
    if (session.data.tipoResidente === "inquilino") {
      return "Por último: ¿cuánto costaría reponer *el contenido* (muebles, electro, etc.)? Un monto aproximado en pesos alcanza.";
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
  session.stage = "idle";
  await deps.leads.save({
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
  lineas.push(
    `💰 Estimación orientativa: ${pesos(estimate.desde)} a ${pesos(estimate.hasta)} por mes`,
    "",
    "*Incluye:*",
    HOGAR_INCLUYE,
    "",
    "Es un rango orientativo. Un asesor confirma el valor final del contenido y del edificio, y las opciones de pago (CBU o tarjeta).",
    "",
    "Escribí *menú* para hacer otra consulta.",
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
      return "No te entendí el plan. Respondé el *número* del plan de la lista.";
    }
    session.data.plan = plan.nombre;
    session.stage = "idle";
    await deps.leads.save({
      producto: "accidentes",
      userId: session.userId,
      name: session.name,
      modalidad,
      plan: plan.nombre,
      precio: plan.precio,
    });
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
      "Es el precio publicado (débito automático de tarjeta). Un asesor te ayuda a contratarlo y con las opciones de pago.",
      "",
      "Escribí *menú* para hacer otra consulta.",
    ].join("\n");
  }

  return null;
}
