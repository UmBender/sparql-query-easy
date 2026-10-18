# Authentication Contract

Approved under AUTH-000 on 2026-10-16. Product choices are the user's answers
(D4 of [[../05 - Migration/Frontend Migration Conflict Report]]); the
security defaults below were proposed with them and are reversible.

## Product choices (user)

- Users are application-owned and created through the login screen
  (self-registration). No password recovery in this release.
- The query editor works without login. An anonymous user never receives
  proposed queries or questionnaires; those require a session.
- After the final submission a user can no longer open their proposed queries
  (STUDY-001).
- LGPD/consent handling is deferred (D5).

## Security defaults

| Item | Contract |
|---|---|
| Identity | `username` (unique, case-insensitive) + password; no email collected |
| Storage | PostgreSQL (BE-005), Flyway-managed tables |
| Hashing | Argon2id with a per-password salt; parameters in configuration; password length 8–128 |
| Session | Server-side session row; opaque id in an `HttpOnly`, `SameSite=Lax` cookie, `Secure` in production; id rotated at login; 7-day absolute expiry; logout deletes the row |
| CSRF | Same origin only, no CORS. State-changing auth/study routes accept only JSON and reject a mismatching `Origin` |
| Brute force | Rate limit on login and registration per client address |
| Errors | `401 {"error":"..."}` without a session on protected routes; `409` on a taken username; `400` on invalid input; login failures do not reveal whether the username exists |
| Secrets | From environment/`.env`; nothing committed |

## Route matrix

| Public | Requires a session |
|---|---|
| The SPA (the legacy `index2.html` was retired in FE-049); `/api/local-database`; `/api/query/**`; `/health`; `/swagger`; `/openapi.json`; `POST /api/auth/register`; `POST /api/auth/login`; `GET /api/auth/session` (returns the user or 401) | `POST /api/auth/logout`; `/api/study/**` (proposed queries, submissions, questionnaires) |

AUTH-001 implemented these paths; details (username rules, cookie
attributes, `403`/`415`/`429`/`503` answers, proxy-aware rate limit) are in
OpenAPI and [[../03 - Backend/API v1]] under "Accounts and sessions".

## Source files

- `tcc/90 - Tasks/items/AUTH-000-authentication-contract-decision.md`
- `src/main/kotlin/com/example/sparqlqueryeasy/http/HttpModule.kt`
