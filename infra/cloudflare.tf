variable "cloudflare_zone_id" {
  description = "The Cloudflare Zone ID"
}

resource "cloudflare_worker_script" "seatmap_cache" {
  name    = "megaticketing-seatmap-cache"
  content = file("${path.module}/seatmap-cache.js")
}

output "cloudflare_load_balancer_hostname" {
  value = "api.megaticketing.com"
}
