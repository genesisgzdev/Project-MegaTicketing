# MegaTicketing Architecture

## System Overview
A high-performance, real-time ticketing system designed to handle massive spikes in traffic (e.g., concert on-sales).

## Tech Stack
- **Monorepo Manager:** Turborepo / npm workspaces
- **API (apps/api):** Fastify + TypeScript
- **Frontend (apps/web):** React + Vite + TailwindCSS
- **Primary Database:** PostgreSQL (Prisma ORM)
- **Cache & Real-time Locking:** Redis
- **Schema Validation:** Zod

## Core Services & Logic
1.  **Distributed Seat Locking:**
    - When a user selects a seat, a TTL (Time-To-Live) lock is placed in Redis.
    - If the purchase is not completed within 10 minutes, the lock expires automatically.
2.  **Concurrency Handling:**
    - Use PostgreSQL transactions for ticket issuance to prevent double-selling.
    - Optimistic UI updates on the frontend for low latency.

## Security Layer
- **Auth:** JWT with Refresh Tokens stored in HTTP-only cookies.
- **Audit:** All transactions logged with checksums in `packages/database`.
- **Scanning:** Continuous CI/CD security scanning via Snyk and OSV-Scanner.

## Directory Structure
- `apps/api`: REST/GraphQL endpoints.
- `apps/web`: Admin and Customer portals.
- `packages/shared`: Common TypeScript types and validation schemas (Zod).
- `packages/database`: Prisma models and migrations.


