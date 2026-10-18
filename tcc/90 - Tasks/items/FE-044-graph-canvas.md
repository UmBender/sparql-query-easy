---
id: FE-044
title: Draw and edit the query graph on a Cytoscape canvas driven by the store
status: DONE
priority: P1
type: frontend
depends_on: [FE-041, FE-050, FE-043]
human_gate: false
created: 2026-10-16
updated: 2026-10-18
---
# Draw and edit the query graph on a Cytoscape canvas driven by the store

## Objective

T5a. Skill: `tcc-frontend`. Spec: legacy cards FE-002, FE-003, FE-007,
FE-013, FE-014, FE-016, FE-030, FE-032–FE-034, FE-037 and
[[../../04 - Frontend/Predicate Variable Edge Contract]].

## Scope

Cytoscape view rendering from the store; gestures become store actions.
Endpoint picker; add entity/variable/value/value variable/class; search nodes
by name; left-click action list; connect nodes with defined or variable
predicates; convert, remove; zoom behavior.

## Fixture scenarios (QUAL-009)

`explore-relationship-value`, `node-run-query-table`, `class-explore-values`, `predicate-variable-edge`, `upload-local-graph` (search is not captured). See `fixtures/legacy/README.md` and [[../../04 - Frontend/Frontend Parity Checklist]].

## Acceptance criteria

- [x] The QUAL-006 rows for these features pass against the new app.
- [x] Cytoscape never holds state the store lacks (test: rebuild view from store).

## Execution log

- 2026-10-18: The SvelteKit page is now the query editor
  (`frontend/src/lib/features/editor/`): app bar (View SPARQL, Demo, undo,
  redo, theme), toolbar (Auto Layout, Search nodes combobox with 400 ms
  debounce and relation discovery, Limit, endpoint combobox fed by
  `GET /api/endpoints` with free text, New Query, Add Variable, Add Value
  Variable), the Cytoscape canvas, the persistent node/edge action lists,
  connection preview, Alt+drag, legend, zoom controls, status bar with the
  API warm-up, the results sheet and the SPARQL dialog. `graph-view.ts` is
  the pure graph-to-elements mapping; the canvas reconciles Cytoscape with it
  (nodes before relations, because the Cytoscape-order graph can list a
  relation first) and writes layout positions back to the store.
  `EditorController` ports explore relationships, explore values (full
  `rdfs:domain` IRI), node Run query with row binding and refetch,
  predicate choices, Add value filter (profile seed, editor request for
  FE-045), connections, View SPARQL/Copy and search probes. Findings while
  building: Cytoscape injects `position: relative` on its container (the
  canvas needs an absolute wrapper); an effect that bumps a counter must read
  it untracked; Cytoscape rejects quoted font-family (token `font.canvas`).
  Tests: `graph-view.spec.ts` (2); `tests/editor.e2e.ts` (17) port the
  P-01–P-07, P-13, P-14, P-16 and G-01–G-12 rows with the legacy server
  defaults (`tests/support/mock-api.ts`, recording overrides) and assert
  after every test that Cytoscape equals the view rebuilt from the store.
  Parity checklist rows marked `new`. Playwright now runs one worker (parallel
  Firefox timed out) on an unminified e2e build. Validation: check, lint,
  `npm --prefix frontend test` (150 Vitest server, 4 component, 22
  Playwright). G-13 (value edits) is FE-045. Completion commit for this task.
