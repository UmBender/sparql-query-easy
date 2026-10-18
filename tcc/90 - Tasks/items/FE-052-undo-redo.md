---
id: FE-052
title: Undo and redo query graph edits from the store
status: DONE
priority: P2
type: frontend
depends_on: [FE-043]
human_gate: false
created: 2026-10-16
updated: 2026-10-17
---
# Undo and redo query graph edits from the store

## Objective

T4 undo/redo, split from FE-043 by decision D-T4b (option B, user,
2026-10-16). The legacy page has no undo, so this is new behavior, not
parity. Skill: `tcc-frontend`.

## Scope

- History of immutable `QueryGraph` snapshots in the FE-043 store, one entry
  per user edit action (domain operations), with a bounded depth (proposed
  100, recorded in the card at execution).
- Not recorded: selection, funnel step on/off previews, query results,
  endpoint change.
- History cleared on load, new query and endpoint change; a new edit after
  undo drops the redo branch.
- Store exposes `undo()`, `redo()`, `$derived` `canUndo`/`canRedo`.

Excluded: keyboard shortcuts and buttons (they land with the canvas, FE-044,
or later); persisting history.

## Acceptance criteria

- [x] After N edits, N undos restore the initial graph and N redos the final
      one (deep-equal), with `canUndo`/`canRedo` correct at each step.
- [x] Selection and funnel toggles add no history entries.
- [x] An edit after undo empties redo; history never exceeds the bound.
- [x] Load and new query clear the history.

## Validation

Focused: the store's Vitest file. Closing gate: the new frontend unit gate
from the Operational Map (as defined by FE-040/QUAL-007).

## Execution log

- 2026-10-16: Planned from the T4 brief after D-T4b = B; no code changed.
- 2026-10-17: `QueryStore` keeps `past`/`future` graph snapshots
  (`$state.raw`, immutable graphs), bound `HISTORY_LIMIT = 100`. `commit`
  records the graph before every edit and empties `future`; `undo`/`redo`
  apply snapshots through the same path (stage order and funnel steps
  follow). Not recorded: selection, funnel toggles and variable, stage order,
  limit, endpoint, node moves and layout positions. `clear` (New Query),
  `load` and an endpoint change clear the history. `$derived` `canUndo`
  and `canRedo`. Tests (`query-store-history.spec.ts`, 4): N edits → N
  undos/redos deep-equal with flags at each step; non-edits add no entry;
  edit after undo empties redo and the bound holds; load/New Query/endpoint
  clear. Validation: check, lint, server Vitest (12 store cases). Buttons and
  shortcuts land with the canvas (FE-044). Completion commit for this task.
