---
id: AUTH-001
title: Implement the approved Ktor authentication backend
status: READY
priority: P0
type: security
depends_on: [AUTH-000]
human_gate: false
created: 2026-09-21
updated: 2026-09-21
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

- [ ] No secret or plaintext production password is committed.
- [ ] Login/logout/session behavior and status/JSON/redirect contracts match
      `AUTH-000` exactly.
- [ ] Every protected route rejects an unauthenticated request and succeeds
      with a valid session; every public route remains public.
- [ ] Session fixation, expiry, tampering, logout invalidation, CSRF, and
      repeated invalid-login behavior have deterministic tests.
- [ ] Existing compatibility and route tests remain green or are extended only
      for the explicitly approved auth boundary.
- [ ] Configuration and API/security documentation are updated.

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
