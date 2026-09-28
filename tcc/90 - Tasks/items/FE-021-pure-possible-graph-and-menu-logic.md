---
id: FE-021
title: Move pure possible-graph and menu decisions into checked modules
status: DONE
priority: P2
type: refactor
depends_on: [FE-020]
human_gate: false
created: 2026-09-28
updated: 2026-09-28
---
# Move pure possible-graph and menu decisions into checked modules

## Objective

Move data decisions out of DOM/timer code into checked modules with unit
tests: the assignment/caption part of `possibleGraphState()` (timer stays in
the caller), `nodeActions()`/`edgeActions()` item lists, and
`nextPredicateVariableName()`. Skill: `tcc-refactor`. A shared base
Cytoscape style was dropped: the two graphs' styles differ by design (see the
execution log).

## Acceptance criteria

- [x] New DOM-free unit tests in `npm run test:query`; type check passes.
- [x] Browser suite passes unchanged.

## Execution log

- 2026-09-28: Added checked module `sparql/graph-actions.js` (`nodeActions`,
  `edgeActions`, `nextPredicateVariableName`) and `possibleGraphView` in
  `query-stages.js`. The page keeps thin adapters: Cytoscape reads, the
  sequence counter and the cycle timer. The timer still restarts at the first
  value when the hovered option changes. Bridged `window.graphActions`,
  packaged it, added it to `tsconfig.frontend.json`, `npm run test:query` and
  `StaticFrontendRoutesTest`. Checked the audit's shared-style idea: the main
  graph (120 px, `getNodeColor`, HTML labels) and possible graph (60 px, state
  classes) share only edge color/arrow, so it was dropped and the audit was
  corrected. Validation: `npm run test:query` 24/24 (8 new),
  `npm run check:frontend-types`, `npm run test:browser` 53/53,
  `npm run test:e2e` 3/3, `./gradlew ktlintCheck detekt test` passed.
