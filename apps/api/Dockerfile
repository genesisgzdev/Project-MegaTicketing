FROM node:20-slim AS build
WORKDIR /usr/src/app
RUN apt-get update -y && apt-get install -y openssl
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/web/package*.json ./apps/web/
COPY packages/database/package*.json ./packages/database/
COPY packages/shared/package*.json ./packages/shared/
# FIX: Ignore scripts to skip husky in Docker/CI
RUN npm install --legacy-peer-deps --ignore-scripts
COPY . .
RUN npm run db:generate --prefix packages/database
RUN npm run build --prefix apps/api

FROM node:20-slim AS runner
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl
COPY --from=build /usr/src/app/apps/api/dist ./dist
COPY --from=build /usr/src/app/apps/api/package*.json ./
COPY --from=build /usr/src/app/node_modules ./node_modules
EXPOSE 3000
CMD [ "node", "dist/apps/api/src/index.js" ]


