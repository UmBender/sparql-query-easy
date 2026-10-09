---
id: FE-030
title: Add a value filter to a variable node from its action list
status: DONE
priority: P1
type: frontend
depends_on: [BE-003]
human_gate: false
created: 2026-10-07
updated: 2026-10-07
---
# Add a value filter to a variable node from its action list

## Objective

User request (2026-10-07, while testing FE-026): a button to create a value
node easily, so the filter editor can be used without building the value via
Explore relationships and Convert to variable. Human decision: a node action
(not a toolbar button). Skill: `tcc-frontend`.

## Behavior

A variable node's action list offers **Add value filter**. It loads
`POST /api/query/relationships` for the variable and lists only datatype
relations (`propertyType` `label`), sorted by label. Choosing one adds a value
node fed by the variable through that relation, seeds it with the smallest
numeric value from `POST /api/query/numeric-profile` (limit 1, under the rest
of the query) or leaves it empty when the relation has no numbers, and opens
the existing Edit value filter editor (numeric or text filters by the seed;
the FE-026 branch adds its histogram there). An empty value no longer counts
as numeric in the editor.

## Acceptance

- Only datatype relations are offered, sorted; the value node is connected by
  the chosen predicate and the editor opens with the seed.
- A relation without numbers opens the text editor on an empty value.
- Live check (PokemonGen1): 13 relations listed; HP seeds 10.

## Conclusion

- `graph-actions.js` adds the action; `graph-menus.js` reuses the predicate
  choice list in a `value` mode and adds `addValueFilter`; `graph-nodes.js`
  treats an empty value as text.
- Tests: unit action list; two browser tests for the numeric and text cases.
- Commands: `npm run test:query` (29 pass), `npm run check:frontend-types`,
  `npx playwright test` (71 pass), `npm run test:e2e` (4 pass).
- Limitations: offered on variable nodes only (the editor requires a variable
  source); cancelling the editor keeps the seeded node as an exact-value
  constraint (or an empty value), which can be edited or removed; the relation
  list for a variable covers the whole dataset, not only the current query.
- Local commit: completion commit for this task (shared with BUG-006).
