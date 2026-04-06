# MegaTicketing

Industrial-grade high-availability ticketing suite built for extreme concurrency and security.

## Core Features

- **Distributed Concurrency Control**: Atomic seat reservations using Redis-based distributed locking with Lua scripts to prevent race conditions.
- **Microservices Architecture**: Decoupled design using a monorepo structure for API, Web, and Shared packages.
- **Security Hardening**:
    - Modern JWT handling via the `jose` library for cryptographic integrity.
    - Strict input validation with Zod schemas.
    - Real-time threat telemetry integrated with the TDS EDR.
- **Production Infrastructure**: Optimized multi-stage Docker builds and GKE deployment manifests.

## Technical Stack

- **Backend**: Fastify, TypeScript, Prisma ORM, Redis (Sentinel/Cluster mode).
- **Frontend**: React 18, Vite, Tailwind CSS.
- **DevOps**: Docker, Terraform (GKE/Cloudflare), GitHub Actions.

## Getting Started

### Local Development
```bash
npm install
npm run db:generate
npm run dev
```

### Production Deployment (Docker)
```bash
docker compose up -d --build
```

## Maintenance and Security

This project is continuously audited for vulnerabilities using **Snyk** and **OSV-Scanner**. Security reports are automatically generated and reviewed by the Security Operations Center (SOC).
