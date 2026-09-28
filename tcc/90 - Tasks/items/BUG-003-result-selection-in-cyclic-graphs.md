---
id: BUG-003
title: Keep result-table selection working when the value is already in a cyclic graph
status: DONE
priority: P1
type: bug
depends_on: [FE-013]
human_gate: false
created: 2026-09-28
updated: 2026-09-28
---
# Keep result-table selection working when the value is already in a cyclic graph

## Objective

User report: in a complex graph with cycles, converting a node of the cycle
to a variable, choosing **Run query** on it and clicking some result rows
leaves the UI unresponsive. Skill: `tcc-frontend`.

## Evidence

Browser reproduction (triangle A→B→C→A, B converted to a variable):
choosing a value that is already a graph node (such as A) makes
`replaceWithNewNode` add a second element with that ID. Cytoscape throws
`Can not create second element with ID`, the handler stops before closing
the results modal, and every further click throws again. Related hazards in
the same path: an outgoing edge whose target becomes the chosen node deletes
the replacement node; a variable self-loop re-adds one edge ID twice; and a
relationship value that is already a node throws in `addNodeWithRelationship`.

## Scope

- A chosen value already in the graph reuses that node (as FE-010 Apply
  to graph does); edges move to it keeping their IDs and data.
- The replacement node itself is never removed; an edge that becomes a loop
  on it is kept and sends no relationship-value request.
- `addNodeWithRelationship` reuses an existing node and never adds a
  duplicate edge ID.
- Otherwise unchanged: other outgoing targets are still replaced through the
  relationship-value request (legacy behavior).

## Acceptance criteria

- [x] Choosing an existing node's value in a cycle closes the modal, merges
      the variable into that node and raises no page error.
- [x] A variable self-loop and an edge to the chosen node survive selection.
- [x] A relationship value already in the graph reuses its node.
- [x] Selection of a new value keeps the existing behavior; browser suite
      passes offline.

## Result

`sparql/graph-nodes.js`: `replaceWithNewNode` reuses an existing node,
moves connected edges with `edge.move`, never removes the replacement node,
and requests relationship values only for outgoing edges that do not loop on
it. `addNodeWithRelationship` reuses an existing node and picks a free edge
ID. Three browser tests (cycle merge, relationship value already present,
variable self-loop) fail on the previous code and pass now. Validation: full
browser suite (60 passed), `npm run test:query`, `npm run check:frontend-types`.

Remaining legacy behavior (unchanged by this bug fix): other outgoing
targets of the variable are removed and replaced by the chosen value's own
relationship value, which can open a cycle that passed through them.
