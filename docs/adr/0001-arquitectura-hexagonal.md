# ADR 0001: Arquitectura hexagonal (Ports & Adapters)

- **Estado:** Implementada (2026-07-14). Ver "Estado de implementación".
- **Ámbito:** Estructura del código del bot de WhatsApp de seguros.

## Contexto

El proyecto empezó como un prototipo y creció: motor de conversación híbrido
(menús + LLM), base de conocimiento, captura de leads, métricas de funnel, tests
y CI. El objetivo ahora es que el producto pueda crecer sin re-escribir el núcleo
cada vez que cambia una pieza externa.

Al mirar el código, la complejidad no está en reglas de negocio profundas
(cotizar auto es un flujo de pocos pasos). Está en los **bordes**, y todos son
intercambiables:

- **Canal de mensajería:** hoy consola y Meta; mañana Twilio u otro número.
- **LLM:** hoy Anthropic directo; mañana AI Gateway u otro modelo.
- **Persistencia:** hoy archivos JSONL y sesiones en memoria; mañana Postgres,
  KV o un CRM.
- **Conocimiento:** hoy archivos markdown; mañana un CMS o una API.
- **Puntos de entrada:** webhook, CLI y script de funnel; mañana más.

Hoy el núcleo está acoplado a esos bordes: `engine.ts` y `flows.ts` importan
directamente `saveLead` y `logEvent`, `llm.ts` construye el cliente de Anthropic,
y `session.ts` es un `Map` global. Eso hace difícil testear y cambiar el core sin
tocar todo lo demás.

## Criterios de decisión

1. **Sobrevivir al churn de los bordes** sin tocar el núcleo.
2. **Testeabilidad** del dominio en aislamiento.
3. **Costo proporcional:** sin ceremonia que no compre nada hoy.
4. **Continuidad:** el proyecto ya tiene un puerto (`MessagingProvider`) con sus
   adapters; conviene extender ese patrón, no reemplazarlo.

## Opciones consideradas

- **Layered (n-capas):** simple, pero la lógica termina goteando a la capa de
  datos y cuesta testear aislado. No resuelve el churn de bordes.
- **Clean Architecture:** excelente cuando las reglas de negocio son el corazón
  difícil. Acá agregaría casos de uso, DTOs y mappers que hoy no compran valor
  (patrones por usar). Reservada para si la lógica de cotización/suscripción se
  vuelve compleja.
- **Onion:** centrada en el dominio; útil con DDD y dominio rico. Mismo exceso
  que Clean para el estado actual.
- **Hexagonal (Ports & Adapters):** un núcleo rodeado de puertos (interfaces);
  cada adapter implementa un puerto. Pensada justo para cuando el desafío es
  integrar y sobrevivir a sistemas externos con varios puntos de entrada.

Referencias: comparativas de Glushach, DEV Community y la advertencia de
sobre-ingeniería de Victor Rentea coinciden en que, si el dominio no es el
problema difícil, Clean/Onion completo es exceso; y que hexagonal es la elección
cuando el reto está en los bordes.

## Decisión

Adoptar **arquitectura hexagonal de forma pragmática**: dominio puro en el
centro, puertos en la capa de aplicación, adapters en infraestructura, y el
wiring (inversión de dependencias) en los puntos de entrada.

**Por qué hexagonal y no Clean:** el valor y el riesgo del proyecto están en los
bordes, no en reglas de negocio complejas. Hexagonal ataca exactamente eso con el
mínimo de estructura. El proyecto ya es medio hexagonal (el puerto de mensajería
existe); esto es completar el patrón, no reinventar.

### Patrones a usar, cada uno con un fin concreto

| Patrón | Fin (cambio real que habilita) |
|---|---|
| Port + Adapter | Cambiar JSONL por Postgres, o Anthropic por Gateway, sin tocar el dominio |
| Repository | Leads/sesiones/eventos detrás de una interfaz: hoy archivo, mañana CRM |
| Factory (ya existe) | Elegir adapter por configuración (`MESSAGING_PROVIDER`, `LLM_PROVIDER`) |
| Composition Root | Un único lugar de wiring por entrypoint que inyecta los adapters al core, y lo vuelve testeable |

