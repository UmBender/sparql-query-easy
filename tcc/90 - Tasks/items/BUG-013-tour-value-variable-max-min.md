---
id: BUG-013
title: The tour says a literal value variable offers MAX and MIN
status: DONE
priority: P2
type: bug
depends_on: []
human_gate: false
created: 2026-10-28
updated: 2026-10-28
---
# The tour says a literal value variable offers MAX and MIN

## Objective

The guided tour step for **Add Literal Value Variable**
(`frontend/src/lib/features/utilities/tour-steps.ts`, target
`#add-value-variable-btn`) lists "MAX or MIN" among the filters of the new
node. That node offers Any value, Exact match, Starts with, Contains, At
least, At most and Between (`FILTER_OPTIONS.variable` in
`features/filters/filter-form.ts`); MAX/MIN exist only on a fixed literal
value (FE-034, [[../../09 - Decisions/Current Contracts]] "Value variables").
Requested by the user on 2026-10-28. Skill: `tcc-frontend`.

## Acceptance criteria

- [x] The step lists only the value variable's filters and says MAX/MIN are
      on a fixed literal value.
- [x] `tour-steps.spec.ts` fails if that step offers MAX or MIN again, and
      checks that the value variable's editor options still exclude them.

## Validation

Focused: `tour-steps.spec.ts`. Closing gate: frontend gate. No screenshot
shows the tour text, so `test:screens` and `help:screens` are not needed.

## Conclusion

- **Fix:** the step now reads "Click it to add a filter: any value, exact,
  starts with, contains, at least, at most or between. MAX and MIN are on a
  fixed literal value (Edit literal value)." The help page's filter table
  already lists MAX/MIN as a general filter kind without tying it to this
  node, so it was left as it is.
- **Test:** `tour-steps.spec.ts` "lists only the filters a literal value
  variable offers (BUG-013)": the list after "add a filter:" contains
  `between` and no MAX/MIN, the step names where MAX/MIN live, and
  `FILTER_OPTIONS.variable` has no codes 4/5. It fails on the old text.
- **Validation:** focused Vitest 9/9. The frontend gate ran with this change
  and BUG-012's (see BUG-012: all green except one a11y cold-start flake that
  passed on rerun). No screenshot shows tour text. The completion commit for
  this task.
