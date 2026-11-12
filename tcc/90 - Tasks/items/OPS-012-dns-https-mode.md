---
id: OPS-012
title: Serve HTTPS with a DNS-01 certificate when the university offers no name or ports 80/443
status: REVIEW
priority: P2
type: operations
depends_on: [OPS-008, OPS-011]
human_gate: true
created: 2026-11-12
updated: 2026-11-12
---
# Serve HTTPS with a DNS-01 certificate when the university offers no name or ports 80/443

## Objective

Fallback for the case where IT gives no DNS name, certificate or proxy
(checklist N2, H1–H3) and only ports 8280/8281 are open. Adds
`EASYQUERY_HTTPS_MODE=dns` to OPS-008: Caddy proves control of an own domain
(zone on Cloudflare) with a DNS-01 challenge, so no inbound 80/443 is needed.

## Done

- `deploy/caddy/dns.Caddyfile`, xcaddy stage with `caddy-dns/cloudflare` in
  `deploy/web.Dockerfile`, `CLOUDFLARE_API_TOKEN` in `compose.yaml` and
  `.env.example`.
- Documented in [[../../07 - Operations/Docker Compose Stack]] and
  [[../../07 - Operations/Server Deploy Runbook]] (settings, token rotation).

## Validation

- `docker build` of `deploy/web.Dockerfile` succeeds; `caddy list-modules`
  shows `dns.providers.cloudflare`; `caddy adapt/validate` of `dns.Caddyfile`
  reaches the provider (rejects only a fake token); `docker compose config`
  passes with `EASYQUERY_HTTPS_MODE=dns`.
- Not verified: a real certificate issue (needs a domain and token) and
  `scripts/check-https-modes.mjs` does not cover `dns`.

## Human gate

Owner buys/uses a domain on Cloudflare, creates the A record (proxy off) and
the token, runs one install on the VM and confirms the certificate is issued
and the site opens at `https://<domain>:8281`.
