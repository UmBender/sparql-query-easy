---
id: FE-036
title: Bring the FE-027 kept/total badge for range filters into main
status: BACKLOG
priority: P1
type: frontend
depends_on: [FE-035]
human_gate: false
created: 2026-10-09
updated: 2026-10-09
---
# Bring the FE-027 kept/total badge for range filters into main

## Objective

Per DEC-010 (2026-10-09) the FE-027 dot strip is dropped, but its live
"kept / total" badge over range-filtered value nodes in the main graph is kept.
Port the badge part of `sparql/filter-profile.js` from branch
`FE-027-filter-dot-strip-badge` (commit `bfe1d8a`) onto `main` after FE-035.
Skill: `tcc-frontend`.

## Scope

Badge only: debounced refresh, green/amber/red states, `+` lower bound,
stale responses ignored, no change to element data. Exclude the editor dot
strip. Reuse the FE-027 browser cases for the badge.

## Acceptance criteria

- [ ] Badges behave as in FE-027 on top of FE-026/FE-035; the editor shows no
      dot strip.
- [ ] Offline browser tests; browser gate and Kotlin static-route test pass
      if a new script is packaged.
