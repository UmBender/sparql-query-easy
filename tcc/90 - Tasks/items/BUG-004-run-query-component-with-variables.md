---
id: BUG-004
title: Run Query uses the graph group that contains the variables
status: DONE
priority: P1
type: bug
depends_on: [DEC-008]
human_gate: false
created: 2026-10-06
updated: 2026-10-06
---
# Run Query uses the graph group that contains the variables

## Objective

User report (2026-10-06, `PokemonGen1`): the canvas had a Pikachu/Raichu/
Electric/Sandshrew group with no variables, built first, and a separate
Fire → `?` predicate → `?` node group. The stage order was not shown and Run
Query said "Add at least one variable (?) node before running." Skill:
`tcc-frontend`.

## Evidence

`runQuery`, `seeSparqlQuery` (`app-core.js`) and `queryComponent`
(`stage-order.js`) always took `cy.elements().components()[0]`, as the
DEC-008 contract stated ("Run Query considers only the first graph
component"). The first group held no variables, so the registry was empty.
The node menu's "Run query" already used the clicked node's group.

## Human decision (2026-10-06)

Use the single group that contains variables and ignore groups without
variables. With no variables anywhere, keep the first group and the existing
error. If two or more groups contain variables, Run Query shows an error
asking the user to connect them or remove one, and no stage order is shown.

## Scope

- Pure selection in `query-stages.js`, unit-tested; used by Run Query,
  View SPARQL, the stage-order registry and the possible-graph window.
- Update the DEC-008 wording in the Two Variable Exploration Contract and
  Frontend Architecture.
- Exclusions: no change to filters, staging, the parallel-predicate guard or
  the node menu's "Run query".

## Acceptance criteria

- A variable-free group added first no longer hides another group's
  variables: the stage order appears and Run Query stages/runs that group.
- Variables in two disconnected groups: an error toast, no request, no panel.
- No variables: the existing "Add at least one variable" error.

## Validation

`npm run test:query`, `npm run check:frontend-types`, focused browser cases,
then the browser closing gate `npm run test:browser`; documentation check
`node scripts/check-project-docs.mjs`; `git diff --check`.

## Execution log

- 2026-10-06: Card created from the user report and decision above.
- 2026-10-06: `queryStages.queryComponentChoice` picks the component;
  `selectQueryComponent`/`queryComponent` (`stage-order.js`) apply it to the
  graph, and `runQuery`/`seeSparqlQuery` (`app-core.js`) use it, with a
  separate-groups error. Contract wording updated in the Two Variable
  Exploration Contract, Frontend Architecture and Current Contracts.
  - Tests: one unit case, and three browser cases (variable group after a
    fixed group stages two variables; a single later-group variable sends the
    legacy request for that group; variables in two groups are rejected
    without requests). The three browser cases failed on the previous code.
  - Validation: `npm run test:query` (25 passed), `npm run
    check:frontend-types`, focused browser cases, `npm run test:browser`
    (63 passed), `node scripts/check-project-docs.mjs`, `git diff --check`.
    A first full browser run had one timeout in the existing "exactly two
    valid variables" case (the click never finished). An 8× parallel repeat
    then failed 8/8, but further 8×, 4× and single-worker repeats on the same
    code passed (26/26), and the full suite rerun passed. Treated as a
    transient environment slowdown; recorded here in case it returns.
  - No new frontend files, so packaging is unchanged.
