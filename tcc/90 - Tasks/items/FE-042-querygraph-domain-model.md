---
id: FE-042
title: Model the drawn query as a typed QueryGraph with a versioned saved format
status: BACKLOG
priority: P1
type: frontend
depends_on: [FE-040, QUAL-006, QUAL-009, QUAL-010]
human_gate: false
created: 2026-10-16
updated: 2026-10-16
---
# Model the drawn query as a typed QueryGraph with a versioned saved format

## Objective

T4, part 1, and condition 1 of DEC-011: the framework-free domain comes
first. Skill: `tcc-refactor` (port) with `tcc-test`.

## Scope

- `frontend/src/lib/domain/` types: `QueryGraph`, `Node` with a kind union
  (entity, variable, value, value-variable, class) and a typed RDF term with
  datatype/language, `Edge` with predicate, `Filter` union (exact, starts
  with, contains, at least, at most, between, MAX, MIN), `VariableOrder`
  (stage order), `Endpoint` (built-in dataset id or remote URL).
- Pure operations: add, update, remove and connect nodes and edges; convert
  a node's kind; set and clear a filter; reorder variables; apply a chosen
  result to a variable (the ported binding rule); validate (returns typed
  errors, no exceptions); switch a funnel step on or off (preview state
  only; the step's filter stays in the graph, rendered by FE-047).
- Port the rules and unit tests of `graph-model.js`, `graph-binding.js`,
  `graph-actions.js`, `query-calculations.js`, `query-stages.js`; the ported
  tests are the oracle and must keep their expected values.
- Mapping `QueryGraph` → existing request DTOs (`where`, `variableFilters`,
  stage bindings); same payloads as the legacy page for the same graph,
  field by field as documented in QUAL-010.
- Versioned saved format (`formatVersion: 1`) with Zod schema. The loader
  dispatches on `formatVersion` through a migrator chain that holds only v1
  today, ready for v2+ (D-T4a). Files without `formatVersion` are rejected
  with a clear error.

Excluded: Svelte, Cytoscape, HTTP; legacy `query_exported.json`
(`cy.json()`) files (D6b, D-T4a).

## Decision D-T4a: legacy saved-query migrator (CONTRADICTS, resolved)

The T4 brief asked for "a migrator for legacy files" and that every legacy
saved-query fixture load and round-trip; D6b had dropped the legacy importer.
On 2026-10-16 the user chose option A: keep D6b. The migrator is the
`formatVersion` dispatch above, and the round-trip criterion applies to
checked-in v1 fixtures. Rejected option B (importer from `cy.json()`) would
have reopened D6b and forced D-T2b.

## Fixture scenarios (QUAL-009)

Every scenario whose graph the domain builds: the mapped `where`, `variableFilters` and stage requests must equal the captured `.request.json` entries. See `fixtures/legacy/README.md` and [[../../04 - Frontend/Frontend Parity Checklist]].

## Acceptance criteria

- [ ] Ported unit cases pass unchanged in Vitest.
- [ ] Every domain operation has unit tests; Vitest coverage of
      `frontend/src/lib/domain` is at least 90% (lines and branches),
      enforced as a threshold in the Vitest config.
- [ ] No module under `frontend/src/lib/domain` imports `svelte`,
      `cytoscape` or `@tanstack/*` (checked by a lint rule or test).
- [ ] For the QUAL-005 graphs the payload equals the legacy payload.
- [ ] For every `fixtures/legacy/<name>` scenario whose graph the domain can
      build, the mapped request is JSON-equal to `<name>.request.json`
      (filters and unordered lists compared as multisets).
- [ ] The QueryGraph and the versioned format cover every field listed in the
      QUAL-010 request documentation, or this card records why one is dropped.
- [ ] Every checked-in v1 saved-query fixture loads and round-trips
      losslessly; a file without `formatVersion` or with an unknown version
      fails with a typed error.

## Execution log

- 2026-10-16: Merged the T2 amendment (QUAL-009/010 dependencies, fixture
  and field-coverage criteria) and the T4 amendment (named types, extra
  operations, 90% coverage, no-UI-import check) after user confirmation;
  recorded D-T4a = A. No code changed.
