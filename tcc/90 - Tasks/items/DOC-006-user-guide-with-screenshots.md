---
id: DOC-006
title: Add an in-app /help page with screenshots one command can regenerate
status: BACKLOG
priority: P2
type: frontend
depends_on: [DEC-018, FE-054]
human_gate: false
created: 2026-10-20
updated: 2026-10-20
---
# Add an in-app /help page with screenshots one command can regenerate

## Objective

T12 ("update user guide screenshots"). No user guide exists. DEC-018 Q4 C:
the guide is a route of the SvelteKit app, so participants find it where
they work. Skills: `tcc-frontend`, `tcc-style`; `tcc-test` for the capture
script.

## Scope

- Route `frontend/src/routes/help/+page.svelte`, public (no session), linked
  from the editor toolbar and the app layout; built from the base components
  and tokens (FE-050), both themes.
- Sections: endpoint picker, node kinds (entity, variable, value, value
  variable, class), edges, filters and the filter editor, Run Query stages and
  Apply, the funnel and badges, View SPARQL, upload/load/export, search, auto
  layout, the tour (with a "start the tour" link), login and the study pages.
- One worked example on PokemonGen1 (Fire Pokémon with speed ≥ 90, matching
  `fixtures/legacy/fire-speed-at-least-90.*`).
- Screenshots in `frontend/static/help/`, written by one proposed script
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

- [ ] `/help` loads without a session and every feature group in the T12
  brief has a section.
- [ ] The toolbar link opens `/help`; the tour link on `/help` starts the tour
  on `/`.
- [ ] Every help image is written by the script; re-running it on an
  unchanged app changes no page text, and it makes no external request
  (`tests/support/offline.ts`).
- [ ] axe passes on `/help` in light and dark themes.

## Validation

Focused: a `help.e2e.ts` Playwright spec. Closing: the new frontend gate and
`test:screens` from the Operational Map (new page).
