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
| **B** | **Nudge "¿seguís ahí?"** ~30 min tras una pausa en flujo, dentro de la ventana (mensaje libre). | Medio (necesita un job proactivo que escanee sesiones inactivas) | Roadmap |
| **C** | **Re-enganche >24h** con plantilla de "cotización a medias" (cadencia 24/72h). | Alto (plantilla aprobada por Meta + opt-in + costo, es *marketing*) | Roadmap/producción |

**Criterio.** A es barato, no depende de la plataforma ni de infra proactiva, y
ataca el problema que se ve hoy: volver y que el bot pregunte algo sin contexto (o
peor, perder el progreso). B y C dependen de un scheduler (B) y de toda la máquina de
plantillas/opt-in de WhatsApp (C), que además choca con que la demo no puede usar
WhatsApp real (bloqueo de verificación de negocio, ver `docs/conectar-meta.md`).

## 6. Lo que se hizo (mejora A)

`Session.lastActivityAt` guarda el ISO del último mensaje. En `handleFlow`, si el
usuario vuelve a mitad de un flujo (cotización, cierre o captura de contacto) tras más
de `RESUME_GAP_MS` (30 min), en vez de seguir mudo se le devuelve un mensaje de
"retomamos" con la **pregunta pendiente sacada del historial** (así no se duplican los
textos de cada paso), y el *menú* sigue disponible para arrancar de nuevo. El umbral
se dispara una sola vez, porque `lastActivityAt` se actualiza en cada mensaje.

## Fuentes

- Meta for Developers, *Service messages / 24-hour window*: developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages
- YCloud, *WhatsApp 24-Hour Conversation Window Explained*.
- Quidget, *Chatbot Session Timeout Settings: Best Practices*.
- Velaro, *What Causes Chatbot Drop-Off and How to Fix It*.
- Neuwark, *WhatsApp Cart Recovery Playbook (2026)*; Kanal, *Abandoned Cart Recovery Templates*.
