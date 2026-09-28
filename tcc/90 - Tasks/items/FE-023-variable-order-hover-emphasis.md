---
id: FE-023
title: Emphasize a variable in the graph and the stage order together on hover
status: DONE
priority: P1
type: frontend
depends_on: [FE-009, FE-022]
human_gate: false
created: 2026-09-28
updated: 2026-09-28
---
# Emphasize a variable in the graph and the stage order together on hover

## Objective

Make the query order of multi-variable queries easier to read. Hovering a
variable node or variable relation in the graph emphasizes its numbered
stage-order block. Hovering (or keyboard-focusing) a block emphasizes every
node and relation carrying that variable. Skill: `tcc-frontend`.

## Scope

- Applies only while stage-order blocks are shown (two or more variables in
  the query component) and only to variables in the current registry.
- Emphasis is visual only: no change to order, graph data, menus, queries or
  exploration state.
- A node and a predicate sharing one variable are emphasized together.

## Acceptance criteria

- [x] Hovering a variable node or relation emphasizes exactly its block;
      leaving it removes the emphasis.
- [x] Hovering or focusing a block emphasizes all its nodes/relations and no
      others; leaving removes it.
- [x] Fixed (non-variable) elements and single-variable queries emphasize nothing.
- [x] Emphasis follows block re-rendering after reordering; the graph and
      stage order remain otherwise unchanged.
- [x] Browser suite passes offline.

## Result

Implemented in `sparql/stage-order.js` (`initVariableEmphasis`,
`applyVariableEmphasis`), a cyan `.variable-emphasis` Cytoscape underlay in
`index2.html` and a matching block outline in `index2.css`. Three browser
tests cover graph-to-block, block-to-graph (hover, focus, reorder, graph
unchanged) and single-variable cases. Validation: full browser suite (56
passed) and `npm run check:frontend-types`.
