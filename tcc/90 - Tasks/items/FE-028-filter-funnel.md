---
id: FE-028
title: Visualize how each filter narrows the result as a funnel
status: DONE
priority: P1
type: frontend
depends_on: [BE-003]
human_gate: false
created: 2026-10-07
updated: 2026-10-07
---
# Visualize how each filter narrows the result as a funnel

## Objective

One of four competing numeric-filter visualizations requested on 2026-10-07.
Implement on its own branch `FE-028-filter-funnel` from `main` after BE-003; the
user tests the branches and chooses which one is merged (DEC-010). Do not
merge into `main`. Skill: `tcc-frontend`.

## Scope

A panel listing the query's filters in order with the remaining count after each step (e.g. 151 → 72 → 34 → 9) and a toggle per step to see its effect without deleting it. Use the BE-003 profile (`fetchNumericProfile`) and filter labels.

## Acceptance criteria

- [x] Counts per step come from bounded requests; toggling a step changes later counts only; disabled steps are not sent by Run Query until re-enabled (or the toggle is preview-only, as decided in the card).
- [x] Offline browser tests with a mocked profile; browser gate passes.
- [x] Works on a narrow viewport; keyboard reachable.

## Execution log

- 2026-10-07: Created; BE-003 provides the profile and labels.
- 2026-10-07: Implemented on branch `FE-028-filter-funnel`. Decision: toggles
  are preview-only (Run Query and View SPARQL always send every filter), stated
  in the panel. Counts come from a new additive `POST /api/query/count`
  (`ResultCountService`, `CountQuery`: `COUNT(DISTINCT ?var)`, no LIMIT, no
  rdf:type requirement) instead of the BE-003 profile, because the profile
  counts value pairs of one numeric relation while the funnel needs distinct
  results of the query variable after IRI and numeric filters alike. Steps are
  fixed-predicate relations to an IRI/literal; the base row relaxes every step
  to "any value"; MAX/MIN are listed as ordering only. Bounded: at most 8 counted
  steps, one request at a time, cache by request body, 350 ms debounce, aborted
  when superseded. Labels reuse the graph's readable filter labels (`≥ 90`).
  Pure plan in `query-calculations.js` (`filterFunnelPlan`, `funnelStepCounts`),
  panel in `sparql/filter-funnel.js`. Documented in API v1, Request Flows and
  Current Contracts.
- 2026-10-07: Resumed after a crash before commit; fixed detekt (ReturnCount in
  `ResultCountService`, long line in `StaticFrontendRoutesTest`). Validation:
  `./gradlew ktlintCheck detekt test` passed (incl. `ResultCountRoutesTest` on
  PokemonGen1, OpenAPI inventory); `npm run test:query` 33 passed;
  `npm run check:frontend-types` passed; `npm run test:browser` 75 passed
  (7 funnel cases with a mocked count route: cumulative counts, preview toggle
  vs Run Query, error/retry, empty query and debounce, abort, keyboard/Escape,
  step cap and 360 px viewport). Not merged into `main` (DEC-010).
