---
id: INV-001
title: Investigate Ktor HTTP-client and runtime resource lifecycle
status: READY
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
