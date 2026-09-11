resource "cloudflare_workers_script" "seatmap_cache" {
  account_id = var.cloudflare_account_id
  script_name = "megaticketing-seatmap-cache"
  content    = file("${path.module}/seatmap-cache.js")
}

resource "cloudflare_ruleset" "ticketing_firewall" {
  zone_id     = var.cloudflare_zone_id
  name        = "megaticketing-custom-firewall"
  description = "Migrated ticket reservation blocking policy"
  kind        = "zone"
  phase       = "http_request_firewall_custom"
  rules = [{
    ref         = "ticketing_reservation_policy"
    description = "Preserve the existing POST /reserve blocking policy"
    expression  = "(http.request.uri.path matches \"^/reserve\" and http.request.method == \"POST\")"
    action      = "block"
    enabled     = true
  }]
}

resource "cloudflare_workers_route" "seatmap_route" {
  zone_id     = var.cloudflare_zone_id
  pattern     = "api.megaticketing.com/api/seatmap/*"
  script      = cloudflare_workers_script.seatmap_cache.script_name
}

moved {
  from = cloudflare_worker_script.seatmap_cache
  to   = cloudflare_workers_script.seatmap_cache
}

moved {
  from = cloudflare_worker_route.seatmap_route
  to   = cloudflare_workers_route.seatmap_route
}

# Cloudflare migrated legacy firewall rules to custom rulesets. Forget the
# retired Terraform addresses without deleting the remote protections.
removed {
  from = cloudflare_filter.rate_limit_filter
  lifecycle {
    destroy = false
  }
}

removed {
  from = cloudflare_firewall_rule.ticketing_rate_limit
  lifecycle {
    destroy = false
  }
}
