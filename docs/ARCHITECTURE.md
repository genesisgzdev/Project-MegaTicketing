# MegaTicketing architecture

La arquitectura se entiende mejor separando disponibilidad, reserva, pago y operación. Cada flujo tiene una autoridad distinta y el frontend no decide estados de venta.

## Cómo leerlo

La primera figura ubica las dependencias. La segunda sigue una reserva que compite con otras. La tercera muestra los estados persistidos. PostgreSQL decide el ticket.

## 1. Topología de ejecución

~~~mermaid
flowchart TB
    WEB[React seat map] -->|seat polling| HTTP[Fastify API]
    OPS[React operations] -->|health metrics socket| HTTP
    CLIENT[client with JWT] -->|reserve request| HTTP
    HTTP --> CTX[request context and errors]
    HTTP --> RL[Redis rate limit]
    HTTP --> AUTH[JWT authentication]
    AUTH --> FRAUD[fraud service]
    FRAUD --> RES[reservation service]
    RES -->|lock and release| R[(Redis keys)]
    RES -->|database transaction| DB[(PostgreSQL)]
    RES -->|reserved event| ORD[Redis consumer]
    STRIPE[Stripe] -->|signed webhook| PAY[payment webhook]
    PAY -->|paid state| DB
    HTTP --> HEALTH[health readiness metrics]
    HEALTH --> DB
    HEALTH --> R
~~~

El WebSocket `/ws` no es el canal del mapa de asientos: `CyberArena` hace polling. `/ws` consume streams operativos por evento y acepta controles de defensa solo con `x-admin-token` válido.

## 2. Reserva bajo concurrencia

~~~mermaid
sequenceDiagram
    participant C as client
    participant API as ReservationController
    participant A as auth and fraud
    participant R as Redis nonce
    participant PG as PostgreSQL transaction
    participant X as Redis order stream
    C->>API: reserve event and seat
    API->>API: Zod UUID validation
    API->>A: authenticate and check fraud
    A-->>API: allow or reject
    API->>R: SET lock:event:seat NX PX
    alt nonce lost
      R-->>API: no token
      API-->>C: 409
    else nonce acquired
    API->>PG: expire old locked ticket when needed
      API->>PG: find user and seat
      API->>PG: UPDATE Seat WHERE isLocked=false
    API->>PG: create or update locked ticket
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
    available --> held: seat locked and ticket locked
    held --> available: expiry or cancellation
    held --> sold: signed payment success
    sold --> sold: duplicate webhook ignored
    available --> available: failed reservation releases nonce
~~~

PostgreSQL tiene `Ticket.seatId UNIQUE` y `Seat @@unique([eventId, seatNumber])`. Redis coordina la carrera, pero no es la autoridad del ticket. Stripe confirma el pago; no crea disponibilidad.

Los IDs de webhooks procesados también quedan en PostgreSQL con una clave única. Redis mantiene el lock breve de entrada; no guarda el único registro de un pago.

## 4. Operación y límites

- `/health` devuelve estado de database, Redis y heap; `/health/ready` exige query SQL y `PING` Redis.
- `PubSubService` consume y recupera mensajes pendientes del stream `stream:orders:reserved`; hoy el consumidor registra y hace ACK, no es un procesador externo de fulfillment.
- Docker, Kubernetes, Terraform, Nginx y Cloudflare son superficies de despliegue configuradas en el repo, no prueba de una cuenta cloud desplegada.
- `npm run load:test` necesita API, PostgreSQL, Redis y UUIDs sembrados. El resultado válido es exactamente un `201`, cero `5xx` e invariant safe.
