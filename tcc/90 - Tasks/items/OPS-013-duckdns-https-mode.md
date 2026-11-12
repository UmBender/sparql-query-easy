---
id: OPS-013
title: Serve a trusted HTTPS certificate on a free DuckDNS name (mode duckdns)
status: REVIEW
priority: P2
type: operations
depends_on: [OPS-012]
human_gate: true
created: 2026-11-12
updated: 2026-11-12
---
# Serve a trusted HTTPS certificate on a free DuckDNS name (mode duckdns)

## Objective

The university offers no name or certificate, so the study uses the free
`easyquery-usp.duckdns.org`. Adds `EASYQUERY_HTTPS_MODE=duckdns` to OPS-012's
design: Caddy proves the name with a DNS-01 challenge through DuckDNS, so no
inbound 80/443 is needed, participants see no self-signed warning and nothing
is bought.

## Done

- `deploy/caddy/duckdns.Caddyfile`, `caddy-dns/duckdns` added to the xcaddy
  stage of `deploy/web.Dockerfile`, `DUCKDNS_TOKEN` in `compose.yaml` and
  `.env.example`.
- Documented in [[../../07 - Operations/Docker Compose Stack]] and
  [[../../07 - Operations/Server Deploy Runbook]].

## Validation

- `docker build` of `deploy/web.Dockerfile` succeeds; `caddy list-modules`
  shows `dns.providers.duckdns` (and cloudflare); `caddy validate` of
  `duckdns.Caddyfile` reports "Valid configuration"; `docker compose config`
  passes with `EASYQUERY_HTTPS_MODE=duckdns`.
- Not verified: a real certificate issue (needs the real token and the DuckDNS
  A record); `scripts/check-https-modes.mjs` does not cover `duckdns`.

## Human gate

On the DuckDNS page set `easyquery-usp` to the VM's address; put the token in
the VM's `.env` (`EASYQUERY_DOMAIN=easyquery-usp.duckdns.org`); install; confirm
the certificate is issued and `https://easyquery-usp.duckdns.org:8281` opens
without a warning from a USP-network browser. If the VM's address is
university-internal, participants must be on the USP network or VPN.
