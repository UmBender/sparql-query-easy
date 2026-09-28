---
id: BUG-001
title: Repair C# local-search capture instrumentation and recapture baselines
status: DONE
priority: P0
type: bug
depends_on: [DOC-001]
human_gate: true
created: 2026-09-16
updated: 2026-09-17
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
- [x] C# local search detects a real `LocalQueryExecutor`.
- [x] Both captures contain reviewed C# route/query evidence.
- [x] Provenance is updated and Kotlin comparator re-enables both cases.

## Verification commands
`dotnet run --project compatibility/Compatibility.Harness/Compatibility.Harness.csproj`; focused Kotlin capture comparator command.

## Expected documentation updates
`MIGRATION.md`, `MIGRATION_REPORT.md`, compatibility provenance, migration status note.

## Risks
Golden baselines are immutable until a reviewed harness correction proves the old evidence invalid.

## Execution log
- 2026-09-16: Blocked pending approval to repair harness and recapture reviewed C# evidence.
- 2026-09-17: Human approval received to repair the harness-only instrumentation and recapture the two invalid local-search baselines. Task resumed as `IN_PROGRESS`.
- 2026-09-17: Replaced the wrapper with `CapturingLocalQueryExecutor`, an
  `IQueryExecutor` implementation that subclasses `LocalQueryExecutor`, and
  added a fail-fast runtime-type guard. Production C# search code was not
  changed.
- 2026-09-17: Ran
  `dotnet run --project compatibility/Compatibility.Harness/Compatibility.Harness.csproj`;
  it captured 34 cases. Reviewed the complete capture diff, retained only the
  two approved search recaptures, and rejected unordered-row noise in two
  unrelated cases. `SEARCH-LOCAL-001` records 4 raw rows;
  `BUILTIN-GRAPH-001` records 1819. Both prove the unfiltered/no-request-limit
  local query and the C# post-query filter. Updated their timestamp, C# SHA,
  .NET SDK/host/OS, normalization, status, path, and observations in
  `capture-status.tsv`.
- 2026-09-17: Re-enabled both cases in `CaptureDrivenCompatibilityTest`. Its
  first run exposed the captured `.NET Uri.AbsoluteUri` empty-path rule for
  `http://futebol.usp.br#...`. Added the RDF-boundary normalization and a
  focused regression; no comparator assertion was weakened.
- 2026-09-17: Focused RDF/comparator tests passed. Ran `ktlintFormat`
  separately, then
  `GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintCheck detekt test --no-daemon --console=plain`;
  the full gate passed. Earlier combined-gate attempts identified and then
  cleared one indentation violation and one Detekt line-length violation.
  `git diff --check` passed; no dedicated Markdown-link or Mermaid checker is
  configured, and this task introduced no links or Mermaid diagrams.
- 2026-09-17: Updated `MIGRATION.md`, `MIGRATION_REPORT.md`, the vault home and
  migration/quality notes, task index, run log, and blockers. Marked `DONE`
  after all three acceptance criteria were objectively verified.
