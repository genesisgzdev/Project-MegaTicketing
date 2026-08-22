

variable "api_image" {
  description = "Immutable API image reference, including a sha256 digest."
  type        = string

  validation {
    condition     = can(regex("@sha256:[0-9a-f]{64}$", var.api_image))
    error_message = "api_image must use an immutable @sha256:<64 hex characters> digest."
  }
}

variable "runtime_secret_name" {
  description = "Existing Kubernetes Secret populated by the external secret manager."
  type        = string
  default     = "megaticketing-runtime"
}

variable "kubernetes_service_account_name" {
  description = "Existing least-privilege Kubernetes service account for the API."
  type        = string
  default     = "megaticketing-api"
}
