---
id: FE-035
title: Cycle a numeric filter through its values with a large current value and a mini result graph
status: DONE
priority: P1
type: frontend
depends_on: [FE-026]
human_gate: false
created: 2026-10-09
updated: 2026-10-09
---
# Cycle a numeric filter through its values with a large current value and a mini result graph

## Objective

User request (2026-10-09), after testing FE-027: a dot per entity repeats what
the FE-026 histogram already shows. Instead, the histogram editor should let
the user cycle through every possible value, show the current value in large
letters, and preview the resulting graph at each step. Skill: `tcc-frontend`.

Decisions taken with the user (2026-10-09, recorded in DEC-010):
- The preview is a mini graph inside the filter editor (FE-029 idea). The
  main graph changes only on Apply.
- Play/Pause steps through the distinct profiled values automatically;
  Previous/Next (and ←/→ on the controls) step one value; the sliders and the
  typed value still work and pause playback.
- A step follows the selected filter type: Exactly Equal shows the entities
  with that value, At least/At most move the threshold, Between keeps its
  width and slides the window. MAX/MIN do not cycle.

## Scope

Entry: `renderFilterHistogram` in `sparql/graph-nodes.js` (FE-026); pure
helpers in `sparql/query-calculations.js` (type-checked); CSS in
`sparql/index2.css`. The profile comes from one `fetchNumericProfile`
request per editor opening, as today; cycling makes no requests.

- Large current-filter value (readable label, e.g. `≥ 45`, `45–90`, `45`)
  next to the controls, updated by playback, the sliders and typing.
- Each step writes the editor value and filter type exactly as a manual edit
  would, so Apply writes the step being shown.
- Exactly Equal now highlights only the bars and count for that value
  (FE-026 highlighted the whole range for an exact value).
- Mini result graph: kept entities (blue) linked to their value nodes (pink),
  read-only, at most a capped number of entities with a "+N more" note.
- Playback stops when the editor closes or is replaced.

Exclusions: the FE-027 graph badge (FE-036); changes to the profile route.

## Acceptance criteria

- [x] Play/Pause/Previous/Next step through distinct values following the
      filter type; each step updates the large value, bars, count, editor value
      and mini graph without new profile requests.
- [x] Apply after stepping writes the shown filter; the main graph is unchanged
      before Apply; closing the editor stops playback.
- [x] Offline browser tests with a mocked profile and unit tests for the step
      and mini-graph helpers; browser gate passes.
- [x] Works on a narrow viewport; controls keyboard reachable.

## Validation

Focused: `npm run test:query`, `npm run check:frontend-types`,
`npm run test:browser -- --grep 'histogram|cycle'`. Closing gate:
`npm run test:browser`.

## Execution log

- 2026-10-09: Created from the user's FE-027 feedback; branch
  `FE-035-filter-cycle-preview` from `main`.
- 2026-10-09: Implemented. `renderFilterHistogram` (`graph-nodes.js`) gains a
  large previewed-filter value, Previous/Play/Next controls (Material icons,
  44px targets, ←/→ on the group) and a read-only Cytoscape mini graph
  (`filterPreviewCy`, refitted by a ResizeObserver). Pure `cycleMode`,
  `cycleStep` and `resultPreviewGraph` (cap 24, staggered rows of four) in
  `query-calculations.js`. A slider move now repaints after writing the
  filter. Changed FE-026 expectation: an exact value counts only itself
  (e.g. "Keeps 2 of 6 values" for 45). Validation: `npm run test:query`
  34/34, `npm run check:frontend-types` clean, `npm run test:browser` 79/79
  (3 new offline cases: stepping per filter type with Apply, play/pause/
  keyboard/close, cap and empty preview; narrow-viewport case extended),
  `node scripts/check-project-docs.mjs` and `git diff --check` clean. Not
  checked in the real app with the Material icon font (tests stub it).
  Completion commit for this task.
