# Project Blockers

## QUAL-001 — Recorded Wikidata fixtures

No approved, provenance-recorded Wikidata success/error responses exist. Human
approval is required before one-time collection and sanitization; normal tests
must continue to avoid live Wikidata.

## Production operations tasks

Production domain, container/runtime, hosting, and security decisions are not
yet selected. They block the dependent DNS/TLS/CORS, AWS, monitoring, and
backup tasks; no deployment or infrastructure mutation is authorized.

## DEC-001 — Repository, login, and OpenAPI scope

Human approval is required for two remaining scope decisions. The `tcc/` vault
and PDFs are approved to remain external; `sparql/login.html` has no matching
Kotlin authentication route; and C# launch settings reference Swagger while
Kotlin does not expose OpenAPI. No deletion, authentication implementation, or
OpenAPI addition is authorized without approval.

**Question:** Authentication was selected, but what is the approved contract:
credential source (environment-backed local users or external identity
provider), session cookie versus bearer token, and which API routes require
authentication? OpenAPI is approved for immediate addition.
