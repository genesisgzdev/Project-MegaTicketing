provider "google" {
  project = var.project_id
  region  = var.region
}

variable "project_id" {
  description = "The GCP project ID"
  default     = "genesisgzdev-project"
}

variable "region" {
  description = "The GCP region"
  default     = "us-central1"
}

resource "google_container_cluster" "primary" {
  name     = "megaticketing-cluster"
  location = var.region

  # We're creating a managed node pool separately
  remove_default_node_pool = true
  initial_node_count       = 1

  release_channel {
    channel = "STABLE"
  }

  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }
}

resource "google_container_node_pool" "primary_nodes" {
  name       = "megaticketing-node-pool"
  location   = var.region
  cluster    = google_container_cluster.primary.name
  node_count = 2

  management {
    auto_repair  = true
    auto_upgrade = true
  }

  node_config {
    preemptible  = true
    machine_type = "e2-medium"

    labels = {
      app = "megaticketing"
    }

    service_account = "default"
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]
  }
}

output "kubernetes_cluster_name" {
  value       = google_container_cluster.primary.name
  description = "GKE Cluster Name"
}

