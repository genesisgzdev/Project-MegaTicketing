# MegaTicketing

MegaTicketing es una plataforma de venta de entradas orientada a picos de demanda. Su regla de negocio no es una promesa de marketing: para un asiento concreto, una sola petición puede crear la reserva persistida; las demás reciben conflicto. La garantía se sostiene en PostgreSQL y se acelera con Redis.

## Estado real

- API Fastify + TypeScript.
- PostgreSQL/Prisma como autoridad de reservas y tickets.
- Redis como lock distribuido de corta duración, rate limiting y eventos.
- Stripe PaymentIntents con idempotencia por evento/asiento/usuario.
- WebSocket para inventario y señales operativas; el control administrativo requiere token.
- React/Vite consume el mapa de asientos desde `/events/:eventId/seats`; no inventa disponibilidad local.
- Node 22 en las imágenes Docker.

## Mapa del sistema

```text
apps/api/
  controllers/       HTTP, pagos, reservas, seatmap, seguridad y Stripe webhook
  services/          reserva transaccional, fraude, salud, Pub/Sub y seguridad
  redis.ts            nonce NX/PX, liberación Lua, estado realtime e idempotencia
  db.ts               frontera Prisma/PostgreSQL
  health-check.ts     health/readiness con dependencias reales
  metrics.ts          métricas Prometheus
apps/web/
  App.tsx             consola operativa, health y WebSocket
  CyberArena.tsx      mapa conectado al inventario PostgreSQL
packages/
  database/prisma/    Event, Seat, Ticket y estados persistidos
  shared/             contratos Zod compartidos
infra/
  Docker/Compose      runtime local y contenedores multi-stage
  Kubernetes/HPA      despliegue y escalado de API
  Terraform            GKE y Cloudflare/WAF
  nginx/               gateway HTTP/WebSocket sin cachear mutaciones
scripts/
  concurrency-check   prueba contra Redis + PostgreSQL reales, no mocks
.github/workflows/
  security            audit, build y tests en PR/push
  release              release manual versionada
```

La ruta crítica es `POST /reserve` → nonce Redis → `UPDATE Seat ... WHERE isLocked=false` en PostgreSQL → único `Ticket` → Stripe webhook firmado → `PAID`. La interfaz, el gateway y las capas de infraestructura consumen ese estado; ninguna decide por sí sola que un asiento está vendido.

## La invariante de venta única

La ruta `POST /reserve` sigue este orden:

1. Valida UUIDs y, en producción, verifica que el JWT sea del `userId` solicitado.
2. Obtiene un nonce con `SET NX PX` en Redis.
3. En una transacción PostgreSQL libera un lock persistido expirado, ejecuta `UPDATE seat ... WHERE isLocked=false`, y solo si afecta una fila crea/actualiza el ticket `LOCKED`.
4. Si la transacción falla libera el nonce Redis.
5. El webhook Stripe cambia el ticket a `PAID` de forma condicional; el evento queda idempotentemente registrado.

Redis nunca es la autoridad final. Si Redis se reinicia, PostgreSQL sigue impidiendo el doble ticket; si PostgreSQL rechaza la operación, el lock Redis se libera.

## Desarrollo local

Requisitos: Node 22+, npm 10+ y Docker.

```bash
cp .env.example .env
# Completa STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET y JWT_SECRET.
npm ci
npm run build
npm test
```

Para levantar las dependencias:

```bash
docker compose up -d db redis
npx prisma db push --schema packages/database/prisma/schema.prisma
```

La API requiere secretos reales en Compose; no hay claves placeholder silenciosas en producción.

## Contratos principales

`POST /reserve`

```json
{"eventId":"uuid","seatId":"uuid","userId":"uuid"}
```

Devuelve `201` una vez, `409` si el asiento está ocupado y `401` cuando producción no recibe un JWT válido.

`GET /events/:eventId/seats` devuelve el evento, precio y estado real (`available`, `held`, `sold`). El frontend refresca ese inventario y no usa asientos hardcodeados.

`POST /payments/intents` solo acepta una reserva `LOCKED` vigente del usuario y devuelve el `clientSecret` de Stripe.

`POST /webhook` verifica la firma raw de Stripe y acepta `payment_intent.succeeded` y `checkout.session.completed`. Los fallos liberan el marcador de procesamiento para permitir el retry legítimo de Stripe.

## Prueba de concurrencia

Con un evento, asiento y usuario existentes en la base:

```bash
npm run load:test -- http://localhost:3001 EVENT_UUID SEAT_UUID USER_UUID 40000 1000
```

El resultado debe reportar exactamente un `201`, ningún `5xx` y `invariant.safe: true`. El resto puede ser `409` por carrera o `403` por la defensa de abuso. Esta prueba golpea la API real; no mockea Redis, PostgreSQL ni el controlador. El TTL de reserva se controla con `SEAT_LOCK_TTL_MS` y vale 30 segundos por defecto.

## Operación

- `/health` verifica PostgreSQL, Redis y memoria.
- `/health/ready` bloquea readiness si PostgreSQL o Redis no responden.
- `/metrics` expone métricas Prometheus.
- `CORS_ORIGINS`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `WS_ADMIN_TOKEN` y `VITE_API_URL` son configuración explícita.
- `npm audit` debe permanecer en cero antes de publicar.

Para el detalle de invariantes, amenazas, límites y fallos aceptables, consultar [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) y [SECURITY.md](SECURITY.md).
