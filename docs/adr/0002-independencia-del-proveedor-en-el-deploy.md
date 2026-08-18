# ADR 0002: Independencia del proveedor en el deploy de la demo

- **Estado:** Aceptada (2026-08-18).
- **Ámbito:** Infraestructura del deploy de la demo pública.
- **Reemplaza:** la sección de persistencia de `docs/deploy.md`, que declaraba la
  base dentro del blueprint de Render.
- **En una línea:** lo que la demo no puede perder (los datos y la URL) deja de
  vivir adentro del proveedor de compute, sin dejar de costar US$0.

## Contexto

La demo pública se cayó. El síntoma era raro: el borde de Render atendía, el
handshake TLS y el stream HTTP/2 abrían bien, pero el origen no respondía nunca.
Ni 500 ni página de error: la request quedaba colgada.

La causa fue que **el Postgres free de Render expira**. Su documentación lo dice
sin vueltas: las bases free "expire 30 days after creation", hay 14 días de
gracia, y después Render "deletes the database (along with all of its data)". El
proyecto se desplegó el 2026-07-18 y se cayó alrededor del 2026-08-17. Treinta
días.

El modo de falla encadena así: `buildDependencies()` llama a `ensureSchema(pool)`
al arrancar (`src/main/container.ts`), eso no puede conectar contra una base que
ya no existe, el proceso no llega a escuchar, el `healthCheckPath: /health` nunca
pasa y la plataforma deja las requests esperando a un origen que no va a levantar.

Dos cosas lo hicieron peor de lo necesario:

1. **Nadie se enteró.** La caída la detectó un chequeo semanal de link-rot del
   portfolio, no un monitor. Pasó cerca de una semana sirviendo un timeout.
2. **El artículo del portfolio anticipaba una falla parecida pero distinta.** El
   caso avisa que "la primera carga puede tardar unos segundos en despertar"
   (el cold start del free tier). Un lector que llegó esa semana esperó, no pasó
   nada, y esa aclaración se leyó como excusa. Anticipar una falla y que después
   falle por otro motivo es peor que no anticipar nada.

## Criterios de decisión

1. **Costo cero.** La demo es una vitrina de portfolio, no un producto con
   ingresos. Cualquier opción que requiera pagar queda descartada por definición.
2. **Que no caduque.** Es la restricción que originó este ADR. Una capa gratuita
   con fecha de vencimiento no es gratuita: es una bomba de tiempo con la mecha
   corriendo.
3. **Que responda cuando alguien hace clic.** Si un reclutador abre la demo y
   espera un minuto, se va. El cold start no es un detalle cosmético.
4. **Que la caída se sepa el mismo día.**

## Decisión

**El compute se queda en Render free; la base de datos se va a Neon free; la URL
pública deja de ser la del proveedor.**

Nada en el `render.yaml` declara ya una base. `DATABASE_URL` pasa a ser un
secreto (`sync: false`) que se carga a mano apuntando a Neon.

El criterio de fondo: el compute es reemplazable y perderlo no cuesta nada, así
que puede vivir en una capa gratuita. Los datos y la URL no son reemplazables, así
que no.

Se agregan tres piezas gratuitas más:

- **UptimeRobot** (free) pingueando `/health` cada 5 minutos. Cumple dos
  funciones con un solo monitor: mantiene el servicio despierto (Render duerme a
  los 15 min de inactividad) y avisa por mail cuando se cae de verdad.
- El monitor es de tipo **keyword** contra `insurance-advisor-bot OK`, no de
  status code, porque un 200 no prueba que la app esté viva: puede venir de una
  página de error o de un redirect de la infraestructura de adelante.
- **Un dominio propio, `bot.ivandujaut.com`**, como URL pública de la demo. Ver
  "El dominio propio" más abajo.

### El dominio propio

La URL de la demo está escrita en cuatro lugares del portfolio (los dos `demo:`
del frontmatter y las dos líneas de cierre, en ES y EN). Mientras esa URL sea la
del proveedor, **cada mudanza de plataforma es una edición de contenido**, y el
contenido tiene su propio flujo de revisión: no es algo que uno quiera disparar
por una decisión de infraestructura.

Con `bot.ivandujaut.com` esa dependencia se corta: mudarse pasa a ser cambiar un
registro DNS, y el portfolio no se entera.

Es gratis. El plan Hobby de Render (el de US$0) incluye 2 dominios propios, y los
certificados TLS se emiten y renuevan solos. Y no rompe nada en el camino: los
servicios con dominio propio conservan también su subdominio `onrender.com`, así
que las dos URLs conviven y ningún link viejo se cae.

