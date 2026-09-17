---
id: FE-001
title: Add browser-level tests for authoritative frontend flows
status: READY
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
