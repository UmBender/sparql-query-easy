---
id: FE-062
title: Hide the Class node kind from the graph legend and the help page
status: DONE
priority: P2
type: frontend
depends_on: []
human_gate: false
created: 2026-10-28
updated: 2026-10-28
---
# Hide the Class node kind from the graph legend and the help page

## Objective

User decision (2026-10-28): participants do not use classes in the study
tests, so the editor's graph legend (`graph-overlays.svelte`, Nodes column)
and the help page's Node kinds list (`routes/help/+page.svelte`) no longer
show Class. Skills: `tcc-frontend`, `tcc-style`.

## Scope and acceptance

- The legend's Nodes column shows Entity, Node variable and Multiple
  results; the help page's Node kinds list has no Class entry.
- Class nodes keep working: a query or saved file that yields one still
  renders it with its colour and actions. Tokens, the `/styleguide` and the
  domain are unchanged.

## Validation

- The new frontend gate; `test:screens` refreshed only for the editor and
  help screens, after checking the only change is the missing Class line.

## Conclusion

Done 2026-10-28. The Class line is gone from the legend's Nodes column and
the Class entry from the help page's Node kinds; class nodes, tokens and
`/styleguide` are untouched. Screens: the editor, study task and new admin
task goldens differ only in the legend box, the help goldens in the Node
kinds list and the six embedded help images; those images
(`static/help-images/`, `help:screens`) differ only inside the legend.
Validation: `test:screens` 22 passed; `editor.e2e.ts` and `visual.e2e.ts`
24 passed; the new frontend gate.
