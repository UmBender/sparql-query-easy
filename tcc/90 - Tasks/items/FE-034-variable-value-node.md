---
id: FE-034
title: Add a variable value node that holds a filter and becomes a value when chosen
status: BACKLOG
priority: P1
type: fullstack
depends_on: [FE-032, FE-033]
human_gate: true
created: 2026-10-09
updated: 2026-10-09
---
# Add a variable value node that holds a filter and becomes a value when chosen

## Objective

User request (2026-10-09): a new node notation, the **variable value
node**. It is a variable whose values are literals (numbers, text, dates). It
is the natural place for a filter, and when the variable is settled (a
results-table choice, Assume or Apply to graph) it becomes an ordinary value
node. Skill: `tcc-fullstack`.

## Current behavior (evidence, `main` `5d64c4a`)

- A filtered value is a literal node (`type` `label`, pink) whose `value`
  holds the filter text (`90`, `40..80`). The **edge** carries `filterType`,
  and the edge label shows the readable filter (`relationLabelKind` →
  `filter`, `edgeLabelHtml`). FE-030 Add value filter creates such a node,
  seeded from `POST /api/query/numeric-profile`.
- The server filters only a literal object. `WikidataQueryGenerator` renders
  a hidden `?literalValue<n>` plus `FILTER`. For a variable object it writes a
  plain triple, so a `filterType` sent there is ignored. A filtered value
  therefore cannot be a stage, a Run Query target or a results column.
- A variable node (green) can be bound to an IRI or a literal; nothing marks
  it as literal-only.

## Intended behavior (to confirm)

- A distinct notation for "variable restricted to literal values", labelled
  with its name and filter (for example `?hp ≥ 90`), different from a plain
  variable and from a value.
- It is a real query variable: it appears in the stage order, the staged
  panel lists only the literals that satisfy its filter, and Run Query /
  View SPARQL include it.
- When it is settled it becomes a plain value node holding the chosen
  literal, without the filter. The filter editor (FE-026 histogram, or the
  DEC-010 choice) edits this node's filter.

## Decisions needed before READY (recommendations first)

1. **Notation.** Recommended: green variable fill with the pink value
   border and the filter in the node label. Alternative: a different shape.
2. **Where the filter lives.** Recommended: on the node (one variable, one
   filter); the edge label returns to the plain predicate. Alternative: keep
   it on the edge as today.
3. **Creation.** Recommended: FE-030 Add value filter creates this node
   instead of a literal filter node, and Convert to variable on a literal value
   node creates it too. Should existing filtered literal nodes (saved or
   imported graphs) stay as they are (recommended) or be converted on load?
4. **API.** A filter on a variable object needs an additive change to
   `POST /api/query` and `POST /api/query/stage`. Recommended: an optional
   per-variable filter (`?v` + `filterType` + value) rendered as `FILTER` on
   `?v`, with `isLiteral(?v)`. The legacy literal-object form stays
   unchanged. Confirm, or limit the first slice to frontend-only
   (filter not staged).
5. **Without a filter.** Is a variable value node without a filter allowed
   (meaning "any literal")? Recommended: yes, so Convert to variable can
   produce it.
6. **Max/Min (filterType 4/5).** These only order results and are rejected by
   staging. Recommended: not offered on this node in the first slice.

## Scope (after the decisions)

- Kind `value-variable` in `graph-model.js` (FE-032); settle through
  `bindVariable` (FE-033); add rows to the QUAL-005 table.
- Backend: additive filter support with generator and route tests on
  `PokemonGen1`. Document it in API v1, OpenAPI and Current Contracts.
- Frontend: notation, creation actions, the filter editor attached to the
  node, the query/stage payload and the settle behavior.
- Exclusions: no change to the legacy literal-filter form; no change to the
  C# capture oracles.

## Acceptance criteria (draft)

- On `PokemonGen1`: `?pokemon` → HP → `?hp ≥ 90` lists only Pokémon with
  HP ≥ 90 in Run Query and the staged panel. Choosing one turns `?hp` into a
  value node with that Pokémon's HP and no filter.
- Existing filtered literal nodes still produce the same request payloads as
  today.
- Unit, headless graph, browser and Kotlin tests cover the above.

## Relation to DEC-010

FE-026–FE-029 attach their visualizations to today's filter (the edge plus
the literal node). Merging another variant before this card means moving it
too, so the DEC-010 choice is best made before or together with decision 2.
