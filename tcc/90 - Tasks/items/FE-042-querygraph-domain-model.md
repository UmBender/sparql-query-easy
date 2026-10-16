---
id: FE-042
title: Model the drawn query as a typed QueryGraph with a versioned saved format
status: BACKLOG
priority: P1
type: frontend
depends_on: [FE-040, QUAL-006]
human_gate: false
created: 2026-10-16
updated: 2026-10-16
---
# Model the drawn query as a typed QueryGraph with a versioned saved format

## Objective

T4, part 1, and condition 1 of DEC-011: the framework-free domain comes
first. Skill: `tcc-refactor` (port) with `tcc-test`.

## Scope

- `frontend/src/lib/domain/`: `QueryGraph` (nodes with kind, typed RDF term
  with datatype/language, edges with predicate, value-variable filters, stage
  order) and pure operations (add, connect, remove, convert, bind a variable,
  set filter).
- Port the rules and unit tests of `graph-model.js`, `graph-binding.js`,
  `graph-actions.js`, `query-calculations.js`, `query-stages.js`; the ported
  tests are the oracle and must keep their expected values.
- Mapping `QueryGraph` → existing request DTOs (`where`, `variableFilters`,
  stage bindings); same payloads as the legacy page for the same graph.
- Versioned saved format (`formatVersion: 1`) with Zod schema. No importer
  for legacy `query_exported.json` (`cy.json()`) files: dropped by the user
  on 2026-10-16.

Excluded: Svelte, Cytoscape, HTTP, legacy export files.

## Acceptance criteria

- [ ] Ported unit cases pass unchanged in Vitest.
- [ ] For the QUAL-005 graphs the payload equals the legacy payload.
- [ ] Round-trip save/load is lossless.

## Proposed amendment (2026-10-16, pending user confirmation)

From the T2 brief (QUAL-008–QUAL-010, conflict rule EXTENDS). Approved scope
above is unchanged; apply only after the user confirms.

- `depends_on` adds QUAL-009 and QUAL-010.
- [ ] For every `fixtures/legacy/<name>` scenario whose graph the domain can
      build, the mapped request equals `<name>.request.json` (filters and
      unordered lists compared as multisets).
- [ ] The QueryGraph and the versioned format cover every field listed in the
      QUAL-010 request documentation, or the card records why one is dropped.
