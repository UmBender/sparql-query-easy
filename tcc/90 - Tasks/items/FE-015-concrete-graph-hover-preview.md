---
id: FE-015
title: Preview the concrete graph on the canvas while exploring stages
status: DONE
priority: P1
type: frontend
depends_on: [FE-010]
human_gate: false
created: 2026-09-28
updated: 2026-09-28
---
# Preview the concrete graph on the canvas while exploring stages

## Objective

Make multi-variable exploration visual. While the panel is open, the graph
canvas shows the query "concreted" with committed values. Hovering or
focusing a candidate also shows that value where its variable sits, so the
user sees the resulting graph before choosing.

## Evidence and contract

Skill: tcc-frontend. `sparql/index2.html` staged exploration
(`renderStage`, `renderStagePreview`, `previewStageCandidate`); the registry
in `variableOrderState.registry` holds each variable's node and edge IDs.
[[../../04 - Frontend/Two Variable Exploration Contract]] (DEC-008): previews
never mutate the graph, and only Apply to graph changes it.

## Scope

- A visual-only overlay over the canvas (`#concrete-preview`, pointer-
  transparent, `aria-hidden`). It places a value chip on every node and
  predicate edge of each committed variable (solid) and of the hovered or
  focused candidate's variable (dashed, highlighted). IRI and literal chips
  follow the node colors.
- The next variable's occurrences show its preview state (loading, value
  count, none, or error).
- Chips follow pan, zoom, resize and node moves, and are removed when the
  panel closes, on Back/reorder, or after Apply.
- No Cytoscape data, class or style changes; no additional requests.

## Out of scope

Changing request budgets, the Apply semantics, or the panel's text lists.

## Acceptance criteria

- [x] Hover and focus show the assumed value on every occurrence of the
      current variable; committed values stay visible in later stages.
- [x] The next variable shows its preview count or state.
- [x] Chips track node positions through pan/zoom and disappear on close.
- [x] The graph data is unchanged by any preview; the browser suite passes.

## Execution log

- 2026-09-28: Created at user request; implementation started.
- 2026-09-28: Implemented `#concrete-preview` and `renderConcretePreview`
  from the registry's node/edge IDs, the commitments and the current
  assumption. Bound nodes are drawn at the rendered node size and shape;
  edges get a relation label; the next variable shows the preview count.
  Two refinements came from screenshots. The last stage now also concretes
  its hovered value (no request). Opening the panel adjusts only the
  viewport when the panel would cover the query. Validation: browser suite
  51/51 offline (chip placement on nodes, assumed/committed/pending states,
  pan/zoom tracking, clearing on close, unchanged graph data, no extra
  request on the last stage, viewport reveal), `npm run test:e2e` 3/3,
  `git diff --check`, visual checks of the stage 2 and 3 canvases.
