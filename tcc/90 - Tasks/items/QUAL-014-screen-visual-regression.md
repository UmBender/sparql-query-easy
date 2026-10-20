---
id: QUAL-014
title: Compare screenshots of /styleguide and the main screens in light and dark themes
status: BACKLOG
priority: P1
type: quality
depends_on: [QUAL-007]
human_gate: false
created: 2026-10-20
updated: 2026-10-20
---
# Compare screenshots of /styleguide and the main screens in light and dark themes

## Objective

T10 visual gap. `tests/visual.e2e.ts` compares only two canvas screenshots,
light theme, labels hidden (`canvas-node-kinds-linux.png`,
`canvas-selected-linux.png`). The brief asks for `/styleguide` and the main
screens in both themes. Skill: `tcc-test` (`tcc-style` for the styleguide).

## Confirmed entry points

- `frontend/tests/visual.e2e.ts`, baselines `tests/visual.e2e.ts-snapshots/`.
- Offline mocks: `tests/support/mock-api.ts` over `src/lib/api/mock-routes.ts`
  (all snapshot routes, including study and admin).
- Routes: `/`, `/login`, `/study`, `/study/[key]`, `/admin`,
  `/admin/tasks`, `/admin/tasks/new`, `/admin/groups`, `/styleguide`.
- Update command (Operational Map): `(cd frontend && npx playwright test
  visual --update-snapshots)`.

## Scope

- One shared main-route list in `tests/support/` (also used by QUAL-015).
- Full-page screenshots of each route in light and dark, offline, with
  deterministic data (mocked API, fixed viewport, animations off, the
  bundled Inter font; dynamic text such as dates masked).
- Keep the existing canvas screenshots.
- Baselines reproducible across machines: generated in the Playwright
  container image matching `@playwright/test` 1.63.0 (or the CI runner), with
  the command documented in `frontend/README.md` and the Operational Map.

## Out of scope

- Visual redesign; changing a screen to make a screenshot stable.
- Real-stack screenshots.

## Acceptance criteria

- [ ] Every route in the list has a light and a dark baseline.
- [ ] Changing one colour token makes the run fail with a diff image
  (verified once, reverted).
- [ ] The documented update command regenerates the baselines identically on
  a second run.

## Validation

Focused: `(cd frontend && npx playwright test visual)`. Closing: the new
frontend gate.
