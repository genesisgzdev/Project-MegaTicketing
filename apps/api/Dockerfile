# Stage 1: Build logic
FROM node:22-alpine AS builder
WORKDIR /usr/src/app
RUN apk add --no-cache libc6-compat
COPY . .
RUN npm install --ignore-scripts
RUN npx prisma generate --schema=packages/database/prisma/schema.prisma
RUN npx turbo run build --filter=@mega-ticketing/api

# Stage 2: Hardened Runner
FROM node:22-alpine AS runner
WORKDIR /usr/src/app
ENV NODE_ENV=production

# [SECURITY FIX] Selective copying to prevent source code or .env leaks
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/apps/api/package.json ./apps/api/
COPY --from=builder /usr/src/app/apps/web/package.json ./apps/web/
COPY --from=builder /usr/src/app/packages/database/package.json ./packages/database/
COPY --from=builder /usr/src/app/packages/shared/package.json ./packages/shared/
COPY --from=builder /usr/src/app/packages/database/prisma ./packages/database/prisma
COPY --from=builder /usr/src/app/apps/api/dist ./apps/api/dist
# Only install production dependencies for the workspace
RUN npm install --omit=dev --ignore-scripts && npm cache clean --force
RUN npx prisma generate --schema=packages/database/prisma/schema.prisma

USER node
EXPOSE 3001
CMD ["node", "apps/api/dist/index.js"]
