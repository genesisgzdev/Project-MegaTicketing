# MegaTicketing Platform v2.1.0

## Executive Summary
MegaTicketing is a high-availability, distributed ticketing platform engineered to handle massive, concurrent traffic spikes (flash sales). Built on a microservices architecture, it guarantees transactional atomic consistency and zero-overselling through advanced Redis Lua locking, event-driven state reconciliation, and edge caching.

## System Architecture & Distributed Concurrency

### 1. Controller/Service Pattern (Fastify)
The system strictly adheres to the Controller/Service architectural pattern, leveraging **Fastify** for its low overhead and high-throughput capabilities.
- **Controllers**: Act purely as the transport layer. They handle HTTP request parsing, routing, and HTTP response formatting.
- **Services**: Encapsulate all business logic. They are protocol-agnostic, making them highly testable and reusable.

### 2. Distributed Atomic Locking (Redis Lua Scripts)
Preventing overselling under high concurrency is achieved via a distributed locking mechanism.
- **Lua Scripts (`releaseLockAtomic`)**: To guarantee atomicity, lock management is pushed directly to the Redis engine using Lua scripts. The `releaseLockAtomic` script ensures that a lock is only released if the requester possesses the correct unique lock token. This eliminates race conditions.

### 3. Real-time State Reconciliation (Redis Streams & WebSockets)
To keep the UI synchronized with the backend state (e.g., seat availability) without aggressive polling, the system uses a reactive, event-driven topology.
- **Redis Streams (`XREAD BLOCK`)**: Services publish state-change events to Redis Streams. Dedicated worker processes consume these streams using `XREAD BLOCK`, ensuring ordered, at-least-once delivery of state mutations with minimal CPU overhead.
- **WebSockets**: Upon consuming a stream event, the real-time gateway broadcasts the delta to all relevant connected WebSocket clients.

### 4. Idempotent Webhook Handling (Zod Validation)
External systems (like payment gateways) use webhooks to notify the platform of asynchronous events. 
- **Strict Validation**: All incoming payloads are verified at the perimeter using **Zod**. This provides runtime type safety and payload sanitization.
- **Idempotency**: The Webhook Controller relies on unique event identifiers stored in the database or Redis to safely ignore duplicate events, ensuring that a payment is never applied to a reservation twice.

## Infrastructure & Deployment Operations

### Cloudflare Edge Caching & WAF (Terraform)
We utilize Terraform to provision and manage our Cloudflare edge infrastructure, ensuring consistent performance and protection against malicious traffic:
- **Edge Caching via Workers:** A custom Cloudflare Worker script (`megaticketing-seatmap-cache`) is deployed and routed to handle real-time seat map requests. This aggressively caches highly-requested data at the edge, drastically reducing the load on upstream API instances during flash sales.
- **WAF & Managed Challenges:** We deploy tailored `cloudflare_filter` and `cloudflare_firewall_rule` configurations to monitor and mitigate abuse, thwarting bot-driven ticket scalping before it hits the origin network.

### Docker Compose Resource Constraints
To guarantee predictability and prevent resource starvation across our containerized microservices, the cluster is governed by strict Docker Compose resource constraints:
- **Database (PostgreSQL):** Hard-limited to 2.0 CPUs and 2GB RAM.
- **Cache (Redis):** Hard-limited to 1.0 CPUs and 1GB RAM.
- **API Services:** Deployed with 3 load-balanced replicas with strict reservations to maintain responsive routing.