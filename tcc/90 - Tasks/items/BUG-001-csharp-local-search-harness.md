---
id: BUG-001
title: Repair C# local-search capture instrumentation and recapture baselines
status: BLOCKED
priority: P0
type: bug
depends_on: [DOC-001]
human_gate: true
created: 2026-09-16
updated: 2026-09-16
---
# Repair C# local-search capture instrumentation and recapture baselines

## Objective
Make C# characterization capture local search without altering `LocalQueryExecutor` runtime-type behavior, then review and recapture `SEARCH-LOCAL-001` and `BUILTIN-GRAPH-001`.

## Evidence and relevant files
`Sparql.QueryEasy/Services/EndpointService.cs`; `compatibility/Compatibility.Harness/Program.cs`; `compatibility/expected/SEARCH-LOCAL-001/case.json`; `compatibility/expected/BUILTIN-GRAPH-001/case.json`.

## Scope
Replace harness-only instrumentation that wraps the local executor; capture executed query/results without causing C# to select the remote-search branch.

## Out of scope
Changing production search semantics or editing expected captures by hand.

## Dependencies
DOC-001 and .NET 8 capture environment.

## Acceptance criteria
- C# local search detects a real `LocalQueryExecutor`.
- Both captures contain reviewed C# route/query evidence.
- Provenance is updated and Kotlin comparator re-enables both cases.

## Verification commands
`dotnet run --project compatibility/Compatibility.Harness/Compatibility.Harness.csproj`; focused Kotlin capture comparator command.

## Expected documentation updates
`MIGRATION.md`, `MIGRATION_REPORT.md`, compatibility provenance, migration status note.

## Risks
Golden baselines are immutable until a reviewed harness correction proves the old evidence invalid.

## Execution log
- 2026-09-16: Blocked pending approval to repair harness and recapture reviewed C# evidence.
