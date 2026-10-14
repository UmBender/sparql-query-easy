---
id: FE-034
title: Add a variable value node that holds a filter and becomes a value when chosen
status: DONE
priority: P1
type: fullstack
depends_on: [FE-032, FE-033]
human_gate: false
created: 2026-10-09
updated: 2026-10-14
---
# Add a variable value node that holds a filter and becomes a value when chosen

## Objective

User request (2026-10-09): a new node notation, the **variable value
node**. It is a variable whose values are literals (numbers, text, dates). It
is the natural place for a filter, and when the variable is settled (a
results-table choice, Assume or Apply to graph) it becomes an ordinary value
node. Skill: `tcc-fullstack`.

## Behavior before this task (evidence, `main` `5d64c4a`)

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

1. **Notation.** Decided by the user (2026-10-14): the same format as a
   value node (the value box shape and size), with the green variable fill
   and a pink border.
2. **Where the filter lives.** Decided (2026-10-14, recommendation): on
   the node (one variable, one filter); the edge label returns to the plain
   predicate.
3. **Creation.** Decided (recommendation): FE-030 Add value filter creates
   this node instead of a literal filter node, and Convert to variable on a
   literal value node creates it too. Existing filtered literal nodes (saved
   or imported graphs) stay as they are.
4. **API.** Decided (recommendation): an optional per-variable filter (`?v` +
   `filterType` + value) in `POST /api/query` and `POST /api/query/stage`,
   rendered as `FILTER` on `?v` with `isLiteral(?v)`. The legacy
   literal-object form stays unchanged.
5. **Without a filter.** Decided (recommendation): allowed, meaning "any
   literal", so Convert to variable can produce it.
6. **Max/Min (filterType 4/5).** Decided (recommendation): not offered on this
   node in the first slice.

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

## Result

- 2026-10-14. Evidence correction: before this task the filter was already
  stored on the literal node (`filterType`, with the filter text in `value`).
  Only the legacy imported `label-filter` edge type carries a filter on the
  edge.
- **Backend.**
  - `VariableFilter(variable, filter?, exactValue?)` in
    `WikidataQueryGenerator.kt`; the general, display, stage, count and
    profile queries take `variableFilters`.
  - Each filter renders `FILTER (isLiteral(?v) && …)` after the patterns and
    inside every Maximum/Minimum subquery.
  - Validation rejects:
    - a variable that is not the object of a pattern;
    - two filters on one variable;
    - Maximum/Minimum on a variable;
    - a filter type sent with no value (400).
  - The HTTP field is `variableFilters: [{variableName, filterType?, value?}]`
    on `/api/query`, `/sparql`, `/stage`, `/count` and `/numeric-profile`.
  - Literal-object rendering is byte-identical: the shared condition text is
    extracted without changes, and the capture tests pass.
- **Frontend.**
  - `graph-model.js` adds the `value-variable` kind: the value box, the
    variable green, a 4px pink border (`nodeBorder`), and the label `?`,
    `? ≥ 90`, `? in 40–80` or `? = Rio`.
  - The filter lives in `filterType` + `filterValue`; `nodeFilter` and
    `variableFilterOf` read it.
  - Add value filter creates `?value_<n>` (`addValueVariableNode`), and
    Convert to variable turns a literal into one without a filter.
  - **Edit filter** edits the filter in place. The editor offers Any value,
    Exact match, Starts with, Contains, At least, At most and Between, plus
    the histogram; MAX/MIN are not offered.
  - Every request with `where` sends `variableFilters` (only for object
    variables in its own `where`; omitted when empty): Run query action,
    staged Run Query, View SPARQL, funnel, profile/histogram and badges.
  - Assume/Apply settle the node through `bindVariable` into a plain value
    node.
- **Recorded choices.**
  - The label shows `?` plus the filter, because variables have no display
    name (IDs are `?value_<n>`).
  - Convert to variable gives a value variable without the old literal's
    filter (decision 5; QUAL-005 already dropped filters on convert).
  - A value variable does not offer the legacy node **Run query**, because
    `/api/query` requires `rdf:type` and cannot list literals (BUG-005).
    Staged Run Query lists them.
  - The funnel treats value-variable filters as constraints on every count,
    not as steps.
- **Validation.**
  - Kotlin: `VariableFilterGeneratorTest`; `VariableFilterRoutesTest` on
    PokemonGen1 (`?pokemon` hp `?hp ≥ 150` lists only Chansey and Snorlax in
    the stage, Run Query, count and profile; any literal, exact value, 400s);
    an OpenAPI assertion; Gradle `test` (173 pass); `ktlintCheck`; `detekt`.
  - Frontend: unit tests (67 pass), including the headless settle test;
    `check:frontend-types`; QUAL-005 rows (value-variable kind; literal kinds
    convert to a value variable; Edit filter; payloads); FE-030 tests updated
    to the new node; five FE-034 browser tests (look, staged Run Query + Apply,
    Assume, View SPARQL/Run query/badge, Convert + editor).
  - Gates on the final state: `npm run test:browser` (119 pass), `npm run
    test:e2e` (4 pass through Ktor), Gradle `test`, `ktlintCheck` and
    `detekt` (clean).
