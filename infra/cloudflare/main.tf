resource "cloudflare_worker_script" "seatmap_cache" {
  name    = "megaticketing-seatmap-cache"
  content = file("${path.module}/seatmap-cache.js")
}

resource "cloudflare_filter" "rate_limit_filter" {
  zone_id     = var.cloudflare_zone_id
  description = "Filter for ticketing rate limit"
  expression  = "(http.request.uri.path matches \"^/reserve\" and http.request.method == \"POST\")"
}

resource "cloudflare_firewall_rule" "ticketing_rate_limit" {
  zone_id     = var.cloudflare_zone_id
  description = "Prevent rapid-fire automated ticket reservations"
  filter_id   = cloudflare_filter.rate_limit_filter.id
  action      = "block"
}

resource "cloudflare_worker_route" "seatmap_route" {
  zone_id     = var.cloudflare_zone_id
  pattern     = "api.megaticketing.com/api/seatmap/*"
  script_name = cloudflare_worker_script.seatmap_cache.name
}
