---
id: BE-002
title: Expose the typed stage-query service over Ktor
status: DONE
priority: P1
type: backend
depends_on: [DEV-001, API-002, BE-001]
human_gate: false
created: 2026-09-27
updated: 2026-09-28
---
# Expose the typed stage-query service over Ktor

## Objective

Add the approved bounded candidate HTTP route and code-generated OpenAPI 3.1
documentation without changing any existing route's contract.

## Evidence and relevant files

`src/main/kotlin/com/example/sparqlqueryeasy/http/HttpModule.kt`;
`src/main/kotlin/com/example/sparqlqueryeasy/http/QueryHttpModels.kt`;
`src/main/kotlin/com/example/sparqlqueryeasy/http/OpenApiModule.kt`;
`src/test/kotlin/com/example/sparqlqueryeasy/http/OpenApiRoutesTest.kt`.

## Exact scope

Validate request shape, bounds and typed bindings; translate approved service
results/errors to the API-002 schema; document the route from code; verify
local uploaded-graph cases and recorded/fake remote responses offline.

## Explicitly out of scope

Frontend, authentication implementation, live upstream tests, or altering
the eight existing OpenAPI operations and C# baselines.

## Dependencies

DEV-001, API-002, BE-001.

## Acceptance criteria

- [x] Route, response, validation and error tests match API-002.
- [x] OpenAPI 3.1 exposes the new operation and all existing operations.
- [x] Normal test suite uses no live Wikidata; legacy comparators pass.

## Verification commands

```sh
GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintCheck detekt test --no-daemon
git diff --check
```

## Expected documentation updates

[[../../03 - Backend/API v1]]; [[../../04 - Frontend/Request Flows]];
`MIGRATION.md` for the additive post-C# feature.

## Risks

An undocumented route or a weakened old-route assertion would hide a
contract break. Keep all existing OpenAPI and capture assertions intact.

## Execution log

- 2026-09-27: Planned only; no route added.
- 2026-09-28: Added `StageQueryHttpRequest`/`RdfTermHttp`/candidate DTOs,
  typed term conversion (bnode and unknown types rejected; langString datatype
  implied by the tag), `POST /api/query/stage` and `listStageCandidates`
  OpenAPI metadata. OpenAPI inventory now has nine operations. New
  `StageQueryRoutesTest` uploads a local Turtle graph and asserts exact typed
  JSON, paging, bnode output, validation and 404; `QueryRoutesTest` covers 502.
  Kotlin gate: 133 tests, ktlint/detekt pass. MIGRATION.md not appended: this
  is an ordinary additive feature per AGENTS.md.
