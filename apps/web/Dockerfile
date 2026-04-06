FROM node:20-slim AS build
WORKDIR /usr/src/app
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
COPY packages/shared/package*.json ./packages/shared/
# FIX: Industrial dependency resolution bypass and ignore scripts to skip husky
RUN npm install --legacy-peer-deps --ignore-scripts
COPY . .
RUN npm run build --prefix apps/web

FROM nginx:stable-alpine AS runner
COPY --from=build /usr/src/app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
