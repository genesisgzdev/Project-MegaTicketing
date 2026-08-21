# MegaTicketing architecture

La arquitectura se entiende mejor separando disponibilidad, reserva, pago y operación. Cada flujo tiene una autoridad distinta y el frontend no decide estados de venta.

## 1. Topología de ejecución

~~~mermaid
flowchart TB
    WEB[React/Vite CyberArena] -->|GET seats cada 5s| HTTP[Fastify API]
    OPS[React App/SystemMonitor] -->|health metrics ws| HTTP
    CLIENT[cliente con Bearer JWT] -->|POST reserve| HTTP
    HTTP --> CTX[request context + error handler]
    HTTP --> RL[rate limit Redis en producción]
    HTTP --> AUTH[authenticateUser: JWT sub == userId]
    AUTH --> FRAUD[FraudService velocity/pattern]
    FRAUD --> RES[ReservationController + ReservationService]
    RES -->|SET NX PX / Lua release| R[(Redis keys)]
    RES -->|transaction + conditional update| DB[(PostgreSQL Prisma)]
    RES -->|XADD stream:orders:reserved| ORD[Redis consumer group]
    STRIPE[Stripe] -->|raw signed /webhook| PAY[WebhookController]
    PAY -->|LOCKED to PAID| DB
    HTTP --> HEALTH[/health /health/ready /metrics]
    HEALTH --> DB
    HEALTH --> R
~~~

El WebSocket `/ws` no es el canal del mapa de asientos: `CyberArena` hace polling. `/ws` consume streams operativos por evento y acepta controles de defensa solo con `x-admin-token` válido.

## 2. Reserva bajo concurrencia

~~~mermaid
sequenceDiagram
    participant C as client
    participant API as ReservationController
    participant A as JWT + FraudService
    participant R as Redis nonce
    participant PG as PostgreSQL transaction
    participant X as Redis order stream
    C->>API: POST /reserve eventId seatId userId
    API->>API: Zod UUID validation
    API->>A: authenticateUser + detectFraud
    A-->>API: allow or 401/403
    API->>R: SET lock:event:seat NX PX
    alt nonce lost
      R-->>API: no token
      API-->>C: 409
    else nonce acquired
      API->>PG: expire old LOCKED ticket/seat if TTL elapsed
      API->>PG: find user and seat
      API->>PG: UPDATE Seat WHERE isLocked=false
      API->>PG: create/update unique Ticket LOCKED
      alt transaction fails
        API->>R: Lua release with nonce
        API-->>C: error or 409
      else committed
        API->>X: XADD order reserved
        API-->>C: 201
      end
    end
~~~

## 3. Estado persistido

~~~mermaid
stateDiagram-v2
    [*] --> available
    available --> held: Seat.isLocked=true + Ticket LOCKED
    held --> available: TTL expiry / Ticket CANCELLED
    held --> sold: signed Stripe success / Ticket PAID
    sold --> sold: duplicate webhook ignored
    available --> available: failed reservation releases nonce
~~~

PostgreSQL tiene `Ticket.seatId UNIQUE` y `Seat @@unique([eventId, seatNumber])`. Redis coordina la carrera, pero no es la autoridad del ticket. Stripe confirma el pago; no crea disponibilidad.

## 4. Operación y límites

- `/health` devuelve estado de database, Redis y heap; `/health/ready` exige query SQL y `PING` Redis.
- `PubSubService` consume y recupera mensajes pendientes del stream `stream:orders:reserved`; hoy el consumidor registra y hace ACK, no es un procesador externo de fulfillment.
- Docker, Kubernetes, Terraform, Nginx y Cloudflare son superficies de despliegue configuradas en el repo, no prueba de una cuenta cloud desplegada.
- `npm run load:test` necesita API, PostgreSQL, Redis y UUIDs sembrados. El resultado válido es exactamente un `201`, cero `5xx` e invariant safe.
