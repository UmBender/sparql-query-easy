---
id: FE-032
title: Decide graph element kinds in one checked module
status: BACKLOG
priority: P1
type: refactor
depends_on: [QUAL-005]
human_gate: false
created: 2026-10-09
updated: 2026-10-09
---
# Decide graph element kinds in one checked module

## Objective

Make what a node or edge *is* a single decision instead of about 85 local
checks (FE-031). Behavior-preserving. Skill: `tcc-refactor`.

## Scope

- New checked module `sparql/graph-model.js` (added to
  `tsconfig.frontend.json`, the `index2.html` bridge, `build.gradle.kts`
  includes and `StaticFrontendRoutesTest`):
  - `elementKind(data)` returns `iri`, `literal`, `class`, `variable` or
    `many`, plus `isLink` and the filter, from today's stored fields
    (`type`, `color`, `isLink`, `?` IDs, edge `filterType`).
  - `nodeDataForTerm(term, label)` writes node data from an `RdfTerm`
    (`query-stages.js`). It replaces the hand-written
    `type: 'node' | 'label'` choices in `graph-nodes.js`,
    `stage-exploration.js` and `app-core.js`.
  - Edge kind keeps using `relationLabelKind` (`query-calculations.js`).
- Callers in `graph-menus.js`, `graph-nodes.js`, `graph-actions.js`,
  `app-core.js`, `stage-exploration.js`, `query-stages.js` and
  `getNodeColor` use these functions.
- The stored field values do not change, so imported graphs, tests and
  request payloads stay the same.
- Exclusions: no new kind, no behavior change, no change to which actions
  each kind offers.

## Acceptance criteria

- Outside `graph-model.js`, no code compares `data('type')`/`data.type` or
  tests a `?` prefix to decide a node's kind (`rg` check recorded here).
- Unit tests cover every kind and the term → data mapping.
- QUAL-005 table and the full browser suite pass unchanged.

## Validation

`npm run test:query`, `npm run check:frontend-types`, `npm run test:browser`,
Gradle `test` for packaging. Rollback: revert the commit.
