# De prototipo a production-ready: la arquitectura del bot de La Caja

*Segunda parte del caso de estudio. En la [primera](blog-la-caja-caso-de-estudio.md)
conté la decisión de producto: dónde jugar. Acá va la de ingeniería: cómo llevé
ese prototipo a un estado listo para crecer sin re-escribirlo. Lectura ~7 min.*

> Proyecto y análisis independientes, con datos públicos de La Caja. El bot es un
> prototipo funcional, no un sistema en producción.

---

El prototipo andaba: menús para lo estructurado, un modelo de lenguaje para las
dudas abiertas, captura de leads. Pero por dentro estaba atado con alambre. El
motor de conversación importaba directo la función que guardaba el lead en un
archivo. El cliente de Anthropic se construía dentro del módulo que armaba el
prompt. Las sesiones vivían en un `Map` global.

Todo funcionaba, y todo estaba acoplado. Para un prototipo está perfecto. El
problema aparece cuando querés crecer: cambiar el archivo por una base, Anthropic
por otro proveedor, el `Map` por Redis para correr varias instancias. Con ese
acoplamiento, cada cambio es cirugía a corazón abierto.

Así que antes de sumar features, paré a decidir la arquitectura.

## Por qué hexagonal, y no Clean

Hay un reflejo feo en ingeniería: elegir la arquitectura más sofisticada que uno
conoce. Es al revés. La arquitectura correcta no es la más elegante, es la que
ataca **dónde está el cambio**.

Miré el proyecto con honestidad. La complejidad no está en reglas de negocio
profundas: cotizar un seguro es un flujo guiado de pocos pasos. Está en los
**bordes**, y todos son intercambiables:

- **Canal**: hoy consola y WhatsApp; mañana Twilio.
- **LLM**: hoy Anthropic; mañana el AI Gateway u otro modelo.
- **Persistencia**: hoy archivos; mañana Postgres o un CRM.
- **Sesiones**: hoy memoria; mañana Redis.
- **Conocimiento**: hoy markdown; mañana un CMS.
- **Cotización**: hoy un modelo local de factores; mañana el tarifador real de La Caja.

Eso es territorio de **arquitectura hexagonal (Ports & Adapters)**: un núcleo
rodeado de puertos (interfaces), con adapters intercambiables afuera. No elegí
Clean Architecture completa: agregaría casos de uso, DTOs y mappers que hoy no
compran nada. Sería usar patrones por usar, justo lo que hay que evitar. La
decisión, con su benchmark y sus trade-offs, quedó registrada en un
[ADR](adr/0001-arquitectura-hexagonal.md).

## El patrón: puertos que el núcleo conoce, adapters que no

Un puerto es una interfaz que vive en el centro. Por ejemplo, el repositorio de
leads:

```ts
export interface LeadRepository {
  save(lead: LeadInput): Promise<void>;
}
```

El núcleo llama `deps.leads.save(...)` y no sabe si detrás hay un archivo, una
base o un CRM. Todos los bordes se agrupan en un solo objeto de dependencias que
el motor recibe inyectado:

```ts
export interface Dependencies {
  leads: LeadRepository;
  events: EventSink;
  llm: LlmPort;
  sessions: SessionStore;
  knowledge: KnowledgeSource;
  quoting: QuotingProvider;
}
```

La regla que sostiene todo es simple: **el núcleo (`domain/` y `application/`) no
importa de `infrastructure/`**. Las dependencias apuntan hacia adentro. Y como
una regla que depende de la buena voluntad se afloja sola, la puse a verificarse
en el CI con un script que falla si alguien la cruza:

```
✅ Arquitectura OK: domain/ y application/ no importan de infrastructure/ ni main/.
```

## El refactor, borde por borde

No lo hice de una. Fueron cinco pasos, cada uno un pull request con los tests en
verde, sin cambiar el comportamiento del bot:

1. Persistencia (leads y eventos) detrás de puertos.
2. El LLM detrás de `LlmPort`.
3. Las sesiones detrás de `SessionStore`.
4. El conocimiento detrás de `KnowledgeSource`.
5. La reorganización final a `domain / application / infrastructure / main`, con
   el composition root que arma e inyecta todo.

El truco para no romper nada en el camino: los puertos se inyectaron primero con
valores por defecto (los adapters que ya existían), y el composition root real
llegó al final. Nunca hubo un commit gigante que dejara el proyecto sin compilar.
Cada paso era chico, revisable y reversible.

## La prueba de fuego: de archivos a Postgres y Redis

Acá se ve si el diseño sirve o era decoración. Para dejar el proyecto
production-ready quería los leads en Postgres y las sesiones en Redis.

