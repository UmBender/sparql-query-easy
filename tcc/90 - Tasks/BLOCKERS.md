# Project Blockers

## QUAL-001 — Recorded Wikidata fixtures

No approved, provenance-recorded Wikidata success/error responses exist. Human
approval is required before one-time collection and sanitization; normal tests
must continue to avoid live Wikidata.

## Production operations tasks

Production domain, container/runtime, hosting, and security decisions are not
yet selected. They block the dependent DNS/TLS/CORS, AWS, monitoring, and
backup tasks; no deployment or infrastructure mutation is authorized.

## AUTH-000 — Authentication contract

Authentication implementation is approved, but credentials, sessions,
anonymous access, protected routes, cookie/CSRF/rate-limit policy, and
registration/recovery scope are not.

**Question:** Approve the recommended first contract—environment-configured
bootstrap user(s) with password hashes, server-side same-origin session cookie,
no anonymous graph/API access, public login/logout/session and health routes,
no registration/password recovery, and Swagger available only in local
development—or specify the changes.

## OAPI-000 — Swagger/OpenAPI publication contract

Swagger/OpenAPI implementation is approved, but source ownership, paths,
environment exposure, security, included routes, and drift enforcement are not.

**Question:** Approve a reviewed static OpenAPI 3.1 document, Swagger UI at
`/swagger`, raw specification at `/openapi.json`, all current application/auth
routes documented, local-development exposure by default, and production
exposure disabled unless explicitly configured—or specify the changes.