### Lo que se evita a propósito (no sobre-ingenierizar)

Sin framework de inyección de dependencias, sin CQRS, sin event sourcing, sin un
caso de uso por acción, sin mappers/DTOs por capa. Se usan funciones donde
alcanzan funciones. Cada abstracción tiene que pagar su costo con un cambio real
que hoy ya vemos venir.

## Estructura objetivo

```
src/
  domain/          # núcleo puro, sin imports de infraestructura
    conversation/  # engine, flows, modelo de sesión, tipos de dominio
  application/
    ports/         # LlmPort, LeadRepository, EventSink, SessionStore,
                   # KnowledgeSource, MessagingProvider
    process-message.ts   # orquestación (hoy engine.ts), recibe los puertos
  infrastructure/  # adapters concretos
    messaging/     # cli, meta
    llm/           # anthropic
    persistence/   # jsonl-leads, jsonl-events, memory-session
    knowledge/     # filesystem
  config/
  main/            # composition root: server.ts, scripts/{chat,funnel}
```

**Regla que sostiene todo, verificable de forma automática:** `domain/` no
importa de `infrastructure/`. Nunca. Las dependencias apuntan hacia adentro.

## Plan de implementación (incremental, borde por borde)

Cada paso es un PR con tests en verde. Para no romper todo de una, los puertos se
inyectan primero con valores por defecto (los adapters actuales), y el
composition root real llega al final.

1. **Persistencia:** definir `LeadRepository` y `EventSink`; los JSONL actuales
   los implementan; inyectarlos en la orquestación y en los flujos. Quita los
   imports directos de `saveLead`/`logEvent`.
2. **LLM:** `LlmPort` con un adapter de Anthropic; inyectar. `llm.ts` deja de
   construir el cliente por su cuenta.
3. **Sesiones:** `SessionStore` con un adapter en memoria; elimina el `Map`
   global.
4. **Conocimiento:** `KnowledgeSource` con un adapter de filesystem.
5. **Reorganización final:** mover a `domain/`, `application/`, `infrastructure/`
   y `main/`; composition root que arma e inyecta en cada entrypoint. Agregar un
   chequeo que falle si `domain/` importa de `infrastructure/`.

## Estado de implementación

Los cinco pasos se completaron, cada uno como un PR con tests en verde:

1. Persistencia detrás de puertos (`LeadRepository`, `EventSink`). PR #7.
2. LLM detrás de `LlmPort` (adapter Anthropic). PR #8.
3. Sesiones detrás de `SessionStore` (adapter en memoria). PR #9.
4. Conocimiento detrás de `KnowledgeSource` (adapter filesystem). PR #10.
5. Reorganización a `domain/application/infrastructure/main` + composition root +
   chequeo de la regla de dependencias en CI (`pnpm check:arch`). PR #11.

**La prueba de que el diseño paga:** después, para llevar el proyecto a
production-ready, los puertos se hicieron async (PR #14) y se sumaron adapters de
Postgres (leads/eventos) y Redis (sesiones) elegibles por config (PR #15). Cambiar
de storage fue **escribir un adapter nuevo, sin tocar el núcleo**, que es justo lo
que esta decisión buscaba. Los adapters JSONL/memoria siguen como default sin
dependencias.

## Consecuencias

**Positivas**

- El núcleo se testea sin tocar disco, red ni LLM (inyectando fakes).
- Cambiar un borde (storage, LLM, canal) es un adapter nuevo, no una cirugía.
- La estructura "grita" el dominio y separa lo estable de lo volátil.

**Negativas / costo**

- Más archivos e indirección (interfaces + adapters).
- Hay que sostener la disciplina de la regla de dependencias.

Se asume porque el perfil del proyecto (mucho borde intercambiable, poco dominio
complejo) es justo donde ese costo se paga solo.
