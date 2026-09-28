---
id: COM-001
title: Characterize frontend-to-backend request flows
status: DONE
priority: P1
type: frontend-backend
depends_on: [API-001]
human_gate: false
created: 2026-09-16
updated: 2026-09-16
---
# Characterize frontend-to-backend request flows

## Objective
Create test-backed flow documentation for each frontend request, including payload mapping, response consumption, and displayed error behavior.

## Evidence and relevant files
`sparql/index2.html`; `QueryHttpModels.kt`; `HttpModule.kt`; HTTP route tests.

## Scope
Search, relationships, relationship values, query execution, SPARQL preview, health warm-up, and Turtle upload.

## Out of scope
UI redesign, API contract change, or implementation of `login.html`.

## Dependencies
API-001.

## Acceptance criteria
Every AJAX request has a contract reference and automated test coverage at the appropriate HTTP/browser boundary.

## Verification commands
Route tests and future FE-001 browser tests.

## Expected documentation updates
Frontend architecture, API contract, quality note.

## Risks
The browser currently presents generic errors and may conceal approved JSON diagnostics.

## Execution log
- 2026-09-16: Ready.
- 2026-09-16: Traced every network call in `sparql/index2.html`: health
  warm-up; Turtle upload; debounced search; autocomplete connection probes;
  relationship discovery; both relationship-value actions; general query; and
  SPARQL preview. Published [[../../04 - Frontend/Request Flows|Request Flows]]
  with payload mapping, response use, displayed failures, API references, and
  test boundaries. The confirmed generic-error behavior is documented without
  changing UI or API behavior.
- 2026-09-16: Extended `StaticFrontendRoutesTest` to assert that the served
  authoritative frontend declares every Ktor request route, its same-origin
  base, and the `ttlFile` field. Passed
  `GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintCheck test --tests 'com.example.sparqlqueryeasy.ApplicationTest' --tests 'com.example.sparqlqueryeasy.http.QueryRoutesTest' --tests 'com.example.sparqlqueryeasy.http.LocalDatabaseRoutesTest' --tests 'com.example.sparqlqueryeasy.http.StaticFrontendRoutesTest' --no-daemon --console=plain`.
  Verified the documented route declarations, API note targets, and
  `git diff --check`. Existing unrelated worktree changes were preserved, so
  no commit was created.
