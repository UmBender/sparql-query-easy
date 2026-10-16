---
id: FE-047
title: Show the filter funnel with switchable steps and kept/total badges
status: BACKLOG
priority: P1
type: frontend
depends_on: [FE-045, FE-046]
human_gate: false
created: 2026-10-16
updated: 2026-10-16
---
# Show the filter funnel with switchable steps and kept/total badges

## Objective

T5d. Skill: `tcc-frontend`. Spec: FE-028, FE-036, FE-039 and the Numeric
filters row of [[../../09 - Decisions/Current Contracts]].

## Scope

Funnel panel from `count` (one step per filter, MAX/MIN last, preview-only
toggles); badges above filtered nodes (kept/total, or actual value with ✓/✗
for a fixed-entity subject).

## Acceptance criteria

- [ ] QUAL-006 rows for funnel and badges pass with identical counts.
