---
id: BE-002
title: Expose the typed stage-query service over Ktor
status: BACKLOG
priority: P1
type: backend
depends_on: [DEV-002, API-002, BE-001]
human_gate: false
created: 2026-09-27
updated: 2026-09-27
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

DEV-002, API-002, BE-001.

## Acceptance criteria

- [ ] Route, response, validation and error tests match API-002.
- [ ] OpenAPI 3.1 exposes the new operation and all existing operations.
- [ ] Normal test suite uses no live Wikidata; legacy comparators pass.

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