El monitor de UptimeRobot apunta al dominio propio, no al de Render, para que
cubra también que el DNS y el certificado sigan sanos.

### Por qué Neon y no las otras

| Opción | Por qué no |
|---|---|
| Postgres free de Render | Expira a los 30 días y borra los datos. Es la causa raíz |
| Supabase free | Pausa el proyecto tras 7 días de baja actividad y hay que restaurarlo a mano. Para una demo que puede pasar semanas sin visitas, es peor |
| Fly Managed Postgres | Desde US$38/mes. Viola el criterio 1 |
| Neon free | 0.5 GB, 100 CU-hours/mes, no expira, y su FAQ es explícito: "None of these limits delete your data" |

El scale-to-zero de Neon (5 min, despierta en cientos de ms) no molesta, y de
hecho encaja bien: el `/health` que pinguea el keep-alive no toca la base, así
que Neon duerme y despierta recién en el primer mensaje real del chat. Ese
despertar ya estaba cubierto por `retryTransient` en
`src/infrastructure/persistence/postgres.ts`, que reintenta con backoff solo los
errores de conexión transitorios.

### Por qué el compute no se movió

Se evaluaron Fly.io (~US$2/mes, sin free tier) y Vercel Hobby (US$0). Ambos
resuelven el cold start de forma nativa, sin depender de un ping externo.

El dominio propio no entró en esta comparación, aunque al principio parecía un
punto a favor de Vercel: Render también lo da gratis (2 dominios en el plan
Hobby, certificados incluidos). No era un argumento para mudarse.

No se movió por tres razones:

1. Fly cuesta plata. Criterio 1.
2. Vercel exige refactorizar `server.ts` para exportar el handler en vez de usar
   `serve()`, y sobre todo **multiplica el rate limiter**: `src/main/rate-limit.ts`
   es en memoria y por instancia. En un runtime que escala a varias instancias, el
   límite de 20 requests por minuto por IP se multiplica por instancia, con la API
   paga de Anthropic detrás de `POST /chat`. Un contenedor único protege mejor el
   gasto.
3. El compute nunca fue el problema. Cambiarlo habría sido arreglar lo que no
   estaba roto.

## Consecuencias

**A favor:**

- El deploy deja de tener fecha de vencimiento.
- Cambiar de proveedor de base es cambiar una variable de entorno. La
  arquitectura hexagonal del [ADR 0001](0001-arquitectura-hexagonal.md) es lo que
  hace que esta migración sea cero líneas de código, y esta es la primera vez que
  ese diseño se cobra en producción.
- La demo deja de tener cold start, así que el aviso de "puede tardar unos
  segundos en despertar" del caso del portfolio deja de ser necesario.
- Las caídas se saben el mismo día.
- **Mudarse de plataforma deja de tocar el portfolio.** Es la consecuencia que
  más vale a futuro: la próxima decisión de infraestructura se toma por sus
  méritos, sin arrastrar una edición de contenido con su propio flujo de revisión.

**En contra, y asumido:**

- **La cuenta de horas queda ajustada.** Render da 750 instance-hours por
  workspace por mes calendario. Un servicio despierto 24/7 consume 744 en un mes
  de 31 días: entra con 6 horas de margen, pero **solo si es el único free web
  service del workspace**. Si aparece un segundo, se caen los dos a fin de mes.
  Es una restricción que hay que recordar, y está anotada en `render.yaml` y en
  `docs/deploy.md`.
- **Un proveedor más que administrar.** La base ya no se crea sola con el
  blueprint: hay que crearla en Neon y pegar la URL a mano. Un paso más en el
  setup a cambio de que no se autodestruya.
- **El DNS pasa a ser parte del deploy.** Antes, si la demo no cargaba, el
  problema estaba en Render y nada más. Ahora puede estar en Render, en Neon, en
  el CNAME de Cloudflare o en el certificado. Más superficie de falla a cambio de
  independencia del proveedor. El monitor apunta al dominio propio justamente
  para que esa superficie extra quede vigilada.
- **Hay que acordarse de la nube gris.** El CNAME tiene que quedar en "DNS only"
  hasta que Render emita el certificado, y el modo SSL de Cloudflare en "Full".
  Son dos settings fáciles de olvidar y difíciles de diagnosticar después.

## Pendiente

- Evaluar mover el rate limiter a un store compartido. Hoy la decisión de quedarse
  en un solo contenedor es en parte una consecuencia de que sea en memoria: si
  dejara de serlo, se abren opciones de compute que hoy están cerradas.
