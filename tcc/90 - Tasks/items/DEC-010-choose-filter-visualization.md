---
id: DEC-010
title: Choose which numeric-filter visualization is merged into main
status: BLOCKED
priority: P1
type: decision
depends_on: [FE-026, FE-027, FE-028, FE-029]
human_gate: true
created: 2026-10-07
updated: 2026-10-09
---
# Choose which numeric-filter visualization is merged into main

## Objective

The user tests the FE-026–FE-029 branches and chooses which one (or which
combination) is merged into `main`. The others stay unmerged or are
cancelled.

## Question

Which branch(es) should be merged, and should any parts of the others be
combined into the chosen one?

## Execution log

- 2026-10-07: Created; waits for the four variant branches.
- 2026-10-07: Partial decision: FE-026 (histogram + range slider) is
  accepted and merged into `main` (`1204dd1`). FE-027, FE-028 and FE-029
  stay unmerged on their branches until the user tests them; still open is
  whether any of them (or parts) is combined with FE-026.
- 2026-10-09: After testing FE-027 the user dropped its dot strip as
  redundant with the histogram, kept its graph badge (FE-036) and asked for
  FE-035: with the range fixed, cycle over the kept entities one or two at a
  time, in large type and as a mini result graph. Still open: FE-028.
