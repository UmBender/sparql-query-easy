---
id: QUAL-005
title: Reproduce value-node bugs and cover every node kind against every action
status: DONE
priority: P1
type: quality
depends_on: [FE-031]
human_gate: false
created: 2026-10-09
updated: 2026-10-14
---
# Reproduce value-node bugs and cover every node kind against every action

## Objective

The user reports that value-node interactions are still buggy
(2026-10-09). This card adds the safety net from the FE-031 proposal before
any refactor. Skill: `tcc-test`. Evidence:
[[../../04 - Frontend/Frontend Evolution Audit]] (Reliability proposal).

## Scope

- First, turn each bug the user reports into a failing browser case
  (`frontend-tests/index2.spec.mjs`, `PokemonGen1`-style mocked data) and
  fix it here. **Input needed when the card starts:** the steps for each
  value-node bug the user has seen. If none are given, explore the matrix
  below and record what fails.
- A data-driven table of node kinds × actions. Kinds: IRI, literal
  value, filtered value, variable, "N results", class (`default`), image link.
  Actions: results-table choice, Assume, Apply to graph, Convert to variable,
  Add value filter, Edit value, Toggle Boolean, Remove, Connect with
  variable/defined predicate, Remove relation. Each row checks the
  resulting node kinds, element IDs, edge endpoints and the next query
  payload. Actions a kind does not offer are checked as absent from its
  action list.
- Exclusions: no refactor (FE-032/FE-033) and no new node kind (FE-034).

## Acceptance criteria

- Every reported bug has a case that fails before its fix and passes after.
- The table runs in `npm run test:browser`. Where current behavior is
  questionable but was not reported, record it in this card instead of
  changing it.

## Validation

Focused: `npx playwright test -g "<case>"`. Closing gate: frontend gate of
the Operational Map (`npm run test:query`, `npm run check:frontend-types`,
`npm run test:browser`, Gradle packaged-resource test if files are added).

## Execution log

- 2026-10-14: Started at the user's request without reported bug steps, so
  the matrix was explored as the card allows.
- Added a `QUAL-005` section to `frontend-tests/index2.spec.mjs`. The node
  kinds are built with the app's own factories (`addNodeWithRelationship`,
  `changeElementStringValue`, `replaceWithNewNode`): variable, "N results",
  IRI, class, literal, Boolean, filtered value, image link, and a value under a
  fixed entity. Cases: the exact action list for each kind (actions a kind
  lacks are absent), Convert to variable and Remove for every kind, both
  Connect actions for every kind, Toggle Boolean, Edit value (literal and
  filtered), Explore relationships/values, Open link, Run query, Add value
  filter on "N results", results-table choice (IRI and literal), Assume, Apply
  to graph, and Remove relation for each relation kind. Each case checks node
  kinds, element IDs, edge endpoints and the next query payload, comparing
  filters as multisets.
- Validation: `npm run test:query` (44 pass), `npm run check:frontend-types`
  (clean), `npm run test:browser` (113 pass, including the 3 expected
  failures below). No product file changed, so the Gradle resource test was
  not needed.

### Bugs found and fixed

These were found unreported and first committed as expected failures. Each one
failed for exactly its stated reason. `convertMenuNodeToVariable` copied every
old data field onto the new variable:

1. **Filtered value → variable keeps `filterType`.** The query sends
   `filterType: 2` with a variable object, and the server rejects it
   (`GreaterOrEqual` requires a number).
2. **Image link → variable keeps `isLink`/`href`.** The new variable offers
   "Open link" (to the old image) instead of Run query and Add value filter.
3. **"N results" → variable keeps `color: 'gray'`.** The new `?` variable is
   drawn gray instead of variable green.

### Questionable behavior recorded, not changed

- **Empty value node.** Add value filter on a relation with no numbers seeds
  `value: ''`. If the editor is cancelled, `filterEdgeItems` falls back to
  the element ID, so the query requires the literal `"value_<timestamp>"`.
- **Image link value.** The link is fetched with `isLiteral` and stored as the
  bare URL of a `label` node, so the query matches a string literal, not the
  image IRI. Edit value on the link opens with `View image` as its current
  value, and applying it would send that text.
- **Edit value / Toggle Boolean only under a variable subject.** After
  Assume/Apply, a kept filter cannot be edited from the menu (already noted in
  FE-036).
- **Literal values offer Connect.** Connect with a variable or defined
  predicate puts the literal in the subject position. Defined-predicate loading
  sends the literal as `id`. The server rejects both (`must be an IRI, property
  path, or SPARQL variable`).
- **Results-table choice (legacy Run query action).** Every outgoing target of
  the replaced variable is removed and refetched. A filtered value loses its
  filter, a variable/"N results" target becomes a fetched value, and a class
  target is refetched with `isLiteral: true`. The node action "Run query" uses
  this legacy table, while the toolbar Run Query uses staged exploration.
- **Applied literal IDs.** Assume/Apply give a literal node its lexical value
  as ID. Two variables bound to the same literal, or a literal equal to an
  existing node ID such as `true`, merge into one node. The datatype and
  language are dropped.
- A literal whose ID contains `?` is treated as a variable by the legacy
  `extractVariableName`/`getAllNodes`.

- 2026-10-14: At the user's request, fixed the three Convert bugs in
  `sparql/graph-menus.js`: the new variable drops `filterType`, `isLink`,
  `href` and `color` and keeps other data (the existing convert test checks
  custom data is kept). The `test.fail` markers were removed, and the rows now
  pass. Validation: `npm run test:query` (44 pass),
  `npm run check:frontend-types` (clean), `npm run test:browser` (113 pass).

Commits: `c9cf089` (matrix) and the fix commit for this task.
