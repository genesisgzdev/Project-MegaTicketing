# Contrato de secretos de ejecucion

Este contrato describe nombres, identidad y rotacion. No habilita un proveedor. Terraform sigue leyendo un Secret ya materializado por fuera.

## Proveedor

| Campo | Valor acordado |
| --- | --- |
| Proveedor | External Secrets Operator + Google Secret Manager |
| Identidad de workload | Service account de Kubernetes `megaticketing-api` con Workload Identity Bound al SA de GCP del entorno |
| Almacen | Secret Manager del proyecto del ambiente |
| Recurso de sincronizacion | `k8s/external-secrets/runtime.external-secret.yaml` |

El manifiesto es de validacion. No incluye credenciales y no se aplica desde CI.

## Nombres

| Clave en Kubernetes | Secreto remoto | Rotacion |
| --- | --- | --- |
| `DATABASE_URL` | `megaticketing/${env}/database-url` | 90 dias o al rotar el rol de Postgres |
| `JWT_SECRET` | `megaticketing/${env}/jwt-secret` | 30 dias |
| `JWT_ISSUER` | `megaticketing/${env}/jwt-issuer` | cambio de audiencia |
| `JWT_AUDIENCE` | `megaticketing/${env}/jwt-audience` | cambio de audiencia |
| `STRIPE_SECRET_KEY` | `megaticketing/${env}/stripe-secret` | al revocar la clave |
| `STRIPE_WEBHOOK_SECRET` | `megaticketing/${env}/stripe-webhook` | al recrear el endpoint |
| `REDIS_PASSWORD` | `megaticketing/${env}/redis-password` | 90 dias |

`${env}` es `dev`, `staging` o `prod`. El Secret destino se llama `megaticketing-runtime`.

## Criterio para habilitar la integracion

1. Lectura observada desde un namespace descartable.
2. Actualizacion observada de una nueva version remotamente.
3. Revocacion observada.
4. Rollback de credenciales ensayado.

Hasta completar esos cuatro puntos, CI no aplica ExternalSecret ni Terraform.
