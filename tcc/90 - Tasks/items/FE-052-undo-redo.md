---
id: FE-052
title: Undo and redo query graph edits from the store
status: BACKLOG
priority: P2
type: frontend
depends_on: [FE-043]
human_gate: false
created: 2026-10-16
updated: 2026-10-16
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

- [ ] After N edits, N undos restore the initial graph and N redos the final
      one (deep-equal), with `canUndo`/`canRedo` correct at each step.
- [ ] Selection and funnel toggles add no history entries.
- [ ] An edit after undo empties redo; history never exceeds the bound.
- [ ] Load and new query clear the history.

## Validation

Focused: the store's Vitest file. Closing gate: the new frontend unit gate
from the Operational Map (as defined by FE-040/QUAL-007).

## Execution log

- 2026-10-16: Planned from the T4 brief after D-T4b = B; no code changed.
