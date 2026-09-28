---
id: FE-020
title: Split the index2 top-level script into ordered classic files
status: DONE
priority: P1
type: refactor
depends_on: [FE-018]
human_gate: false
created: 2026-09-28
updated: 2026-09-28
---
# Split the index2 top-level script into ordered classic files

## Objective

Move top-level script (`index2.html` lines ≈820–2086) into classic
`<script src>` files split by responsibility: core/config/API/graph operations,
stage-order blocks and panel, staged exploration with the possible-graph
window, and node factory/connection/change-value helpers. Skill:
`tcc-refactor`.

## Scope

Classic scripts keep the global functions that inline `onclick` handlers and
tests (`runQuery`, `getQuery`, `seeSparqlQuery`, …) call on `window`. Keep load
order before the `DOMContentLoaded` script. Package each file in
`build.gradle.kts` and assert it in `StaticFrontendRoutesTest`. No behavior,
naming or logic change; `DOMContentLoaded` stays inline in this slice.

## Acceptance criteria

- [x] Browser suite and `npm run test:query` pass unchanged.
- [x] Each new file is served by Ktor with a JavaScript content type.
- [x] No moved file exceeds about 500 lines.

## Execution log

- 2026-09-28: Moved `index2.html` lines 335–1598 unchanged into
  `app-core.js` (466 lines), `stage-order.js` (154), `stage-exploration.js`
  (469) and `graph-nodes.js` (190), each `'use strict'`, loaded in that order
  after the module bridge. Only indentation changed outside template literals,
  and all 46 template literals are byte-identical (scripted check). Packaged
  in `build.gradle.kts`; `StaticFrontendRoutesTest` checks each script's
  JavaScript content type and include, and reads API flow strings from the
  page plus scripts. Updated Operational Map, Frontend Architecture and the
  `tcc-frontend` skill. `index2.html`: 2,514 → 1,256 lines.
  Validation: `npm run test:browser` 53/53, `npm run test:e2e` 3/3 (built
  Ktor distribution), `./gradlew ktlintCheck detekt test` passed.
