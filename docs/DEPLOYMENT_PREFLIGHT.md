# Antes de publicar MegaTicketing

Esta guía está dirigida a quien administra la instalación. La [guía de uso](USO.md) explica la selección de asientos. Publicar requiere una base de datos, Redis, acceso de usuarios, integración de pagos y un entorno donde ejecutar la web y la API.

## Entender qué se publica

La web consulta eventos y solicita reservas con acceso verificado. La API crea intenciones de pago y recibe avisos firmados de Stripe. El repositorio todavía no contiene el formulario de pago, el registro de cuentas, la recuperación de contraseñas ni la emisión de entradas.

El consumidor de eventos registra y confirma lo recibido. No envía correos ni liquida pagos. Esas acciones necesitan una integración que soporte entregas repetidas antes de usarse con compradores reales.

## Elegir la forma de arrancar

Compose inicia la base de datos y Redis, ejecuta las migraciones y espera a que terminen antes de iniciar la API. El gateway sirve la web en `/` y dirige `/api` al servidor.

En Kubernetes se usa Terraform. No existe un chart Helm. CI valida los archivos, pero no ejecuta Terraform apply, publica imágenes ni despliega recursos.

## Preparar la configuración privada

La instalación de Kubernetes necesita una imagen identificada por digest, una cuenta de servicio existente y el Secret `megaticketing-runtime` preparado fuera de Terraform. Su contenido debe incluir:

- `DATABASE_URL`
- `JWT_SECRET`, `JWT_ISSUER` y `JWT_AUDIENCE`
- `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET`
- `REDIS_PASSWORD`

Configura `redis_host` con una dirección privada accesible desde la API. Los valores de firma y las claves de Stripe pertenecen al servidor. No se entregan a la web.

Para desplegar hace falta revisar el estado de Terraform, las credenciales, la aprobación del entorno y cómo volver a una versión anterior. Los archivos de este repositorio no prueban que esos recursos ya existan en una cuenta cloud.

## Preparar la base de datos

Una base nueva usa `npm run db:migrate`. La primera migración crea el esquema inicial. La siguiente conserva el historial de pagos y añade la propiedad de las reclamaciones de eventos. CI comprueba esas migraciones en una base vacía.

Si la base ya se creó mediante `db push`, primero prepara una copia recuperable y detén las escrituras. Compara su esquema con la migración inicial. Solo si coinciden, marca `202609100001_initial` como aplicada con `prisma migrate resolve` y ejecuta después las migraciones pendientes. No ejecutes los CREATE TABLE iniciales a ciegas sobre datos existentes.

Si una rama anterior ya modificó la base, resuelve esa diferencia antes de marcar migraciones. Una prueba en una base vacía no valida automáticamente ese caso.

## Conectar pagos

Con gateway, el destino del aviso de Stripe es `/api/webhook`; con acceso directo a la API es `/webhook`. Se procesa `payment_intent.succeeded` y se exige una firma válida.

Un pago se vincula a una reserva concreta con su importe y moneda. Si llega después de vencer, se conserva como reembolso pendiente. `PaymentAttempt` mantiene la identidad de reservas antiguas para que un pago atrasado no marque como pagado el asiento de otra persona.

Los reintentos de devolución usan una clave estable. El resultado solo se copia al ticket actual si todavía corresponde a ese pago. Las entregas repetidas son parte del comportamiento esperado.

## Comprobar que puede atender

`/health/live` comprueba que el proceso responde. `/health/ready` exige una consulta SQL correcta y una respuesta de Redis. No confundan esas comprobaciones con una compra completa de extremo a extremo.

Supervisa los eventos pendientes de la tabla outbox, los mensajes pendientes del stream y los pagos con `REFUND_PENDING`. Conserva los datos hasta que los consumidores hayan confirmado las entregas correspondientes. Redis usa persistencia append-only en Compose y PostgreSQL sigue siendo la autoridad de reservas y pagos.

[Configuración de infraestructura](../infra/README.md) · [Funcionamiento del servidor](ARCHITECTURE.md)
