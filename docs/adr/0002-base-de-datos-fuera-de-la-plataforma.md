# ADR 0002: La base de datos vive fuera de la plataforma de compute

- **Estado:** Aceptada (2026-08-17).
- **Ámbito:** Infraestructura del deploy de la demo pública.
- **Reemplaza:** la sección de persistencia de `docs/deploy.md`, que declaraba la
  base dentro del blueprint de Render.

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

**El compute se queda en Render free; la base de datos se va a Neon free.**

Nada en el `render.yaml` declara ya una base. `DATABASE_URL` pasa a ser un
secreto (`sync: false`) que se carga a mano apuntando a Neon.

Se agregan dos piezas gratuitas más:

- **UptimeRobot** (free) pingueando `/health` cada 5 minutos. Cumple dos
  funciones con un solo monitor: mantiene el servicio despierto (Render duerme a
  los 15 min de inactividad) y avisa por mail cuando se cae de verdad.
- El monitor es de tipo **keyword** contra `insurance-advisor-bot OK`, no de
  status code, porque un 200 no prueba que la app esté viva: puede venir de una
  página de error o de un redirect de la infraestructura de adelante.

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
resuelven el cold start mejor que Render, y Vercel además daría un dominio propio
gratis, que arreglaría de raíz el problema de que la URL de la demo esté escrita
en cuatro lugares del portfolio.

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
- **La URL sigue siendo `insurance-advisor-bot.onrender.com`**, o sea que sigue
  atada al proveedor. Si algún día hay que mudarse, hay que volver a editar el
  portfolio. La solución real es un dominio propio (`bot.ivandujaut.com`), que
  queda pendiente.

## Pendiente

- Dominio propio para la demo, para que la URL deje de depender del proveedor.
- Evaluar mover el rate limiter a un store compartido. Hoy la decisión de quedarse
  en un solo contenedor es en parte una consecuencia de que sea en memoria: si
  dejara de serlo, se abren opciones de compute que hoy están cerradas.
