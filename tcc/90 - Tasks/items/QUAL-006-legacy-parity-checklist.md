---
id: QUAL-006
title: Map every legacy frontend behavior to a parity check for the new app
status: DONE
priority: P1
type: quality
depends_on: [FE-001, QUAL-005]
human_gate: false
created: 2026-10-16
updated: 2026-10-17
---
# Map every legacy frontend behavior to a parity check for the new app

## Objective

T2. The legacy suite already characterizes the frontend (111 cases in
`frontend-tests/index2.spec.mjs`, the QUAL-005 node-kind × action table, 4 e2e
cases, 5 unit suites). This card closes the gaps and turns them into a
checklist that every FE-044–FE-048 card must satisfy. Skill: `tcc-test`.

## Scope

- List each legacy feature (see the Project context list in
  [[../../05 - Migration/Frontend Migration Conflict Report]]) with the
  existing test titles that cover it.
- Add legacy browser cases for features without coverage (check first:
  guided tour, auto layout, export/upload query, search nodes).
- Store the checklist in `tcc/04 - Frontend/Frontend Parity Checklist.md`,
  each row naming the target card (FE-042–FE-048).

Excluded: changing legacy behavior or existing assertions.

## Acceptance criteria

- [x] Every legacy feature has at least one named legacy test and a target card.
- [x] New legacy cases pass in `npm run test:browser`.

## Validation

`npm run test:browser -- --grep '<new case>'`, then `npm run test:browser`.

## Amendment (2026-10-16; applied 2026-10-17 under the user's full-migration goal)

From the T2 brief (conflict rule EXTENDS). Behavior parity stays here;
payload parity is QUAL-008–QUAL-010. Apply only after the user confirms.

- [x] Each checklist row that sends a backend request names the
      `fixtures/legacy/` scenario (QUAL-009) its target card must reproduce.

## Execution log

- 2026-10-17: The user set the goal "implement full migration to svelte",
  which authorizes the migration card chain. Wrote
  [[../../04 - Frontend/Frontend Parity Checklist]] (49 rows, each with
  legacy test titles, a target card, a scenario column and a status).
  Added nine `QUAL-006 …` legacy browser cases for features that had no test:
  guided tour, Auto Layout, Export/Upload Query, New Query, zoom buttons,
  results-table filter, Enter-to-run, search-result relation discovery and
  Alt+drag. Two findings recorded in the tests: Enter inside a toolbar input
  runs the query through implicit form submission; the jQuery stub's `is()`
  hides the Auto Layout toggle-on handler, so the test pins the checked
  state's effect instead. Validation: `npm run test:browser` 131 passed, 1
  failure in the unchanged, known-intermittent `QUAL-005 each node kind
  offers exactly its actions …` (passed 3/3 on repeat). Scenario names are
  filled by QUAL-009. Completion commit for this task.
