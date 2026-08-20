variable "cloudflare_zone_id" {
  description = "Cloudflare zone receiving the ticketing edge rules."
  type        = string
  sensitive   = true
}
