---
id: BUG-010
title: A MAX or MIN value applied with an empty value field reopens with text filters only
status: BACKLOG
priority: P2
type: bug
depends_on: []
human_gate: false
created: 2026-10-21
updated: 2026-10-21
---
# A MAX or MIN value applied with an empty value field reopens with text filters only

## Objective

Found by STUDY-012 on the real stack: on the value node `90` (HP of
Arcanine, under a variable), Edit value → MIN with the value field cleared →
Apply. The node shows `MIN`. Opening Edit value again offers only Exact
match / Starts with / Contains, so MIN cannot be changed to MAX without
removing the node. If the seeded value is left in the field, the
numeric choices (with MAX and MIN) come back as expected.
Skill: `tcc-frontend`.

## Evidence

- `editorStart` (`frontend/src/lib/features/filters/filter-form.ts`) starts
  from `data.value` when a filter type is stored. After MAX/MIN with an empty
  field that value is `''`.
- `editorMode` treats `''` as neither numeric nor MAX/MIN, so it returns `text`.
- Observed node after the edit: `{ id: 'node_<n>', kind: 'value', label: 'MIN' }`;
  editor labels on reopening: New Value, Exact match, Starts with, Contains.

## Acceptance criteria

- [ ] Reopening a value node whose filter is MAX or MIN always offers the
      numeric choices, whatever the value field held when it was applied.
- [ ] Regression test in `filter-form.spec.ts` or `tests/filters.e2e.ts`.

## Validation

Focused: the filter-form unit test. Closing gate: frontend gate.
