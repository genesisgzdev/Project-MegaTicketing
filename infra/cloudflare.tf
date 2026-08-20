variable "cloudflare_zone_id" {
  description = "The Cloudflare Zone ID"
}

variable "cloudflare_account_id" {
  description = "Cloudflare account containing the Worker."
  type        = string
  sensitive   = true
}

resource "cloudflare_worker_script" "seatmap_cache" {
  account_id = var.cloudflare_account_id
  name       = "megaticketing-seatmap-cache"
  content    = file("${path.module}/seatmap-cache.js")
}

output "cloudflare_load_balancer_hostname" {
  value = "api.megaticketing.com"
}
