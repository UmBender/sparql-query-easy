---
id: MIG-001
title: Complete valid capture-driven C# to Kotlin compatibility coverage
status: DONE
priority: P0
type: migration
depends_on: [DOC-001]
human_gate: false
created: 2026-09-16
updated: 2026-09-16
---
# Complete valid capture-driven C# to Kotlin compatibility coverage

## Objective
Keep every valid C# capture compared through Kotlin’s real route/service execution with strict graph, query, result, and HTTP assertions.

## Evidence and relevant files
`compatibility/expected/`; `src/test/kotlin/com/example/sparqlqueryeasy/http/CaptureDrivenCompatibilityTest.kt`; `AGENTS.md`.

## Scope
Maintain graph isomorphism, generated/executed SPARQL comparison, variable/row/binding/RDF-term comparison, duplicate handling, and ordered-row rules.

## Out of scope
Normal live Wikidata access; invalid local-search baselines covered by BUG-001.

## Dependencies
DOC-001; BUG-001 is required before local-search cases can be marked equivalent.

## Acceptance criteria
- No assertion is weakened.
- Every valid local capture passes through Ktor routes.
- Exception-only C# captures remain explicit intentional differences.

## Verification commands
`GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew test --tests 'com.example.sparqlqueryeasy.http.CaptureDrivenCompatibilityTest' --no-daemon`.

## Expected documentation updates
Migration report and capture matrix.

## Risks
dotNetRDF/Jena behavior may differ on parser diagnostics, blank nodes, and ordering.

## Execution log
- 2026-09-16: Comparator exists; valid cases pass. Local-search evidence awaits BUG-001.
- 2026-09-16: Selected by the task worker after `DOC-001` was confirmed `DONE`.
  Inspected the comparator and its recorded execution boundary. It parses Turtle
  with Jena, compares captured graphs isomorphically, captures Kotlin's actual
  local execution, and strictly compares query text (with only documented
  literal-variable normalization), projected variables, bindings, RDF terms,
  duplicate rows, and `ORDER BY` row order.
- 2026-09-16: Passed the focused offline comparator command. No file in
  `compatibility/expected/` or capture provenance was changed. The six
  exception-only captures remain explicit intentional non-equivalences;
  `SEARCH-LOCAL-001` and `BUILTIN-GRAPH-001` remain excluded as invalid C#-harness
  evidence pending `BUG-001`, not as a weakened assertion.
- 2026-09-16: Passed the broader offline quality gate:
  `GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintCheck detekt test --no-daemon --console=plain`.
  `git diff --check` also passed. Reviewed task-related documentation and the
  dirty worktree; unrelated pre-existing changes were preserved, so no commit
  was created.
