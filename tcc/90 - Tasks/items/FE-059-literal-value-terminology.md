---
id: FE-059
title: Name value nodes "Literal value" and "Literal value variable" and say "Multiple results"
status: DONE
priority: P1
type: frontend
depends_on: []
human_gate: false
created: 2026-10-27
updated: 2026-10-27
---
# Name value nodes "Literal value" and "Literal value variable" and say "Multiple results"

## Objective

User request (2026-10-27): buttons and indexes say **Literal value
variable** instead of "Value variable" and **Literal value** instead of
"Value"; a node standing for more than one result is called **Multiple
results** instead of "Many results"/"many values". Skills: `tcc-frontend`,
`tcc-style`.

## Scope and acceptance

- Toolbar button **Add Literal Value Variable** (and its title), action
  list/menu items and editor titles that name the node type (e.g. Edit
  value → Edit literal value), tour steps, help page prose, styleguide
  text, aria labels, and every test/page object that asserts those texts.
- Wording for a grey node: "Multiple results" wherever the node type is
  named. The per-node count label ("12 results") is unchanged.
- Not owned here (FE-057): `graph-overlays.svelte`, the help page
  `nodeKinds` array, the styleguide node-kind chips/canvas.
- Identifiers (`valueVariable`, `value-variable`), saved format, API and
  generic actions not naming the node type ("Add value filter") stay.

## Validation

- Focused: Vitest and e2e specs touching the renamed texts.
- Closing: the new frontend gate; `test:screens` refreshed only for this
  intended change, diffs reviewed.

## Conclusion

Done 2026-10-27. Renamed in the UI: toolbar **Add Literal Value Variable**
(and its title), action **Edit literal value**, tour step, filter editor
header comment, help prose (worked example, action list, filters,
"Multiple results" for a grey node). Identifiers (`valueVariable`,
`value-variable`, `edit-value`), saved format, API and "Add value filter"
unchanged; the legend, help `nodeKinds` and styleguide chips are FE-057.
Tests updated: `operations.spec.ts`, `tour-steps.spec.ts`, `editor.e2e.ts`,
`filters.e2e.ts`, `tests-stack/study-query-creation.e2e.ts`. Docs: Current
Contracts (Value variables), Request Flows, Parity Checklist P-07/G-13.
Gate: check 0 errors, lint clean, Vitest 252 + 25, Playwright 120 passed;
`test:screens` 8 baselines refreshed (editor, help, study task, admin new
task, both themes), diffs reviewed: only the button label and the edited
help paragraphs; re-run 22 passed. `test:stack`: 21 passed (3.9m).
