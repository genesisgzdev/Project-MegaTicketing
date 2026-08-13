# Contributing to MegaTicketing

MegaTicketing is a real reservation system: changes to seat state, payment confirmation, Redis locking, or webhook retries must preserve the exactly-once sale invariant. Pull requests that only change the visual shell without validating the runtime contract are incomplete.

## Local stack

Requirements: Node.js 22+, npm 10+, Docker and Docker Compose.

```bash
cp .env.example .env
npm ci
docker compose up -d db redis
npx prisma generate --schema=packages/database/prisma/schema.prisma
npx prisma db push --schema=packages/database/prisma/schema.prisma
```

Run the checks before opening a pull request:

```bash
npm run build
npm test
npm audit --audit-level=moderate
git diff --check
```

For reservation changes, run the real load gate against a disposable staging event:

```bash
npm run load:test -- http://localhost:3001 EVENT_UUID SEAT_UUID USER_UUID 40000 1000
```

The gate must report `invariant.safe: true`: one `201`, zero `5xx`. `403` responses are the abuse shield and `409` responses are expected contention; neither creates a sale.

## Repository boundaries

- `apps/api`: Fastify controllers, reservation/payment/webhook services, health, metrics and tracing.
- `apps/web`: React/Vite operational UI and live seatmap client.
- `packages/database`: Prisma schema and generated database boundary.
- `packages/shared`: Zod contracts shared between application surfaces.
- `infra`: Docker/Kubernetes/Terraform/Nginx/Cloudflare deployment material.
- `scripts`: executable operational checks, including the concurrency gate.

## Engineering rules

- PostgreSQL is the authority for seats and tickets; Redis is a lock/event accelerator.
- Never introduce hardcoded inventory, prices, user identities, credentials, or fake availability in production paths.
- Keep the reservation TTL synchronized through `SEAT_LOCK_TTL_MS`; do not duplicate a magic timeout.
- Payment success is accepted only from a verified Stripe webhook.
- Use the controller/service split, strict TypeScript, Zod validation, structured errors, and tests for failure paths.
- Do not commit `.env`, generated output, credentials, or local dependency trees.

## Commit and release

Use focused conventional commits. A release requires updated `CHANGELOG.md`, workspace versions, runtime telemetry version, passing checks, and a GitHub release whose notes include the measured concurrency result.
