---
id: OAPI-001
title: Implement and verify Kotlin Swagger/OpenAPI documentation
status: READY
priority: P0
type: documentation
depends_on: [OAPI-000, AUTH-000]
human_gate: false
created: 2026-09-21
updated: 2026-09-21
---
# Implement and verify Kotlin Swagger/OpenAPI documentation

## Objective

Add the approved Swagger UI and machine-readable OpenAPI contract for every
current Kotlin route, including authentication and error behavior.

## Evidence and relevant files

`build.gradle.kts`; `HttpModule.kt`; `API v1.md`; request/response DTOs;
`QueryRoutesTest.kt`; `LocalDatabaseRoutesTest.kt`.

## Exact scope

- Add `ktor-server-swagger` (and only other approved Ktor OpenAPI artifacts) at
  the project's pinned Ktor version.
- Add the authoritative specification source selected by `OAPI-000`.
- Document `/`, `/health`, `/api/local-database`, and all five `/api/query`
  routes: parameters, multipart body, JSON bodies/defaults/nullability,
  numeric filter enum, success schemas, `400`/`401`/`403`/`404`/`502` errors,
  side effects, and authentication/security requirements.
- Serve Swagger UI and the raw specification at the approved paths/exposure
  level without enabling wildcard production CORS.
- Add tests that parse/validate the specification, fetch UI/spec routes, and
  cross-check the route/path/method inventory and representative schemas.
- Keep `API v1.md` aligned and document how future route changes update both
  executable tests and the specification.

## Explicitly out of scope

- Changing existing HTTP/RDF/SPARQL behavior to make the spec pass.
- Production domain, CORS, DNS, TLS, or deployment changes.
- Authentication implementation beyond documenting the approved contract.

## Dependencies

- `OAPI-000` selects specification ownership and exposure.
- `AUTH-000` selects security schemes and protected routes.

## Acceptance criteria

- [ ] Swagger UI and raw OpenAPI endpoints return successful documented content
      at the approved paths.
- [ ] Every current application route/method is represented exactly once.
- [ ] Request defaults, multipart upload, nullable response fields, numeric
      filters, and all approved errors/security requirements match code/tests.
- [ ] The spec parses under an OpenAPI validator and automated drift checks
      fail when a route or required schema is missing.
- [ ] Normal tests are offline and the complete quality gate passes.

## Verification commands

```sh
GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintFormat --no-daemon
GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintCheck detekt test --no-daemon
git diff --check
```

## Expected documentation updates

`MIGRATION.md`; `MIGRATION_REPORT.md`; `tcc/03 - Backend/API v1.md`;
`tcc/06 - Development/Development Environment.md`;
`tcc/08 - Quality/Quality and Compatibility.md`.

## Risks

An attractive Swagger UI can conceal an incomplete or drifting schema. Swagger
"Try it out" must follow the approved session/CSRF policy and must not force
wildcard CORS.

## Execution log

- 2026-09-21: Created from DEC-001 analysis. Implementation waits for the two
  decision-first tasks so it does not invent exposure or security behavior.
