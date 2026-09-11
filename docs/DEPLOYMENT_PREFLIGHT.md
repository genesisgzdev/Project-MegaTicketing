# Deployment preflight boundary

This repository currently contains Terraform configuration for GCP/Kubernetes and Cloudflare, but it does not contain `k8s/helm/megaticketing`. There is therefore no Helm release target in this repository.

The CI workflow validates Terraform and reports the missing chart as a skipped deployment target. It does not apply Terraform, push container images, or deploy Kubernetes. Terraform is the only Kubernetes source in the repository; the old standalone deployment and HPA manifests are not deployment targets.

The Terraform deployment requires an immutable `api_image` digest, an existing least-privilege service account and an externally populated `megaticketing-runtime` Secret. The Secret must provide `DATABASE_URL`, `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and `REDIS_PASSWORD`. Set redis_host to a private endpoint reachable from the API pods. The deployment exposes `/health/live` and `/health/ready` as liveness and readiness gates and owns the HPA. A future apply still needs provider credentials, environment approval and a tested rollback procedure.

The application runtime contract is limited to reservation, payment-intent creation, and signed webhook handling. This repository does not claim to provide a frontend Stripe checkout flow.

## Database migration boundary

New databases use `npm run db:migrate` (Prisma migrate deploy). The initial migration records the former main schema; the second migration adds durable payment history, backfills existing payment bindings, and adds outbox claim ownership. CI applies these migrations to an empty PostgreSQL database before running integration tests.

For an existing database created with db push, first take a recoverable backup, stop application writers, and compare the live schema with the initial migration. Only when they match, mark `202609100001_initial` as already applied using Prisma migrate resolve, then run migrate deploy. Do not run the initial CREATE TABLE migration blindly over existing data. A database already changed by an unmerged branch may differ; reconcile that schema before baselining. This review does not execute migrations against production.

Compose runs a one-shot migration service and starts the API only when migration succeeds. The gateway serves the web at `/` and strips `/api/` before forwarding to Fastify. Configure Stripe for `/api/webhook` at the gateway and subscribe to `payment_intent.succeeded`. Direct API access uses `/webhook`. Issuer, audience, JWT and Stripe secrets must be supplied. Redis append-only persistence is enabled; PostgreSQL remains authoritative.

PaymentAttempt retains old reservation identity. An old successful payment cannot mark a new buyer's reservation paid: it records REFUND_PENDING and retries the Stripe refund with a stable idempotency key. Refund completion is mirrored into the current Ticket only when its PaymentIntent still matches. Repeated deliveries are expected. No external payment or refund was performed in repository tests.

The stream consumer records and deduplicates order events; it does not implement ticket issuance, email delivery or settlement. Add downstream effects and their deduplication transaction before treating it as fulfillment. Monitor pending outbox rows, stream pending entries and PaymentAttempt REFUND_PENDING; configure retention only after consumers acknowledge events.
