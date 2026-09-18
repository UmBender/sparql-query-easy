---
id: DATA-001
title: Decide canonical Brazilian football dataset behavior
status: DONE
priority: P2
type: decision
depends_on: [DOC-001]
human_gate: true
created: 2026-09-16
updated: 2026-09-16
---
# Decide canonical Brazilian football dataset behavior

## Objective
Declare the supported built-in data asset and explain the relation between C# runtime Turtle, `files/`, and frontend Turtle files.

## Evidence and relevant files
`Sparql.QueryEasy/futebol_completo.ttl`; `files/`; `sparql/databases/brasileirao2023.ttl`; `build.gradle.kts`.

## Scope
Dataset ownership, runtime packaging, endpoint naming, and documentation.

## Out of scope
Changing data contents or silently replacing the C# baseline asset.

## Dependencies
DOC-001 and human product decision.

## Acceptance criteria
One documented runtime source and a compatibility plan for any dataset change.

## Verification commands
Resource packaging and built-in graph tests.

## Expected documentation updates
Project inventory, API contract, migration report.

## Risks
Dataset replacement changes query results and baseline behavior.

## Execution log
- 2026-09-16: Ready for human decision.
- 2026-09-16: Inspected both candidate assets and packaging. The C# runtime
  source is `Sparql.QueryEasy/futebol_completo.ttl`; its SHA-256 is
  `2345428c9513651dcf184835538fa910abae6c95fcb399e508709d646af7993f` and it
  is also `files/dados-campeonato-brasileiro-2023.ttl`. Gradle copies this
  C# asset as `futebol_completo.ttl` for Kotlin's built-in endpoint.
- 2026-09-16: Confirmed `sparql/databases/brasileirao2023.ttl` is a distinct
  17,029-line asset (SHA-256
  `56f9609aa7b4f3e732abc263d58c0cfbf71baded42641a1ce32a7b6e24fc802a`), is
  not packaged by `processResources`, and differs in ontology/base and data
  content. No data was changed.
- 2026-09-16: Human approved option 1: retain the C# runtime asset as the sole
  canonical built-in dataset. `CampeonatoBrasileiro2023` continues to resolve
  `futebol_completo.ttl`; the frontend asset remains reference-only. No data or
  C# compatibility baseline was changed.
- 2026-09-16: Verified resource packaging and built-in graph tests after the
  decision. The packaged resource and C# source retain SHA-256
  `2345428c9513651dcf184835538fa910abae6c95fcb399e508709d646af7993f`.
- 2026-09-16: Revalidated the focused Gradle test after approval. The first
  restricted-sandbox attempt could not determine a wildcard IP for Gradle's
  lock service; the approved outside-sandbox retry completed successfully.
