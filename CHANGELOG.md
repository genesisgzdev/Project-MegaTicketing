# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-04-05

### Added
- **Industrial Redis Locking**: Implemented distributed locking pattern using atomic Lua scripting to prevent overbooking in high-concurrency environments.
- **Stripe High-Availability (HA)**: Robust payment flow with idempotency keys, automatic retry logic for webhooks, and circuit breaker patterns.
- **Dockerized Architecture**: Full containerization with multi-stage builds for optimized production images and `docker-compose` orchestration for microservices.
- **Turborepo Integration**: Monorepo management with intelligent caching and parallel execution pipelines.
- **Prisma Data Layer**: Centralized PostgreSQL persistence with type-safe client generation.
- **Fastify Backend**: High-performance API layer with Zod validation and `jose` for cryptographic JWT integrity.
- **React Frontend**: Modern UI with React 18, Vite, and React Three Fiber for interactive 3D seat mapping.
- **Security Guardrails**: Integrated Snyk, OSV-Scanner, and Husky hooks for continuous security auditing.

### Fixed
- Improved environment variable validation at runtime.
- Optimized Docker build layers to reduce image size by 40%.
- Resolved race conditions in seat reservation state transitions.

### Security
- Mandatory SAST/SCA scanning in CI/CD.
- Strict Content Security Policy (CORS) and rate limiting.
