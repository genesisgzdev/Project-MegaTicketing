variable "cloudflare_zone_id" {
  description = "Cloudflare Zone ID used by the edge rules."
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare account containing the Worker."
  type        = string
  sensitive   = true
}
