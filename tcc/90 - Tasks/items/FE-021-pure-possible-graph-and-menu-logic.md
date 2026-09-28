---
id: FE-021
title: Move pure possible-graph and menu decisions into checked modules
status: BACKLOG
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
`nextPredicateVariableName()`. Share one base Cytoscape node/edge style
between the main graph and `possibleGraphStyle()`. Skill: `tcc-refactor`.

## Acceptance criteria

- [ ] New DOM-free unit tests in `npm run test:query`; type check passes.
- [ ] Browser suite passes unchanged; both graphs render the same styles.
