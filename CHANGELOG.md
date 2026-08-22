# Changelog

All notable changes are documented here using Semantic Versioning.

## [Unreleased]

### Fixed

- Calcula el fingerprint de idempotencia después de parsear el body y ordena sus claves.
- Persiste reservas y eventos outbox en una misma transacción PostgreSQL.
- Convierte importes a unidades menores sin redondeo binario antes de llamar a Stripe.
- El fraude usa señales por actor; la presión total del evento queda como señal operativa.
- Decodifica los mensajes del stream por nombre de campo y conserva los retries de webhook durante una ventana posterior al próximo intento.
- Nombra el lock de Redis como lease de una instancia; no lo presenta como Redlock multi-master.
- Añade una imagen multi-stage de la API y alinea el entrypoint de producción con la ruta que genera TypeScript.
- Evita refunds falsos cuando Stripe entrega más de un evento para un ticket ya pagado.
- Asocia el PaymentIntent, la moneda y el importe en unidades menores al ticket antes de aceptar el webhook.
- Rechaza una solicitud de pago que intente reinterpretar el precio persistido en otra moneda.

## [2.1.1] — 2026-08-20

### Changed
- Updated workspace, API telemetry and runtime version metadata together.
- Published the current reservation invariant, integration setup and operational limits in the README.

## [2.1.0] — 2026-08-13

### Added
- Live PostgreSQL-backed seat inventory and prices in the React client.
- PaymentIntent creation guarded by a current user-owned reservation.
- A native 40,000-request concurrency gate that fails on duplicate acceptance or any 5xx response.
- Configurable reservation TTL shared by Redis, PostgreSQL reconciliation, seatmap state, and payment validation.
- Release-grade architecture, security, operations, and contribution documentation.

### Fixed
- Fastify 5 compatibility for CORS and rate limiting.
- Prisma/OpenTelemetry version mismatch that crashed the API at runtime.
- Redis stream consumer startup race and incorrect propagation of rate-limit errors.
- Version drift between workspace packages, API telemetry, and runtime logs.

### Verified
- `npm run build` passes for all workspaces.
- 24 Vitest tests pass.
- `npm audit --audit-level=moderate` reports zero vulnerabilities.
- Real Docker load: 40,000 concurrent reservation attempts, exactly one `201`, zero `5xx`.

## [2.0.0]

### Added
- Distributed Redis locking with PostgreSQL as the reservation authority.
- Stripe PaymentIntents, signed webhooks, retries, and circuit breakers.
- Docker Compose, Turborepo, Prisma, Fastify, Zod, JWT validation, React and Vite.
- Metrics, health/readiness endpoints, WebSocket operations and deployment material.

### Fixed
- Environment validation, Docker build layering, CORS, rate limiting and reservation race handling.

## [1.0.0-rc.1]

- Initial Core API and SPA release.
