# Infrastructure contract

Terraform is the authoritative deployment surface in this directory. The CI workflow only runs syntax and validation checks; it does not create a GKE cluster, publish an image or apply Kubernetes resources.

Before a real plan or apply, provide:

- `api_image` with an immutable container digest such as `registry.example/api@sha256:<digest>`
- a least-privilege Kubernetes service account named by `kubernetes_service_account_name`
- an externally managed Secret named by `runtime_secret_name`
- provider credentials and a reviewed Terraform backend

The runtime Secret contains the database URL, JWT secret, Stripe keys and Redis password. Secret values are intentionally not managed by Terraform here. The API deployment owns its readiness/liveness probes and HPA in `kubernetes.tf`.

There is no Helm chart or deployment command in this repository. Adding an apply job requires a separate review of state locking, environment approvals, image promotion, secret rotation and rollback.
