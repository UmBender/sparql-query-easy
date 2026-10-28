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
| 1 | Reaching `/api/admin/*` or `/admin` without the admin role | Tested (QUAL-019): `AccessControlMatrixTest` over every OpenAPI operation and routing variants; `frontend/tests/admin-access.e2e.ts` | QUAL-019 DONE |
| 2 | Becoming admin: register an admin username (case, whitespace, Unicode lookalikes), a `role` field in the body, forged/old/other user's session cookie, session after logout | Tested (QUAL-019): `AdminEscalationTest`; open: a listed name nobody registered yet is claimable by the first registrant | QUAL-019 DONE |
| 3 | A participant reading another participant's data or another group's tasks (IDOR), the expected answer of a task | Tested (QUAL-019): `ParticipantIsolationTest`; fixed the attempt list revealing another group's task keys (200 `[]` → 404) | QUAL-019 DONE |
| 4 | Cross-site requests (CSRF) on every state-changing route | Tested (QUAL-019): foreign `Origin` 403 and non-JSON 415 for every auth/study/admin write, state unchanged | QUAL-019 DONE |
| 5 | SPARQL injection through any client field that reaches the generator | Tested (QUAL-020): no injection found; every payload is rejected with 400 before execution or stays one term of an unchanged query | QUAL-020 |
| 6 | SPARQL features that escape the query's scope: `SERVICE`, `FROM`, updates, extra patterns | Tested (QUAL-020); local graphs now refuse `SERVICE` (they used to fetch it) | QUAL-020 |
| 7 | SSRF: a remote `endpointUrl` pointing at internal hosts (`localhost`, `db`, the university network the app will run in, cloud metadata) | Any http(s) host accepted | QUAL-021 (decision A: allowlist) |
| 8 | Uploads: oversized or malicious Turtle, another user's uploaded graph by id | No explicit size limit seen; ids are GUIDs | QUAL-021 |
| 9 | Leaks in errors, logs and exports: stack traces, SQL, paths, passwords, session ids; CSV formula injection in the admin export | Tested (QUAL-022); malformed-body errors named Kotlin classes, fixed | QUAL-022 |
| 10 | XSS: labels from an uploaded graph or a task statement rendered as HTML | Tested (QUAL-022): every API text renders as text; the CSP also blocks inline handlers | QUAL-022 |
| 11 | Missing security headers (CSP, frame-ancestors, cookie flags through Caddy) | Tested (QUAL-022): CSP (header + SvelteKit meta), `frame-ancestors 'none'`, `X-Frame-Options`, `Permissions-Policy`, cookie `HttpOnly; Secure; SameSite=Lax` | QUAL-022 |
| 12 | Resource exhaustion: huge `limit`/`offset`, slow queries, big bodies, login flooding | Tested (QUAL-023): body 1 MiB (413), `limit` ≤ 10,000, 100 patterns/filters, JSON depth 32, 30 s local query timeout, 30 attempts a minute per user | QUAL-023 |

## Order

QUAL-019 (admin and access) → QUAL-020 (SPARQL injection) → QUAL-022
(leaks, XSS, headers) → QUAL-023 (limits) → QUAL-021 (SSRF and uploads, after
its decision). Each lands in the Kotlin gate, the frontend gate or the
compose smoke as noted on the card; CI already runs all three.

## QUAL-019 results (2026-10-27)

- Matrix: `src/test/kotlin/com/example/sparqlqueryeasy/http/AccessControlRules.kt`
  is the one table of expected access; `AccessControlMatrixTest` fails for an
  OpenAPI operation it lacks, a stale entry, an `/api/admin` entry that is not
  `ADMIN` or an `/api/study` one that is `PUBLIC`. A mutation (the
  participants list behind a session instead of the admin role) failed it.
- Fixed: `GET /api/study/submissions?task=` answered `200 []` for another
  group's or an inactive task and `404` for an unknown one, so a participant
  could enumerate other groups' task keys; it now answers `404` like the other
  task routes.
