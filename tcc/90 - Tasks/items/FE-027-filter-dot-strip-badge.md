---
id: FE-027
title: Visualize a numeric filter as a dot strip with a live count badge on the graph
status: CANCELLED
priority: P1
type: frontend
depends_on: [BE-003]
human_gate: false
created: 2026-10-07
updated: 2026-10-09
---
# Visualize a numeric filter as a dot strip with a live count badge on the graph

## Objective

One of four competing numeric-filter visualizations requested on 2026-10-07.
Implement on its own branch `FE-027-filter-dot-strip-badge` from `main` after BE-003; the
user tests the branches and chooses which one is merged (DEC-010). Do not
merge into `main`. Skill: `tcc-frontend`.

## Scope

Each profiled entity is a dot on the number line (name on hover); dots outside the range fade; clicking a dot can add that entity to the graph. The filter node in the main graph shows a badge "kept / total" (red at 0, amber when truncated). Use the BE-003 profile (`fetchNumericProfile`) and filter labels.

## Acceptance criteria

- [ ] Dots fade with the range; the badge updates after edits; hover names and click-to-add work; no badge mutation of query data.
- [ ] Offline browser tests with a mocked profile; browser gate passes.
- [ ] Works on a narrow viewport; keyboard reachable.

## Execution log

- 2026-10-07: Created; BE-003 provides the profile and labels.
- 2026-10-09: Implemented on branch `FE-027-filter-dot-strip-badge` (`bfe1d8a`, not
  merged). DEC-010: the dot strip is dropped as redundant with the FE-026 histogram;
  the kept/total graph badge moves to FE-036 and the value preview to FE-035.
