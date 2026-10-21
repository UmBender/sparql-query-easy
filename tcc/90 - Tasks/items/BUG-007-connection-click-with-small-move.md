---
id: BUG-007
title: A click that moves a little still ends a pending connection
status: DONE
priority: P1
type: bug
depends_on: []
human_gate: false
created: 2026-10-21
updated: 2026-10-21
---
# A click that moves a little still ends a pending connection

## Objective

While a connection (Connect with variable or defined predicate) is pending,
an ordinary hand click on the destination node often moved the pointer a few
pixels between press and release. Cytoscape then treated it as a drag: the
destination node moved and no `tap` fired, so the edge was not added and the
preview stayed. Skill: `tcc-frontend`.

## Evidence

`graph-canvas.svelte` completed a connection only from `tap` on a node
(`controller.tapNode`), and Cytoscape suppresses `tap` once the pointer moves
past its tap threshold; nodes stayed grabbable during the connection.

## Scope and acceptance

- During a pending connection nodes cannot be grabbed (`autoungrabify`), so
  the destination never moves; outside a connection nodes drag as before.
- Release over the node that was pressed completes the connection even
  without a `tap`; a following `tap` does not open that node's action list.
- Browser test "G-07 a click that moves a little still ends the connection and
  never drags the destination (BUG-007)" (0, 8 and 25 px moves; fails without
  the fix).

## Conclusion

- `graph-canvas.svelte`: `tapstart`/`tapend` on nodes complete the connection
  on release over the pressed node; an `$effect` toggles `autoungrabify` with
  `controller.connection`.
- Commands: `npm --prefix frontend run check`, `run lint`, `test`
  (Vitest 240 + 25 component, Playwright 116 pass); the new test failed
  against the previous `graph-canvas.svelte`.
- Limitation: pressing on one node and releasing on another does not connect
  (unchanged: a connection targets the clicked node).
