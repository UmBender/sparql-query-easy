---
id: QUAL-006
title: Map every legacy frontend behavior to a parity check for the new app
status: BACKLOG
priority: P1
type: quality
depends_on: [FE-001, QUAL-005]
human_gate: false
created: 2026-10-16
updated: 2026-10-16
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

- [ ] Every legacy feature has at least one named legacy test and a target card.
- [ ] New legacy cases pass in `npm run test:browser`.

## Validation

`npm run test:browser -- --grep '<new case>'`, then `npm run test:browser`.

## Proposed amendment (2026-10-16, pending user confirmation)

From the T2 brief (conflict rule EXTENDS). Behavior parity stays here;
payload parity is QUAL-008–QUAL-010. Apply only after the user confirms.

- [ ] Each checklist row that sends a backend request names the
      `fixtures/legacy/` scenario (QUAL-009) its target card must reproduce.
