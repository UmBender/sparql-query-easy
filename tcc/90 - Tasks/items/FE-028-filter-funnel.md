---
id: FE-028
title: Visualize how each filter narrows the result as a funnel
status: READY
priority: P1
type: frontend
depends_on: [BE-003]
human_gate: false
created: 2026-10-07
updated: 2026-10-07
---
# Visualize how each filter narrows the result as a funnel

## Objective

One of four competing numeric-filter visualizations requested on 2026-10-07.
Implement on its own branch `FE-028-filter-funnel` from `main` after BE-003; the
user tests the branches and chooses which one is merged (DEC-010). Do not
merge into `main`. Skill: `tcc-frontend`.

## Scope

A panel listing the query's filters in order with the remaining count after each step (e.g. 151 → 72 → 34 → 9) and a toggle per step to see its effect without deleting it. Use the BE-003 profile (`fetchNumericProfile`) and filter labels.

## Acceptance criteria

- [ ] Counts per step come from bounded requests; toggling a step changes later counts only; disabled steps are not sent by Run Query until re-enabled (or the toggle is preview-only, as decided in the card).
- [ ] Offline browser tests with a mocked profile; browser gate passes.
- [ ] Works on a narrow viewport; keyboard reachable.

## Execution log

- 2026-10-07: Created; BE-003 provides the profile and labels.
