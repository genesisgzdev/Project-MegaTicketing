# Seguridad y modelo de amenazas

## Garantías actuales

- Una reserva solo se confirma si PostgreSQL actualiza exactamente una fila `Seat` y existe un único `Ticket` por asiento.
- Redis usa nonces aleatorios y Lua para liberar únicamente el lock que lo creó.
- El pago se confirma desde un webhook Stripe firmado, no desde el navegador.
- Los eventos Stripe se procesan con una marca idempotente; si el procesamiento falla, el lock de procesamiento se elimina para que Stripe pueda reintentar.
- En producción `/reserve` y `/payments/intents` requieren JWT `HS256` con `sub`, `iss`, `aud`, `exp` y `nbf` válidos; `sub` debe coincidir con `userId` y `JWT_ISSUER`/`JWT_AUDIENCE` son obligatorios.
- El WebSocket es un canal de lectura de streams operativos. Los comandos de activar o desactivar defensa se rechazan porque no existe una policy de runtime conectada y no se usa un token administrativo para habilitarlos.
- Los secretos de Compose no tienen valores de producción implícitos.

## Fuera de alcance

No afirmamos que Redis de un nodo sea tolerante a cualquier pérdida de datos ni que una sola API soporte 40.000 conexiones sin dimensionar PostgreSQL, Redis, Stripe, red y límites del proveedor. La prueba `scripts/concurrency-check.mjs` verifica la propiedad de una venta única contra un entorno levantado, no una capacidad universal.

## Reglas de despliegue

1. Nunca expongas PostgreSQL ni Redis a Internet.
2. No cachees ni reintentes `POST /reserve`, `/payments/intents` o `/webhook` en Cloudflare/Nginx.
3. Usa un JWT issuer real y rota `JWT_SECRET`, claves Stripe y credenciales de base.
4. Ejecuta `npm audit`, `npm run build` y `npm test` antes de publicar.
5. Revisa el resultado de la prueba de concurrencia con IDs de una base de staging real.

## Reportes

Reporta bypass de autenticación, doble emisión de tickets, aceptación de un webhook sin firma o escalada del control WebSocket de forma privada al mantenedor del repositorio. No publiques credenciales ni payloads con datos personales.
