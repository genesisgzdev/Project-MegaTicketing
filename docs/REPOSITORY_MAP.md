# Mapa del repositorio

Revisión de estructura y flujos: 2026-09-11. Este inventario cubre los archivos versionados y las incorporaciones de esta revisión; excluye dependencias instaladas y artefactos de build. Los límites de validación aparecen por área.

## Flujos y fronteras

| Área | Recorrido real | Verificación / límite |
| --- | --- | --- |
| Web | React → GET /events paginado → GET /events/:eventId/seats | Inventario HTTP, moneda por asiento, selección local; no incluye login ni checkout completo |
| Acceso | configuración → JWT con exp/sub e issuer/audience en producción → controladores | Bypass de pruebas solo en NODE_ENV=test |
| Reserva | Redis lease → transacción PostgreSQL con bloqueo de Seat → Ticket y OutboxEvent | PostgreSQL decide la venta; Redis reduce contención |
| Pago | generación de reserva → Stripe PaymentIntent → PaymentAttempt durable | Reintento del mismo intent válido; identidad sobrevive al reciclado de Ticket |
| Webhook | cuerpo crudo firmado → evento único → bloqueo de fila → venta o refund pendiente | Solo payment_intent.succeeded; importe/moneda/TTL/propietario deben coincidir |
| Eventos | outbox con token de reclamación → Redis Stream → processedOrderEvent | Conexión BLOCK separada; entrega al menos una vez; consumidor registra, no emite entradas por correo |
| Ciclo de vida | Fastify onReady/onClose → workers → tracing → DB/Redis | Detiene productores/lector antes de desconectar dependencias |
| Despliegue local | migraciones versionadas → API y web → Nginx /api y / | Compose no publica DB/Redis; desarrollo local no es certificación de producción |
| Infraestructura opcional | Terraform GCP/Cloudflare, Worker cache | Validación sintáctica; no Terraform apply ni despliegue cloud durante revisión |

Los módulos game-state/HealthController/HealthService, metrics.ts, redis-enhanced.ts y varios hooks de rendimiento no forman parte de las rutas activas de index.ts/App.tsx. La métrica activa es fastify-metrics. No se interpreta su presencia como integración operativa. Las pruebas de Stripe usan contratos y firmas; no se realizaron cobros reales. La integración PostgreSQL/Redis se ejecuta en CI con servicios reales.

## Inventario de archivos

