---
id: FE-059
title: Name value nodes "Literal value" and "Literal value variable" and say "Multiple results"
status: READY
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
