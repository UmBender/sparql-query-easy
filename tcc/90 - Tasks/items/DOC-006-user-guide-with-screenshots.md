---
id: DOC-006
title: Add an in-app /help page with screenshots one command can regenerate
status: DONE
priority: P2
type: frontend
depends_on: [DEC-018, FE-054]
human_gate: false
created: 2026-10-20
updated: 2026-10-21
---
# Add an in-app /help page with screenshots one command can regenerate

## Objective

T12 ("update user guide screenshots"). No user guide exists. DEC-018 Q4 C:
the guide is a route of the SvelteKit app, so participants find it where
they work. Skills: `tcc-frontend`, `tcc-style`; `tcc-test` for the capture
script.

## Scope

- Route `frontend/src/routes/help/+page.svelte`, public (no session), linked
  from the editor toolbar; built from the base components
  and tokens (FE-050), both themes.
- Sections: endpoint picker, node kinds (entity, variable, value, value
  variable, class), edges, filters and the filter editor, Run Query stages and
  Apply, the funnel and badges, View SPARQL, upload/load/export, search, auto
  layout, the tour (with a "start the tour" link), login and the study pages.
- One worked example on PokemonGen1 (Fire Pokémon with speed ≥ 90, matching
  `fixtures/legacy/fire-speed-at-least-90.*`).
- Screenshots in `frontend/static/help-images/`, written by one proposed script
  (`npm --prefix frontend run help:screens`) that drives the editor through
  the Playwright page objects (QUAL-013) on mocked API data, offline, light
  theme. Images have alt text.
- `/help` joins `MAIN_ROUTES` in `tests/support/screens.ts`, so QUAL-014
  screenshots and QUAL-015 axe cover it in both themes.
- Update [[../../04 - Frontend/Frontend Architecture]] (routes) and link
  `/help` from the README (DOC-007).

## Out of scope

- A Markdown guide in the repo or vault (Q4 A/B), translations, video.
- Treating the help images as visual-regression baselines.

## Acceptance criteria

- [x] `/help` loads without a session and every feature group in the T12
  brief has a section.
- [x] The toolbar link opens `/help`; the tour link on `/help` starts the tour
  on `/`.
- [x] Every help image is written by the script; re-running it on an
  unchanged app changes no page text, and it makes no external request
  (`tests/support/offline.ts`).
- [x] axe passes on `/help` in light and dark themes.

## Validation

Focused: a `help.e2e.ts` Playwright spec. Closing: the new frontend gate and
`test:screens` from the Operational Map (new page).

## Execution log

- 2026-10-21: `src/routes/help/+page.svelte`: public `/help` with 11 sections
  (getting started, worked example, node kinds with token swatches,
  relations and action list, filters, Run Query, funnel and badges, View
  SPARQL, files, search/layout/undo, accounts and the study), a contents nav,
  "Start the tour" (`forget(TOUR_KEY)` in `seen.ts`, then `/`) and "Back to
  the editor". Menu and stage wording checked against `graph-actions.ts` and
  `exploration-panel.svelte`. Linked from the editor toolbar (`#help-link`,
  so also on the task and admin task editors) and as the tour's last step;
  the other pages already lead back to the editor, so no separate layout
  link was added.
- Images: `frontend/static/help-images/` (not `static/help/`, so the built
  site has no `help/` directory where the `/help` route is served), written
  by `npm run help:screens` (`tests-help/help-images.capture.ts`,
  `playwright.help.config.ts`, run by `scripts/test-screens.mjs` in the
  pinned image via a new `--config=` override). The example loads
  `src/lib/domain/fixtures/fire-speed-at-least-90.query.json` in a triangle
  layout; counts and stage candidates are the captured
  `fixtures/legacy/fire-speed-at-least-90` answers, speeds from
  `pokemon_gen1.ttl` (12 Fire, 42 with speed ≥ 90 of 151, 7 both). The
  capture waits for the debounced text-suggestion answer: a first version
  caught a transient "Looking for matching values…" line. Three runs were
  byte-identical.
- Tests: `tests/help.e2e.ts` (anonymous load, section headings and contents
  links, six images with alt text and 1280 px natural width, toolbar link and
  back, Start the tour); `/help` added to `MAIN_ROUTES`, so QUAL-014
  screenshots and QUAL-015 axe cover it in both themes.
- Docs: Frontend Architecture (route), Operational Map (`help:screens` row,
  not a gate), frontend README, README (run step), parity checklist P-12
  (13 tour steps incl. Help).
- Validation: `check` 0 errors, `lint`; `npm test` (240 server, 25
  component, 115 Playwright, exit 0); after the image move, `playwright test
  help a11y -g help` 5 passed; `test:screens`: the six editor screens
  changed (Help link in the app bar) and `/help` had no baseline; both
  reviewed and refreshed; final run 22 passed. No Caddy or Compose file
  changed, so `test:compose` was not run.
