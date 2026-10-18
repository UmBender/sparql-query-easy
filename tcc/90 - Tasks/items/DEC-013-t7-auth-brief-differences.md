---
id: DEC-013
title: Decide whether the T7 brief changes the approved authentication contract
status: BLOCKED
priority: P1
type: decision
depends_on: [AUTH-000, AUTH-001, AUTH-003]
human_gate: true
created: 2026-10-18
updated: 2026-10-18
---
# Decide whether the T7 brief changes the approved authentication contract

## Objective

The T7 brief (2026-10-18) restates authentication. Most of it is already
approved in AUTH-000 ([[../../09 - Decisions/Authentication Contract]]) and
implemented in AUTH-001 and AUTH-003 (all DONE). Four points make a different
decision from the approved contract or the code. The user chooses for each.
Nothing changes until then. The gaps that don't conflict are in AUTH-004.

## Already decided, not reopened

- Registration vs admin-created accounts (the brief says to ask): answered by
  D4 on 2026-10-16. Users register themselves on the login screen; there is no
  password recovery.
- Public routes (the brief asks for a list to approve): approved in the
  Authentication Contract route matrix. The SPA, `/api/local-database`,
  `/api/query/**`, `/health`, `/swagger`, `/openapi.json`,
  `POST /api/auth/{register,login}` and `GET /api/auth/session` are public.
  `POST /api/auth/logout` and `/api/study/**` need a session.
- Consent fields: D5 (LGPD deferred) and STUDY-002 own them; T7 adds none,
  which matches the brief ("left for T9").

## Conflicts

| # | T7 brief | Approved contract / code | Affects if changed |
|---|---|---|---|
| C1 | `email` unique + display name | `username` (3–32 `[A-Za-z0-9._-]`, case-insensitive unique) and no email collected (`V2__accounts.sql` `app_user`) | New Flyway migration (V3) plus a policy for existing rows; `AuthService` validation; OpenAPI and the frontend types snapshot; Zod schemas and forms; `AuthRoutesTest`, `auth-session.spec.ts`, both `auth.e2e.ts`; Authentication Contract. Email is personal data under LGPD: if only login needs it, collecting it works against "minimal data" |
| C2 | `role` column `[participant, admin]` | No roles. All signed-in users are equal; STUDY-001 loads tasks from a repository file, so it needs no admin | Migration; how the first admin is made (env-configured username list, a CLI/Gradle task, or a SQL seed), since self-registration must never grant admin; an admin guard; route matrix. Probably first needed for T9 (who may export research data, D5) |
| C3 | `GET /api/auth/me` | `GET /api/auth/session` (200 user / 401) | Route rename or alias, OpenAPI snapshot, `client.ts` `session()`, mocks, tests, API v1 docs |
| C4 | "Ktor Authentication with cookie sessions" (target architecture) | AUTH-001 implemented the same behavior (server-side session row, opaque HttpOnly/SameSite=Lax/Secure-in-prod cookie, rotation, 7-day expiry, logout delete) with a few application-owned functions (`AuthRoutes.kt` `withSession`), without the `ktor-server-auth`/`sessions` plugins | Moving to the plugins changes no observable behavior. It means a refactor of `AuthRoutes.kt` plus two dependencies, and every `AuthRoutesTest` case must stay green |

## Options and recommendation

- **C1.** A: keep `username` (recommended; no personal data collected, no
  migration, matches D4). B: switch to email + display name (new migration,
  existing test accounts migrated or dropped, LGPD notice needed before go-live).
- **C2.** A: no roles now; plan roles with T9 when it is clear who needs admin
  access (recommended). B: add `role` now with a default of `participant` and
  admins listed in configuration (`EASYQUERY_ADMIN_USERNAMES`), plus an
  `/api/admin/**` guard and tests. That is a new card that depends on this one.
- **C3.** A: keep `/api/auth/session` (recommended; the brief's name is not a
  requirement for any behavior). B: rename it to `/api/auth/me`. C: add
  `/api/auth/me` as an alias and keep `session`.
- **C4.** A: record the current implementation as an approved deviation from
  the target architecture's wording (recommended; it works the same and is
  already tested). B: a behavior-preserving refactor card (`tcc-refactor`)
  onto `ktor-server-auth` + `ktor-server-sessions`.

## Acceptance criteria

- [ ] The user picks an option for C1–C4. Record the choices in
      Open Decisions and in the Authentication Contract.
- [ ] Each B/C choice gets its own implementation card that depends on this
      one. AUTH-001 and AUTH-003 stay DONE as written.

## Decision

Pending.
