---
id: AUTH-000
title: Decide the authentication and authorization contract
status: DONE
priority: P0
type: decision
depends_on: [DEC-001]
human_gate: true
created: 2026-09-21
updated: 2026-10-16
---
# Decide the authentication and authorization contract

## Objective

Turn the approved direction to implement login into a precise contract before
credentials, cookies, or route guards are added.

## Evidence and relevant files

- `sparql/login.html` is a static form that posts email/password fields to the
  removed `index.html`; its registration and password-recovery links are
  placeholders.
- `build.gradle.kts` packages `login.html`, but Kotlin has no authentication or
  session dependency.
- `HttpModule.kt` exposes the frontend, health, upload, and five query routes
  without authentication or authorization.
- C# calls `UseAuthorization()` but configures no authentication provider,
  credentials, protected route, or login endpoint. There is no legacy auth
  behavior to preserve.
- Official Ktor session authentication supports form login followed by a
  cookie session, but credential storage, cookie policy, CSRF policy, and the
  protected-route matrix remain product/security decisions.

## Exact scope

Decide and record:

1. identity source: application-owned users, environment/bootstrap users, or
   an external OIDC provider;
2. browser mechanism: recommended same-origin server-side session identifier
   in an `HttpOnly` cookie, or an explicitly justified alternative;
3. whether anonymous use remains supported;
4. which of `/index2.html`, `/api/local-database`, `/api/query/**`, `/health`,
   `/swagger`, and the raw OpenAPI document require authentication;
5. login, logout, current-session, unauthorized-response, expiry, and session
   invalidation contracts;
6. whether account creation and password recovery are real scope or must be
   removed/disabled in the first release;
7. password hashing/storage requirements if credentials are application-owned;
8. CSRF, secure-cookie, brute-force/rate-limit, audit-log, and secret-loading
   requirements for local development and production.

## Explicitly out of scope

- Implementing routes, dependencies, credential storage, or frontend behavior.
- Adding real users, passwords, client secrets, or identity-provider
  credentials to Git.
- Choosing a production domain or deploying an identity provider.

## Dependencies

- `DEC-001` records that authentication will be implemented.

## Acceptance criteria

- [x] Every numbered contract choice is recorded in a decision note.
- [x] The protected/public route matrix is explicit.
- [x] Registration and password recovery are either scoped with follow-up
      tasks or explicitly disabled/removed from the initial UI.
- [x] No secret value or production credential is committed.
- [x] `AUTH-001` and `AUTH-002` are updated to reflect the approved contract.

## Verification commands

```sh
rg -n -i 'login|logout|auth|session|cookie|password|swagger|openapi' \
  sparql src/main src/test build.gradle.kts tcc
git diff --check
```

## Expected documentation updates

- `tcc/09 - Decisions/Authentication Contract.md`
- `tcc/09 - Decisions/Open Decisions.md`
- `tcc/03 - Backend/API v1.md`
- `tcc/04 - Frontend/Frontend Architecture.md`
- `tcc/90 - Tasks/TASKS.md`

## Risks

- Implementing the existing form before these choices would invent a credential
  store and authorization boundary.
- Cookie sessions without CSRF protection can authorize cross-site requests.
- Protecting only the page while leaving API routes public provides no access
  control; protecting APIs without coordinating the frontend breaks the app.

## Execution log

- 2026-09-21: Created from approved DEC-001 direction after inspecting all
  login/auth call sites, Ktor composition, tests, Gradle dependencies, and C#
  history. Recommended direction is a same-origin server-side session cookie,
  subject to explicit human approval of the complete contract.
- 2026-09-27: Stakeholder explicitly deferred authentication until user
  testing. The task remains `BLOCKED`; no provider, credential, session,
  protected-route, cookie, CSRF, or recovery contract was invented. OpenAPI
  remains public and has no security scheme in the meantime.
- 2026-10-07: While planning deployment (DOC-003) the user stated that login
  passwords will be stored in PostgreSQL. Recorded as a direction for item 1
  (application-owned users) and item 7 (storage); hashing parameters and
  every other item remain undecided, so the task stays `BLOCKED`. `LEARN-008`
  prepares the user to answer the remaining questions.
- 2026-10-16: User answered (D4 of [[../../05 - Migration/Frontend Migration Conflict Report]]):
  the login screen also creates users; the query editor works without login,
  but anonymous users get no questionnaire; no password recovery for now.
  Security defaults (Argon2id, server-side session in an `HttpOnly`
  `SameSite=Lax` cookie, Origin check, rate limit, route matrix) recorded with
  them in [[../../09 - Decisions/Authentication Contract]]; they are reversible
  and listed for the user's veto. AUTH-001 now also depends on BE-005;
  AUTH-002 is superseded by AUTH-003. Completion commit for this task.

## Source files

- `sparql/login.html`
- `build.gradle.kts`
- `src/main/kotlin/com/example/sparqlqueryeasy/Application.kt`
- `src/main/kotlin/com/example/sparqlqueryeasy/http/HttpModule.kt`
- `Sparql.QueryEasy/Program.cs`
- [Ktor session authentication](https://ktor.io/docs/server-session-auth.html)
- [Ktor authentication](https://ktor.io/docs/server-auth.html)
