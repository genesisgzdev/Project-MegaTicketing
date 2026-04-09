### Core Architecture
* Backend API built with Fastify for optimized I/O throughput.
* Atomic seat reservation system implemented via Redis Lua scripts to prevent overselling and race conditions.
* Frontend SPA built with React and Vite, utilizing virtualization for rendering large-scale seat maps.
* Data layer managed with Prisma ORM for relational consistency.

### Security & Infrastructure
* Dedicated anti-fraud service for anomaly detection in transactions.
* Automated mitigation scripts (Python) integrated for application-layer defense.
* Perimeter resilience implemented via Circuit Breaker pattern in Redis.
* Infrastructure as Code (IaC) included: Terraform configurations for Kubernetes provisioning and Cloudflare routing.
* Kubernetes deployment manifests (Helm charts) with Horizontal Pod Autoscaler (HPA) configurations.
