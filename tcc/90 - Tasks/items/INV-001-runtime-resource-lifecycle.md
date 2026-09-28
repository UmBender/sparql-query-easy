---
id: INV-001
title: Investigate Ktor HTTP-client and runtime resource lifecycle
status: DONE
priority: P1
type: investigation
depends_on: [DOC-001]
human_gate: false
created: 2026-09-16
updated: 2026-09-16
---
# Investigate Ktor HTTP-client and runtime resource lifecycle

## Objective
Establish ownership and shutdown behavior for HTTP clients and application-scoped resources created by default Ktor dependencies.

## Evidence and relevant files
`src/main/kotlin/com/example/sparqlqueryeasy/http/HttpModule.kt`; `Application.kt`.

## Scope
Trace client creation, Ktor lifecycle hooks, shutdown behavior, and tests.

## Out of scope
Changing HTTP retry/timeout semantics without contract review.

## Dependencies
DOC-001.

## Acceptance criteria
Documented owner and deterministic close behavior with a regression test if change is needed.

## Verification commands
Focused lifecycle test and Gradle quality gate.

## Expected documentation updates
Architecture, development, and quality notes.

## Risks
Resource leaks or premature shared-client closure.

## Execution log
- 2026-09-16: Ready; source review found construction but no visible lifecycle owner.
- 2026-09-16: Confirmed that `defaultHttpDependencies()` creates one shared CIO
  client for remote SPARQL and entity search, while wrapper `close()` methods
  would incorrectly close that shared client if used independently. Made
  `HttpDependencies` the explicit owner and registered close on Ktor
  `ApplicationStopped`.
- 2026-09-16: Added `HttpModuleLifecycleTest`; a forced focused execution
  passed and verifies an owned resource closes exactly once after application
  shutdown. `ktlintCheck`, Detekt, and the full test suite completed with no
  test-result XML failures/errors. `git diff --check` passed. The unrelated
  `tcc/.obsidian/workspace.json` change was preserved, so no commit was made.
