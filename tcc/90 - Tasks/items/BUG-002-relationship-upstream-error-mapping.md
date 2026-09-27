---
id: BUG-002
title: Map relationship executor failures to the approved JSON 502 contract
status: DONE
priority: P1
type: bug
depends_on: [OAPI-001]
human_gate: false
created: 2026-09-27
updated: 2026-09-27
---
# Map relationship executor failures to the approved JSON 502 contract

## Objective

Make `/api/query/relationships` and `/api/query/relationship-value` apply the
same explicit `502 {"error":"..."}` contract already implemented by search
and general-query execution failures.

## Evidence and relevant files

- Both relationship services call `EndpointExecution.execute` directly.
- `runQueryRoute` maps validation and endpoint-selection failures but does not
  catch `SparqlQueryExecutionFailure`.
- Search and general-query services return typed `ExecutionFailure` results,
  which their routes map through `upstreamFailure` to JSON `502`.
- OpenAPI currently documents only the explicit responses actually produced
  by the two relationship routes and records this gap in `API v1.md`.

## Exact scope

- Add deterministic route regressions that inject a failing endpoint executor.
- Map the two relationship execution failures to the approved JSON `502`
  envelope without changing success, `400`, or `404` behavior.
- Add `502` to both generated OpenAPI operations and align API documentation.

## Explicitly out of scope

- Authentication, retry policy, timeout policy, or remote endpoint allowlists.
- Changing diagnostic text beyond the existing approved upstream-error policy.
- Live Wikidata or remote SPARQL traffic in tests.

## Dependencies

- `OAPI-001` provides the executable API contract and drift tests.

## Acceptance criteria

- [x] Both relationship routes return JSON `502` for deterministic executor
      failures.
- [x] Existing success, validation, and cache-miss tests remain unchanged and
      pass.
- [x] Generated OpenAPI documents `502` for both operations.
- [x] The complete offline Kotlin quality gate passes.
- [x] API/migration documentation no longer lists this gap.

## Verification commands

```sh
GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew \
  test --tests 'com.example.sparqlqueryeasy.http.QueryRoutesTest' \
  --tests 'com.example.sparqlqueryeasy.http.OpenApiRoutesTest' --no-daemon
GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew \
  ktlintFormat ktlintCheck detekt test --no-daemon
git diff --check
```

## Expected documentation updates

- `tcc/03 - Backend/API v1.md`
- `tcc/03 - Backend/API Contract.md`
- `MIGRATION.md`
- `MIGRATION_REPORT.md`

## Risks

An overly broad exception catch could hide programming defects as upstream
failures. Catch only the application-owned execution failure type at the HTTP
boundary and preserve its diagnostic.

## Execution log

- 2026-09-27: Created from the OAPI-001 source/contract audit. No relationship
  runtime behavior was changed in the documentation implementation task.
- 2026-09-27: Implemented and verified in isolated branch
  `bug/bug-002-upstream-errors`, commit `a2656b4`. The branch catches only
  `SparqlQueryExecutionFailure`, adds deterministic regressions for both
  relationship routes, and passed focused `QueryRoutesTest` plus the complete
  `ktlintCheck detekt test` gate. Status is `REVIEW` until that commit is merged
  into the currently dirty main worktree.
- 2026-09-27: Integrated as merge commit `e040afc` on `kotlin`. The integrated
  `ktlintCheck detekt test --no-daemon` gate passed; all acceptance criteria
  are objectively verified.

## Source files

- `src/main/kotlin/com/example/sparqlqueryeasy/http/HttpModule.kt`
- `src/main/kotlin/com/example/sparqlqueryeasy/http/OpenApiModule.kt`
- `src/main/kotlin/com/example/sparqlqueryeasy/application/relationships/ElementRelationshipsService.kt`
- `src/main/kotlin/com/example/sparqlqueryeasy/application/relationships/RelationshipValueService.kt`
- `src/main/kotlin/com/example/sparqlqueryeasy/domain/model/DomainModels.kt`
- `src/test/kotlin/com/example/sparqlqueryeasy/http/QueryRoutesTest.kt`
- `src/test/kotlin/com/example/sparqlqueryeasy/http/OpenApiRoutesTest.kt`
