# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-04-05

### Added
- Initial industrial-grade monorepo structure.
- High-performance Fastify backend with TypeScript.
- Reactive React 18 + Vite frontend with 3D seat mapping.
- Distributed Locking Pattern using Redis Lua scripting.
- Stripe API integration for secure payment processing.
- Prisma ORM with PostgreSQL production support.
- Multi-stage Docker builds for API and Web services.
- GitHub Actions pipeline for Snyk and OSV-Scanner auditing.
- Local security shield using Husky pre-commit hooks.
- Industrial monitoring with Prometheus metrics and Grafana dashboard schema.

### Fixed
- Replaced insecure `@fastify/jwt` with `jose` for robust cryptographic integrity.
- Sanitized environment variable fallbacks in `docker-compose.yml` to prevent default secrets in production.
- Fixed Mermaid diagram rendering in README.
- Resolved dependency resolution conflicts by enforcing `--legacy-peer-deps`.

### Security
- Implemented boot-time environment validation using Zod.
- Added strict CORS and Rate Limiting policies.
- Automated vulnerability scanning integrated into CI/CD.
