---
id: QUAL-009
title: Capture at least 15 PokemonGen1 queries covering every node kind, filter and Run Query flow
status: BACKLOG
priority: P1
type: quality
depends_on: [QUAL-008, QUAL-005]
human_gate: false
created: 2026-10-16
updated: 2026-10-16
---
# Capture at least 15 PokemonGen1 queries covering every node kind, filter and Run Query flow

## Objective

T2, part 2. Extend the QUAL-008 harness to a corpus that covers the legacy
features whose requests the new app must reproduce. Skill: `tcc-test`.

## Scope

At least 15 scenarios on `PokemonGen1`, each producing the QUAL-008 fixture
triple (`.request.json`, `.response.json`, `.sparql`). A coverage table in
`fixtures/legacy/README.md` lists, per scenario, the items below; together
they cover each at least once:

- Node kinds: entity, variable, value, value variable (with and without a
  filter), class; also a predicate variable edge (FE-003).
- Filters on value nodes (`where[].filterType`) and on value variables
  (`variableFilters`): exact (no `filterType`), starts with (0), contains (1),
  at least (2), at most (3), between (6), MAX (4), MIN (5), including a MAX/MIN
  tie (BE-004).
- Run Query with one variable, with 2 and 3+ variables in a reordered stage
  order, choosing a result per variable and applying it back into the graph,
  followed by the next query.
- Requests the filter UI sends: histogram (`/api/query/numeric-profile`),
  text suggestions (`/api/query/stage`), funnel counts (`/api/query/count`)
  including a step switched off.
- A Turtle upload (`/api/local-database`) followed by one query, using a
  small checked-in fixture file.
- Includes `fire-speed-at-least-90` from QUAL-008.

Each scenario states its expected result as an independent oracle (a list or
count read from `pokemon_gen1.ttl` or the uploaded file), not only the
captured response.

## Out of scope

Legacy page changes (see D-T2a in QUAL-008); live endpoints and Wikidata
search; UI-only features with no backend request (auto layout, guided tour,
node search display); format docs (QUAL-010).

## Acceptance criteria

- [ ] At least 15 scenarios; the coverage table shows every item above
      covered by at least one named scenario.
- [ ] Each scenario's captured result matches its independent oracle
      (multiset comparison; order only where the query has ORDER BY or the
      contract fixes it, such as MAX/MIN ties).
- [ ] The single QUAL-008 command regenerates the whole corpus and is
      idempotent.
- [ ] QUAL-006 checklist rows and FE-042–FE-048 cards link the scenarios they
      must reproduce (T4/T5 reference).

## Validation

Focused: the capture command filtered to one scenario. Closing gate:
`npm run test:browser`, `npm run test:e2e`, regeneration idempotence, docs
check for the card links.

## Execution log

- 2026-10-16: Planned from the T2 brief; no code changed.
