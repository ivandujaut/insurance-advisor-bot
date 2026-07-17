# Inactividad, timeout y re-enganche: benchmark

Qué hacer cuando pasa mucho tiempo sin respuesta en el chat. Sintetiza cómo lo
resuelve la industria (con la ventana de 24h de WhatsApp como restricción central),
el estado actual del bot, y las mejoras priorizadas. Base para la Decisión de
producto sobre retomar/re-enganche.

## 1. La restricción que manda: la ventana de 24h de WhatsApp

Cada mensaje entrante del usuario abre (o reinicia) una **ventana de 24 horas**.
Dentro de la ventana, el negocio puede mandar mensajes libres. Fuera de la ventana,
solo se pueden enviar **plantillas pre-aprobadas** por Meta.

- Desde julio 2025, las plantillas *utility* dentro de la ventana no cobran; el
  modelo pasó a facturación por plantilla.
- Un re-enganche del estilo "volvé a terminar tu cotización" es **marketing**
  (objetivo comercial), no *utility*: cuesta y requiere opt-in previo.

Esto parte el problema en **dos horizontes** con soluciones distintas: dentro de la
ventana (mensaje libre) y fuera de la ventana (plantilla + costo + opt-in).

## 2. Patrones de timeout de chatbots

- **Idle timeout** (el más común): se cierra tras N minutos de silencio (ej: 10 min).
- **Absoluto**: se cierra a un tiempo fijo, aunque el usuario siga activo.
- **Deslizante**: cada acción reinicia el reloj. Es lo que usa nuestro bot (TTL de
  sesión de 24h que se renueva en cada mensaje).

Best practice de re-enganche: un **"¿seguís ahí?"** ~30 min después del último
mensaje, que rescata al distraído y lo mantiene en control. Antipatrón a evitar: el
bot pregunta algo y se queda esperando indefinidamente, sin timeout, sin re-enganche
y sin escalar.

## 3. Recuperación de "carrito abandonado" (aplica a una cotización a medias)

En comercio conversacional, re-enganchar una compra abandonada recupera **15-30%**,
con una cadencia típica de **1h / 24h / 72h**, personalizada (nombre, el ítem exacto,
CTA directo). WhatsApp tiene ~98% de open rate, por eso es el canal preferido. Una
cotización de seguro abandonada a mitad es el mismo problema: intención viva que se
enfría.

## 4. Estado actual del bot

| Horizonte | Hoy |
|---|---|
| Pausa corta (minutos, misma sesión) | La sesión sigue viva, pero el bot continúa **en silencio** sin reconocer el hueco; y si el usuario vuelve con un "hola" lo manda al menú y pierde el progreso. |
| Pausa larga (>24h) | La sesión de Redis expira (TTL deslizante de 24h) → saludo desde cero, progreso perdido, sin aviso. |
| Siempre | El bot es 100% reactivo: nunca escribe primero. |

## 5. Mejoras priorizadas

| # | Mejora | Costo | Estado |
|---|---|---|---|
| **A** | **Retomar con conciencia del hueco**: si el usuario vuelve a mitad de un flujo tras >30 min, reconocer el tiempo y re-mostrar la pregunta pendiente, con opción de arrancar de nuevo. In-chat, sin LLM ni plataforma. | Bajo | **Hecho** |
| **B** | **Nudge "¿seguís ahí?"** ~30 min tras una pausa en flujo, dentro de la ventana (mensaje libre). El bot escribe primero. | Medio (job proactivo que barre sesiones inactivas) | **Hecho** (opt-in, solo WhatsApp) |
| **C** | **Re-enganche >24h** con plantilla de "cotización a medias". | Alto (plantilla aprobada por Meta + opt-in + costo, es *marketing*) | **Hecho** (código; falta opt-in y aprobar la plantilla) |

**Criterio.** A es barato, no depende de la plataforma ni de infra proactiva, y
ataca el problema que se ve hoy: volver y que el bot pregunte algo sin contexto (o
peor, perder el progreso). B y C dependen de un scheduler (B) y de toda la máquina de
plantillas/opt-in de WhatsApp (C), que además choca con que la demo no puede usar
WhatsApp real (bloqueo de verificación de negocio, ver `docs/conectar-meta.md`).

## 6. Lo que se hizo

**A — Retomar (reactivo).** `Session.lastActivityAt` guarda el ISO del último mensaje.
En `handleFlow`, si el usuario vuelve a mitad de un flujo (cotización, cierre o captura
de contacto) tras más de `RESUME_GAP_MS` (30 min), en vez de seguir mudo se le devuelve
un mensaje de "retomamos" con la **pregunta pendiente sacada del historial** (así no se
duplican los textos de cada paso), y el *menú* sigue disponible para arrancar de nuevo.
Se dispara una sola vez, porque `lastActivityAt` se actualiza en cada mensaje.

**B — Nudge proactivo (opt-in).** El paso de reactivo a proactivo: el bot escribe
primero. Un barrido (`application/reengagement.ts`) recorre las sesiones activas
(`SessionStore.listActive`, con SCAN/keys en Redis) y, a las que están a mitad de flujo
e inactivas entre 30 min y 24h (dentro de la ventana de WhatsApp), les manda un
"¿seguís por ahí?" con contexto, marcando cada una para no repetir (`data.nudged`, que
se resetea cuando el usuario responde). Corre en un `setInterval` en el server, gateado
por `REENGAGEMENT_ENABLED` (apagado por default): **solo tiene canal en WhatsApp** (la
web es request/response, sin push), por eso no se puede demostrar en la demo web. La
lógica de a-quién (`shouldNudge`) y qué (`buildNudge`) es pura y testeada.

**C — Plantilla fuera de la ventana (>24h).** Fuera de las 24h ya no se puede mandar un
mensaje libre, solo una plantilla aprobada. Se agregó `MessagingProvider.sendTemplate`
(el `MetaProvider` la manda por la Cloud API con `type: template`; el CLI la loguea) y un
segundo barrido (`runTemplateReengagement`) que, a las sesiones a mitad de flujo e
inactivas entre 24h y `maxHours` (72h), les manda la plantilla `cotizacion_a_medias` con
el producto como variable, y marca `data.templateSent`. Gateado por
`REENGAGEMENT_TEMPLATE_ENABLED` (off por default). **Dos prerequisitos de producción, aún
pendientes:** (1) la plantilla tiene que estar **aprobada en Meta**, y (2) como es
*marketing*, solo se manda con **opt-in** del usuario (`data.optIn`), que hoy no se
captura en ningún lado; sin eso, `shouldSendTemplate` nunca dispara (correcto por
política: mandar marketing sin consentimiento puede banear el número). Capturar el opt-in
(ej: una línea de consentimiento al dejar el contacto) es el próximo paso.

## Fuentes

- Meta for Developers, *Service messages / 24-hour window*: developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages
- YCloud, *WhatsApp 24-Hour Conversation Window Explained*.
- Quidget, *Chatbot Session Timeout Settings: Best Practices*.
- Velaro, *What Causes Chatbot Drop-Off and How to Fix It*.
- Neuwark, *WhatsApp Cart Recovery Playbook (2026)*; Kanal, *Abandoned Cart Recovery Templates*.
