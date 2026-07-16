# syntax=docker/dockerfile:1
#
# Imagen multi-stage: se compila con todas las deps y se corre con una imagen
# slim que solo tiene las deps de producción + el dist compilado.
# Ver docs/adr para el criterio de dockerización.

# --- Stage 1: build ---
FROM node:22-bookworm-slim AS builder
ENV HUSKY=0
WORKDIR /app
RUN corepack enable

# Instalar deps primero (aprovecha la cache de capas si no cambió el lockfile).
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Compilar (tsc + copia de los assets a dist). docs/ trae el benchmark del FAQ
# router, que copy-assets.mjs copia a dist/ para el runtime; sin él, el build falla.
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
COPY docs ./docs
RUN pnpm build

# --- Stage 2: runtime ---
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production HUSKY=0
WORKDIR /app
RUN corepack enable

# Solo deps de producción; --ignore-scripts evita el prepare de husky.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

# Artefacto compilado.
COPY --from=builder /app/dist ./dist

# Directorio de datos escribible por el usuario no-root.
RUN mkdir -p /app/data && chown -R node:node /app
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main/server.js"]
