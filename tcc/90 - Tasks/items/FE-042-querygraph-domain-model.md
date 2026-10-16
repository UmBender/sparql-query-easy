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

## Proposed amendment from the T4 brief (2026-10-16, pending user confirmation)

The T4 brief duplicates this card (conflict rule DUPLICATE). Approved scope
above is unchanged; apply only after the user confirms. It folds in the T2
amendment above, so both are confirmed together.

- Types named explicitly: `QueryGraph`, `Node` with a kind union (entity,
  variable, value, value-variable, class), `Edge`, `Filter` union (exact,
  starts with, contains, at least, at most, between, MAX, MIN),
  `VariableOrder`, `Endpoint` (built-in dataset id or remote URL).
- Operations added to the list: update node and edge, clear filter, reorder
  variables, apply a chosen result to a variable (the ported binding rule),
  validate (returns typed errors, no exceptions), toggle a funnel step on or
  off (preview state only; the step's filter stays in the graph, see FE-047).
- [ ] Every domain operation has unit tests; Vitest coverage of
      `frontend/src/lib/domain` is at least 90% (lines and branches),
      enforced as a threshold in the Vitest config.
- [ ] No module under `frontend/src/lib/domain` imports `svelte`,
      `cytoscape` or `@tanstack/*` (checked by a lint rule or test).
- [ ] T2 fixture criterion of the amendment above, stated as: each mapped
      request is JSON-equal to its `<name>.request.json` (byte-equal not
      required; filters and unordered lists as multisets).

## Pending decision D-T4a: legacy saved-query fixtures and migrator (CONTRADICTS)

The T4 brief asks for "a migrator for legacy files" and "every legacy
saved-query fixture loads and round-trips". On 2026-10-16 (D6b) the user
decided legacy `query_exported.json` (`cy.json()`) files are not imported,
and D-T2b (QUAL-010) is still open on whether such files are captured at all.

- Option A: keep D6b. The loader dispatches on `formatVersion` and has a
  migrator chain that today holds only v1 (ready for v2+). The fixture
  criterion becomes "every checked-in v1 saved-query fixture loads and
  round-trips"; files without `formatVersion` are rejected with a clear
  error. Affects only this card.
- Option B: reopen D6b. Add an importer from `cy.json()` to v1 (kinds from
  `graph-model.js` classes, filters from node data, stage order, positions),
  tested against legacy exports captured by QUAL-010 (forces D-T2b to option
  B or C). Affects FE-042, FE-048, QUAL-010, the conflict report (D6b) and
  DEC-011 notes; adds the risk that `cy.json()` carries no datatype/language,
  so imported literals are untyped.
- Recommendation: **A**, unless real users hold exported files they need to
  reopen. The version-dispatch migrator gives the brief's structure at no
  cost, and B depends on an unversioned Cytoscape-internal format.
