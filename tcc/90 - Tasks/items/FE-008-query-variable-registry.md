---
id: FE-008
title: Build a stable registry of query variables and stages
status: DONE
priority: P1
type: frontend
depends_on: [DEV-001, DEC-008, FE-004]
human_gate: false
created: 2026-09-27
updated: 2026-09-28
---
# Build a stable registry of query variables and stages

## Objective

Identify each distinct query variable by stable graph identity and derive a
user-orderable stage model independently of Cytoscape traversal order.

## Evidence and relevant files

`sparql/index2.html` (`getQueryVariables`, `runQuery`, `buildFilters`,
`extractVariableName`); `frontend-tests/index2.spec.mjs`;
[[../../04 - Frontend/Two Variable Exploration Contract]].

## Exact scope

Implement the DEC-008-supported variable positions and repeated-name rules,
stable IDs, original order and order reconciliation after node/edge add,
remove, rename, load, endpoint change and New Query. Preserve the existing
parallel-predicate rejection and zero/one-variable behavior. Add pure-state
and offline browser tests; do not issue new API requests.

## Explicitly out of scope

Visual reorder controls, candidate fetch, backend requests, binding or result
rendering.

## Dependencies

DEV-001, DEC-008 and FE-004 review completion.

## Acceptance criteria

- [x] Registry follows the approved node/predicate/repeated-variable matrix.
- [x] IDs/order remain stable across redraw and invalidate safely on edits.
- [x] Two or more variables use stages; zero/one behavior and parallel-edge
      guard remain unchanged.
- [x] Relevant offline browser tests pass without live services.

## Verification commands

```sh
npm run test:browser
git diff --check
```

## Expected documentation updates

[[../../04 - Frontend/Frontend Architecture]];
[[../../04 - Frontend/Two Variable Exploration Contract]].

## Risks

Text labels or traversal order are not stable identities. Stale stage state
after graph edits could preview a different query than the graph shows.

## Execution log

- 2026-09-27: Planned only; no frontend behavior changed.
- 2026-09-28: Implemented. `sparql/query-stages.js` (packaged, type-checked)
  derives the sorted registry (one entry per name, node and edge IDs kept),
  a label/position-insensitive exploration signature and block moves.
  `index2.html` keeps session-only order state, refreshed on Cytoscape
  add/remove/data, endpoint edits and Turtle upload; the order resets only
  when the signature changes. Run Query opens the panel for two or more
  variables in that order; zero/one-variable and parallel-edge behavior are
  unchanged. Stage-request and preview helpers drafted in the same session
  were left out as FE-005/FE-006 scope. Validation: `npm run test:query`
  (7), `check:frontend-types`, browser suite 25/25 offline, Kotlin
  `ktlintCheck detekt test installDist`, and a built-distribution smoke of
  `/query-stages.js` (200, `text/javascript`).
