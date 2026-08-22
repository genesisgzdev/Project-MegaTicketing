# Deployment preflight boundary

This repository currently contains Terraform configuration for GCP/Kubernetes and Cloudflare, but it does not contain `k8s/helm/megaticketing`. There is therefore no Helm release target in this repository.

The CI workflow validates Terraform and reports the missing chart as a skipped deployment target. It does not apply Terraform, push container images, or deploy Kubernetes. Terraform is the only Kubernetes source in the repository; the old standalone deployment and HPA manifests are not deployment targets.

The Terraform deployment requires an immutable `api_image` digest, an existing least-privilege service account and an externally populated `megaticketing-runtime` Secret. The Secret must provide `DATABASE_URL`, `JWT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and `REDIS_PASSWORD`. The deployment exposes `/health` and `/health/ready` as liveness and readiness gates and owns the HPA. A future apply still needs provider credentials, environment approval and a tested rollback procedure.

The application runtime contract is limited to reservation, payment-intent creation, and signed webhook handling. This repository does not claim to provide a frontend Stripe checkout flow.
