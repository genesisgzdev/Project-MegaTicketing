# Stage 1: Builder
FROM node:20-alpine AS builder
WORKDIR /usr/src/app
RUN apk add --no-cache libc6-compat

# En un monorepo, debemos copiar TODO para que npm detecte los workspaces
COPY . .
RUN npm install --ignore-scripts

# Compilar solo la API
RUN npx prisma generate --schema=packages/database/prisma/schema.prisma || true
RUN npx turbo run build --filter=@mega-ticketing/api

# Stage 2: Runner
FROM node:20-alpine AS runner
WORKDIR /usr/src/app
ENV NODE_ENV=production

# Copiar el monorepo compilado
COPY --from=builder --chown=node:node /usr/src/app ./

# Limpiar dependencias de desarrollo para reducir la superficie de ataque
RUN npm install --omit=dev --ignore-scripts && npm cache clean --force

USER node
EXPOSE 3001

# Ejecutar el binario desde la ruta correcta del workspace
CMD ["node", "apps/api/dist/index.js"]

