# 🏟️ MegaTicketing: Industrial-Grade High-Availability Suite

[![Security Status](https://img.shields.io/badge/Security-Snyk%20Verified-blueviolet)](https://snyk.io/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

MegaTicketing is an enterprise-grade monorepo designed for high-concurrency event management. It features a distributed architecture focused on performance, real-time consistency, and advanced security hardening.

## 🏗️ Monorepo Architecture

Managed via **Turbo**, the repository is structured into isolated microservices and shared packages:

-   **`apps/api`**: High-performance backend built with **Fastify** and **TypeScript**.
-   **`apps/web`**: Reactive frontend using **React 18**, **Vite**, and **Tailwind CSS**.
-   **`packages/database`**: Type-safe persistence layer powered by **Prisma ORM**.
-   **`packages/shared`**: Shared validation schemas using **Zod**.

## 🚀 Key Features & Industrial Logic

### 1. Distributed Concurrency Control (Redis Locking)
To prevent seat overbooking in high-traffic events, MegaTicketing implements a **Distributed Locking** mechanism using **Redis**. This ensures that seat reservations are atomic and consistent across multiple API instances.

### 2. Advanced Security Hardening
-   **JWT with `jose`**: Replaced insecure implementations with the modern `jose` library for JWS/JWT handling, ensuring cryptographic integrity.
-   **Real-time Attack Monitoring**: Integrated WebSocket telemetry to detect and broadcast abnormal request spikes (Internal "Boss Battle" mode).
-   **Snyk Integration**: Continuous static analysis (SAST) and dependency auditing to maintain a zero-vulnerability codebase.

### 3. Production-Ready Infrastructure
-   **Multi-stage Docker Builds**: Optimized images for both API and Web components.
-   **Infrastructure as Code**: Terraform configurations included for **Kubernetes (GKE)** and **Cloudflare WAF** deployment.

## 🛠️ Tech Stack

-   **Runtime**: Node.js 20 (Slim)
-   **Backend**: Fastify, WebSockets, Prisma, Redis, Stripe API.
-   **Frontend**: React, Vite, Tailwind CSS, Framer Motion.
-   **DevOps**: Docker, Terraform, Snyk, GitHub Actions.

## 🚦 Getting Started

### Local Development
```bash
npm install
npm run db:generate
npm run dev
```

### Docker Production Build
```bash
docker build -t mega-ticketing-api -f apps/api/Dockerfile .
docker build -t mega-ticketing-web -f apps/web/Dockerfile .
```

---
*Developed with a focus on technical integrity and anti-evasion mindset. Zero simulated logic. Full industrial grade.*
