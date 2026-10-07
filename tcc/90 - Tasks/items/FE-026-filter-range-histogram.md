---
id: FE-026
title: Visualize a numeric filter as a range slider over a histogram
status: READY
priority: P1
type: frontend
depends_on: [BE-003]
human_gate: false
created: 2026-10-07
updated: 2026-10-07
---
# Visualize a numeric filter as a range slider over a histogram

## Objective

One of four competing numeric-filter visualizations requested on 2026-10-07.
Implement on its own branch `FE-026-filter-range-histogram` from `main` after BE-003; the
user tests the branches and chooses which one is merged (DEC-010). Do not
merge into `main`. Skill: `tcc-frontend`.

## Scope

A two-handle range slider over a histogram of the profiled values inside the filter editor. Bars outside the range are grey; a live "keeps N of M" count. Moving the handles writes a Between (or ≥/≤) filter. Use the BE-003 profile (`fetchNumericProfile`) and filter labels.

## Acceptance criteria

- [ ] Histogram bins and the kept count follow the slider; applying writes the expected filter; empty/error/truncated profiles are shown.
- [ ] Offline browser tests with a mocked profile; browser gate passes.
- [ ] Works on a narrow viewport; keyboard reachable.

## Execution log

- 2026-10-07: Created; BE-003 provides the profile and labels.
