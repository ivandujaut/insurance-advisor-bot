# Conectar el bot a WhatsApp (Meta Cloud API)

El código del webhook ya está listo y testeado (verificación, firma, recepción y
respuesta). Lo que sigue son los pasos que hacés vos, porque implican tu cuenta de
Meta y credenciales.

## Lo que ya está resuelto (del lado del código)

- `GET /webhook`: responde el handshake de verificación de Meta (compara el
  `verify_token`).
- `POST /webhook`: valida la firma `X-Hub-Signature-256` (si hay `META_APP_SECRET`),
  parsea el mensaje y responde por la Cloud API.
- Probado localmente simulando los requests de Meta.

## Paso a paso

### 1. Crear la app en Meta

1. Entrá a [developers.facebook.com](https://developers.facebook.com/) y creá una
   app tipo **Business**.
2. Agregá el producto **WhatsApp**.
3. En **WhatsApp > API Setup** vas a ver: un **número de prueba**, un
   **access token temporal** y el **Phone Number ID**. Anotá los tres.
4. En **App Settings > Basic** copiá el **App Secret**.

### 2. Elegir un verify token

Es una cadena que inventás vos (ej: una random larga). Tiene que coincidir entre
tu `.env` y la config del webhook en Meta.

### 3. Exponer el server con HTTPS

Meta necesita una URL pública `https`. Dos caminos:

- **Desarrollo (rápido):** [ngrok](https://ngrok.com). Con el server corriendo en
  el puerto 3000: `ngrok http 3000`. Te da una URL `https://xxxx.ngrok-free.app`.
- **Producción:** deployá el contenedor (Fly.io, Render, Railway o un VPS con
  Caddy/Traefik para el TLS). Ver el `Dockerfile` y `docker-compose.yml`.

### 4. Configurar el `.env` y levantar el bot

```bash
cp .env.example .env
```

Completá:

```
MESSAGING_PROVIDER=meta
META_ACCESS_TOKEN=<token de API Setup>
META_PHONE_NUMBER_ID=<Phone Number ID>
META_VERIFY_TOKEN=<el que inventaste en el paso 2>
META_APP_SECRET=<App Secret del paso 1>
ANTHROPIC_API_KEY=<tu clave, para las respuestas abiertas>
```

Levantá el server: `pnpm dev` (o `docker compose up`).

### 5. Registrar el webhook en Meta

En **WhatsApp > Configuration > Webhook**:

1. **Callback URL:** `https://TU_DOMINIO/webhook`.
2. **Verify token:** el mismo `META_VERIFY_TOKEN`.
3. Al guardar, Meta pega un `GET` de verificación. Si el token coincide, queda
   verificado (verde).
4. En **Webhook fields**, suscribite al campo **messages**.

### 6. Probar

Mandá un WhatsApp al número de prueba. El bot debería responder con el menú.

### 7. Token permanente (System User)

El token de **API Setup vence a las 24 hs**, así que para no renovarlo a mano
conviene generar uno **sin expiración** con un *System User* del Business. Un
System User es una identidad no-humana (un "usuario de servicio") a la que le
asignás la app y el WhatsApp Business Account (WABA), y en su nombre emitís el
token que usa el bot.

Requisito previo: la app tiene que pertenecer a un **Meta Business** (Business
Manager). Si la creaste suelta, asociala en **Business Settings > Accounts >
Apps > Add > Connect an app**.

1. Entrá a [business.facebook.com/settings](https://business.facebook.com/settings)
   (Business Settings).
2. **Users > System users > Add**. Nombralo (ej: `lacaja-bot`) y asignale el rol
   **Admin** (o **Employee**; alcanza para mensajería).
3. Con el System User seleccionado, **Add assets**:
   - **Apps** > tu app > activá **Full control** (Manage app).
   - **WhatsApp accounts** > tu WABA > activá **Full control**.
4. **Generate new token**:
   - **App:** tu app.
   - **Token expiration:** **Never**.
   - **Permissions:** marcá `whatsapp_business_messaging` (enviar/recibir) y
     `whatsapp_business_management` (gestionar números y plantillas).
5. Copialo apenas aparece: **se muestra una sola vez**. Guardalo en `.env`:

   ```
   META_ACCESS_TOKEN=<token permanente del System User>
   ```

6. Reiniciá el bot para que lo tome. El `META_PHONE_NUMBER_ID` y el resto del
   `.env` no cambian.

Chequeo rápido de que quedó bien (no vence): en el
[Access Token Debugger](https://developers.facebook.com/tools/debug/accesstoken/)
pegá el token; **Expires** debe decir **Never**.

## Cosas a tener en cuenta

- **Token temporal vs permanente:** el de API Setup vence a las 24 hs (bien para
  probar). Para algo estable, usá el token del System User del paso 7.
- **Número de prueba:** hasta que la app esté verificada, solo podés escribirle a
  destinatarios que agregues a mano en API Setup.
- **Ventana de 24 hs:** se puede responder texto libre dentro de las 24 hs del
  último mensaje del usuario (que es el caso del bot). Fuera de eso, Meta exige
  plantillas aprobadas.
- **Firma:** si dejás `META_APP_SECRET` vacío, el webhook igual funciona pero no
  verifica la firma (el server avisa al arrancar). Para un endpoint público,
  conviene setearlo.
- **Número argentino en el sandbox:** Meta te identifica en el webhook con el
  formato E.164 (con "9": `5491151769708`), pero la lista de autorizados del
  número de prueba a veces guarda el formato local (con "15": `54111551769708`).
  Si el bot recibe el mensaje pero el envío de la respuesta falla con
  `#131030 Recipient phone number not in allowed list`, mapealo con
  `META_RECIPIENT_OVERRIDES` (ver `.env.example`). Podés sumar varios números
  separados por coma. En producción, con un número real, no hace falta: se
  responde directo al wa_id.
