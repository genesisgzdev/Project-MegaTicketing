# MegaTicketing

MegaTicketing es una plataforma de venta de entradas pensada para momentos de mucha demanda. La regla importante es simple: para un asiento concreto una sola solicitud puede quedarse con la reserva persistida. Las demás reciben un conflicto y no crean un ticket duplicado.

## Qué hay hoy

- API con Fastify y TypeScript
- PostgreSQL con Prisma como fuente de verdad para eventos, asientos y tickets
- Redis para locks cortos, rate limiting, eventos e idempotencia
- PaymentIntents de Stripe y webhooks firmados
- Frontend React/Vite con inventario de asientos leído desde la API
- WebSocket para actualizaciones en vivo y señales operativas
- Docker, Compose, Terraform y manifiestos de Kubernetes para los entornos de despliegue

Redis ayuda a coordinar la carrera pero no decide quién compró. La reserva definitiva se confirma dentro de una transacción de PostgreSQL:

```text
POST /reserve
  -> lock temporal en Redis
  -> UPDATE condicional del asiento en PostgreSQL
  -> ticket LOCKED
  -> PaymentIntent y webhook firmado de Stripe
  -> ticket PAID
```

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

No pongas claves de producción en el repositorio ni uses valores de ejemplo para probar una integración real.

## Rutas que importan

`POST /reserve` recibe `eventId`, `seatId` y `userId`. Devuelve `201` cuando crea la reserva, `409` si otro proceso ganó la carrera y `401` cuando falta una identidad válida en producción.

`GET /events/:eventId/seats` devuelve el estado actual de cada asiento. La interfaz consume esa respuesta y no mantiene una copia fija de la disponibilidad.

`POST /payments/intents` solo trabaja con una reserva `LOCKED` vigente del usuario.

`POST /webhook` comprueba la firma de Stripe y procesa los eventos de pago de forma idempotente. Si el procesamiento falla se permite el retry legítimo del proveedor.

## Comprobar la carrera de reservas

Con un evento, un asiento y un usuario existentes en la base puedes lanzar la prueba contra servicios reales:

```bash
npm run load:test -- http://localhost:3001 EVENT_UUID SEAT_UUID USER_UUID 40000 1000
```

El resultado esperado es un solo `201`, ningún `5xx` y `invariant.safe: true`. El resto de intentos puede terminar en `409` o en una respuesta de defensa contra abuso. El TTL de una reserva se configura con `SEAT_LOCK_TTL_MS` y por defecto es de 30 segundos.

## Operación y seguridad

- `/health` comprueba PostgreSQL, Redis y memoria
- `/health/ready` no informa readiness si una dependencia crítica está caída
- `/metrics` expone métricas para Prometheus
- `CORS_ORIGINS`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `WS_ADMIN_TOKEN` y `VITE_API_URL` son configuración explícita
- `npm run test:api:integration` ejecuta las pruebas de integración cuando hay servicios disponibles
- `npm audit` y la revisión de seguridad deben formar parte del gate antes de publicar

La arquitectura y las decisiones de seguridad están en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) y [SECURITY.md](SECURITY.md).

## Licencia

Apache License 2.0. Consulta [LICENSE](LICENSE).