- Open, not a code fix: AUTH-005 grants admin to whoever registers a listed
  name first. Register the admin accounts before participants can reach the
  server (recorded in API v1); a bootstrap secret would be a new decision.

## Findings

- QUAL-020 (2026-10-28): local Jena execution ran `SERVICE` and made the
  outbound HTTP request; fixed (refused before execution, ARQ service
  execution off). Not SPARQL injection, left for QUAL-022/023: saving a task
  or attempt whose text holds U+0000 answers 503 "Accounts are temporarily
  unavailable" (PostgreSQL cannot store it), and an attempt whose answer
  variable exceeds 64 characters answers 500. Fixed by QUAL-023: both are 400
  before anything is stored, and the QUAL-020 study test runs every payload.
- QUAL-023 (2026-10-28): a study or admin body with an ignored field nested
  about 1,000 levels deep made kotlinx's recursive JSON parser overflow the
  stack (500); fixed by a depth cap of 32 checked before parsing. Local graph
  queries had no time limit and ran on the request thread; a query over
  three unrelated patterns never ended. They now run on the IO dispatcher
  and Jena stops them after 30 s (502).

## QUAL-022 results (2026-10-28)

- Errors (`security/ErrorLeakTest`): malformed bodies on strict routes,
  lenient study/admin bodies, an executor failure whose message holds a JDBC
  URL and a file path, invalid Turtle, an invalid IRI and a missing database
  answer the contract body; a regex of class names, stack frames, `.kt`,
  paths, JDBC/PostgreSQL and SQL finds nothing. Fixed: Ktor's converter
  message (`Failed to convert request body to class com.example…`) and
  kotlinx's (serial names) are replaced; an unhandled failure is a fixed
  500 instead of Ktor's default.
- Logs: register, a wrong and a right login, consent, the profile answers
  and a submission, at the production levels of `logback.xml`: no password,
  session token, its SHA-256 digest, answer key or query text.
- CSV: the STUDY-011 formula escape (`=`, `+`, `-`, `@`, tab, CR → leading
  `'`) is tested for every start character.
- XSS (`frontend/tests/xss.e2e.ts`, mock API): an `<img onerror>`, a
  `<script>` and a `<b>` in search results, the results table, node labels,
  View SPARQL, the task list, a task page, attempt feedback, questionnaire
  texts, admin task and group lists and the help page stay text: no handler
  runs, no element is added, no dialog opens. A mutation (`{@html}` on the
  task title) fails the test, and the CSP blocks its handler.
- Headers and CSP: `site.caddy`; checked by `test:compose`. Measured needs:
  with `style-src 'self'` the editor breaks (Cytoscape's `<style>`, bits-ui
  and Svelte style attributes), so `'unsafe-inline'` stays for styles only;
  scripts need only the hashed boot script. Zod 4 probed `new Function`
  (a CSP violation); it now runs `jitless`. The offline, stack and compose
  browser guards fail a test on any CSP violation.

## QUAL-023 results (2026-10-28)

Tests: `security/RequestLimitsRoutesTest` (query routes on PokemonGen1:
`limit`, stage and profile caps, 100 patterns/filters, declared and
streamed bodies over 1 MiB and one at exactly 1 MiB, deep JSON, a cube query
stopped by a 2 s timeout while another request is answered, the executor
timeout) and `http/StudyRequestLimitsRoutesTest` (U+0000 in a task title,
statement, answer literal and graph; a 64-character answer variable refused
and a 63-character one stored; the 31st attempt in a minute 429 for that user
only; JSON depth). Values: [[../03 - Backend/API v1#Request limits (QUAL-023)]].

## Open decisions

- SSRF policy for remote endpoints (QUAL-021): decided 2026-10-27, A —
  allowlist (the Wikidata endpoint and the built-in graphs). Deployment
  target: the user's university server.
- CSP strictness (QUAL-022): resolved 2026-10-28, see QUAL-022 results.
- Upload size limit and whether uploaded graphs stay readable by anyone who
  knows the id (QUAL-021).
