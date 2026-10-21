---
id: FE-054
title: Rewrite the guided tour for the current editor's features
status: DONE
priority: P2
type: frontend
depends_on: [DEC-018, FE-048]
human_gate: false
created: 2026-10-20
updated: 2026-10-21
---
# Rewrite the guided tour for the current editor's features

## Objective

T12 ("update the demo tour text"). The tour in
`frontend/src/lib/features/utilities/tour-steps.ts` is a port of the legacy
Intro.js texts (FE-048, parity row P-12): nine steps that cover search, max
results, endpoint, upload, auto layout, add variable, Run Query, the canvas
and the legacy demo video. It says nothing about filters, the funnel, staged
Run Query, View SPARQL or export/load. Skills: `tcc-frontend`, `tcc-style`.

## Scope (DEC-018 Q5 A)

- New `TOUR_STEPS` texts in the same `{ target, text }` shape, each target an
  existing element id of the editor: keep search, endpoint, upload, add
  variable, Run Query and canvas; add value variable / filter, funnel panel,
  View SPARQL and export/load.
- Remove the `#demo-link` step and the toolbar link to
  `youtu.be/6vh7bccR-Ow` (it shows the legacy UI).
- Keep P-12 behavior: tour on the first visit only, hint after the first
  node (`seen.ts` keys unchanged).
- Update the P-12 row of [[../../04 - Frontend/Frontend Parity Checklist]]
  (intended difference: new texts) and the screens snapshots if the toolbar
  changes.

## Out of scope

- A new demo video; tour library or styling changes; the `/help` page (DOC-006).

## Acceptance criteria

- [x] Every tour step points at an element that exists on `/` (a test walks
  all steps and fails on a missing target).
- [x] The tour mentions filters, the funnel, staged Run Query and View SPARQL.
- [x] P-12 still holds: tour once on the first visit, not on reload.
- [x] No link to the legacy demo video remains in `frontend/src`.

## Validation

Focused: `(cd frontend && npx playwright test utilities)`. Closing: the new
frontend gate and `test:screens` (toolbar change) from the Operational Map.

## Execution log

- 2026-10-21: `tour-steps.ts` has 12 steps: endpoint, search, add variable,
  add value variable (filter kinds), canvas, filter funnel (steps, badges),
  Run Query (numbered stage order, apply), View SPARQL, Export/Upload Query,
  Upload Triples, Limit, Auto Layout. The `#demo-link` step and the toolbar
  Demo link to `youtu.be/6vh7bccR-Ow` are removed. New ids as tour targets:
  `#add-value-variable-btn`, `#view-sparql-btn`, `#export-query-btn`,
  `#load-query-btn`. `seen.ts` keys unchanged.
- Tests: `tour-steps.spec.ts` (features named, unique `#id` targets, no
  video step); `utilities.e2e.ts` P-12 now walks every step, checks its text
  and that its target is visible, then Back/Done and no tour after reload.
  Parity checklist P-12 records the intended difference.
- Validation: focused `vitest run src/lib/features/utilities` (8) and
  `playwright test utilities` (7); closing gate `check` (0 errors), `lint`,
  `npm test` (240 server, 25 component, 110 Playwright); `test:screens`
  failed on the three screens with the editor app bar (`/`,
  `/study/fire-fast`, `/admin/tasks/new`, both themes) because the Demo
  button left; the diff showed only the app-bar buttons shifting; refreshed
  and re-run: 20 passed. The component run logs a Vite proxy
  `ECONNREFUSED` for `/api/query/count` (no Ktor in that run; tests pass,
  unrelated to this change).
