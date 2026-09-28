---
id: FE-001
title: Add browser-level tests for authoritative frontend flows
status: DONE
priority: P1
type: frontend
depends_on: [DOC-001, API-001]
human_gate: false
created: 2026-09-16
updated: 2026-09-16
---
# Add browser-level tests for authoritative frontend flows

## Objective
Verify autocomplete search-to-node insertion, Turtle upload endpoint replacement, relationship expansion, and query preview/execution in `index2.html`.

## Evidence and relevant files
`sparql/index2.html`; `StaticFrontendRoutesTest.kt`; `HttpModule.kt`.

## Scope
Choose a browser test tool, use test-local API responses, and cover main client flows.

## Out of scope
Redesigning the UI or introducing authentication.

## Dependencies
Documented API contract.

## Acceptance criteria
Automated browser test catches a broken autocomplete callback and validates relative API URLs.

## Verification commands
Tool-specific browser test command plus Gradle quality gate.

## Expected documentation updates
Frontend and quality notes.

## Risks
CDN dependencies can make browser tests flaky; use controlled assets or stubs.

## Execution log
- 2026-09-16: Ready.
- 2026-09-16: Selected Playwright Firefox because the workspace has Node and
  Firefox but no existing browser-test framework. Added a deterministic local
  server that serves the real `index2.html`, returns test-local API responses,
  and intercepts CDN-only dependencies with minimal test stubs. No live
  Wikidata or CDN request is required.
- 2026-09-16: The first browser attempt failed because the Materialize stub
  lacked `M.Sidenav.init`, aborting page initialization before Cytoscape. This
  was a test-harness defect, not a frontend syntax error; after adding the
  stub, all three flows passed: autocomplete callback/node insertion; Turtle
  upload and relationship expansion; and SPARQL preview/query execution.
- 2026-09-16: Passed `npm run test:browser` and
  `GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintCheck detekt test --no-daemon --console=plain`.
  Reviewed the task diff and `git diff --check`; no secrets or unrelated
  changes were added.
