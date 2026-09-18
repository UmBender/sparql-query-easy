---
id: DEC-001
title: Resolve vault ownership login page and OpenAPI scope
status: BLOCKED
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
- 2026-09-16: Started review. Source inspection confirms `tcc/` contains the
  thesis vault and PDFs, `sparql/login.html` has no corresponding Kotlin auth
  route, and the C# launch profile points to Swagger while Kotlin has no
  OpenAPI route. These are product/repository decisions, not safe autonomous
  implementation choices.
- 2026-09-16: Blocked at the human gate. Please approve a disposition for each:
  (A) keep/version the vault and PDFs in this repository or keep them external;
  (B) retain `login.html` as a static non-functional page, remove it, or
  implement authentication; and (C) add Kotlin OpenAPI now, defer it, or omit
  it. No files were removed or application behavior changed.
- 2026-09-16: Stakeholder approved A: keep the `tcc/` vault and PDFs external
  to the application repository. Decisions B and C remain outstanding.
- 2026-09-16: Stakeholder selected B: implement authentication. The source
  review found only a static HTML form and no credential store, session/token
  mechanism, or protected-route policy. Safe implementation therefore needs
  an explicit authentication contract rather than invented credentials.
- 2026-09-16: Stakeholder approved C: add Kotlin OpenAPI now. Authentication
  remains blocked pending its credential, session/token, and route-protection
  contract.
