---
id: FE-029
title: Show the filtered result as a live graph that changes with the range
status: CANCELLED
priority: P1
type: frontend
depends_on: [BE-003]
human_gate: false
created: 2026-10-07
updated: 2026-10-09
---
# Show the filtered result as a live graph that changes with the range

## Objective

One of four competing numeric-filter visualizations requested on 2026-10-07.
Implement on its own branch `FE-029-filter-live-result-graph` from `main` after BE-003; the
user tests the branches and chooses which one is merged (DEC-010). Do not
merge into `main`. Skill: `tcc-frontend`.

## Scope

The possible-graph window (or a mini graph) shows the matching entities as nodes; moving a range slider fades nodes in and out with their values, so the user sees the resulting graph change. Use the BE-003 profile (`fetchNumericProfile`) and filter labels.

## Acceptance criteria

- [ ] Nodes appear/fade with the range without new requests per movement; the main graph is unchanged until the filter is applied.
- [ ] Offline browser tests with a mocked profile; browser gate passes.
- [ ] Works on a narrow viewport; keyboard reachable.

## Execution log

- 2026-10-07: Created; BE-003 provides the profile and labels.
- 2026-10-07: Implemented on branch `FE-029-filter-live-result-graph` (`f86a00d`, not merged).
- 2026-10-09: User tested it and dropped it per DEC-010: the FE-035 mini result
  graph in the filter editor already covers it, readably. Branch kept unmerged.