| Archivo | Responsabilidad |
| --- | --- |
| [.dockerignore](../.dockerignore) | Configuración/metadata: .dockerignore |
| [.env.example](../.env.example) | Configuración/metadata: .env.example |
| [.github/workflows/deploy.yml](../.github/workflows/deploy.yml) | Automatización de deploy |
| [.github/workflows/release.yml](../.github/workflows/release.yml) | Automatización de release |
| [.github/workflows/security.yml](../.github/workflows/security.yml) | Automatización de security |
| [.gitignore](../.gitignore) | Configuración/metadata: .gitignore |
| [CHANGELOG.md](../CHANGELOG.md) | Documentación: CHANGELOG |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Documentación: CONTRIBUTING |
| [Dockerfile](../Dockerfile) | Build y ejecución en contenedores |
| [LICENSE](../LICENSE) | Licencia del proyecto |
| [README.md](../README.md) | Documentación: README |
| [SECURITY.md](../SECURITY.md) | Documentación: SECURITY |
| [apps/api/Dockerfile](../apps/api/Dockerfile) | Build y ejecución en contenedores |
| [apps/api/attack.js](../apps/api/attack.js) | Módulo: attack |
| [apps/api/package.json](../apps/api/package.json) | Dependencias y comandos del componente |
| [apps/api/scripts/soc_bot_trigger.py](../apps/api/scripts/soc_bot_trigger.py) | Módulo: soc_bot_trigger |
| [apps/api/src/__tests__/auth.test.ts](../apps/api/src/__tests__/auth.test.ts) | Validación: auth.test |
| [apps/api/src/__tests__/config.test.ts](../apps/api/src/__tests__/config.test.ts) | Validación: config.test |
| [apps/api/src/__tests__/idempotency.test.ts](../apps/api/src/__tests__/idempotency.test.ts) | Validación: idempotency.test |
| [apps/api/src/__tests__/payments.test.ts](../apps/api/src/__tests__/payments.test.ts) | Validación: payments.test |
| [apps/api/src/__tests__/pubsub.test.ts](../apps/api/src/__tests__/pubsub.test.ts) | Validación: pubsub.test |
| [apps/api/src/__tests__/redis-enhanced.test.ts](../apps/api/src/__tests__/redis-enhanced.test.ts) | Validación: redis-enhanced.test |
| [apps/api/src/__tests__/redis.test.ts](../apps/api/src/__tests__/redis.test.ts) | Validación: redis.test |
| [apps/api/src/__tests__/reservation.controller.test.ts](../apps/api/src/__tests__/reservation.controller.test.ts) | Validación: reservation.controller.test |
| [apps/api/src/__tests__/runtime.integration.test.ts](../apps/api/src/__tests__/runtime.integration.test.ts) | Validación: runtime.integration.test |
| [apps/api/src/auth.ts](../apps/api/src/auth.ts) | Módulo: auth |
| [apps/api/src/config.ts](../apps/api/src/config.ts) | Módulo: config |
| [apps/api/src/controllers/health.controller.ts](../apps/api/src/controllers/health.controller.ts) | Módulo: health.controller |
| [apps/api/src/controllers/payment.controller.ts](../apps/api/src/controllers/payment.controller.ts) | Módulo: payment.controller |
| [apps/api/src/controllers/reservation.controller.ts](../apps/api/src/controllers/reservation.controller.ts) | Módulo: reservation.controller |
| [apps/api/src/controllers/seatmap.controller.ts](../apps/api/src/controllers/seatmap.controller.ts) | Módulo: seatmap.controller |
| [apps/api/src/controllers/webhook.controller.ts](../apps/api/src/controllers/webhook.controller.ts) | Módulo: webhook.controller |
| [apps/api/src/db.ts](../apps/api/src/db.ts) | Módulo: db |
| [apps/api/src/error-handler.ts](../apps/api/src/error-handler.ts) | Módulo: error-handler |
| [apps/api/src/game-state.ts](../apps/api/src/game-state.ts) | Módulo: game-state |
| [apps/api/src/graceful-shutdown.ts](../apps/api/src/graceful-shutdown.ts) | Módulo: graceful-shutdown |
| [apps/api/src/health-check.ts](../apps/api/src/health-check.ts) | Módulo: health-check |
| [apps/api/src/idempotency.ts](../apps/api/src/idempotency.ts) | Módulo: idempotency |
| [apps/api/src/index.ts](../apps/api/src/index.ts) | Composición de rutas y ciclo de vida de la API |
| [apps/api/src/logger.ts](../apps/api/src/logger.ts) | Módulo: logger |
| [apps/api/src/metrics.ts](../apps/api/src/metrics.ts) | Módulo: metrics |
| [apps/api/src/payments.ts](../apps/api/src/payments.ts) | Módulo: payments |
| [apps/api/src/redis-enhanced.ts](../apps/api/src/redis-enhanced.ts) | Módulo: redis-enhanced |
| [apps/api/src/redis.ts](../apps/api/src/redis.ts) | Módulo: redis |
| [apps/api/src/redis-circuit-breaker.ts](../apps/api/src/redis-circuit-breaker.ts) | Reintentos y circuito sin conexiones al importar |
| [apps/api/src/request-context.ts](../apps/api/src/request-context.ts) | Módulo: request-context |
| [apps/api/src/services/fraud.service.ts](../apps/api/src/services/fraud.service.ts) | Módulo: fraud.service |
| [apps/api/src/services/health.service.ts](../apps/api/src/services/health.service.ts) | Módulo: health.service |
| [apps/api/src/services/pubsub.service.ts](../apps/api/src/services/pubsub.service.ts) | Módulo: pubsub.service |
| [apps/api/src/services/reservation.service.ts](../apps/api/src/services/reservation.service.ts) | Módulo: reservation.service |
| [apps/api/src/tracing.ts](../apps/api/src/tracing.ts) | Módulo: tracing |
| [apps/api/tsconfig.json](../apps/api/tsconfig.json) | Configuración/metadata: tsconfig.json |
| [apps/api/vitest.config.mts](../apps/api/vitest.config.mts) | Validación: vitest.config |
| [apps/api/vitest.setup.ts](../apps/api/vitest.setup.ts) | Validación: vitest.setup |
| [apps/web/Dockerfile](../apps/web/Dockerfile) | Build y ejecución en contenedores |
| [apps/web/index.html](../apps/web/index.html) | Configuración/metadata: index.html |
| [apps/web/package.json](../apps/web/package.json) | Dependencias y comandos del componente |
| [apps/web/postcss.config.js](../apps/web/postcss.config.js) | Módulo: postcss.config |
| [apps/web/src/App.tsx](../apps/web/src/App.tsx) | Pantalla de inventario y estado obtenido por HTTP |
| [apps/web/src/CyberArena.tsx](../apps/web/src/CyberArena.tsx) | Eventos, disponibilidad, selección y monedas |
| [apps/web/src/__tests__/CyberArena.test.tsx](../apps/web/src/__tests__/CyberArena.test.tsx) | Validación: CyberArena.test |
| [apps/web/src/__tests__/deepEqual.test.ts](../apps/web/src/__tests__/deepEqual.test.ts) | Validación: deepEqual.test |
| [apps/web/src/__tests__/useLocalStateSync.test.ts](../apps/web/src/__tests__/useLocalStateSync.test.ts) | Validación: useLocalStateSync.test |
| [apps/web/src/hooks/useErrorBoundary.ts](../apps/web/src/hooks/useErrorBoundary.ts) | Módulo: useErrorBoundary |
| [apps/web/src/hooks/useLocalStateSync.ts](../apps/web/src/hooks/useLocalStateSync.ts) | Módulo: useLocalStateSync |
| [apps/web/src/hooks/useMemoDeep.ts](../apps/web/src/hooks/useMemoDeep.ts) | Módulo: useMemoDeep |
| [apps/web/src/hooks/usePerformanceOptimization.ts](../apps/web/src/hooks/usePerformanceOptimization.ts) | Módulo: usePerformanceOptimization |
| [apps/web/src/index.css](../apps/web/src/index.css) | Configuración/metadata: index.css |
| [apps/web/src/main.tsx](../apps/web/src/main.tsx) | Módulo: main |
| [apps/web/src/utils/deepEqual.ts](../apps/web/src/utils/deepEqual.ts) | Módulo: deepEqual |
| [apps/web/src/vite-env.d.ts](../apps/web/src/vite-env.d.ts) | Módulo: vite-env.d |
| [apps/web/tailwind.config.js](../apps/web/tailwind.config.js) | Módulo: tailwind.config |
| [apps/web/tsconfig.json](../apps/web/tsconfig.json) | Configuración/metadata: tsconfig.json |
| [apps/web/tsconfig.node.json](../apps/web/tsconfig.node.json) | Configuración/metadata: tsconfig.node.json |
| [apps/web/vite.config.ts](../apps/web/vite.config.ts) | Módulo: vite.config |
| [apps/web/vitest.config.ts](../apps/web/vitest.config.ts) | Validación: vitest.config |
| [apps/web/vitest.setup.ts](../apps/web/vitest.setup.ts) | Validación: vitest.setup |
| [docker-compose.yml](../docker-compose.yml) | Build y ejecución en contenedores |
| [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) | Documentación: ARCHITECTURE |
| [docs/DEPLOYMENT_PREFLIGHT.md](../docs/DEPLOYMENT_PREFLIGHT.md) | Documentación: DEPLOYMENT_PREFLIGHT |
| [docs/REPOSITORY_MAP.md](../docs/REPOSITORY_MAP.md) | Documentación: REPOSITORY_MAP |
| [infra/README.md](../infra/README.md) | Documentación: README |
| [infra/cloudflare.tf](../infra/cloudflare.tf) | Infraestructura opcional: cloudflare |
| [infra/cloudflare/main.tf](../infra/cloudflare/main.tf) | Infraestructura opcional: main |
| [infra/cloudflare/seatmap-cache.js](../infra/cloudflare/seatmap-cache.js) | Infraestructura opcional: seatmap-cache |
| [infra/cloudflare/variables.tf](../infra/cloudflare/variables.tf) | Infraestructura opcional: variables |
| [infra/cloudflare/versions.tf](../infra/cloudflare/versions.tf) | Infraestructura opcional: versions |
| [infra/grafana-dashboard.json](../infra/grafana-dashboard.json) | Infraestructura opcional: grafana-dashboard |
| [infra/kubernetes.tf](../infra/kubernetes.tf) | Infraestructura opcional: kubernetes |
| [infra/main.tf](../infra/main.tf) | Infraestructura opcional: main |
| [infra/nginx.conf](../infra/nginx.conf) | Infraestructura opcional: nginx |
| [infra/nginx/nginx.conf](../infra/nginx/nginx.conf) | Infraestructura opcional: nginx |
| [infra/seatmap-cache.js](../infra/seatmap-cache.js) | Infraestructura opcional: seatmap-cache |
| [infra/variables.tf](../infra/variables.tf) | Infraestructura opcional: variables |
| [infra/versions.tf](../infra/versions.tf) | Infraestructura opcional: versions |
| [package-lock.json](../package-lock.json) | Resolución exacta del grafo npm |
| [package.json](../package.json) | Dependencias y comandos del componente |
| [packages/database/package.json](../packages/database/package.json) | Dependencias y comandos del componente |
| [packages/database/prisma/migrations/202609100001_initial/migration.sql](../packages/database/prisma/migrations/202609100001_initial/migration.sql) | Migración SQL versionada: 202609100001_initial |
| [packages/database/prisma/migrations/202609100002_payment_history/migration.sql](../packages/database/prisma/migrations/202609100002_payment_history/migration.sql) | Migración SQL versionada: 202609100002_payment_history |
| [packages/database/prisma/migrations/migration_lock.toml](../packages/database/prisma/migrations/migration_lock.toml) | Configuración/metadata: migration_lock.toml |
| [packages/database/prisma/schema.prisma](../packages/database/prisma/schema.prisma) | Entidades, relaciones e invariantes de persistencia |
| [packages/database/src/index.ts](../packages/database/src/index.ts) | Módulo: index |
| [packages/shared/package.json](../packages/shared/package.json) | Dependencias y comandos del componente |
| [packages/shared/src/index.ts](../packages/shared/src/index.ts) | Módulo: index |
| [packages/shared/src/schemas.ts](../packages/shared/src/schemas.ts) | Módulo: schemas |
| [scripts/concurrency-check.mjs](../scripts/concurrency-check.mjs) | Módulo: concurrency-check |
| [tsconfig.json](../tsconfig.json) | Configuración/metadata: tsconfig.json |
| [turbo.json](../turbo.json) | Configuración/metadata: turbo.json |
