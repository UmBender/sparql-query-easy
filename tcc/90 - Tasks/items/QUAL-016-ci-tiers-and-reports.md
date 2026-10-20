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

T10 CI gap. Apply the DEC-016 Q2 choice to `.github/workflows/ci.yml`
and keep reports for every run. `human_gate`: proving CI on GitHub needs a
push, which is not authorized by planning or local commits. Skill:
`tcc-test`.

## Confirmed entry points

- `.github/workflows/ci.yml`: jobs `kotlin`, `frontend`; triggers push to
  `main`, `pull_request`, `workflow_dispatch`; `frontend/test-results/`
  uploaded on failure only.
- `frontend/playwright.config.ts`, `playwright.stack.config.ts` (reporters).

## Scope

- Triggers (DEC-016 Q2 A): every gate on every pull request and push to
  `main` (unchanged); a nightly `schedule` running every gate; the fast job
  (check, lint, Vitest, contract) also on pushes to any branch, so
  `frontend` splits into a fast job and a browser job (Playwright,
  `test:stack`) that skips pushes to branches other than `main`.
- HTML reporter in both Playwright configs; upload `playwright-report/` of
  each suite on every run (`if: always()`), plus `test-results/` on failure.
- The compose smoke job belongs to QUAL-017, not this card.
- Operational Map CI row.

## Out of scope

- Deploy, secrets, a self-hosted runner.

## Acceptance criteria

- [ ] On GitHub, `main` is green; a push to another branch runs only the
  fast job; a pull request and the nightly run run every gate.
- [ ] A deliberate API contract drift (a field renamed in the snapshot only)
  and a deliberate screenshot change each turn a run red on a branch
  (verified once, reverted). This also closes QUAL-007's open criterion.
- [ ] Each run lists the Playwright report artifacts.

## Validation

Locally: the Kotlin and frontend gates plus `test:stack` (CI row of the
Operational Map). On GitHub: the runs above, after the user pushes.
