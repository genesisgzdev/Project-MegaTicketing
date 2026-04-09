# Stage 1: Build logic
FROM node:20-alpine AS builder
WORKDIR /usr/src/app
RUN apk add --no-cache libc6-compat
COPY . .
RUN npm install --ignore-scripts
RUN npx prisma generate --schema=packages/database/prisma/schema.prisma || true
RUN npx turbo run build --filter=@mega-ticketing/api

# Stage 2: Hardened Runner
FROM node:20-alpine AS runner
WORKDIR /usr/src/app
ENV NODE_ENV=production

# [SECURITY FIX] Selective copying to prevent source code or .env leaks
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/apps/api/package.json ./apps/api/
COPY --from=builder /usr/src/app/apps/api/dist ./apps/api/dist
# Only install production dependencies for the workspace
RUN npm install --omit=dev --ignore-scripts && npm cache clean --force

USER node
EXPOSE 3001
CMD ["node", "apps/api/dist/index.js"]
