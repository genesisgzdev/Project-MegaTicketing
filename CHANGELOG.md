# Changelog

All notable changes are documented here using Semantic Versioning.

## [2.1.4] — 2026-08-22

### Changed

- Hace que Terraform sea la única fuente Kubernetes del repositorio.
- Exige una imagen API inmutable, referencias a secretos externos, probes de salud y un HPA versionado.
- Retira manifiestos sueltos que apuntaban a otro namespace y a otro Deployment.

### Riesgo y actualización

- No se ejecuta ningún apply automáticamente.
- Antes de aplicar hacen falta provider credentials, service account, Secret externo, backend con locking, aprobación de entorno y rollback probado.

## [2.1.3] — 2026-08-22

### Fixed

- Mantiene la publicación de reservas detrás del outbox transaccional y elimina la ruta directa al stream.

### Riesgo y actualización

- No cambia el esquema ni requiere migración.
- La publicación de `ticket.reserved` queda centralizada en el publisher que reclama filas outbox.

## [2.1.2] — 2026-08-22

### Fixed

- Calcula el fingerprint de idempotencia después de parsear el body y ordena sus claves.
- Persiste reservas y eventos outbox en una misma transacción PostgreSQL.
- Convierte importes a unidades menores sin redondeo binario antes de llamar a Stripe.
- El fraude usa señales por actor; la presión total del evento queda como señal operativa.
- Decodifica los mensajes del stream por nombre de campo y deja los retries de webhook bajo responsabilidad de Stripe, con idempotencia durable en PostgreSQL.
- Nombra el lock de Redis como lease de una instancia; no lo presenta como Redlock multi-master.
- Añade una imagen multi-stage de la API y alinea el entrypoint de producción con la ruta que genera TypeScript.
- Evita refunds falsos cuando Stripe entrega más de un evento para un ticket ya pagado.
- Asocia el PaymentIntent, la moneda y el importe en unidades menores al ticket antes de aceptar el webhook.
- Rechaza una solicitud de pago que intente reinterpretar el precio persistido en otra moneda.
- Reclama filas outbox con `SKIP LOCKED` y lease recuperable para evitar publicaciones concurrentes entre réplicas.
- Rechaza webhooks de pago que llegan después del TTL persistido, cancela el ticket y libera el asiento antes de solicitar el refund.
- Conserva el `refundId` y permite reintentar un refund pendiente después de una caída entre la cancelación y la respuesta de Stripe.
- Impide reciclar un asiento pagado cuando su marca histórica de lock supera el TTL.

### Riesgo y actualización

- No cambia el esquema ni requiere migración.
- La release corrige una ruta de consistencia de reservas pagadas y se valida con PostgreSQL y Redis.

## [Unreleased]

- El panel web deja de mostrar WAF, región, Kubernetes o alertas que la API no expone; ahora muestra únicamente health, estado del WebSocket y eventos de Redis recibidos. `VITE_EVENT_ID` activa la suscripción del panel al stream de un evento.
- Los webhooks de pago rechazan bindings incompletos y esperan el reintento de Stripe en lugar de confirmar una carrera entre Stripe y PostgreSQL.
- El canal WebSocket rechaza controles de defensa no conectados y ya no expone una configuración administrativa sin runtime detrás.
- Exige `JWT_ISSUER` y `JWT_AUDIENCE` cuando la API arranca en producción; la firma sigue limitada a `HS256` y la identidad se toma del `sub` validado.
- Limpia toda la vinculación de pago al reciclar un ticket expirado para otro usuario; un webhook tardío del PaymentIntent anterior ya no puede pagar la reserva nueva.
- El endpoint de PaymentIntent devuelve `409` si la vinculación condicional del pago pierde una carrera antes de confirmar la reserva; ya no responde `201` con un secreto sin asociación local.

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
