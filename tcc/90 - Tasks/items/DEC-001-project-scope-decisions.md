---
id: DEC-001
title: Resolve vault ownership login page and OpenAPI scope
status: DONE
priority: P0
type: decision
depends_on: [DOC-001]
human_gate: true
created: 2026-09-16
updated: 2026-09-21
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
- [x] Repository/PDF ownership is recorded with a follow-up task.
- [x] Login direction is recorded with decision and implementation tasks.
- [x] Swagger/OpenAPI direction is recorded with decision and implementation tasks.

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
- 2026-09-21: Stakeholder confirmed that PDFs do not belong in Git and asked
  for decision-first authentication and Swagger/OpenAPI implementation cards.
  Task resumed as `IN_PROGRESS` for source-backed decomposition; no production
  behavior or tracked PDF was changed during the analysis.
- 2026-09-21: Confirmed three PDFs under `tcc/PDF/` are tracked and total about
  7.7 MB. Created `REPO-001` to untrack and ignore them without deleting local
  copies or rewriting published history. The Markdown vault remains the
  versioned project knowledge/task system.
- 2026-09-21: Traced the complete static login form, packaging, Ktor route
  composition, tests, and Git history. Created decision-first `AUTH-000`, then
  dependent backend `AUTH-001` and frontend `AUTH-002` implementation cards.
- 2026-09-21: Compared C# Swashbuckle behavior, Kotlin's eight application
  routes, the current API contract, and official Ktor Swagger/OpenAPI support.
  Created decision-first `OAPI-000` and dependent implementation card
  `OAPI-001`.
- 2026-09-21: Updated decisions, inventory, blockers, task index, and run log.
  Marked `DONE`: the three scope directions are recorded and every approved
  implementation has an independently verifiable follow-up task. No
  application code, tracked PDF, or secret was modified.
- 2026-09-21: `git diff --check`, task-ID uniqueness, task-index/status
  consistency, source-link target checks, and the final documentation diff
  review passed. The first zsh status-check helper used the reserved variable
  name `status`; it was corrected to `task_state` and then passed. No dedicated
  Markdown/Mermaid checker is configured, and this task introduced no Mermaid.
