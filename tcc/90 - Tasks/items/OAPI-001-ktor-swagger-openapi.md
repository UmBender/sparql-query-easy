---
id: OAPI-001
title: Implement and verify Kotlin Swagger/OpenAPI documentation
status: DONE
priority: P0
type: documentation
depends_on: [OAPI-000]
human_gate: false
created: 2026-09-21
updated: 2026-09-27
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
  numeric filter enum, success schemas, current `400`/`404`/`502` errors,
  side effects, and the approved absence of authentication/security
  requirements.
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
- Authentication is deliberately deferred. The current public contract is
  documented without a security scheme; `AUTH-000` will define it later.

## Acceptance criteria

- [x] Swagger UI and raw OpenAPI endpoints return successful documented content
      at the approved paths.
- [x] Every current application route/method is represented exactly once.
- [x] Request defaults, multipart upload, nullable response fields, numeric
      filters, and all approved errors/security requirements match code/tests.
- [x] The spec parses under an OpenAPI validator and automated drift checks
      fail when a route or required schema is missing.
- [x] Normal tests are offline and the complete quality gate passes.

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
- 2026-09-21: Three consecutive execution audits confirmed that `OAPI-000` and
  `AUTH-000` remain human-gated and `BLOCKED`. No explicit approval was
  received for specification ownership/paths, environment exposure, security
  scheme, or protected-route policy. Marked `BLOCKED` without modifying
  dependencies, application code, routes, or tests. Resume after the concrete
  approval question in `BLOCKERS.md` is answered.
- 2026-09-27: User approved code-generated OpenAPI 3.1, `/swagger`,
  `/openapi.json`, production availability, and no authentication for now.
  Removed the unresolved authentication decision as an implementation
  dependency and started OAPI-001.
- 2026-09-27: Added Ktor runtime routing metadata, public Swagger UI and raw
  JSON routes, explicit OpenAPI defaults/filter/multipart annotations, and an
  offline contract suite. Swagger Parser accepts the generated OpenAPI 3.1
  document without messages; tests enforce the exact eight-operation
  inventory, schemas, errors, and deliberate lack of security requirements.
- 2026-09-27: Ktor's compiler inference was evaluated but not retained because
  Ktor 3.5.1 reported it requires Kotlin 2.4+, while this project pins Kotlin
  2.2.20. Runtime `.describe` metadata provides code-owned generation without
  an unrelated compiler upgrade.
- 2026-09-27: `GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew
  ktlintFormat ktlintCheck detekt test --no-daemon` passed. `git diff --check`
  passed. Updated API, development, quality, migration, decision, README, task,
  run-log, and blocker documentation. Completed OAPI-001.

## Source files

- `build.gradle.kts`
- `src/main/kotlin/com/example/sparqlqueryeasy/http/HttpModule.kt`
- `src/main/kotlin/com/example/sparqlqueryeasy/http/OpenApiModule.kt`
- `src/main/kotlin/com/example/sparqlqueryeasy/http/QueryHttpModels.kt`
- `src/test/kotlin/com/example/sparqlqueryeasy/http/OpenApiRoutesTest.kt`
