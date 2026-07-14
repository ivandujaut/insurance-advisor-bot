# lacaja-whatsapp-bot

[![CI](https://github.com/ivandujaut/lacaja-whatsapp-bot/actions/workflows/ci.yml/badge.svg)](https://github.com/ivandujaut/lacaja-whatsapp-bot/actions/workflows/ci.yml)

Bot de WhatsApp para cotización y consulta de pólizas de seguros (orientado a la
oferta de **La Caja**). Motor **híbrido**: menús determinísticos para lo
estructurado (cotizar, derivar) + **LLM (Claude)** para consultas abiertas,
anclado a una base de conocimiento.

## Arquitectura

```
src/
├── server.ts                     # Webhook HTTP (Hono) para Meta Cloud API
├── scripts/chat.ts               # Chat por consola para probar sin WhatsApp
└── lib/
    ├── config.ts                 # Config desde variables de entorno
    ├── messaging/                # Capa de adaptadores (proveedor intercambiable)
    │   ├── types.ts              #   contrato MessagingProvider
    │   ├── cli.ts                #   adaptador consola (dev)
    │   ├── meta.ts               #   adaptador WhatsApp Cloud API (Meta)
    │   └── index.ts              #   factory segun MESSAGING_PROVIDER
    ├── conversation/
    │   ├── engine.ts             #   orquestador: menús -> LLM
    │   ├── flows.ts              #   máquina de estados de menús
    │   ├── llm.ts                #   respuesta con Claude + grounding
    │   └── session.ts            #   sesiones en memoria
    ├── analytics/
    │   └── events.ts             #   log de eventos del funnel (data/events.jsonl)
    ├── leads/
    │   └── store.ts              #   persistencia de leads (data/leads.jsonl)
    └── knowledge/
        └── productos/*.md        #   base de conocimiento (auto, general, ...)
```

La clave del diseño: el **motor no depende del proveedor de mensajería**.
Hoy se desarrolla contra la consola; mañana se conecta Meta cambiando una
variable de entorno.

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

## Conectar WhatsApp (Meta Cloud API)

1. Crear una app en [Meta for Developers](https://developers.facebook.com/) con
   el producto *WhatsApp*.
2. Completar en `.env`: `META_ACCESS_TOKEN`, `META_PHONE_NUMBER_ID`,
   `META_VERIFY_TOKEN` (este último lo elegís vos), y `MESSAGING_PROVIDER=meta`.
3. Levantar el server (`pnpm dev`) y exponerlo con una URL pública (ngrok, o
   deploy en Vercel).
4. Configurar el webhook en Meta apuntando a `https://TU_DOMINIO/webhook` con el
   mismo verify token.

## Estado

Prototipo inicial. La base de conocimiento (`src/lib/knowledge/productos/`) es
contenido semilla y hay que ajustarla a la oferta real de La Caja.
