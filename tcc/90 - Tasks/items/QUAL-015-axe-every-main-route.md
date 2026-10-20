---
id: QUAL-015
title: Run axe on every main route in both themes
status: DONE
priority: P1
type: quality
depends_on: [QUAL-007, QUAL-014]
human_gate: false
created: 2026-10-20
updated: 2026-10-20
---
# Run axe on every main route in both themes

## Objective

T10 accessibility gap. axe runs today on `/styleguide` and `/` (offline) and
on `/study`, the questionnaire and `/admin` (real stack). `/login`,
`/study/[key]` and the admin task and group screens are unchecked. Skill:
`tcc-test`.

## Confirmed entry points

- `frontend/tests/styleguide.e2e.ts`, `tests/visual.e2e.ts` (axe,
  violation summary), `tests-stack/study-participant.e2e.ts`,
  `study-questionnaires.e2e.ts`.
- The shared main-route list from QUAL-014.

## Scope

- One offline spec that runs axe on every route in the list, light and
  dark, with the same failure rule and the existing tooltip exclusion.
- Failure rule: any violation fails, whatever its impact (DEC-016 Q3 A).
- Fix violations found, following `tcc-style` and the tokens.

## Out of scope

- Manual screen-reader testing; contrast redesign beyond what axe reports.

## Acceptance criteria

- [x] Each route in the list is analysed in both themes and passes.
- [x] Removing an accessible name from one control fails the run naming the
  rule and route (verified once, reverted).

## Validation

Focused: `(cd frontend && npx playwright test a11y)`.
Closing: the new frontend gate.

## Execution log

- 2026-10-20: `frontend/tests/a11y.e2e.ts`: axe on each of the 10 routes in
  `MAIN_ROUTES` (QUAL-014) in light and dark (20 tests), with the same
  session, typed data and theme setup as the screenshots, the theme asserted
  on `<html>` before analysing, the Bits tooltip exclusion kept, and any
  violation failing (DEC-016 Q3 A). The failure lists rule id, impact and
  targets under the route and theme.
- All 20 passed on the first run: `/login`, `/study/[key]` and the admin
  task and group screens needed no fix.
- Negative check: the editor's Zoom in `IconButton` replaced by an unnamed
  `<button>` failed `/ (light)` with `button-name` (critical,
  `#zoom-controls > button…`); reverted.
- The existing axe checks (`styleguide.e2e.ts`, `visual.e2e.ts` with the
  funnel panel open, the two stack specs) stay.
- Validation: check, lint, `npm test` (Vitest, then 104 Playwright passed).
- Commit: completion commit for this task.