Primero hubo que hacer una cosa: **volver async los puertos**. Guardar en un
archivo puede ser síncrono; hablar con Postgres o Redis, no. Ese cambio de firma
recorrió el núcleo (un refactor propio, con su PR y sus tests). Con eso hecho, lo
demás fue escribir adapters.

El de Postgres para leads es esto, básicamente:

```ts
export function createPostgresLeadRepository(pool: Pool): LeadRepository {
  return {
    async save(lead) {
      // Columnas comunes; lo específico de cada producto va a un jsonb.
      const { userId, name, producto, plan, ...detalle } = lead;
      await pool.query(
        `INSERT INTO leads (user_id, name, producto, plan, detalle)
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [userId, name ?? null, producto, plan, JSON.stringify(detalle)],
      );
    },
  };
}
```

Y cuál adapter usar se elige por configuración, en el composition root:

```ts
if (config.persistence.driver === "postgres") {
  const pool = createPgPool();
  await ensureSchema(pool);
  leads = createPostgresLeadRepository(pool);
  events = createPostgresEventSink(pool);
} else {
  leads = createJsonlLeadRepository();
  events = createJsonlEventSink();
}
```

El resultado es el que buscaba: **cambiar de storage fue escribir un adapter
nuevo, sin tocar una línea del núcleo**. Los adapters viejos (archivos, memoria)
siguen siendo el default sin dependencias, ideales para desarrollo, tests y una
demo sin levantar nada.

Y no me quedé en el "compila". Escribí tests de integración que corren contra un
Postgres y un Redis de verdad, levantados como service containers en el CI. Guardan
un lead, lo leen de vuelta, hacen el roundtrip de una sesión. Localmente, sin esas
bases, se saltean solos.

## Cuatro productos sin tocar el núcleo

La prueba más fuerte llegó después, sumando líneas. Auto, hogar, accidentes
personales y bici no comparten forma: uno estima por factores, otro por un valor
declarado, otro es un catálogo de precio fijo. Y aun así el motor no cambió.

La clave fue modelar el lead como una **unión discriminada** por producto:

```ts
type Lead = AutoLead | HogarLead | AccidentesLead | BiciLead;
```

Cada producto agrega su tipo y su flujo; el resto del sistema los distingue por el
campo `producto`, y el compilador obliga a contemplar cada caso. En Postgres, en
vez de una columna por atributo, quedaron las comunes (`producto`, `plan`) más un
`detalle` jsonb con lo específico de cada línea. El resultado: sumar un producto
fue agregar un flujo y, si estima, un tarifador detrás del mismo puerto. Cero
cambios en el núcleo, cero migraciones de columnas. Los bordes crecieron; el
corazón quedó intacto.

## Lo que sostiene todo

La arquitectura sola no alcanza. Alrededor hay una red de seguridad:

- **Tests**: el núcleo se prueba inyectando fakes en memoria, sin tocar disco, red
  ni LLM. Los adapters, con tests de integración.
- **CI**: en cada PR corre typecheck, la regla de dependencias y los tests (con las
  bases reales).
- **Biome** como formatter y linter (una sola herramienta, sin sprawl de config).
- **Git hooks**: commitlint valida los mensajes, lint-staged formatea lo que va al
  commit, y un hook de pre-push corre los chequeos pesados antes de compartir.
- **Docker** multi-stage y un `docker compose up` que levanta el bot con Postgres y
  Redis. Node 20 LTS pineado para que dev, CI y prod hablen el mismo idioma.

## Lo que NO hice (a propósito)

Tan importante como lo que agregué es lo que dejé afuera: nada de framework de
inyección de dependencias, nada de CQRS, nada de event sourcing, nada de un caso
de uso por acción. Cada abstracción tiene que pagar su costo con un cambio real que
ya se ve venir. Un puerto para el LLM se justifica porque vas a cambiar de
proveedor. Un CQRS no, porque no hay una complejidad de lectura/escritura que lo
pida. Patrones con un fin, no por moda.

## Qué me llevo

La frase que resume todo: la arquitectura correcta no es la más sofisticada, es la
que ataca dónde está el cambio. Y la evidencia de que esta pagó no es un
diagrama lindo. Es que el día que cambié archivos por Postgres, escribí un archivo
nuevo y no toqué el núcleo. Eso es lo que estás comprando cuando invertís en
arquitectura: que el próximo cambio sea barato.

---

*El código está en un repositorio con el detalle completo: los puertos, los
adapters, los tests y el ADR. Este post cuenta el porqué; el repo, el cómo.*
