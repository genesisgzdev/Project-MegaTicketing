# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0]

### Added
- **Distributed Redis Locking**: Implemented a distributed locking pattern using atomic Lua scripting to ensure data consistency in high-concurrency environments.
- **Stripe Integration**: Robust payment flow with idempotency support, automatic retry logic for webhooks, and circuit breaker patterns for resilience.
- **Containerized Architecture**: Full containerization using multi-stage Docker builds for optimized production images and `docker-compose` orchestration.
- **Turborepo Monorepo**: Centralized management with intelligent caching and parallel execution pipelines across apps and packages.
- **Type-Safe Persistence**: Integrated Prisma ORM for PostgreSQL with automated client generation and migration workflows.
- **High-Performance API**: Backend powered by Fastify with Zod payload validation and `jose` for secure JWT handling.
- **Interactive Frontend**: React 18 UI with Vite and React Three Fiber for WebGL-based seat mapping and real-time updates.
- **Automated Security Pipelines**: Integrated Snyk and OSV-Scanner into GitHub Actions for continuous security auditing and dependency scanning.

### Fixed
- Improved environment variable validation and runtime configuration management.
- Optimized Docker build layers to reduce final image size.
- Resolved race conditions in the seat reservation state machine.

### Security
- Automated SAST/SCA scanning in CI/CD pipelines.
- Enhanced CORS policies and granular rate limiting per service.
# Unreleased — 2026-08-13

- Reemplazado el mapa de asientos inventado por inventario y precios leídos desde PostgreSQL.
- Añadidos `GET /events/:eventId/seats` y `POST /payments/intents`.
- Añadida prueba de carrera real para 40.000 peticiones contra un mismo asiento.
- Corregidos retries Stripe: un fallo de procesamiento ya no bloquea indefinidamente el retry legítimo.
- Documentadas fuentes de verdad, límites de escala y garantías verificables.
