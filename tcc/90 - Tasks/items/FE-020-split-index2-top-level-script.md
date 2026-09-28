---
id: FE-020
title: Split the index2 top-level script into ordered classic files
status: BACKLOG
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

- [ ] Browser suite and `npm run test:query` pass unchanged.
- [ ] Each new file is served by Ktor with a JavaScript content type.
- [ ] No moved file exceeds about 500 lines.
