---
id: FE-032
title: Decide graph element kinds in one checked module
status: DONE
priority: P1
type: refactor
depends_on: [QUAL-005]
human_gate: false
created: 2026-10-09
updated: 2026-10-14
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

## Result

- 2026-10-14: `sparql/graph-model.js` owns `nodeKind` (`iri`, `literal`,
  `class`, `variable`, `many`, `unknown`, plus `isLink`, `legacyFilter` for
  imported `label-filter` nodes and `filterType`), `nodeColor`, `nodeShape`,
  the variable predicates (`isVariableNode`, `isEditableValue`,
  `isVariableEdge`, `isVariableName`, `hasVariableMark`) and the node data
  writers (`nodeDataForTerm`, `nodeDataForResult`, `nodeDataForRelationValue`,
  `variableNodeData`, `iriNodeData`, `emptyValueNodeData`,
  `convertedVariableData`). `termGraphValue` moved here and is re-exported by
  `query-stages.js`. Stored field values are unchanged.
- `rg` check: outside `graph-model.js`, the remaining `type` comparisons in
  `sparql/` are RDF term types (`term.type`), API `propertyType`, edge writes
  of `type: 'variable'` and `relationLabelKind`; no `?`-prefix or `data('type')`
  node-kind test remains.
- The legacy `?`-anywhere test (`hasVariableMark`) is kept as is (QUAL-005
  records it as a known limitation).
- Validation: `npm run test:query` (52 pass), `npm run check:frontend-types`
  (clean), `npm run test:browser` (113 pass, QUAL-005 table unchanged),
  Gradle `test` (pass), `installDist` with an HTTP smoke of `/graph-model.js`,
  `/graph-actions.js` and `/index2.html` (200).
