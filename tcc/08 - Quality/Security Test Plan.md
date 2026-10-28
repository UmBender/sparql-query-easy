# Security Test Plan (2026-10-27)

User request: a security test suite so that data does not leak and the
application resists attacks; above all, no way to reach the admin role, and
nothing like SQL injection in the generated SPARQL. Planned as QUAL-019 to
QUAL-023; implementation cards are BACKLOG until authorized.

## Principles

- Every test states an attack and asserts it fails (status, body, and that
  no data changed). Tests run offline in the ordinary gates; nothing calls an
  external service.
- Prefer exhaustive, self-updating checks over hand-picked cases: the route
  matrix is built from the live OpenAPI document, so a new route without an
  access rule fails the build.
- Where an attack succeeds today, the card adds the failing test together
  with the fix, or records a decision when the fix changes behavior.
- Payload lists live in one shared fixture so Kotlin and Playwright reuse
  them.

## Threats and where they are tested

| # | Threat | Today (inspected) | Card |
|---|---|---|---|
| 1 | Reaching `/api/admin/*` or `/admin` without the admin role | Role from `EASYQUERY_ADMIN_USERNAMES` (AUTH-005), 401/403 guard; per-route tests exist | QUAL-019 |
| 2 | Becoming admin: register an admin username (case, whitespace, Unicode lookalikes), a `role` field in the body, forged/old/other user's session cookie, session after logout | Partly covered by `AuthRoutesTest` | QUAL-019 |
| 3 | A participant reading another participant's data or another group's tasks (IDOR), the expected answer of a task | Contract says never returned | QUAL-019 |
| 4 | Cross-site requests (CSRF) on every state-changing route | Origin + JSON rule on auth/study/admin | QUAL-019 |
| 5 | SPARQL injection through any client field that reaches the generator | Tested (QUAL-020): no injection found; every payload is rejected with 400 before execution or stays one term of an unchanged query | QUAL-020 |
| 6 | SPARQL features that escape the query's scope: `SERVICE`, `FROM`, updates, extra patterns | Tested (QUAL-020); local graphs now refuse `SERVICE` (they used to fetch it) | QUAL-020 |
| 7 | SSRF: a remote `endpointUrl` pointing at internal hosts (`localhost`, `db`, the university network the app will run in, cloud metadata) | Any http(s) host accepted | QUAL-021 (decision A: allowlist) |
| 8 | Uploads: oversized or malicious Turtle, another user's uploaded graph by id | No explicit size limit seen; ids are GUIDs | QUAL-021 |
| 9 | Leaks in errors, logs and exports: stack traces, SQL, paths, passwords, session ids; CSV formula injection in the admin export | Not systematically tested | QUAL-022 |
| 10 | XSS: labels from an uploaded graph or a task statement rendered as HTML | Svelte escapes by default; not tested | QUAL-022 |
| 11 | Missing security headers (CSP, frame-ancestors, cookie flags through Caddy) | Only nosniff and Referrer-Policy | QUAL-022 |
| 12 | Resource exhaustion: huge `limit`/`offset`, slow queries, big bodies, login flooding | Login rate limit exists; other caps partly | QUAL-023 |

## Order

QUAL-019 (admin and access) → QUAL-020 (SPARQL injection) → QUAL-022
(leaks, XSS, headers) → QUAL-023 (limits) → QUAL-021 (SSRF and uploads, after
its decision). Each lands in the Kotlin gate, the frontend gate or the
compose smoke as noted on the card; CI already runs all three.

## Findings

- QUAL-020 (2026-10-28): local Jena execution ran `SERVICE` and made the
  outbound HTTP request; fixed (refused before execution, ARQ service
  execution off). Not SPARQL injection, left for QUAL-022/023: saving a task
  or attempt whose text holds U+0000 answers 503 "Accounts are temporarily
  unavailable" (PostgreSQL cannot store it), and an attempt whose answer
  variable exceeds 64 characters answers 500.

## Open decisions

- SSRF policy for remote endpoints (QUAL-021): decided 2026-10-27, A —
  allowlist (the Wikidata endpoint and the built-in graphs). Deployment
  target: the user's university server.
- CSP strictness (QUAL-022): what the SPA and Cytoscape need (inline styles).
- Upload size limit and whether uploaded graphs stay readable by anyone who
  knows the id (QUAL-021).
