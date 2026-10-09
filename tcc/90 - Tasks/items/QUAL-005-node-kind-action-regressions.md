---
id: QUAL-005
title: Reproduce value-node bugs and cover every node kind against every action
status: BACKLOG
priority: P1
type: quality
depends_on: [FE-031]
human_gate: false
created: 2026-10-09
updated: 2026-10-09
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
