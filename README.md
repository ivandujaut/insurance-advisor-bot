# lacaja-whatsapp-bot

[![CI](https://github.com/ivandujaut/lacaja-whatsapp-bot/actions/workflows/ci.yml/badge.svg)](https://github.com/ivandujaut/lacaja-whatsapp-bot/actions/workflows/ci.yml)

Bot de WhatsApp para cotización y consulta de pólizas de seguros (orientado a la
oferta de **La Caja**). Motor **híbrido**: menús determinísticos para lo
estructurado (cotizar, derivar) + **LLM (Claude)** para consultas abiertas,
anclado a una base de conocimiento.

## Arquitectura

Arquitectura **hexagonal (Ports & Adapters)**. Las dependencias apuntan hacia
adentro: el núcleo no conoce la infraestructura. Ver
[ADR 0001](docs/adr/0001-arquitectura-hexagonal.md).

```
src/
├── domain/                       # núcleo puro (sin imports de infraestructura)
│   └── conversation/             #   session (modelo), flows (máquina de menús)
├── application/                  # puertos + orquestación
│   ├── ports.ts                  #   LlmPort, LeadRepository, EventSink,
│   │                             #   SessionStore, KnowledgeSource, MessagingProvider
│   ├── process-message.ts        #   orquestador: menús -> LLM
│   └── assistant.ts              #   respuesta abierta anclada al conocimiento
├── infrastructure/               # adapters concretos (implementan los puertos)
│   ├── messaging/                #   cli, meta (WhatsApp Cloud API)
│   ├── llm/                      #   anthropic (Claude vía AI SDK)
│   ├── persistence/              #   jsonl-leads, jsonl-events, memory-sessions
│   └── knowledge/                #   filesystem + productos/*.md
├── config/
└── main/                         # composition root
    ├── container.ts              #   arma e inyecta las dependencias
    └── server.ts, chat.ts, funnel.ts
```

La clave del diseño: **cada borde intercambiable vive detrás de un puerto**.
Cambiar de canal (Meta, Twilio), de LLM (Gateway, otro modelo) o de storage
(archivo, Postgres, CRM) es escribir otro adapter, sin tocar el núcleo. La regla
"domain/ y application/ no importan de infrastructure/" se verifica sola en el CI
(`pnpm check:arch`).

## Puesta en marcha

```bash
pnpm install
cp .env.example .env      # completar ANTHROPIC_API_KEY para las respuestas del LLM
pnpm chat                 # probar el bot en la terminal (no requiere WhatsApp)
```

Los flujos de menú funcionan sin API key. Para las respuestas abiertas del LLM
hay que setear `ANTHROPIC_API_KEY`.

Al completar una cotización, el lead se guarda en `data/leads.jsonl` y los pasos
del recorrido quedan registrados en `data/events.jsonl`. Para ver las métricas
del funnel (activación, drop-off por paso, mix de plan):

```bash
pnpm funnel
```

## Docker

El proyecto es un proceso persistente (sesiones en memoria + `data/*.jsonl`), así
que el deploy natural es un contenedor, no serverless.

```bash
docker compose up --build
```

Levanta el bot en `http://localhost:3000` (health en `GET /`). El `.env` es
opcional: sin él arranca con los defaults (provider `cli`); para WhatsApp real,
`cp .env.example .env` y completar `META_*` + `ANTHROPIC_API_KEY`. Los leads y
eventos se persisten en `./data` (volumen), así que sobreviven reinicios.

La imagen es multi-stage (build con todas las deps, runtime slim con solo las de
producción, usuario no-root). El webhook de WhatsApp igual necesita un endpoint
público con HTTPS: eso lo da el host (un PaaS, o un reverse-proxy como Caddy en
el compose para self-hosting).

## Conectar WhatsApp (Meta Cloud API)

1. Crear una app en [Meta for Developers](https://developers.facebook.com/) con
   el producto *WhatsApp*.
2. Completar en `.env`: `META_ACCESS_TOKEN`, `META_PHONE_NUMBER_ID`,
   `META_VERIFY_TOKEN` (este último lo elegís vos), y `MESSAGING_PROVIDER=meta`.
3. Levantar el server (`pnpm dev`) y exponerlo con una URL pública (ngrok, o
   deploy en Vercel).
4. Configurar el webhook en Meta apuntando a `https://TU_DOMINIO/webhook` con el
   mismo verify token.

## Desarrollo

Scripts: `pnpm typecheck`, `pnpm test`, `pnpm check:arch` (regla de dependencias),
`pnpm lint` y `pnpm format` (Biome).

**Convención de commits (gitmoji):** `<emoji> <tipo>: <descripción>` en inglés,
minúscula, sin punto final (ej: `✨ feat: add auto quote flow`). Validada por
commitlint.

**Git hooks (Husky):**
- `pre-commit`: formatea y lintea los archivos staged (Biome vía lint-staged).
- `commit-msg`: valida el mensaje contra la convención.
- `pre-push`: corre `typecheck` + `check:arch` + `test` antes de compartir.

## Estado

Prototipo inicial. La base de conocimiento
(`src/infrastructure/knowledge/productos/`) es contenido semilla y hay que
ajustarla a la oferta real de La Caja.
