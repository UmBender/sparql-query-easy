---
id: QUAL-014
title: Compare screenshots of /styleguide and the main screens in light and dark themes
status: DONE
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

- [x] Every route in the list has a light and a dark baseline.
- [x] Changing one colour token makes the run fail with a diff image
  (verified once, reverted).
- [x] The documented update command regenerates the baselines identically on
  a second run.

## Validation

Focused: `(cd frontend && npx playwright test visual)`. Closing: the new
frontend gate.

## Execution log

- 2026-10-20: `tests/support/screens.ts`: `MAIN_ROUTES` (`/`, `/login`,
  `/study`, `/study/fire-fast`, `/admin`, `/admin/tasks`,
  `/admin/tasks/new`, `/admin/groups`, `/admin/groups/1`, `/styleguide`),
  each with its role, a ready check, and session and study/admin data typed
  from `schema.d.ts` through `mockApi` overrides (the shared defaults in
  `mock-routes.ts` are unchanged); `useTheme` sets mode-watcher's stored
  mode before load. `tests/screens.e2e.ts`: a full-page screenshot per route
  and theme (20), offline guard kept.
- Reproducibility: text is in the picture, so the suite runs only in
  `mcr.microsoft.com/playwright:v1.63.0-noble` (version read from
  `package.json`) through `scripts/test-screens.mjs` (`npm run test:screens`,
  no container network, the repository mounted with its `node_modules`,
  SELinux label disabled for Fedora). `playwright.config.ts` ignores the
  file; `playwright.screens.config.ts` runs it. `.github/workflows/ci.yml`
  pulls the image and runs `npm run test:screens` in the `frontend` job.
  Existing canvas screenshots (`tests/visual.e2e.ts`) are unchanged.
- Acceptance: two from-scratch generations were byte-identical (20/20
  `cmp`); a second run without update passed 20/20. Token check: `primary`
  `#1565c0` → `#2e7d32` plus `npm run tokens` failed the three light editor
  screens (12 px each) with diffs in `test-results/screens/`; a one-unit
  change (`#1565c1`) passes under Playwright's default per-pixel threshold,
  kept to absorb sub-visible rasterisation noise. Both reverted.
- Reviewed the PNGs: loaded data in every screen; the dark editor canvas
  stays light by design (dark token `canvas: '#f7f9fc'`).
- Docs: Operational Map (frontend row, command, closing gates), README,
  `tcc-style` checklist; skill discovery checked.
- Validation: check, lint; `npm test` (Vitest and 84 host Playwright, screens
  excluded) passed; `test:screens` 20 passed; docs check; skill discovery.
  The CI step has not run on GitHub (no push).
- Commit: completion commit for this task.
