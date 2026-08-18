# Deploy: dejar la demo online (sin ngrok)

El objetivo es una URL pública y estable que cualquiera (alguien de La Caja, o de
cualquier aseguradora) pueda abrir y probar en el navegador, sin instalar nada. La
demo web usa el mismo motor que WhatsApp; solo cambia el canal.

## Plataforma: Render para el compute, Neon para la base

Se elige **Render** por menor fricción: conectás el repo de GitHub, lee el
`Dockerfile` y el `render.yaml`, y levanta el servicio. Sin CLI ni tarjeta para el
plan free.

La base Postgres, en cambio, vive **afuera de Render**, en Neon. No es una
preferencia técnica: el Postgres free de Render expira a los 30 días de creado y
después Render lo borra con los datos adentro. La demo se cayó exactamente así en
agosto de 2026. Ver [ADR 0002](adr/0002-independencia-del-proveedor-en-el-deploy.md).

El objetivo del setup es que la demo **no cueste nada y responda igual**, porque
es una vitrina de portfolio: si un reclutador hace clic y tarda un minuto, se va.

### El costo real: US$0

| Pieza | Proveedor | Plan | Caduca |
|---|---|---|---|
| Compute | Render | Free web service | No |
| Postgres | Neon | Free | No. "None of these limits delete your data" |
| Sesiones | Render Key Value | Free, 25 MB | No |
| Dominio + TLS | Render + Cloudflare | Hobby incluye 2 dominios; certificados automáticos | No |
| Keep-alive + alertas | UptimeRobot | Free, 50 monitores | No |

### El cold start y cómo se evita gratis

El free web service **se duerme** tras 15 min sin tráfico y tarda *about one
minute* en despertar. Eso se mata con un ping externo cada 5 minutos a `/health`
(ver "Mantenerlo despierto y enterarse cuando se cae", más abajo).

**La cuenta de horas, que es la parte ajustada:** Render da **750 instance-hours
por workspace por mes calendario**, y los servicios dormidos no consumen. Un
servicio despierto 24/7 gasta 720 h en un mes de 30 días y **744 h en uno de 31**.
Entra, con 6 horas de margen, pero **solo si este es el único free web service del
workspace**. Si hay otro, comparten las 750 y se caen los dos a fin de mes.
Verificalo en el dashboard antes de prender el ping.

## La demo casi no necesita secretos

Con `MESSAGING_PROVIDER=cli` el server arranca sin tokens de Meta. Los flujos de
menú y cotización son determinísticos (no llaman al LLM), así que la demo funciona
sin ninguna API key: sin `OPENAI_API_KEY` el FAQ router queda desactivado y sin
`ANTHROPIC_API_KEY` las preguntas abiertas no se responden, pero el motor levanta
igual. Degrada, no rompe.

El único secreto **obligatorio** es `DATABASE_URL`, porque
`PERSISTENCE=postgres`. Sin él el server no arranca, y es a propósito: falla con
un mensaje claro en vez de caer al localhost de `pg` con un `ECONNREFUSED` opaco.

Cuidado con las claves de LLM en una demo pública: `POST /chat` pega contra la API
paga de Anthropic. Por eso hay un rate limiter de 20 requests por minuto por IP
(`src/main/rate-limit.ts`), que **es por instancia**. Con un solo servicio en
Render el límite es real; en una plataforma que escala a varias instancias, se
multiplica por instancia y deja de proteger el gasto.

## Paso a paso

### 1. Crear la base en Neon (antes que el servicio)

El server crea las tablas al arrancar, pero necesita una base a la que conectarse:
sin `DATABASE_URL` falla con un mensaje claro y no levanta (`assertConfig` en
`src/main/container.ts`). Así que la base va primero.

1. Entrá a https://neon.com y creá una cuenta (free, sin tarjeta).
2. Nuevo proyecto, región **US West (Oregon)**, la misma en la que el
   `render.yaml` declara el servicio y el Key Value. Una región del otro lado del
   país agrega unos 50-60 ms a cada query, y `/funnel` hace varias por carga.
3. Copiá la **connection string** del dashboard. Viene con `?sslmode=require`.

Notas del plan free de Neon, para saber con qué se convive:

- **0.5 GB de storage y 100 CU-hours/mes.** Para leads y eventos de una demo
  sobra por años.
- **Scale-to-zero a los 5 minutos** de inactividad, y vuelve "within a few
  hundred milliseconds". No se puede desactivar en free, y no hace falta: el
  `/health` que pinguea el keep-alive no toca la base, así que Neon duerme
  tranquilo y despierta recién en el primer mensaje real del chat.
- Ese despertar está cubierto por `retryTransient` en
  `src/infrastructure/persistence/postgres.ts`, que reintenta con backoff solo
  los errores de conexión transitorios.
- Si te pasás de un límite mensual se suspende el compute hasta el mes siguiente,
  pero **no se borran los datos**.

### 2. Levantar el servicio en Render

