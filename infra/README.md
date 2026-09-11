# Preparar la infraestructura

Esta carpeta sirve a quien publica MegaTicketing. Para usar una web ya publicada, empieza por la [guía de reservas](../docs/USO.md). Para levantar el proyecto en tu equipo, usa las instrucciones de Compose del [README](../README.md).

## Qué hace esta configuración

Terraform describe los recursos de despliegue. CI comprueba que la configuración sea válida, pero no crea un clúster, publica imágenes ni modifica una cuenta cloud.

Antes de preparar un plan necesitas:

| Dato | Para qué sirve |
| --- | --- |
| `api_image` con un digest inmutable | Identificar exactamente la imagen que se va a ejecutar |
| `kubernetes_service_account_name` | Usar una cuenta de servicio con los permisos necesarios |
| `runtime_secret_name` | Leer la configuración privada preparada fuera de Terraform |
| Credenciales del proveedor y almacenamiento de estado revisado | Conectar con la cuenta y conservar qué recursos administra Terraform |

El secreto de ejecución contiene la conexión de base de datos, configuración de acceso, claves de Stripe y contraseña de Redis. Sus valores no se gestionan en estos archivos. `kubernetes.tf` define las comprobaciones de disponibilidad y el ajuste del número de réplicas.

No hay un chart Helm en el repositorio. Añadir un despliegue automático requiere definir aprobación del entorno, bloqueo del estado, publicación de imágenes, rotación de secretos y recuperación.

## Si ya tienes recursos de Cloudflare

La configuración usa el proveedor Cloudflare 5.24.0 y Terraform 1.8 o posterior. Si vienes de un estado v4, completa primero la transición por v4.52.5 usando la configuración anterior. Los bloques `moved` permiten migrar scripts y rutas del Worker sin sustituir sus objetos remotos.

Para una zona existente, importa su conjunto actual de reglas `http_request_firewall_custom` en `cloudflare_ruleset.ticketing_firewall`. Conserva todas sus reglas antes de aplicar. Los bloques `removed` con `destroy = false` dejan de administrar las direcciones antiguas sin borrar sus protecciones remotas.

Revisa que el plan no elimine reglas ajenas ni sustituya Workers de forma involuntaria. La validación de CI no realiza esta migración de estado.

La regla de reservas conserva la expresión anterior y su acción de bloqueo. Bloquea peticiones POST que coincidan; no cuenta peticiones para limitar una frecuencia. Cambiar ese comportamiento exige definir la política de tráfico deseada.

Referencias del proveedor: [migración a v5](https://registry.terraform.io/providers/cloudflare/cloudflare/5.24.0/docs/guides/version-5-migration) y [migración de reglas](https://developers.cloudflare.com/waf/reference/legacy/firewall-rules-upgrade/).

[Preparar la aplicación y sus datos](../docs/DEPLOYMENT_PREFLIGHT.md)
