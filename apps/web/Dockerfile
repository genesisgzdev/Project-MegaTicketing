FROM node:20-slim AS build
WORKDIR /usr/src/app
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
COPY packages/shared/package*.json ./packages/shared/
RUN npm install
COPY . .
RUN npm run build --prefix apps/web

FROM nginx:stable-alpine AS runner
COPY --from=build /usr/src/app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
