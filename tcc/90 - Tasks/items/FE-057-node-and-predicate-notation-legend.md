---
id: FE-057
title: Show node and predicate kinds with one colour rule and a three-column legend
status: DONE
priority: P1
type: frontend
depends_on: []
human_gate: false
created: 2026-10-27
updated: 2026-10-27
---
# Show node and predicate kinds with one colour rule and a three-column legend

## Objective

User request (2026-10-27): the notation must follow one rule — fixed
(non-variable) elements keep their own colour, variables are green — and
the legend must be split by element type. Skills: `tcc-frontend`,
`tcc-style`. Contract: [[../../09 - Decisions/Current Contracts]] rows
"Value variables" and "Menus/predicates";
[[../../04 - Frontend/Predicate Variable Edge Contract]].

## Scope and acceptance

- Literal value variable (`valueVariable`): no pink border; the value box
  shape and size with the variable green fill (`tokens.ts`
  `graph.nodes.valueVariable`, `theme.css`, generated CSS).
- Variable predicate (`edge[kind = "variable"]`): the line and arrow are
  the variable green; the label keeps the same look as a defined predicate
  (no green box behind the label), only the colour changes. Defined
  predicate unchanged. Apply the same rule wherever the canvas notation is
  repeated: the possible-graph preview (`possibleGraphStylesheet`,
  `edge.open`), the styleguide node-kind canvas and swatches, and the help
  page node-type list.
- Legend (`frontend/src/lib/features/editor/graph-overlays.svelte`), three
  columns:
  1. **Nodes** — Entity, Node variable (green circle), Class, Multiple
     results (grey).
  2. **Literals** — Literal value (pink box), Literal value variable
     (green box).
  3. **Predicates** — an arrow in the defined colour ("Defined predicate")
     and an arrow in the variable green ("Variable predicate").
  It stays readable at phone and laptop widths and in both themes.
- This card owns the help page `nodeKinds` array and the styleguide
  node-kind chips/canvas, using the new names (Literal value, Literal value
  variable, Node variable, Multiple results). Other wording is FE-059.

## Exclusions

- No change to node shapes other than removing the border, to graph data,
  saved format or requests.

## Validation

- Focused: Vitest for `design/` (tokens, css, cytoscape) and the overlay.
- Closing: the new frontend gate; `test:screens` and the visual baselines
  only refreshed for this intended change, PNG diffs reviewed.

## Conclusion

Done 2026-10-27. Rule: fixed elements keep their own colour, variables are
green. Tokens: `graph.nodes.valueVariable` has no border (width 0);
`graph.variableEdge` is now `{ line: #6a9141, label: #3b6e22 }` (label text
AA on the white label background), replacing the green label box. The
editor (`edge[kind = "variable"]`) and the possible-graph preview
(`edge.open`) change only line, arrow and label colour. Legend
(`graph-overlays.svelte`): three columns Nodes (Entity, Node variable, Class,
Multiple results) / Literals (Literal value, Literal value variable) /
Predicates (defined and variable arrows), two columns under `sm` so it fits
at 360 px (checked by screenshot). Help `nodeKinds`, styleguide chips (the
Multiple results chip is a swatch + text: white on the grey fill fails AA)
and node-kind canvas use the new names. Docs: Current Contracts (Value
variables, Menus/predicates), Predicate Variable Edge Contract, Parity G-12.
Tests: `tokens.spec.ts` (variable predicate = colour-only change, no
border), `editor.e2e.ts` G-01 G-12 (line/arrow/label/background colours,
border width). Gate: check 0 errors, lint clean, Vitest 253 + 25,
Playwright 120 passed; visual baselines (node kinds, selected) and
`test:screens` (editor, help, study task, admin new task, styleguide, both
themes) refreshed and reviewed — only the border, the variable predicate
colour, the legend and the help/styleguide lists changed; re-run 22 passed.
Help images regenerated with `help:screens`.
