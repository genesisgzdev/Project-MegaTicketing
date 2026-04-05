FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS build
COPY . /usr/src/app
WORKDIR /usr/src/app
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run -r build
RUN pnpm deploy --filter=@mega-ticketing/api /prod/api

FROM base AS runner
WORKDIR /app
COPY --from=build /prod/api /app
EXPOSE 3000
CMD [ "node", "dist/index.js" ]
