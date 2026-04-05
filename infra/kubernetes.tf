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
        container {
          image = "mega-ticketing/api:latest"
          name  = "api"

          port {
            container_port = 3001
          }

          env {
            name  = "NODE_ENV"
            value = "production"
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
