# Deploy: dejar la demo online (sin ngrok)

El objetivo es una URL pública y estable que cualquiera (en particular La Caja)
pueda abrir y probar en el navegador, sin instalar nada. La demo web usa el mismo
motor que WhatsApp; solo cambia el canal.

## Plataforma: Render

Se elige **Render** por menor fricción: conectás el repo de GitHub, lee el
`Dockerfile` y el `render.yaml`, y levanta el servicio. Sin CLI ni tarjeta para el
plan free.

Trade-off del plan free: el servicio **se duerme** tras ~15 min de inactividad, y
la primera visita después tarda ~30-50s en despertar. Para una demo que estás
mostrando activamente, conviene el plan **Starter (~US$7/mes)**, que la mantiene
siempre caliente. Se puede empezar en free y subir después con un clic.

## La demo no necesita secretos

Con `MESSAGING_PROVIDER=cli` el server arranca sin tokens de Meta ni API key. Los
flujos de menú y cotización son determinísticos (no llaman al LLM). Así que la
demo web sube con cero secretos: solo las tres variables no sensibles del
`render.yaml`.

## Paso a paso

1. Asegurate de que `render.yaml` esté en `main` (ya está en el repo).
2. Entrá a https://render.com y creá una cuenta (o logueate con GitHub).
3. **New > Blueprint**. Autorizá el acceso al repo `insurance-advisor-bot` y
   seleccionalo. Render detecta el `render.yaml` y muestra el servicio
   `insurance-advisor-bot`.
4. **Apply**. Render construye la imagen desde el `Dockerfile` y despliega. El
   primer build tarda unos minutos.
5. Cuando termina, quedás con una URL tipo
   `https://insurance-advisor-bot.onrender.com`. Abrila: es la demo. Esa es la URL
   para compartir.

Verificá el health check: `https://<tu-url>/health` debe responder
`insurance-advisor-bot OK`.

## Persistencia y métricas (Postgres + /funnel)

El `render.yaml` declara una base **Postgres** (`lacaja-db`) y setea
`PERSISTENCE=postgres` con `DATABASE_URL` cableada desde esa base. Al aplicar el
blueprint, Render crea el Postgres e inyecta la URL solo; el server crea las
tablas al arrancar. Con esto, los leads y eventos **sobreviven** al redeploy y al
spin-down (con `jsonl` el disco de Render es efímero).

El dashboard del embudo queda en `https://<tu-url>/funnel`: activación, drop-off
por paso y mix de plan, en vivo.

El `render.yaml` también declara un **Key Value (Redis)** `lacaja-kv` para el store
de sesiones (`SESSION_STORE=redis`, `REDIS_URL` cableada): así una cotización a
medio hacer **sobrevive a los redeploys y al spin-down** (con `memory` se perdía
en cada deploy) y el bot puede correr con más de una instancia.

Nota: el Postgres **free** de Render se elimina a los ~30 días. Para que los datos
duren, pasar la base a un plan pago desde el dashboard.

### Cambiar de proveedor (Supabase, Neon, RDS)

La persistencia está detrás de puertos y el adapter es Postgres puro, así que
cualquier base compatible sirve. Para migrar de la base de Render a
**Supabase** o **Neon**:

1. Creá la base en el proveedor y copiá su connection string.
2. En el servicio de Render (o donde corra), seteá `DATABASE_URL` con esa string
   y `DATABASE_SSL=true` (los managed externos exigen SSL; también se activa solo
   si la URL trae `sslmode=require`).
3. Redeploy. El server crea las tablas al arrancar. No cambia una línea de código.

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

## Redeploys

Con `autoDeploy: true`, cada push a `main` redeploya solo. No hace falta tocar
nada en Render después del primer Apply.
