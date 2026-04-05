resource "cloudflare_zone" "megaticketing" {
  account_id = var.cloudflare_account_id
  zone       = "megaticketing.io"
}

# Advanced WAF Rule to block bot scrapers and high-frequency attackers
resource "cloudflare_ruleset" "ddos_protection" {
  zone_id     = cloudflare_zone.megaticketing.id
  name        = "Anti-DDoS for Ticketing"
  description = "Blocks high frequency reservation attempts"
  kind        = "zone"
  phase       = "http_request_firewall_custom"

  rules {
    action = "block"
    expression = "(http.request.uri.path matches \"/reserve\" and http.request.rate_limit.exceeded)"
    description = "Block excessive reservation attempts"
    enabled = true
  }
}

# Rate Limiting Rule
resource "cloudflare_rate_limit" "api_limit" {
  zone_id = cloudflare_zone.megaticketing.id
  threshold = 100
  period    = 60
  
  match {
    request {
      url_pattern = "api.megaticketing.io/reserve"
      methods     = ["POST"]
    }
  }

  action {
    mode = "simulate" # Change to "ban" in production
    timeout = 60
    response {
      content_type = "text/plain"
      body         = "Shield Active: Too many requests"
    }
  }
}
