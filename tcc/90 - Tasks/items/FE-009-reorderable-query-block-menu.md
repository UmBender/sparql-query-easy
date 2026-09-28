---
id: FE-009
title: Add numbered Scratch-like reorderable query blocks
status: BACKLOG
priority: P1
type: frontend
depends_on: [DEV-002, FE-008]
human_gate: false
created: 2026-09-27
updated: 2026-09-27
---
# Add numbered Scratch-like reorderable query blocks

## Objective

Place a variable-order menu next to Run Query and let users change the stage
order before exploration, using a block-list appearance inspired by Scratch.

## Evidence and relevant files

`sparql/index2.html` (Run Query at `#run-query-btn`, existing
`#two-variable-panel`); `sparql/grafos.css`; `frontend-tests/index2.spec.mjs`.

## Exact scope

Show numbered variable blocks from FE-008 for 2+ supported variables. Provide
pointer drag/reorder and equivalent keyboard buttons or shortcuts, visible
focus, screen-reader names, and a clear current order. Never use dragging as
the only control. Reorder must update stage state and invalidate downstream
previews without mutating graph topology. Test 2 and 3+ variables, repeated
names, and one-variable/no-variable behavior offline.

## Explicitly out of scope

New API calls, candidate results, modifying Cytoscape edge/node positions,
or importing Scratch runtime/assets.

## Dependencies

DEV-002 and FE-008.

## Acceptance criteria

- [ ] Menu is adjacent to Run Query and visually numbered as blocks.
- [ ] Pointer and keyboard reordering produce the same stage order.
- [ ] Run Query reads that order; no candidate request occurs in this slice.
- [ ] Focus and announcements remain usable at narrow viewport widths.
- [ ] Offline browser tests cover the reorder interaction and regressions.

## Verification commands

```sh
npm run test:browser
git diff --check
```

## Expected documentation updates

[[../../04 - Frontend/Frontend Architecture]];
[[../../04 - Frontend/Two Variable Exploration Contract]].

## Risks

Native HTML drag/drop may not support touch or keyboard; controls must not
depend on it alone. Avoid stealing Cytoscape drag events.

## Execution log

- 2026-09-27: Planned only; visual details await DEC-008 and new workflow.
