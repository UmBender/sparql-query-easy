---
id: BUG-005
title: A single remaining variable is staged so literal values are not lost
status: DONE
priority: P1
type: bug
depends_on: [DEC-008]
human_gate: false
created: 2026-10-07
updated: 2026-10-07
---
# A single remaining variable is staged so literal values are not lost

## Objective

User report (2026-10-07, `PokemonGen1`): with Pikachu → `?predicate_3` →
`?node`, choosing **Assume** on `HP` closed the panel and the query returned
no results, although the possible-graph preview showed values. Running the
query again also returned nothing. Skill: `tcc-frontend`.

## Evidence

Reproduced locally with the built distribution. Assume applied
`pk:hp` correctly and called `runQuery()`, which ran the legacy
`POST /api/query` for the one remaining variable (approved FE-025 behavior).
That request (`Pikachu pk:hp ?node_1`) returned `{"data":[]}`: the legacy
generator requires `?x rdf:type ?xRdfType`, so untyped values such as the
literal `35` never appear (captured C# behavior, INV-002; must not change).
`POST /api/query/stage` returns them, which is why the preview had values.

## Human decision (2026-10-07)

Route both paths through staged exploration: Run Query with one variable,
including the variable left after Assume, opens the panel as "Stage 1 of 1".
The legacy generator is unchanged.

## Scope

- `runQuery` (`app-core.js`) opens the staged panel for one or more variables.
- The variable-node action list's Run query keeps the legacy results table.
- Contracts: Two Variable Exploration Contract, Request Flows, Current Contracts.

## Acceptance

- Assume on a predicate whose object is a literal leaves the panel open at
  "Stage 1 of 1" listing the literal values; Close and Run Query show them again.
- One-variable Run Query sends `/api/query/stage` and no `/api/query`.
- Parallel edges sharing one predicate variable bind together through Apply.

## Conclusion

- `runQuery` threshold changed from 2+ to 1+ variables.
- Browser tests updated for the one-variable staged flow (later group, variable
  detection, Assume on a later stage now ending with a literal Apply, parallel
  predicates, edge-menu conversion, exact numeric match). Legacy result-table
  tests now use the node action list's Run query or `getQuery` directly.
- E2E: the legacy one-variable test became "one-variable Run Query is staged
  through Ktor"; added "Assume on a predicate leaves the literal last variable
  staged with its values", which fails without the fix.
- Commands: `npm run test:query` (29 pass), `npm run check:frontend-types`
  (ok), `npx playwright test` (68 pass), `npm run test:e2e` (4 pass).
- Limitations: the variable-node action list's Run query still uses the legacy
  projection and therefore still omits literal values. The legacy predicate
  result-table path (`replacePredicateVariable`) is no longer reachable from
  the UI but is kept and tested.
- Local commit: completion commit for this task.
