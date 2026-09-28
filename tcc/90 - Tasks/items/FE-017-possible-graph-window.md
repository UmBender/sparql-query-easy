---
id: FE-017
title: Show the possible graph in its own window while exploring stages
status: DONE
priority: P1
type: frontend
depends_on: [FE-015]
human_gate: false
created: 2026-09-28
updated: 2026-09-28
---
# Show the possible graph in its own window while exploring stages

## Objective

Replace the FE-015 canvas overlay with a separate "Possible graph" window
beside the exploration panel. It shows a consolidated copy of the query with
the chosen values, the option under the cursor and, cycling, a few possible
values of the next variable, so the user sees where each choice leads.

## Evidence and contract

Skill: tcc-frontend. `sparql/index2.html` staged exploration
(`renderPossibleGraph`, `possibleGraphState`), pure helpers in
`sparql/query-stages.js`.
[[../../04 - Frontend/Two Variable Exploration Contract]] (DEC-008): previews
never mutate the graph, and only Apply to graph changes it.

## Scope

- `#possible-graph-window`: a labelled region left of the panel (bottom sheet
  on narrow screens) with a read-only Cytoscape copy, a caption and a legend.
- `consolidatedGraphElements` substitutes every occurrence of each assigned
  variable (IRI-only on predicates) and marks committed, assumed, possible,
  open and fixed elements; `possibleValues` picks up to three selectable
  candidates of the next variable.
- Holding an option cycles the possible value every 3 s; leaving it stops
  the cycle. Remove the canvas overlay and the viewport reveal.
- No additional requests; the main graph data and viewport are unchanged.

## Out of scope

Request budgets, Apply semantics and the panel's text lists.

## Acceptance criteria

- [x] The window shows committed values, the assumed option and a next
      possible value in a distinct color, without overlapping the panel.
- [x] Holding an option cycles up to three possible values every 3 s;
      leaving the option stops it.
- [x] The window hides on close; the main graph and viewport are unchanged.
- [x] Unit and browser suites pass offline.

## Execution log

- 2026-09-28: Created at user request; implementation started.
- 2026-09-28: Implemented `#possible-graph-window` with a read-only
  `possibleCy`, `consolidatedGraphElements` and `possibleValues`; removed the
  FE-015 overlay and viewport reveal. A narrow-screen check found the panel
  covering the window, so under 800px the window is a 180px bottom sheet
  (legend hidden) and the panel's height stops above it. Validation:
  `npm run test:query` 16/16, browser suite 53/53 offline (window contents
  and colors, 3 s cycle and stop, committed values, hide on close, unchanged
  graph and viewport, no overlap on desktop and narrow screens),
  `npm run test:e2e` 3/3, `check:frontend-types`, `git diff --check`, visual
  checks at 1280px and 390px.
