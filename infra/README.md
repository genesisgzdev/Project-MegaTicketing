# Infrastructure contract

Terraform is the authoritative deployment surface in this directory. The CI workflow only runs syntax and validation checks; it does not create a GKE cluster, publish an image or apply Kubernetes resources.

Before a real plan or apply, provide:

- `api_image` with an immutable container digest such as `registry.example/api@sha256:<digest>`
- a least-privilege Kubernetes service account named by `kubernetes_service_account_name`
- an externally managed Secret named by `runtime_secret_name`
- provider credentials and a reviewed Terraform backend

The runtime Secret contains the database URL, JWT secret, Stripe keys and Redis password. Secret values are intentionally not managed by Terraform here. The API deployment owns its readiness/liveness probes and HPA in `kubernetes.tf`.

There is no Helm chart or deployment command in this repository. Adding an apply job requires a separate review of state locking, environment approvals, image promotion, secret rotation and rollback.

## Existing Cloudflare state

The configuration uses Cloudflare provider 5.24.0 and Terraform 1.8 or later. Before upgrading an existing v4 workspace, complete the provider's transition through v4.52.5 using the previous configuration. The checked-in `moved` blocks then let the v5 provider migrate Worker scripts and routes without replacing their remote objects.

For an existing zone, import its current `http_request_firewall_custom` ruleset into `cloudflare_ruleset.ticketing_firewall` and retain every existing rule in that ruleset before applying this configuration. The `removed` blocks stop tracking the retired filter/firewall addresses with `destroy = false`; they do not delete the remote firewall protections. Confirm that the resulting plan contains no unintended rule removals or Worker replacements. CI validates the schema only and does not perform this account/state migration.

The migrated reservation policy preserves the former expression and `block` action. It blocks matching POST requests; it is not a request-count rate limiter. A different policy requires explicit traffic limits and a separate reviewed change.

Provider migration: https://registry.terraform.io/providers/cloudflare/cloudflare/5.24.0/docs/guides/version-5-migration

Firewall state migration: https://developers.cloudflare.com/waf/reference/legacy/firewall-rules-upgrade/
