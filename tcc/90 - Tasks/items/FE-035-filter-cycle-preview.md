---
id: FE-035
title: Cycle over the entities a numeric filter keeps, in large type and as a mini result graph
status: DONE
priority: P1
type: frontend
depends_on: [FE-026]
human_gate: false
created: 2026-10-09
updated: 2026-10-09
---
# Cycle over the entities a numeric filter keeps, in large type and as a mini result graph

## Objective

User request (2026-10-09), after testing FE-027: a dot per entity repeats what
the FE-026 histogram already shows. Instead, the histogram editor should let
the user cycle through every possible value, show the current value in large
letters, and preview the resulting graph at each step. Skill: `tcc-frontend`.

Decisions taken with the user (2026-10-09, recorded in DEC-010), as
corrected after the first version (which stepped the range and drew up to 24
unreadable entities):
- The range stays fixed while cycling; cycling goes over the possible values
  of the variable, i.e. the distinct entities the range keeps, each with all
  of its kept values ("consolidated").
- Only one or two entities are shown at a time (two per step), in large type
  and as a mini result graph inside the editor. The main graph changes only
  on Apply.
- Play/Pause steps automatically; Previous/Next (and ←/→ on the controls)
  step one page and wrap.

## Scope

Entry: `renderFilterHistogram` in `sparql/graph-nodes.js` (FE-026); pure
`keptEntities`, `possibilityGraph`, `cycleMode` in
`sparql/query-calculations.js` (type-checked); CSS in `sparql/index2.css`.
One `fetchNumericProfile` request per editor opening; cycling makes none.

- A new range, typed value or filter type restarts from the first entities.
- MAX/MIN (entities not known in advance) and two or fewer kept entities
  disable the controls.
- Exactly Equal highlights only the bars and count for that value (FE-026
  highlighted the whole range for an exact value).
- Playback stops when the editor closes or is replaced.

Exclusions: the FE-027 graph badge (FE-036); changes to the profile route.

## Acceptance criteria

- [x] Previous/Next/Play cycle over the kept entities two at a time, showing
      their names and values in large type and as a mini graph, without
      changing the range, the editor value or making requests.
- [x] Apply writes the edited filter; the main graph is unchanged before
      Apply; closing the editor stops playback.
- [x] Offline browser tests with a mocked profile and unit tests for the
      helpers; browser gate passes.
- [x] Works on a narrow viewport; controls keyboard reachable.

## Validation

Focused: `npm run test:query`, `npm run check:frontend-types`,
`npm run test:browser -- --grep 'histogram|kept entities'`. Closing gate:
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
- 2026-10-09: Reworked after user feedback ("I want range fixed ... render one
  or two possible values ... and cycle over this possible consolidated values
  for that node"): cycling no longer steps the range (`cycleStep` and
  `resultPreviewGraph` removed) but pages two kept entities at a time
  (`keptEntities`, `possibilityGraph`, interval 1.6 s); large names with
  values and a readable mini graph with the relation label. Validation:
  `npm run test:query` 35/35, `npm run check:frontend-types` clean,
  `npm run test:browser` 79/79 (3 rewritten FE-035 cases),
  `node scripts/check-project-docs.mjs`, `git diff --check`. Still not seen
  with the real Material icon font. Completion commit for this task.
