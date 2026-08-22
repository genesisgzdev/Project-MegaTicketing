resource "kubernetes_namespace" "production" {
  metadata {
    name = "megaticketing-prod"
  }
}

resource "kubernetes_deployment" "api" {
  metadata {
    name      = "ticketing-api"
    namespace = kubernetes_namespace.production.metadata[0].name
    labels = {
      app = "api"
    }
  }

  spec {
    replicas = 3 # High Availability

    selector {
      match_labels = {
        app = "api"
      }
    }

    template {
      metadata {
        labels = {
          app = "api"
        }
      }

      spec {
        service_account_name            = var.kubernetes_service_account_name
        automount_service_account_token = false

        container {
          image = var.api_image
          name  = "api"

          port {
            container_port = 3001
          }

          env {
            name  = "NODE_ENV"
            value = "production"
          }

          env {
            name  = "PORT"
            value = "3001"
          }

          dynamic "env" {
            for_each = toset(["DATABASE_URL", "JWT_SECRET", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "REDIS_PASSWORD"])
            content {
              name = env.value
              value_from {
                secret_key_ref {
                  name = var.runtime_secret_name
                  key  = env.value
                }
              }
            }
          }

          liveness_probe {
            http_get {
              path = "/health"
              port = 3001
            }
            initial_delay_seconds = 20
            period_seconds        = 15
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          readiness_probe {
            http_get {
              path = "/health/ready"
              port = 3001
            }
            initial_delay_seconds = 10
            period_seconds        = 5
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          resources {
            limits = {
              cpu    = "500m"
              memory = "512Mi"
            }
            requests = {
              cpu    = "250m"
              memory = "256Mi"
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_horizontal_pod_autoscaler_v2" "api" {
  metadata {
    name      = "ticketing-api"
    namespace = kubernetes_namespace.production.metadata[0].name
  }

  spec {
    min_replicas = 3
    max_replicas = 10

    scale_target_ref {
      api_version = "apps/v1"
      kind        = "Deployment"
      name        = kubernetes_deployment.api.metadata[0].name
    }

    metric {
      type = "Resource"
      resource {
        name = "cpu"
        target {
          type               = "Utilization"
          average_utilization = 50
        }
      }
    }
  }
}

resource "kubernetes_service" "api_service" {
  metadata {
    name      = "api-service"
    namespace = kubernetes_namespace.production.metadata[0].name
  }
  spec {
    selector = {
      app = kubernetes_deployment.api.metadata[0].labels.app
    }
    port {
      port        = 80
      target_port = 3001
    }
    type = "LoadBalancer"
  }
}
