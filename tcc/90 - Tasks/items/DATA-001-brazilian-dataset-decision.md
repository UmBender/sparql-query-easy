---
id: DATA-001
title: Decide canonical Brazilian football dataset behavior
status: READY
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
