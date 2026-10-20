---
id: QUAL-016
title: Run CI per the DEC-016 tiers and keep every Playwright report as an artifact
status: BACKLOG
priority: P1
type: quality
depends_on: [QUAL-007, DEC-016]
human_gate: true
created: 2026-10-20
updated: 2026-10-20
---
# Run CI per the DEC-016 tiers and keep every Playwright report as an artifact

## Objective

T10 CI gap. Apply the DEC-016 Q1/Q2 choices to `.github/workflows/ci.yml`
and keep reports for every run. `human_gate`: proving CI on GitHub needs a
push, which is not authorized by planning or local commits. Skill:
`tcc-test`.

## Confirmed entry points

- `.github/workflows/ci.yml`: jobs `kotlin`, `frontend`; triggers push to
  `main`, `pull_request`, `workflow_dispatch`; `frontend/test-results/`
  uploaded on failure only.
- `frontend/playwright.config.ts`, `playwright.stack.config.ts` (reporters).

## Scope

- Triggers and job split as DEC-016 Q2 decides (including a nightly
  `schedule` in both options).
- HTML reporter in both Playwright configs; upload `playwright-report/` of
  each suite on every run (`if: always()`), plus `test-results/` on failure.
- If DEC-016 Q1 is B or C: the compose-based job, from its own card.
- Operational Map CI row.

## Out of scope

- Deploy, secrets, a self-hosted runner.

## Acceptance criteria

- [ ] On GitHub, `main` is green with the decided triggers.
- [ ] A deliberate API contract drift (a field renamed in the snapshot only)
  and a deliberate screenshot change each turn a run red on a branch
  (verified once, reverted). This also closes QUAL-007's open criterion.
- [ ] Each run lists the Playwright report artifacts.

## Validation

Locally: the Kotlin and frontend gates plus `test:stack` (CI row of the
Operational Map). On GitHub: the runs above, after the user pushes.
