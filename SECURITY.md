# Security Policy and Threat Model

## Threat Model
MegaTicketing is designed to handle high-concurrency environments and is resistant to automated abuse, state corruption, and denial-of-service (DDoS).

### Flash Sale DDoS & Bot Mitigation
- **Edge Layer**: Cloudflare Workers intercept requests at the edge. The seatmap-cache.js worker aggressively caches read-heavy endpoints, absorbing traffic spikes before they hit the origin.
- **WAF**: cloudflare_filter and cloudflare_firewall_rule enforce managed challenges for IP addresses exhibiting bot-like behavior or invalid HTTP verbs.
- **Application Layer**: Fastify's native rate limiter acts as a secondary defense mechanism.

### Transactional Integrity
- **Distributed Locking**: Lua scripts in Redis prevent race conditions.
- **Database Partitioning**: PostgreSQL Hash Partitioning on the eservations table mitigates row-level lock contention during massive concurrent insertions.
- **Webhook Idempotency**: Stripe webhook payloads are parsed as raw Buffer objects for cryptographic signature verification, preventing replay attacks and payload tampering.

### Container Security
- **Least Privilege**: The production Dockerfile executes the API as the 
ode user, denying root access to the containerized environment.
- **Supply Chain**: The CI/CD pipeline enforces Snyk for Software Composition Analysis (SCA).

## Vulnerability Reporting
Reports concerning Redis lock bypassing, JWT token forging, Database isolation failures, or Webhook signature circumvention should be submitted via GitHub Issues.
