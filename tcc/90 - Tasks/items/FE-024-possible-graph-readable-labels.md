---
id: FE-024
title: Enlarge the possible-graph window and move long labels under their element
status: DONE
priority: P1
type: frontend
depends_on: [FE-017]
human_gate: false
created: 2026-09-28
updated: 2026-09-28
---
# Enlarge the possible-graph window and move long labels under their element

## Objective

User feedback on the FE-017 window: the preview works but is too small, and
long values (often strings) do not fit inside a node or between the two nodes
of a relation, so they are cut off. Skill: `tcc-frontend`.

## Scope

- Enlarge `#possible-graph-window` and its canvas (wide and narrow layouts).
- A node label wider than its node, or a relation label wider than the gap
  between its nodes, is drawn wrapped under the element instead of truncated.
  Labels that fit stay where they are.
- Visual only: the same elements, values, caption, cycle and requests; the
  main graph is untouched.

## Acceptance criteria

- [x] The window and canvas are larger than before on wide screens; the narrow
      bottom sheet stays below the panel.
- [x] A long node value is shown complete (not ellipsized) under its node.
- [x] A long relation value is shown complete under the relation.
- [x] Short labels keep their inside/centered placement.
- [x] Browser suite passes offline.

## Result

`sparql/index2.css` enlarges the window and canvas (and the narrow bottom
sheet, keeping the panel above it). `sparql/stage-exploration.js`
`placePossibleLabels` measures each label with the Cytoscape default font after
every render. A label wider than its node, or wider than the gap between the
node borders of its relation, gets `label-below`: wrapped at spaces (150px),
under the node or offset below the line. `text-overflow-wrap: anywhere` was
rejected because Cytoscape drops the spaces. A single word longer than 150px
still overflows its line rather than being broken.

Validation: new browser test for long node and relation values, a visual
check of a screenshot, the full browser suite (57 passed) and
`npm run check:frontend-types`.
