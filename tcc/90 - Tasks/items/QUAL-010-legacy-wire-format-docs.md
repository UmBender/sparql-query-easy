---
id: QUAL-010
title: Document the legacy drawn-graph request and saved-query formats field by field
status: DONE
priority: P1
type: documentation
depends_on: [QUAL-009, COM-001]
human_gate: true
created: 2026-10-16
updated: 2026-10-17
---
# Document the legacy drawn-graph request and saved-query formats field by field

## Objective

T2, part 3. Give FE-042 (QueryGraph mapping and versioned format) a
field-by-field description of what the legacy page sends and saves, backed by
the QUAL-009 fixtures. Skill: `tcc-test` (documentation with fixture oracle).

## Confirmed facts

- The API takes a flat `where` list of `{subject, predicate, object,
  filterType}` strings plus `variableFilters` (`QueryHttpModels.kt`, filter
  codes 0 Starts, 1 Contains, 2 Greater/equal, 3 Lesser/equal, 4 Max, 5 Min,
  6 Between); node identity, kinds and stage order exist only in the browser.
- Export is `JSON.stringify(cy.json())` downloaded as `query_exported.json`
  (`sparql/app-core.js`); import is `cy.json({ elements })`
  (`sparql/index2.html`). It is Cytoscape-internal and unversioned.
- [[../../04 - Frontend/Request Flows]] (COM-001) already maps each request;
  this card adds the field-level shape, not a second flow description.

## Scope

- Request shape: every field of each `/api/*` body the legacy page sends
  (type, allowed values, how each node kind and filter maps to it, what is
  lost, such as datatype/language), with a link to a fixture showing it. Placed
  in Request Flows or a new note linked from it (choice at execution).
- A check that every top-level request field seen in `fixtures/legacy/` is
  documented (proposed: a small `node` script run by the capture command).
- Saved-query format and exported fixtures: only as decided in D-T2b.

## Out of scope

Changing any API or legacy behavior; designing the new versioned format
(FE-042); a legacy importer (removed by the user on 2026-10-16, D6b).

## Decision D-T2b: saved-query fixtures "for format compatibility" (resolved: B)

The T2 brief asks to collect legacy exported files as fixtures for format
compatibility and document the format field by field. On 2026-10-16 (D6b)
the user decided legacy `query_exported.json` files are not imported; FE-042
and FE-048 support only the new versioned format.

- Option A: drop saved-query fixtures and their documentation. Affects only
  this card; FE-042 designs the new format from the QueryGraph alone.
- Option B: capture a few exports (Playwright download) from QUAL-009
  scenarios and document the `cy.json()` fields, labelled characterization
  only, not a compatibility target. Affects this card and gives FE-042 a
  checklist of what a saved query held (positions, kinds, filters, stage
  order). Positions vary with layout and need normalization.
- Option C: reopen D6b and support importing legacy files. Affects FE-042,
  FE-048, the conflict report and DEC-011 notes.
- Recommendation: **B**. It keeps D6b intact and is cheap once QUAL-008
  exists; the field list helps FE-042 avoid losing information.

## Acceptance criteria

- [x] Every request field in `fixtures/legacy/*.request.json` is documented
      with type, meaning and a fixture link; the field check passes.
- [x] Saved-query part delivered as D-T2b decides.
- [x] FE-042 and FE-043 link the documentation (T4 reference).

## Validation

The field check; `node scripts/check-project-docs.mjs`; `git diff --check`.

## Execution log

- 2026-10-16: Planned from the T2 brief; no code changed.
- 2026-10-17: D-T2b taken as the recommended option B under the user's
  full-migration goal. Wrote [[../../04 - Frontend/Legacy Wire Format]]
  (graph-to-request mapping, filter codes, lost information, one field table
  per route, the Export Query file), linked from Request Flows, FE-042 and
  FE-043. Added `scripts/check-legacy-fixture-fields.mjs`, run by
  `npm run fixtures:legacy`; it passes on the corpus and fails when a row is
  removed (checked with `isLiteral`). The capture writes
  `<name>.export.json` for four scenarios. Validation: field check;
  `npm run fixtures:legacy -- --grep …` for the four export scenarios (no
  other fixture changed); docs check; `git diff --check`. Completion commit
  for this task.
