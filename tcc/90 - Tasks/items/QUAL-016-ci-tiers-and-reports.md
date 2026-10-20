---
id: QUAL-016
title: Run CI per the DEC-016 tiers and keep every Playwright report as an artifact
status: REVIEW
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

## Execution log

- 2026-10-20: `.github/workflows/ci.yml`: triggers `push` (any branch),
  `pull_request`, nightly `schedule` (`17 3 * * *`), `workflow_dispatch`;
  concurrency per event and ref, so a nightly run and a push to `main` do not
  cancel each other. Jobs: `kotlin` (unchanged; includes the OpenAPI snapshot
  test), `frontend-fast` (npm ci, Firefox, check, lint, `test:coverage`,
  Vitest components), `frontend-browser` (`if: event != push || ref ==
  main`: `test:e2e`, then `test:screens` and `test:stack` even after an
  earlier suite failed, so every report is produced). `playwright-reports`
  (all of `frontend/playwright-report/`) is uploaded unless cancelled,
  `test-results/` on failure.
- Playwright configs: HTML reporter per suite (`playwright-report/e2e`,
  `stack`, `screens`), stack results under `test-results/stack`.
- actionlint 1.7.7 (Docker): clean after quoting the screenshot image name
  (SC2046 in the QUAL-014 step).
- Local, exact CI commands: check, lint, `test:coverage` (232),
  Vitest client (25), `test:e2e` (110), `test:screens` (20), `test:stack`
  (20) passed; the three report folders were written. Kotlin sources
  unchanged since the QUAL-012 gate (287 passed), reused.
- Local red checks: renaming `hasMore` in the snapshot only failed
  `api-contract.spec.ts` (frontend-fast) and `FrontendOpenApiSnapshotTest`
  (kotlin); a visible token change failed `test:screens` (QUAL-014). Both
  reverted.
- REVIEW (human gate): nothing has run on GitHub; `main` is not pushed. After
  the push, confirm: `main` green; a push to another branch runs only
  `kotlin` and `frontend-fast`; a pull request and the nightly run run all
  three; each run lists `playwright-reports`; a branch with the snapshot
  rename and one with a token change turn red. That also closes QUAL-007's
  open criterion.
- 2026-10-20, first GitHub runs (main pushed with the user's authorization):
  `frontend-fast`, `frontend-browser` and `compose-smoke` green on `main`
  (run 39509582323); `kotlin` red. Added a failure-only step that turns failed
  JUnit tests and ktlint/detekt lines into public annotations (job logs need
  a login). It named `PostgresDatabaseTest` "a ready database lost after
  startup ... ready again when it returns": expected Ready, got Unavailable.
  Reproduced locally 8/8 with the test pinned to 2 CPUs: after
  `DROP DATABASE ... WITH (FORCE)` Hikari backs off, so the first check
  after `CREATE DATABASE` can still time out and the next one is Ready (probe:
  Unavailable, then Ready 29 times). The product recovers within one more
  retry interval; the test assumed exactly one check. It now requires Ready
  within 5 retry intervals (still fails if the database never returns);
  5/5 pinned runs and the Kotlin gate passed. Pre-existing since BE-007; the
  workflow had never run on GitHub before.
- Commit: completion commit for this task.
