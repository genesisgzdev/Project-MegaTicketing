# Elegir asientos con claridad

## Buscar y seleccionar

La lista de eventos se lee del servidor e incluye sus páginas sucesivas. Al cambiar de evento se limpia la selección anterior. La disponibilidad vuelve a consultarse cada cinco segundos.

Puedes escribir el número de un asiento o marcar «Solo disponibles». La búsqueda solo filtra lo que ves; no cambia el precio ni aparta asientos. Si otro comprador obtiene uno de tus asientos, la siguiente actualización lo retira de tu selección.

El importe se suma por moneda. Si hay monedas diferentes se muestran por separado, sin inventar un cambio de divisa.

## Conectar el acceso

El organizador debe facilitarte un acceso de reserva. Introdúcelo en el campo protegido y pulsa «Conectar acceso». El servidor verifica su firma, identidad y vencimiento. No se confía en una identidad escrita por el navegador.

El acceso vive en memoria mientras la página está abierta. No se guarda en el historial del navegador ni en almacenamiento persistente. Recargar la página o desconectarlo exige introducirlo otra vez.

Esta conexión aprovecha el contrato de autenticación existente. No crea una cuenta nueva ni sustituye el sistema de acceso del organizador. Para una instalación pública hace falta integrar una experiencia de inicio de sesión y recuperación de cuenta.

## Reservar

«Reservar selección» solicita cada asiento al servidor. Mientras se procesa, no puedes cambiar de evento ni repetir el envío con otro clic. Si se pierde una respuesta, el reintento conserva la misma clave para que el servidor reconozca la solicitud.

Los resultados se muestran por asiento. Una selección de varios puede aceptarse parcialmente. No se promete una operación indivisible para todo el grupo.

Una respuesta aceptada confirma una reserva temporal en ese momento. La disponibilidad puede cambiar después de que venza. No es un comprobante de compra y no se emite una entrada desde esta pantalla.

## Si algo falla

| Situación | Próximo paso |
| --- | --- |
| No hay eventos | Espera a que el organizador publique el catálogo |
| No hay asientos | El evento todavía no tiene inventario publicado |
| No se puede actualizar | Usa «Volver a consultar» y comprueba tu conexión |
| Acceso no válido o vencido | Pide un acceso vigente al organizador |
| Asiento ocupado | Elige otro asiento disponible |
| Muchas solicitudes | Espera antes de volver a intentar |
| Respuesta incierta | Reintenta la misma reserva sin asumir que se confirmó |

## Para quien integra la web

El catálogo usa `GET /events` y `GET /events/:eventId/seats`. `GET /session` verifica el acceso Bearer y devuelve `userId` con `Cache-Control: no-store`. La reserva usa `POST /reserve` con `eventId`, `seatId`, `userId` y `Idempotency-Key`. El navegador no envía un precio de confianza.

El acceso es un JWT HS256 firmado por el sistema del organizador. Necesita `sub` y `exp`; en producción debe coincidir también el emisor y la audiencia configurados. `sub` debe identificar un usuario existente con UUID válido. La clave de firma pertenece al servidor y nunca se entrega a la web.

En desarrollo Vite atiende en el puerto 3000 y dirige `/api` al servidor del puerto 3001. En Compose el gateway expone la web y `/api` en el mismo origen. `VITE_API_URL` permite configurar otra ubicación durante la compilación.

La API contiene creación de intenciones de pago y recepción de avisos firmados de Stripe. Falta integrar el formulario de pago y la emisión de entradas. Los importes, monedas, vencimientos y pagos antiguos se comprueban en el servidor; conserva esas comprobaciones al ampliar el flujo.

[Volver al inicio](../README.md) · [Funcionamiento de las reservas](ARCHITECTURE.md)
