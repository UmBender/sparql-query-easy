---
id: FE-022
title: Move graph action menus into a controller file
status: BACKLOG
priority: P2
type: refactor
depends_on: [FE-020]
human_gate: false
created: 2026-09-28
updated: 2026-09-28
---
# Move graph action menus into a controller file

## Objective

Move the node menu, edge menu, connection preview and Alt+drag code from the
`DOMContentLoaded` closure (`index2.html` ≈2375–2950) into a file exposing one
initializer that receives `cy` and owns `selectedMenuNodeId`,
`selectedMenuEdgeId`, `pendingConnection` and `predicateChoices`. Skill:
`tcc-refactor`.

## Scope

Callers that need `retargetNodeActionMenu` or position updates use the
controller's returned functions. Listener registration happens once; no menu
behavior change.

## Acceptance criteria

- [ ] `index2.html` holds markup, includes and a short bootstrap only.
- [ ] Browser suite passes unchanged, including menu keyboard/focus tests.
