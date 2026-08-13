# Arquitectura operativa

## Fuentes de verdad

| Dato | Autoridad | Caché/evento |
|---|---|---|
| Evento y precio | PostgreSQL | Redis/Cloudflare solo para lecturas explícitas |
| Lock temporal | Redis nonce NX/PX | `Seat.lockedAt` permite reconciliación |
| Ticket vendido | PostgreSQL `Ticket.status=PAID` | Redis refleja estado para realtime |
| Pago | Stripe + webhook firmado | marcador Redis de idempotencia |

## Carrera de 40.000 compradores

La unicidad no depende de que una instancia de Node sea la primera. Todas las réplicas pueden recibir la petición. El nonce Redis reduce trabajo duplicado; la condición PostgreSQL `isLocked=false` es el árbitro final. Bajo READ COMMITTED, solo una transacción puede afectar esa fila; la restricción `Ticket.seatId UNIQUE` añade una segunda barrera.

Una caída entre Redis y PostgreSQL puede dejar un lock temporal sin ticket, pero el lock expira y la siguiente reserva reconcilia `Seat.lockedAt`. Una caída después de crear el ticket no puede generar otro ticket para ese asiento.

## Ciclo de vida

```text
available -> Redis lock -> PostgreSQL seat locked + Ticket LOCKED
LOCKED + payment_intent.succeeded -> Ticket PAID
LOCKED + timeout -> Ticket CANCELLED y Seat disponible
PAID -> inmutable frente a nuevas reservas
```

El TTL por defecto es 30 segundos y se controla con `SEAT_LOCK_TTL_MS`; la misma configuración se usa en Redis, reconciliación SQL, mapa y payment intent. Cambiarlo exige revisar la ventana de carga y las expectativas de producto.

## Escala y límites

Redis de un nodo no es un Redlock multi-master; es un acelerador y protección de ráfaga. Para producción multi-región, usar Redis gestionado con failover y mantener PostgreSQL con una única autoridad transaccional por evento. Cloudflare puede absorber mapa/cache, pero nunca cachear `POST /reserve`, `/payments/intents` o `/webhook`.

La prueba incluida mide el sistema completo y falla si acepta más de una petición. No prueba capacidad infinita: la capacidad real depende de PostgreSQL, Redis, límites de Stripe, red y configuración del despliegue.
