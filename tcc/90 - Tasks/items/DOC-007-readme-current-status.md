---
id: DOC-007
title: Bring the README's current status in line with the cutover and the deploy work
status: DONE
priority: P2
type: documentation
depends_on: []
human_gate: false
created: 2026-10-20
updated: 2026-10-20
---
# Bring the README's current status in line with the cutover and the deploy work

## Objective

T12 ("update docs: README"). FE-049 updated the frontend line, but the
README's "Current status" still says "No Kotlin deployment workflow or hosting
target is selected yet" and lists deployment, monitoring and backup as open,
while DEC-003 chose the university server and OPS-006 to OPS-011 built the
Compose stack, HTTPS switch, backups, logs and runbook. Skill:
`tcc-plan-task` (documentation).

## Scope

- Rewrite "Current status" from the evidence: SvelteKit-only frontend
  (FE-049), Compose stack and runbook (OPS-006, OPS-011), what is still open
  (SEC-001, OPS-002/004/005, go-live facts in DOC-005).
- Point "Documentation" at the Frontend Architecture, the testing guide, the
  server runbook and, once DOC-006 lands, the user guide.

## Out of scope

- Other notes; the user guide (DOC-006).

## Acceptance criteria

- [x] No README sentence contradicts Current Contracts or TASKS.md statuses.
- [x] Every README link resolves.

## Validation

Docs gate: `node scripts/check-project-docs.mjs`; `git diff --check`.

## Execution log

- 2026-10-20: README "Current status" rewritten from the cards: Compose stack
  on the university server (not live), HTTPS switch, backups, logs, limits,
  release tags (OPS-006 to OPS-011), accounts and study (AUTH-001/003/005,
  STUDY-001/002), CI; open items SEC-001 (DEC-004/005), OPS-002/004/005
  (DOC-005 answers). Documentation links add the Frontend Architecture,
  Testing Guide and Server Deploy Runbook; `remaining.md` is labelled as the
  historical C# port record (its text is out of scope). Source landmarks:
  `compose.yaml`/`deploy/` cover OPS-006 to OPS-011. Claims checked against
  `compose.yaml` and `.env.example` (`EASYQUERY_HTTPS_MODE`, memory limits,
  `EASYQUERY_VERSION`). Validation: `node scripts/check-project-docs.mjs`,
  `git diff --check`. The `/help` link is added by DOC-006.
