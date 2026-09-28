---
id: FE-008
title: Build a stable registry of query variables and stages
status: BACKLOG
priority: P1
type: frontend
depends_on: [DEV-002, DEC-008, FE-004]
human_gate: false
created: 2026-09-27
updated: 2026-09-27
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

DEV-002, DEC-008 and FE-004 review completion.

## Acceptance criteria

- [ ] Registry follows the approved node/predicate/repeated-variable matrix.
- [ ] IDs/order remain stable across redraw and invalidate safely on edits.
- [ ] Two or more variables use stages; zero/one behavior and parallel-edge
      guard remain unchanged.
- [ ] Relevant offline browser tests pass without live services.

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
