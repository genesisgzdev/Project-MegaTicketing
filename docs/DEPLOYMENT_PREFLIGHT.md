# Deployment preflight boundary

This repository currently contains Terraform configuration for GCP/Kubernetes and Cloudflare, but it does not contain `k8s/helm/megaticketing`. There is therefore no Helm release target in this repository.

The CI workflow validates Terraform and reports the missing chart as a skipped deployment target. It does not apply Terraform, push container images, or deploy Kubernetes. A future deployment change must add and review an actual chart, provider configuration, image promotion policy, secrets contract, health checks, and rollback procedure before enabling an apply job.

The application runtime contract is limited to reservation, payment-intent creation, and signed webhook handling. This repository does not claim to provide a frontend Stripe checkout flow.
