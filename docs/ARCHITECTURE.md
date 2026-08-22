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
    RES -->|same transaction| OUT[(PostgreSQL outbox)]
    OUT -->|retryable publisher| ORD[Redis Streams consumer]
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
    participant O as PostgreSQL outbox
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
        API->>PG: INSERT outbox ticket.reserved
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
    held --> expired_payment: payment after expiry
    expired_payment --> expired_payment: refund request retry
    sold --> sold: duplicate webhook ignored
    available --> available: failed reservation releases nonce
~~~

Después del commit, un publicador reclama hasta 50 filas `OutboxEvent` con `FOR UPDATE SKIP LOCKED` y una lease de 60 segundos antes de hacer `XADD`. Si el proceso muere antes de marcar la fila, otra réplica puede recuperar el claim vencido. Si muere después de `XADD` y antes del update, sigue siendo posible una entrega duplicada; el consumidor debe usar `outboxId` como clave idempotente.

El consumidor no depende de posiciones fijas en el array de Redis: reconstruye el mapa de campos y extrae `payload`, con fallback para el formato antiguo. Los fallos del webhook devuelven un estado no exitoso para que Stripe reprograme la entrega; el evento queda registrado en PostgreSQL dentro de la transacción que aplica la transición de pago. Redis no actúa como cola durable de pagos.

PostgreSQL tiene `Ticket.seatId UNIQUE` y `Seat @@unique([eventId, seatNumber])`. Redis coordina la carrera, pero no es la autoridad del ticket. Stripe confirma el pago; no crea disponibilidad.

Un `payment_intent.succeeded` posterior a la expiración queda registrado como evento procesado, mantiene el ticket cancelado y solicita un refund con una clave idempotente. No existe una transición `CANCELLED -> PAID`.

La expiración se comprueba dentro de la misma transacción que procesa el webhook usando `Seat.lockedAt`; no depende de que otra reserva haya pasado antes por el asiento para limpiar el lock. El ticket conserva `refundId` después de un refund confirmado. Si el proceso cae entre `CANCELLED` y la llamada o confirmación del refund, una entrega posterior busca el ticket cancelado sin `refundId` y reintenta con una clave derivada del `PaymentIntent`, no del evento concreto.

El precio persistido en `Seat` incluye su moneda. La API no permite que el cliente reinterprete un importe en otra moneda; el `PaymentIntent`, el importe en unidades menores y la moneda quedan asociados al ticket. La transición a `PAID` exige que el ID del webhook coincida con el `PaymentIntent` persistido y que importe y moneda también coincidan. Si el asiento se recicla mientras Stripe crea el intent, el update condicional no entrega un client secret para un ticket distinto y el intent sin asociación se cancela de forma best effort.

Si Stripe entrega más de un tipo de evento para el mismo pago, un ticket que ya está `PAID` se considera repetición y no vuelve al camino de expiración ni solicita un refund.

Los IDs de webhooks procesados también quedan en PostgreSQL con una clave única. Redis mantiene el lock breve de entrada; no guarda el único registro de un pago.

## 4. Operación y límites

- `/health` devuelve estado de database, Redis y heap; `/health/ready` exige query SQL y `PING` Redis.
- `PubSubService` publica outbox pendientes, consume y recupera mensajes pendientes del stream `stream:orders:reserved`; hoy el consumidor registra y hace ACK, no es un procesador externo de fulfillment.
- La presión del evento se registra como señal operativa. El bloqueo de fraude se calcula por actor y ventana, no por el total de compradores de un evento.
- `defenseActive` ya no aparece como estado operativo: los mensajes WebSocket de activar o desactivar defensa se rechazan mientras no exista una política conectada al runtime.
- Docker, Kubernetes, Terraform, Nginx y Cloudflare son superficies de despliegue configuradas en el repo, no prueba de una cuenta cloud desplegada.
- `npm run load:test` necesita API, PostgreSQL, Redis y UUIDs sembrados. El resultado válido es exactamente un `201`, cero `5xx` e invariant safe.
