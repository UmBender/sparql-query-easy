---
id: FE-046
title: Run the query as ordered stages, choose values and apply them to the graph
status: DONE
priority: P1
type: frontend
depends_on: [FE-044]
human_gate: false
created: 2026-10-16
updated: 2026-10-18
---
# Run the query as ordered stages, choose values and apply them to the graph

## Objective

T5c. Skill: `tcc-frontend`. Spec: DEC-008, FE-004–FE-006, FE-008–FE-010,
FE-015, FE-017, FE-023–FE-025, BUG-003–BUG-006 and
[[../../04 - Frontend/Two Variable Exploration Contract]].

## Scope

Numbered reorderable variable chips, bounded stage requests, hover/focus
preview, possible-graph window, Assume and Apply to graph, View SPARQL.

## Fixture scenarios (QUAL-009)

`fire-speed-at-least-90`, `run-query-two-stage-apply`, `run-query-three-reordered-assume`, `value-variable-any`, `view-sparql-only`. See `fixtures/legacy/README.md` and [[../../04 - Frontend/Frontend Parity Checklist]].

## Acceptance criteria

- [x] QUAL-006 rows for exploration pass; the offline e2e scenario of
      QUAL-002 passes against the new app.

## Execution log

- 2026-10-18: `frontend/src/lib/features/exploration/`: `Exploration`
  (port of stage-exploration.js: per-signature stage cache, generation
  counters so superseded pages and previews are dropped, the budgeted preview
  scheduler, select/Back/summary, Assume returning the remaining order, Apply
  through the store), `Emphasis` (FE-023 both ways), `stage-order.svelte`
  (numbered chips, Move earlier/later with focus kept, pointer drag, live
  status), `exploration-panel.svelte`, `possible-graph.svelte` (cycle every
  3 s, labels under long names, e2e handle `possibleCy`) and
  `exploration-layer.svelte` (side by side on wide screens, the window as a
  sheet below the panel on narrow ones), `run-controls.svelte` (Run Query is
  the toolbar form's submit button, as in legacy). The editor wires Enter,
  Escape, background close, signature and order invalidation; Run Query marks
  the current signature as seen so an Assume just before does not close the
  run it starts. `vite.config.ts` proxies to `API_TARGET`;
  `playwright.stack.config.ts` + `npm run test:stack` run the new app on the
  built Ktor (18096). Tests: `tests/exploration.e2e.ts` (24) port E-01–E-07,
  P-15 and F-06; `tests-stack/ordered-exploration.e2e.ts` runs the four
  QUAL-002 scenarios against Ktor (pass). Validation: check (tests included),
  lint, `npm --prefix frontend test` (153 Vitest server, 4 component, 54
  Playwright), `npm --prefix frontend run test:stack` (4). The F-05
  suggestion test was made independent of request order after one
  intermittent failure in a full run. Completion commit for this task.
