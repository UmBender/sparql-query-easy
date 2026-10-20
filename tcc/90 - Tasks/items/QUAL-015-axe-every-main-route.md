---
id: QUAL-015
title: Run axe on every main route in both themes
status: BACKLOG
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
- Failure rule: any violation fails (current rule), unless DEC-016 Q3
  chooses serious/critical only.
- Fix violations found, following `tcc-style` and the tokens.

## Out of scope

- Manual screen-reader testing; contrast redesign beyond what axe reports.

## Acceptance criteria

- [ ] Each route in the list is analysed in both themes and passes.
- [ ] Removing an accessible name from one control fails the run naming the
  rule and route (verified once, reverted).

## Validation

Focused: `(cd frontend && npx playwright test a11y)` (proposed spec name).
Closing: the new frontend gate.
