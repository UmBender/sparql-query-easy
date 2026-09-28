---
id: DEC-009
title: Decide captured C# versus Kotlin health response contract
status: DONE
priority: P1
type: decision
depends_on: [MIG-001, OPS-001]
human_gate: true
created: 2026-09-27
updated: 2026-09-27
---
# Decide captured C# versus Kotlin health response contract

## Objective

Choose the public `GET /health` status, content type, and body before the
original C# code is removed.

## Evidence and relevant files

`compatibility/retirement-expected/HTTP-HEALTH-001/case.json` records actual
ASP.NET Production-mode `200 text/plain Healthy`.
`src/main/kotlin/com/example/sparqlqueryeasy/http/HttpModule.kt` and
`src/test/kotlin/com/example/sparqlqueryeasy/ApplicationTest.kt` establish
Kotlin `200 application/json {"status":"ok"}`. The frontend only checks HTTP
success for its warmup in `sparql/index2.html`.

## Exact scope

Approve one of two choices: preserve Kotlin's documented JSON response as
an intentional C# difference, or align Kotlin's response to C# plain text.
Update OpenAPI, API docs, health tests, Docker health probe documentation,
compatibility report, and migration decisions to match the choice.

## Explicitly out of scope

Changing production readiness semantics, deploying, changing unrelated API
errors, or rewriting the C# capture.

## Dependencies

The C# health capture exists. The user approved retaining Kotlin JSON as an
intentional difference on 2026-09-27. OPS-002–OPS-004 remain future deployment
work; this decision does not authorize C# deletion or production deployment.

## Approved decision

Keep Kotlin `GET /health` at `200 application/json` with body
`{"status":"ok"}`. C# `HTTP-HEALTH-001` remains `200 text/plain Healthy`.
These are intentionally different response contracts, not equivalent captures.
The Docker health probe continues to check HTTP success only; neither response
proves external-service readiness.

## Acceptance criteria

- [x] Human selects and records the health response contract.
- [x] Tests assert the approved body/content type and status.
- [x] OpenAPI, API docs, migration report, and operations notes agree.
- [x] Existing C# capture remains untouched and the Kotlin quality gate passes.

## Verification commands

`GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintCheck detekt test --no-daemon`;
`git diff --check`.

## Expected documentation updates

`MIGRATION.md`, `MIGRATION_REPORT.md`, `tcc/03 - Backend/API v1.md`,
`tcc/07 - Operations/Local JVM and Container Runtime.md`, and
[[../../05 - Migration/CSharp Retirement Readiness]].

## Risks

Silently calling JSON equivalent to C# plain text would misstate the captured
HTTP contract. Aligning Kotlin may change existing consumers of its OpenAPI
schema; retaining JSON requires explicit intentional-difference approval.

## Execution log

- 2026-09-27: Created after actual ASP.NET health capture exposed a concrete
  body/content-type difference. No contract choice was inferred.
- 2026-09-27: User explicitly approved retaining Kotlin JSON. Added response
  MIME assertions to `ApplicationTest` and `RetirementSuccessCompatibilityTest`
  and a JSON health-schema assertion to `OpenApiRoutesTest`. Updated migration,
  API, operations, compatibility, and task documentation without changing the
  immutable C# capture or production route. The Kotlin quality gate passed.