1. Asegurate de que `render.yaml` esté en `main` (ya está en el repo).
2. Entrá a https://render.com y creá una cuenta (o logueate con GitHub).
3. **New > Blueprint**. Autorizá el acceso al repo `insurance-advisor-bot` y
   seleccionalo. Render detecta el `render.yaml` y muestra el servicio
   `insurance-advisor-bot`.
4. **Apply**. Render construye la imagen desde el `Dockerfile` y despliega. El
   primer build tarda unos minutos.
5. Servicio > **Environment**: pegá la connection string de Neon en
   `DATABASE_URL`. Está declarada como `sync: false` en el blueprint justamente
   para que no viva en el repo. Guardá: Render redeploya solo.
6. Cuando termina, quedás con una URL tipo
   `https://insurance-advisor-bot.onrender.com`. Abrila: es la demo.

Verificá el health check: `https://<tu-url>/health` debe responder
`insurance-advisor-bot OK`. Y entrá a `/funnel`: si la base quedó bien conectada,
carga el dashboard (vacío al principio) en vez de tirar error.

### 3. El dominio propio (`bot.ivandujaut.com`)

**La URL para compartir no es la de Render.** El dominio propio no es cosmético:
es lo que hace que mudarse de plataforma no obligue a editar el portfolio, donde
la URL de la demo está escrita en cuatro lugares. Con `bot.ivandujaut.com`, una
mudanza futura es cambiar un registro DNS.

Es gratis: el plan **Hobby** de Render (el de US$0) incluye **2 dominios propios**,
y "Render automatically creates and renews TLS certificates for all custom
domains" sin costo extra. El HTTP se redirige solo a HTTPS.

**El cambio no rompe nada:** los servicios con dominio propio "also keep their
`onrender.com` subdomain". Las dos URLs quedan funcionando en paralelo, así que
cualquier link viejo sigue vivo y el portfolio se puede actualizar sin apuro.

Pasos:

1. En Render, servicio > **Settings > Custom Domains > Add Custom Domain**:
   `bot.ivandujaut.com`. Render muestra el target del CNAME.
2. En Cloudflare (ahí está el DNS de `ivandujaut.com`), agregá un **CNAME**:
   - Name: `bot`
   - Target: el que dio Render (`insurance-advisor-bot.onrender.com`)
   - **Proxy status: DNS only (nube gris).** No es opcional al principio: la doc
     de Render dice que así "requests go to Render instead of Cloudflare, so that
     we can verify the domain and issue a certificate". Con la nube naranja, la
     validación del certificado falla.
3. En Cloudflare, **SSL/TLS > Overview**: modo **Full**. Con `Flexible` se arma
   un loop de redirects, porque Render ya redirige todo el HTTP a HTTPS.
4. Esperá a que Render marque el dominio como verificado y el certificado como
   emitido. Recién ahí, si querés, podés pasar el registro a **Proxied**.

**Cuidado con los AAAA:** Render todavía no soporta IPv6, y su guía avisa que los
registros AAAA "can interfere with your custom domain's behavior on Render". Si
hay alguno colgando de `bot`, borralo.

### 4. Mantenerlo despierto y enterarse cuando se cae

Sin esto la demo funciona, pero con un minuto de espera en la primera visita.

1. Creá una cuenta en https://uptimerobot.com (free: 50 monitores, intervalo de
   5 min, sin tarjeta).
2. Nuevo monitor de tipo **keyword**, no de status code. **El tipo se elige al
   crear el monitor y después no se puede cambiar editándolo**: si quedó como
   HTTP(s), hay que crear uno nuevo y borrar el viejo.
   - URL: `https://bot.ivandujaut.com/health` (el dominio propio, no el de
     Render: así el monitor también cubre que el DNS y el certificado sigan bien)
   - Keyword: `insurance-advisor-bot OK`
   - Condición: **Keyword Not Exists**. Es fácil de invertir, y hacerlo lo deja
     inservible. En UptimeRobot la condición elegida es la que pone el monitor en
     DOWN: con `Exists` caería cuando *encuentra* la palabra (útil para detectar
     textos de error), o sea que alertaría mientras la demo funciona y diría "up"
     justo cuando se rompe. `Not Exists` alerta cuando la palabra esperada
     desaparece, que es lo que queremos.
   - Intervalo: 5 minutos
3. Alerta por mail a tu casilla.

No hace falta tocar el método HTTP: los monitores keyword usan GET solos, porque
necesitan el cuerpo de la respuesta.

**Por qué keyword y no status code:** un 200 no prueba que la app esté viva. Una
plataforma puede devolver 200 desde una página de error o un redirect a la raíz.
El keyword verifica que quien contesta sea el server, no la infraestructura de
adelante.

Los 5 minutos son la clave doble del setup: quedan por debajo de los 15 que tarda
Render en dormir el servicio, así que nunca se apaga, y al mismo tiempo es el
chequeo que avisa cuando se cae de verdad.

## Persistencia y métricas (Postgres + /funnel)

El `render.yaml` setea `PERSISTENCE=postgres` y declara `DATABASE_URL` como
secreto (`sync: false`), que se carga a mano apuntando a Neon. El server crea las
tablas al arrancar. Con esto, los leads y eventos **sobreviven** al redeploy y al
spin-down (con `jsonl` el disco de Render es efímero).

