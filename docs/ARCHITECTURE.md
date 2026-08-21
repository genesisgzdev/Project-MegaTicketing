# MegaTicketing architecture

~~~mermaid
flowchart LR
    W[React seat map] -->|GET seats every 5s| API[Fastify API]
    O[Operations UI] -->|health metrics ws| API
    U[Client with Bearer JWT] -->|POST reserve| API
    API --> AUTH[JWT subject check]
    API --> FRAUD[Redis velocity check]
    AUTH --> R[ReservationService]
    FRAUD --> R
    R -->|SET NX PX and Lua release| Redis[(Redis)]
    R -->|transactional seat update and ticket| PG[(PostgreSQL Prisma)]
    R -->|XADD order reserved| Stream[(Redis Stream)]
    P[Stripe] -->|signed POST webhook| API
    API -->|conditional LOCKED to PAID| PG
    API -->|health readiness| PG
    API -->|health readiness and streams| Redis
~~~

## State authority

- PostgreSQL owns Event, Seat, Ticket and TicketStatus. Seat.isLocked plus lockedAt is reconciled inside the reservation transaction.
- Redis owns short-lived coordination keys and streams. Losing Redis must not create a second PostgreSQL ticket; losing PostgreSQL fails the reservation.
- Stripe is authoritative for payment events. webhook checks the raw signed body and uses a Redis idempotency marker before confirming a locked ticket.
- The web seat map polls the API. It does not receive seat availability from ws; ws is for operational Redis-stream messages and defense controls.

## Critical request path

ReservationController validates UUIDs, verifies that the JWT subject equals the requested user, applies fraud checks, then calls ReservationService. The service obtains a Redis nonce and runs a PostgreSQL transaction that expires an old lock, conditionally updates the seat and creates or refreshes the unique ticket. A failed transaction releases the nonce.

PaymentController accepts only a current LOCKED ticket owned by the authenticated user. WebhookController conditionally moves that ticket to PAID; duplicate Stripe deliveries are ignored through the event marker.

## Operational boundary

The repository has local Docker and deployment material for Kubernetes, Terraform and Cloudflare, but those manifests are not proof of a deployed environment. npm run load:test requires reachable PostgreSQL, Redis, seeded IDs and a running API.
