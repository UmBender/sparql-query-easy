---
id: FE-016
title: Show the Remove relation action in red
status: DONE
priority: P2
type: frontend
depends_on: [FE-013]
human_gate: false
created: 2026-09-28
updated: 2026-09-28
---
# Show the Remove relation action in red

## Objective

Mark the destructive **Remove relation** edge action like the node menu's
**Remove**: red text (`#c62828`). Other edge actions keep the neutral color.

## Acceptance criteria

- [x] Remove relation text is red; Convert relation to variable is not.
- [x] Browser suite passes offline.

## Execution log

- 2026-09-28: Created at user request and implemented. Edge actions accept
  the node menu's `danger` flag; `.edge-action-menu-button.danger` shares the
  existing red rule. The FE-013 browser test now asserts both colors.
  Validation: browser suite 49/49 offline and `git diff --check`.
