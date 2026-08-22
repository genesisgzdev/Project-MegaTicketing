# MegaTicketing

Plataforma de entradas para escenarios de alta concurrencia. La propiedad que define el sistema es verificable: para un asiento y evento, como máximo una solicitud consigue la reserva persistida; las demás reciben conflicto y no crean un ticket duplicado.

En 30 segundos: React lee el inventario desde la API, Fastify valida identidad y reserva, Redis coordina la carrera corta y PostgreSQL decide la reserva definitiva. Stripe mueve el ticket de `LOCKED` a `PAID` mediante webhook firmado; la moneda y el importe se toman del asiento persistido y se comprueban al confirmar. Si Redis cae, PostgreSQL sigue siendo la autoridad.

## Qué hay

- API con Fastify y TypeScript
- PostgreSQL con Prisma como fuente de verdad para eventos, asientos y tickets
- Redis para locks cortos, rate limiting, idempotencia HTTP y transporte operativo
- PaymentIntents de Stripe y webhooks firmados
- Frontend React/Vite con inventario de asientos leído desde la API
- WebSocket para señales operativas y lectura de Redis Streams; el mapa de asientos se actualiza consultando la API
- Docker, Compose, Terraform y manifiestos de Kubernetes para los entornos de despliegue

Docker, Kubernetes, Terraform, Nginx y Cloudflare están configurados en el repositorio. La reserva escribe un evento outbox en la misma transacción que el ticket; `PubSubService` publica los outbox pendientes en Redis Streams y confirma cada uno después de publicarlo. El despliegue y las tareas posteriores de fulfillment requieren configuración externa. Ver [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) y [`docs/DEPLOYMENT_PREFLIGHT.md`](docs/DEPLOYMENT_PREFLIGHT.md).

El consumidor convierte los pares de campos del stream a nombres (`outboxId`, `eventType`, `aggregateId`, `payload`) antes de procesarlos y mantiene compatibilidad con mensajes antiguos que solo tenían `payload`. Los webhooks fallidos responden con error para que Stripe los reintente; PostgreSQL conserva el evento procesado con una clave única cuando la transacción termina correctamente.

## Flujo de una reserva

```text
POST /reserve
  -> lock temporal en Redis
  -> UPDATE condicional del asiento en PostgreSQL
  -> ticket LOCKED
  -> evento outbox en PostgreSQL, dentro de la misma transacción
  -> publicador reintentable hacia Redis Streams
  -> PaymentIntent y webhook firmado de Stripe
  -> ticket PAID
```

Health, métricas, WebSocket operativo, idempotencia, reintentos del proveedor y reconciliación están descritos en el mapa técnico.

Si Redis se reinicia PostgreSQL sigue evitando el doble ticket. Si la transacción falla el lock temporal se libera.

## Empezar en local

Necesitas Node 22 o superior, npm 10 y Docker.

```bash
cp .env.example .env
# Completa los secretos de Stripe y JWT en .env
npm ci
npm run build
npm test
```

Para levantar las dependencias:

```bash
docker compose up -d db redis
npm run db:generate
npm run db:push
```

La imagen de la API usa un build multi-stage y arranca con `apps/api/dist/apps/api/src/index.js`, que es la salida real del `tsconfig` actual. El contenedor no crea PostgreSQL ni Redis y necesita las variables de `.env.example` inyectadas por el entorno.

No pongas claves de producción en el repositorio ni uses valores de ejemplo para probar una integración real.

## Lo esencial

`POST /reserve` recibe `eventId`, `seatId` y `userId`. Devuelve `201` cuando crea la reserva, `409` si otro proceso ganó la carrera y `401` cuando falta una identidad válida en producción.

`GET /events/:eventId/seats` devuelve el estado actual de cada asiento. La interfaz consume esa respuesta y no mantiene una copia fija de la disponibilidad.

`POST /payments/intents` solo trabaja con una reserva `LOCKED` vigente del usuario.

`POST /webhook` comprueba la firma de Stripe y procesa los eventos de pago de forma idempotente. Si el procesamiento falla se permite el retry legítimo del proveedor.

Los eventos de Stripe procesados se guardan en PostgreSQL. Si un pago confirmado llega después de que la reserva expiró, no revive el ticket: se cancela, se conserva el `refundId` cuando Stripe confirma el refund y un retry puede repetir la solicitud con la misma clave idempotente si el proceso cayó antes de guardarlo. Los eventos de reserva pendientes también quedan en PostgreSQL hasta que el publicador los entrega a Redis Streams. Redis coordina la carrera corta y transporta eventos; no decide la venta.

Los importes se convierten a unidades menores según la moneda antes de llamar a Stripe. El precio se toma de PostgreSQL, no del frontend.

## Prueba que realmente importa

Con un evento, un asiento y un usuario existentes en la base puedes lanzar la prueba contra servicios reales:

```bash
npm run load:test -- http://localhost:3001 EVENT_UUID SEAT_UUID USER_UUID 40000 1000
```

El resultado esperado es un solo `201`, ningún `5xx` y `invariant.safe: true`. El resto puede terminar en `409` o en una respuesta de defensa contra abuso. El TTL se configura con `SEAT_LOCK_TTL_MS` y por defecto es de 30 segundos. Esta prueba necesita API, PostgreSQL, Redis y datos sembrados; una ejecución sin esos servicios no demuestra concurrencia real.

## Dependencias y límites de confianza

- `/health` comprueba PostgreSQL, Redis y memoria
- `/health/ready` no informa readiness si una dependencia crítica está caída
- `/metrics` expone métricas para Prometheus
- `CORS_ORIGINS`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `WS_ADMIN_TOKEN` y `VITE_API_URL` son configuración explícita
- `npm run test:api:integration` ejecuta las pruebas de integración cuando hay servicios disponibles
- `npm audit` y la revisión de seguridad deben formar parte del gate antes de publicar

PostgreSQL es la fuente de verdad de asientos y tickets. Redis es coordinación temporal, rate limiting, idempotencia y stream. Stripe es una dependencia externa para pagos y su webhook firmado es la transición de pago. React no decide disponibilidad y los manifiestos no equivalen a un despliegue observado.

La arquitectura y las decisiones de seguridad están en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) y [SECURITY.md](SECURITY.md).

## Licencia

Apache License 2.0. Consulta [LICENSE](LICENSE).
