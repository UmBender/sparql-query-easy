---
id: OPS-008
title: Choose HTTPS by Caddy certificates or behind the university proxy with one setting
status: DONE
priority: P1
type: operations
depends_on: [DEC-017, OPS-006, QUAL-017]
human_gate: false
created: 2026-10-20
updated: 2026-10-20
---
# Choose HTTPS by Caddy certificates or behind the university proxy with one setting

## Objective

T11 HTTPS, as a follow-up to OPS-006 (EXTENDS). Today `web` serves plain HTTP
on `127.0.0.1:${WEB_PORT}` with `auto_https off`. One `.env` setting selects
how the public origin is served. The mode used on the server is DEC-017 Q1;
the policy (domain, CORS, redirects) stays OPS-002. Skill: `tcc-backend`
(operations files) with `tcc-test` for the checks.

## Confirmed entry points

`deploy/Caddyfile`, `compose.yaml` (`web` ports, `backend`
`EASYQUERY_TRUST_PROXY`), `.env.example`, `deploy/web.Dockerfile`, runbook
[[../../07 - Operations/Docker Compose Stack]]. Backend reads
`EASYQUERY_TRUST_PROXY` and sets `Secure` cookies in production.

## Scope

- Modes (names proposed): `local` (today's behaviour, the default),
  `auto` (site address = `EASYQUERY_DOMAIN`, Caddy obtains and renews
  certificates, publishes 80 and 443, HTTP redirects to HTTPS, ACME e-mail
  from `.env`, certificates in a named volume), `proxy` (plain HTTP on one
  published port for the university proxy; Caddy `trusted_proxies` from
  `.env`, so `X-Forwarded-For` and `X-Forwarded-Proto` from that proxy are
  used and others ignored).
- Same-origin check still works in each mode (`Host` vs `Origin`).
- HSTS only in `auto` (proposed; confirm with OPS-002).
- `.env.example` documents every new variable; runbook section per mode.

## Out of scope

- Real DNS, real certificates, opening ports on the server, CORS policy
  (OPS-002), deployment (OPS-005, OPS-011).
- Changing QUAL-017's files while it is REVIEW.

## Acceptance criteria

- [x] With no new variable set, the stack behaves as in OPS-006 and
  `test:compose` passes unchanged.
- [x] `auto` with a test domain and Caddy's local CA (`tls internal` or the
  ACME staging switch, proposed) serves the SPA and `/api` over HTTPS,
  redirects HTTP, and the session cookie is `Secure`; `caddy validate`
  passes for the real-certificate configuration.
- [x] `proxy` behind a stand-in proxy container: login works, the rate limit
  sees the client address from the trusted proxy, and a forged
  `X-Forwarded-For` from an untrusted source is ignored.

## Validation

Focused: `caddy validate` per mode in the `web` image; a scripted check per
mode (proposed under `scripts/`). Closing: Compose row of the Operational Map
(`docker compose up --build` per runbook) and `npm --prefix frontend run
test:compose`.

## Execution log

- 2026-10-20: DEC-017 Q1 C. `deploy/caddy/site.caddy` holds the site of
  OPS-006 (now `reverse_proxy` sends `X-Forwarded-For {client_ip}`, one
  address, instead of Caddy's default); `deploy/Caddyfile` (mode `local`,
  same behaviour as before), `deploy/caddy/auto.Caddyfile` (site
  `EASYQUERY_DOMAIN`, `tls EASYQUERY_TLS`, HSTS one year without subdomains,
  h1/h2 only because UDP 443 is not published) and
  `deploy/caddy/proxy.Caddyfile` (`trusted_proxies static
  EASYQUERY_TRUSTED_PROXIES`, `trusted_proxies_strict`). `compose.yaml`:
  `web` runs `/etc/caddy/${EASYQUERY_HTTPS_MODE:-local}.Caddyfile`, ports
  `${WEB_BIND}:${WEB_PORT}:80` and `${WEB_HTTPS_BIND}:${WEB_HTTPS_PORT}:443`
  (empty port = random loopback port), volume `caddy-data`. Compose passes
  empty variables to Caddy as empty strings, which skip Caddyfile defaults,
  so the required-setting markers are Compose defaults that make Caddy fail
  with the variable's name. `.env.example`, runbook section, Operational Map
  and Operations Inventory updated. Backend unchanged.
- Check script `scripts/check-https-modes.mjs` with `deploy/test/`
  (`https-auto.env`, `https-proxy.env`, `compose.edge.yaml`; the stand-in
  proxy's Caddyfile is an inline Compose config because SELinux refuses the
  bind mount); reuses QUAL-017's `compose.test.yaml` read-only.
- Results: `auto` 8/8 (HTTPS `/health` ready, SPA fallback, HSTS, `/api`,
  HTTP 308 to HTTPS, registration with `Secure` `HttpOnly` cookie, internal
  CA untrusted by curl); `proxy` 5/5 (registration, the limit counts the
  client named by the trusted proxy, another client has its own limit, a
  forged `X-Forwarded-For` sent directly is ignored). With a different
  trusted range the per-client check failed (reverted). `caddy validate`
  passes for `auto` with a real domain and e-mail and fails, naming the
  variable, when a required setting is missing. `npm --prefix frontend run
  test:compose` 4 passed (local mode); no container or volume left behind.
- Limitation: no real certificate or university proxy tested (OPS-002,
  OPS-011).
- Commit: completion commit for this task.
