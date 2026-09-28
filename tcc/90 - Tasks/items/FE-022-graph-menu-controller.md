---
id: FE-022
title: Move graph action menus into a controller file
status: DONE
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

- [x] `index2.html` holds markup, includes and a short bootstrap only.
- [x] Browser suite passes unchanged, including menu keyboard/focus tests.

## Execution log

- 2026-09-28: Moved the node/edge menus, connection preview, Alt+drag, the
  menu tap/position/remove listeners and the two value-edit helpers the node
  menu calls into `initGraphMenus()` in the classic script
  `sparql/graph-menus.js` (582 lines). Code moved unchanged apart from indentation.
  The bootstrap calls it once after creating `cy`. It uses the returned
  `cancelConnection`, `hasPendingConnection` and `positionMenusAfterLayout`
  for Escape and window resize. `nodeActionMenuController` keeps
  `close`/`retarget` for the other scripts. `index2.html`: 1,231 → 672 lines
  (markup, includes and bootstrap). Packaged the file and added it to the
  static route test. Validation: `npm run test:browser` 53/53,
  `npm run test:e2e` 3/3, `./gradlew ktlintCheck detekt test installDist`
  passed. The built distribution served all new scripts as `text/javascript`
  and `index2.css` as `text/css`.
- Limitation: `graph-menus.js` is slightly above the ~500-line target; the
  node and edge menus share selection/connection state, so splitting them
  further was not done in this slice.
