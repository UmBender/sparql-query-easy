---
id: FE-013
title: Render variable relations consistently and allow removing a relation
status: DONE
priority: P1
type: frontend
depends_on: [FE-003]
human_gate: false
created: 2026-09-28
updated: 2026-09-28
---
# Render variable relations consistently and allow removing a relation

## Objective

A variable relation (predicate variable) sometimes shows the green box and
sometimes only a blue `?`. It must always show the green box. Users also
need an edge-menu action that removes one relation between two nodes.

## Evidence

Skill: tcc-frontend. `sparql/index2.html`: the edge `htmlLabel` template
chose the green `edge-label-variable` class only from stored `data.type`.
`rewireEdges` (Convert to variable) and `replaceWithNewNode` (result-table
replacement) re-created edges with only `id/source/target/label/nodeId`,
dropping `type`. The variable `?` label then rendered with the blue
`edge-label` class. Edges created with a variable `nodeId` but no `type` had
the same result. Contract: [[../../04 - Frontend/Predicate Variable Edge Contract]].

## Scope

- Derive the relation label style from the predicate: a whole valid variable
  `nodeId`, or a missing `nodeId` (the query uses a fallback variable),
  renders green; `filter` keeps its style; a fixed predicate keeps the plain
  label.
- Preserve all edge data when rewiring edges during node replacement or
  conversion.
- Add **Remove relation** to the edge action list for every edge. It removes
  only that edge; both nodes and all other edges remain.

## Out of scope

Changing query semantics, predicate variable naming, the node Remove action,
or the Alt+drag edge shape.

## Acceptance criteria

- [x] Every variable relation renders the green box regardless of how it was
      created or rewired; fixed and filter relations keep their styles.
- [x] Rewiring keeps edge data such as `type` and `filterType`.
- [x] Remove relation removes only the chosen edge, closes the menu and
      updates the status bar and stage-order blocks.
- [x] Pure, browser and existing suites pass offline.

## Validation

`npm run test:query`; `npm run check:frontend-types`;
`npm run test:browser`; `git diff --check`.

## Execution log

- 2026-09-28: Created at user request; implementation started.
- 2026-09-28: Added pure `relationLabelKind` (unit-tested) and the page's
  `edgeLabelHtml` template. The template picks the relation style from the
  predicate, so an unflagged variable edge is green and a stale flag on a
  fixed predicate is not. `rewireEdges` and `replaceWithNewNode` now keep
  every edge data field. The edge action list always offers Remove relation;
  it removes only that edge, and the existing remove listener closes the
  menu while the stage-order blocks refresh. The test CDN stub for
  cytoscape-html-label does not render, so browser tests call the page's
  `edgeLabelHtml` on live edge data. Validation: `npm run test:query` (14),
  `check:frontend-types`, browser suite 48/48 offline, `git diff --check`.
