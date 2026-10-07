---
id: FE-025
title: Let a stage value be applied to the graph immediately with an Assume button
status: DONE
priority: P1
type: frontend
depends_on: [FE-010]
human_gate: false
created: 2026-10-07
updated: 2026-10-07
---
# Let a stage value be applied to the graph immediately with an Assume button

## Origin

External requirement from the thesis advisor, relayed by the user on
2026-10-07. It is not a user-originated design idea; the behavior choice
below was confirmed by the user.

## Objective

In the staged exploration panel the values of each variable are listed, but a
variable only takes a value in the graph at the end, through **Apply to
graph**. To make this easier, each value gets a simple **Assume** button that
makes the variable take that value in the main graph right away.
Skill: `tcc-frontend`.

## Evidence and contract

`sparql/stage-exploration.js` (`renderStage`, `selectStageCandidate`,
`applyExplorationToGraph`), `sparql/index2.css`, `sparql/app-core.js`
(`runQuery`), `frontend-tests/index2.spec.mjs`.
[[../../04 - Frontend/Two Variable Exploration Contract]] (DEC-008) said only
Apply to graph changes the graph; this task adds Assume as a second explicit,
user-approved graph-changing action.

## Scope

- Each selectable candidate of the current stage shows an **Assume** button
  beside it (not for blank nodes).
- Assume applies the values already committed in earlier stages plus this
  value to the main graph, with the same replacement rules as Apply to graph
  (the value depends on the earlier commitments).
- Then Run Query continues with the remaining variables in their current
  order: the panel reopens for 2+ variables, the legacy single-variable query
  runs for one, and nothing more happens when none remain.
- Clicking the value itself keeps its current commit-and-advance behavior;
  hover/focus previews are unchanged.

## Out of scope

Server/API changes, request budgets, the possible-graph window contents.

## Acceptance criteria

- [x] Selectable candidates show Assume; blank-node candidates do not.
- [x] Assume on stage 2 of 3 replaces the committed stage-1 variable and the
      assumed stage-2 variable in the main graph and reopens the panel at the
      remaining variable(s) in the kept order.
- [x] Assume with one variable left after it runs the legacy query for it.
- [x] Clicking a value still only commits inside the panel (graph unchanged).
- [x] Browser suite passes offline.

## Execution log

- 2026-10-07: Created from the advisor's requirement; implementation started.
- 2026-10-07: Implemented. `renderStage` appends `assumeButton` to each
  selectable candidate (same hover/focus preview as the value). Apply and
  Assume share `applyChoicesToGraph`; `assumeStageCandidate` applies the
  committed path plus the value, keeps the remaining variables' order with
  `setVariableOrder` and calls `runQuery`. Validation: two new browser tests
  (stage 1 of 3 reopens at `?c`, `?b` in the reordered order with `?a`
  substituted in `where`; stage 2 of 3 binds `?a` and the predicate and sends
  the legacy `/api/query` for `?c`) and a no-Assume-on-blank-node assertion;
  `npm run test:browser` 65 passed, `npm run test:query` 25 passed,
  `npm run check:frontend-types`, `node scripts/check-project-docs.mjs`,
  `git diff --check`, and a panel screenshot. Kotlin code unchanged.
  Completion commit for this task.