El dashboard del embudo queda en `https://<tu-url>/funnel`: activación, drop-off
por paso y mix de plan, en vivo.

El `render.yaml` también declara un **Key Value (Redis)** `lacaja-kv` para el store
de sesiones (`SESSION_STORE=redis`, `REDIS_URL` cableada): así una cotización a
medio hacer **sobrevive a los redeploys y al spin-down** (con `memory` se perdía
en cada deploy) y el bot puede correr con más de una instancia. Ese sí se puede
dejar en Render: el Key Value free no expira por fecha. Su límite es otro, y está
anotado en el `render.yaml`: es in-memory only, así que un reinicio del propio KV
se lleva las sesiones abiertas.

### Cambiar de proveedor (Supabase, Neon, RDS)

La persistencia está detrás de puertos y el adapter es Postgres puro, así que
cualquier base compatible sirve. Cambiar de proveedor es cambiar `DATABASE_URL`
(con `DATABASE_SSL=true`, ya seteada en el blueprint) y redeployar. El server
crea las tablas al arrancar. No cambia una línea de código.

Dos advertencias sobre las alternativas gratis, verificadas en agosto de 2026:

- **Supabase free pausa el proyecto** tras 7 días de baja actividad y hay que
  restaurarlo a mano desde el dashboard. Para una demo que puede pasar semanas
  sin visitas, es peor que el problema que vino a resolver.
- **El Postgres free de Render expira a los 30 días** de creado, con 14 de gracia,
  y después Render "deletes the database (along with all of its data)". Es la
  razón por la que la base se fue afuera. No volver ahí.

## Opcional: servir también el webhook de WhatsApp desde acá

Si querés que este mismo deploy reemplace a ngrok como webhook de WhatsApp (no
solo la demo web):

1. En el dashboard de Render, servicio > **Environment**, cambiá
   `MESSAGING_PROVIDER` a `meta` y cargá las variables `META_ACCESS_TOKEN`,
   `META_PHONE_NUMBER_ID`, `META_VERIFY_TOKEN`, `META_APP_SECRET` y
   `META_RECIPIENT_OVERRIDES` (los mismos valores del `.env` local).
2. Guardá: Render redeploya solo.
3. En Meta (developers.facebook.com), configuración del webhook de WhatsApp,
   cambiá la Callback URL a `https://<tu-url>/webhook` y el Verify Token al mismo
   `META_VERIFY_TOKEN`. Verificá y suscribí el campo `messages`.

Con eso, ngrok queda de más: la demo web y el webhook viven en la misma URL.

## Renombrar el servicio (aprendizaje del rename a insurance-advisor-bot)

En 2026-07 el proyecto se renombró de `lacaja-whatsapp-bot` a
`insurance-advisor-bot` (separación white-label, ver Decisión 24). Lo que pasó en
Render es un comportamiento a conocer:

**El Blueprint matchea recursos por nombre: renombrar un servicio en `render.yaml`
NO lo renombra, crea uno NUEVO.** Al mergear el rename, Render levantó un segundo
servicio con el nombre nuevo y dejó el viejo andando (por eso "Name is already in
use" al intentar el renombre manual después). Consecuencias prácticas:

- **Las claves `sync:false` no viajan.** El servicio nuevo nace sin
  `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` ni las `META_*`: hay que recargarlas a
  mano en Environment (el motor arranca igual, pero FAQ router y LLM quedan
  caídos hasta entonces; el health check no lo detecta).
- **La base y el KV se conservaron porque NO se renombraron.** `lacaja-db` y
  `lacaja-kv` mantienen su nombre interno a propósito: el blueprint los siguió
  matcheando y el servicio nuevo se colgó de los mismos datos. Renombrarlos
  habría hecho que el blueprint los recree vacíos (pérdida de leads/eventos y
  sesiones). Un nombre interno feo es mejor que una base nueva.
  (Desde agosto de 2026 esto aplica solo a `lacaja-kv`: la base ya no la declara
  el blueprint, así que un rename no la puede tocar. Un problema menos.)
- **La URL vieja muere sin redirect** (a diferencia de GitHub, que sí redirige el
  repo renombrado). Si el webhook de WhatsApp apuntaba ahí, hay que actualizar la
  Callback URL en Meta.
  (Desde que existe `bot.ivandujaut.com` esto pesa mucho menos: la URL pública ya
  no es la de Render, así que un rename se absorbe reapuntando el CNAME. Es
  exactamente para lo que está el dominio propio.)
- **El servicio viejo hay que borrarlo a mano** (después de verificar el nuevo:
  health + una FAQ + una pregunta abierta, que es lo que prueba las dos keys).

Para un próximo rename, el orden que evita el doble servicio: renombrar primero
el servicio en el dashboard (Settings > Name, conserva env vars y deploys) y
recién después actualizar `render.yaml` para que el blueprint matchee el nombre
nuevo.

## Redeploys

Con `autoDeploy: true`, cada push a `main` redeploya solo. No hace falta tocar
nada en Render después del primer Apply.
