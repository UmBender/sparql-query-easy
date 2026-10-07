---
id: BUG-006
title: Choosing a result keeps a fixed IRI neighbour as an IRI node
status: DONE
priority: P1
type: bug
depends_on: []
human_gate: false
created: 2026-10-07
updated: 2026-10-07
---
# Choosing a result keeps a fixed IRI neighbour as an IRI node

## Objective

User report (2026-10-07, `PokemonGen1`, on the FE-026 branch): with
`?` → immune to → Electric and `?` → Attack → 130, choosing Rhydon from the
results table turned Electric into a pink value node labelled
`http://easyquery.example.org/pokemon#ElectricType`. Skill: `tcc-frontend`.

## Evidence

`replaceWithNewNode` (`graph-nodes.js`) removes each outgoing target of the
replaced variable and calls `getRelationshipValueChange`, which always sent
`isLiteral: true` (inherited from the original frontend). The server then
returns the IRI without delimiters, labelled with itself and typed `text`, so
`addNodeWithRelationship` creates a literal node. On `main` since BUG-005
this path is reached through the variable-node action list's Run query.

## Scope and acceptance

- A fixed IRI target (`type` `node`) is fetched again with `isLiteral: false`
  and comes back as an IRI node with its label; value and variable targets keep
  `isLiteral: true`.
- Browser test: "choosing a result re-adds a fixed IRI neighbour as an IRI node
  with its label" (fails without the fix).

## Conclusion

- `getRelationshipValueChange` takes `isLiteral` (default true);
  `replaceWithNewNode` passes false for fixed IRI targets.
- Commands: `npm run test:query` (29 pass), `npm run check:frontend-types`,
  `npx playwright test` (71 pass), `npm run test:e2e` (4 pass).
- Limitation: a fixed neighbour is still removed and fetched again; when the
  chosen result has several values for that relation it becomes an
  "N results" node instead of keeping the original neighbour (unchanged
  legacy behavior).
- Local commit: completion commit for this task (shared with FE-030).
