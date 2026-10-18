---
id: AUTH-001
title: Implement the approved Ktor authentication backend
status: DONE
priority: P0
type: security
depends_on: [AUTH-000, BE-005]
human_gate: false
created: 2026-09-21
updated: 2026-10-18
---
# Implement the approved Ktor authentication backend

## Objective

Implement the authentication/session contract approved by `AUTH-000` without
hard-coded credentials or silent changes to existing API payloads.

## Evidence and relevant files

`build.gradle.kts`; `application.conf`; `Application.kt`; `HttpModule.kt`;
`QueryRoutesTest.kt`; `LocalDatabaseRoutesTest.kt`.

## Exact scope

- Add only the Ktor auth/session dependencies required by the approved design.
- Introduce application-owned credential/user/session boundaries so Ktor types
  and storage choices do not leak into unrelated query services.
- Implement the approved login, logout, and current-session routes.
- Apply route protection exactly according to the approved matrix.
- Load secrets/configuration from environment-backed configuration; fail safely
  when mandatory production configuration is absent.
- Configure cookie/session expiry, `HttpOnly`, `SameSite`, production `Secure`,
  invalidation, CSRF protection, and brute-force controls as approved.
- Preserve existing `DataResponse`/`ErrorResponse` contracts for existing
  routes unless `AUTH-000` explicitly versions an auth failure response.
- Add deterministic route and application tests for success, invalid
  credentials, missing/expired/tampered sessions, logout, CSRF, and every
  public/protected route category.

## Explicitly out of scope

- Frontend form behavior (`AUTH-002`).
- Real production credentials, external-provider provisioning, DNS, or TLS.
- Changing SPARQL/RDF semantics or compatibility captures.

## Dependencies

- `AUTH-000` must be `DONE` with a complete approved contract.

## Acceptance criteria

- [x] No secret or plaintext production password is committed.
- [x] Login/logout/session behavior and status/JSON/redirect contracts match
      `AUTH-000` exactly.
- [x] Every protected route rejects an unauthenticated request and succeeds
      with a valid session; every public route remains public.
- [x] Session fixation, expiry, tampering, logout invalidation, CSRF, and
      repeated invalid-login behavior have deterministic tests.
- [x] Existing compatibility and route tests remain green or are extended only
      for the explicitly approved auth boundary.
- [x] Configuration and API/security documentation are updated.

## Verification commands

```sh
GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintFormat --no-daemon
GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintCheck detekt test --no-daemon
git diff --check
```

## Expected documentation updates

`MIGRATION.md`; `tcc/02 - Architecture/System Architecture.md`;
`tcc/03 - Backend/API v1.md`; `tcc/06 - Development/Development Environment.md`;
`tcc/08 - Quality/Quality and Compatibility.md`.

## Risks

Authentication is a new Kotlin contract, not a C# compatibility feature.
Incorrect cookie/CSRF/route configuration could create a false security
boundary or break same-origin frontend calls.

## Execution log

- 2026-09-21: Created from DEC-001 analysis; implementation intentionally
  depends on the human-gated `AUTH-000` contract.
- 2026-10-16: AUTH-000 approved; contract in
  [[../../09 - Decisions/Authentication Contract]] (self-registration, public
  query routes, `/api/study/**` protected, Argon2id, sessions in PostgreSQL).
  Added dependency on BE-005 for user and session storage. Frontend work moved
  to AUTH-003 in the new app.
- 2026-10-18: Implemented. `application/auth/`: `AuthService` (register,
  login, logout, current user; username 3–32 `[A-Za-z0-9._-]`, unique by
  lower-case key; password 8–128; a new 32-byte token at every login or
  registration, the presented one deleted; 7-day absolute expiry; unknown
  users verified against a placeholder hash), `AccountStore` port,
  `AttemptLimiter` (fixed one-minute window per address). Infrastructure:
  `Argon2PasswordHasher` (BouncyCastle `bcprov-jdk18on` 1.81, PHC strings,
  cost from settings), `PostgresAccountStore` (Exposed + `exposed-java-time`),
  `V2__accounts.sql` (only token SHA-256 digests stored). HTTP:
  `AuthRoutes.kt` (`/api/auth/{register,login,logout,session}`,
  `easyquery_session` cookie HttpOnly/SameSite=Lax/Secure in production,
  Origin and JSON checks → 403/415, 429, 503 when the database is missing,
  `withSession` guard for logout and every `/api/study/` path). Settings:
  `EASYQUERY_ARGON2_{MEMORY_KIB,ITERATIONS,PARALLELISM}`,
  `EASYQUERY_AUTH_ATTEMPTS_PER_MINUTE`, `EASYQUERY_TRUST_PROXY` (validated).
  No Ktor auth/session plugin was needed: the cookie and the guard are a few
  application-owned functions. OpenAPI snapshot and frontend types refreshed.
  Tests: `AuthServiceTest`, `AttemptLimiterTest`, `Argon2PasswordHasherTest`,
  `AuthRoutesTest` (13 cases: cookie attributes, Secure in production,
  conflict/invalid input, identical login failures, fixation, missing/
  tampered/expired sessions, logout, CSRF, rate limit incl. X-Forwarded-For,
  `/api/study/` guard, public routes, no database), `AppSettingsTest`.
  Validation: `ktlintCheck detekt test` (206 tests, 40 classes), frontend
  check and API specs, `test:stack` on the built distribution (6), docs check. MIGRATION.md not appended (ordinary
  feature, AGENTS.md).
