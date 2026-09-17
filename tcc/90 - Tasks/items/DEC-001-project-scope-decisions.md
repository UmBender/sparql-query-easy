---
id: DEC-001
title: Resolve vault ownership login page and OpenAPI scope
status: READY
priority: P2
type: decision
depends_on: [DOC-001]
human_gate: true
created: 2026-09-16
updated: 2026-09-16
---
# Resolve vault ownership login page and OpenAPI scope

## Objective
Make explicit product/repository decisions that currently cannot be inferred from source.

## Evidence and relevant files
`tcc/`; `sparql/login.html`; `Sparql.QueryEasy/Program.cs`; `HttpModule.kt`.

## Scope
Decide whether the vault/PDFs belong in Git, whether `login.html` is retained/implemented/removed, and whether Kotlin needs Swagger/OpenAPI.

## Out of scope
Implementing authentication, deleting assets, or adding OpenAPI before approval.

## Dependencies
DOC-001.

## Acceptance criteria
Recorded decisions with follow-up task disposition.

## Verification commands
Decision review.

## Expected documentation updates
Open decisions, project inventory, task index.

## Risks
Repository scope and public API expectations remain ambiguous without these decisions.

## Execution log
- 2026-09-16: Ready for stakeholder decision.
