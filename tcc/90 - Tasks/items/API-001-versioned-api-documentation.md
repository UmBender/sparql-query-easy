---
id: API-001
title: Publish versioned API contract from source evidence
status: DONE
priority: P1
type: documentation
depends_on: [DOC-001]
human_gate: false
created: 2026-09-16
updated: 2026-09-16
---
# Publish versioned API contract from source evidence

## Objective
Turn the current route inventory into a versioned developer-facing API document with request fields, defaults, envelopes, and approved errors.

## Evidence and relevant files
`HttpModule.kt`; `QueryHttpModels.kt`; C# controllers/requests; route tests.

## Scope
Kotlin current contract plus labeled C# differences.

## Out of scope
Adding OpenAPI implementation or changing routes.

## Dependencies
DOC-001.

## Acceptance criteria
Every route has a request/response/error example and source evidence.

## Verification commands
Markdown-link check; route test suite.

## Expected documentation updates
Backend API note and root README when created.

## Risks
Must change with any HTTP contract change.

## Execution log
- 2026-09-16: Ready.
- 2026-09-16: Read Kotlin route handlers, serialization/request models,
  query-generation and result-mapping services, deterministic Ktor route tests,
  and the C# controllers. Published [[../../03 - Backend/API v1|API v1]], with
  request defaults, success/error examples, endpoint selection rules, and
  labeled C# differences. No application code or route was changed.
- 2026-09-16: Passed:
  `GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew test --tests 'com.example.sparqlqueryeasy.ApplicationTest' --tests 'com.example.sparqlqueryeasy.http.QueryRoutesTest' --tests 'com.example.sparqlqueryeasy.http.LocalDatabaseRoutesTest' --tests 'com.example.sparqlqueryeasy.http.StaticFrontendRoutesTest' --no-daemon --console=plain`.
  Confirmed the Obsidian API link target and all eight configured route headers;
  `git diff --check` passed. Existing unrelated worktree changes were preserved,
  so no commit was created.
