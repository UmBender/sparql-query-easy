---
id: DOC-006
title: Write a user guide for the SvelteKit app with screenshots one command can regenerate
status: BACKLOG
priority: P2
type: documentation
depends_on: [DEC-018, FE-054]
human_gate: false
created: 2026-10-20
updated: 2026-10-20
---
# Write a user guide for the SvelteKit app with screenshots one command can regenerate

## Objective

T12 ("update user guide screenshots"). No user guide exists: the README is
for developers and the vault is the thesis knowledge base. Participants and
the university IT need one page that shows how to draw and run a query.
Skill: `tcc-plan-task` (documentation) with `tcc-test` for the capture script.

## Scope (assumes DEC-018 Q4 A; adjust to the answer)

- `docs/user-guide.md` (proposed path), linked from the README: endpoint
  picker, node kinds (entity, variable, value, value variable, class), edges,
  filters and the filter editor, Run Query stages and Apply, the funnel and
  badges, View SPARQL, upload/load/export, search, auto layout, the tour,
  login and the study pages.
- One worked example on PokemonGen1 (e.g. Fire Pokémon with speed ≥ 90,
  matching `fixtures/legacy/fire-speed-at-least-90.*`).
- Screenshots in `docs/user-guide/img/`, produced by one proposed script
  (`npm --prefix frontend run docs:screens`) that drives the app through the
  Playwright page objects (QUAL-013) on mocked API data, offline, light theme.

## Out of scope

- An in-app help route (Q4 C), translations, video.
- Visual regression: screenshots here are illustrations, not test baselines.

## Acceptance criteria

- [ ] Every legacy feature group in the T12 brief has a section in the guide.
- [ ] Every image in the guide is written by the script; re-running it on an
  unchanged app changes no section text.
- [ ] The script makes no external request (`tests/support/offline.ts`).

## Validation

Docs gate (`node scripts/check-project-docs.mjs`, `git diff --check`); the
script run once; the new frontend gate if files under `frontend/` change.
