---
id: BE-003
title: Profile numeric relation values and add a between filter with readable labels
status: DONE
priority: P1
type: fullstack
depends_on: [BE-002]
human_gate: false
created: 2026-10-07
updated: 2026-10-07
---
# Profile numeric relation values and add a between filter with readable labels

## Objective

Shared base for the filtering visualizations (FE-026–FE-029). The user wants
to see how a numeric filter affects the data and the resulting graph, and
chose to build one tested backend contract on `main` before trying several
visual variants on separate branches. Skill: `tcc-fullstack`.

## Evidence (2026-10-07)

- `WhereHttpRequest.filterType` 2/3 render `FILTER (?lit >= N)` /
  `<= N` (numeric-validated) although the editor says "Greater Than (>)" /
  "Less Than (<)". 4/5 (MAX/MIN) only add `ORDER BY` and are rejected by the
  stage route. Each literal node carries one bound; an interval needs two
  relations. The relation label shows the raw filter number.
- Nothing tells the user the value range or how many results a filter keeps
  before running the query. Both built-in datasets store numbers as typed
  numeric literals.

## Scope

1. `POST /api/query/numeric-profile` (additive). Request: `endpointUrl`,
   `where` (the query without the profiled relation), `subject` (variable or
   IRI), `predicate` (IRI), `limit` (default 500, 1–1000). Response
   `DataResponse` with `subject`, `predicate`, `count`, `truncated`, `min`,
   `max` and `values` (`entity` typed term, display `label`, `value` lexical
   form, `number`), ordered by number. Only numeric literals are profiled.
   Errors follow the existing 400/404/502 query contract.
2. `filterType` 6 **Between**, `object` `min..max` (both numeric, min ≤ max),
   rendered as one `FILTER (?lit >= min && ?lit <= max)`; allowed in staged
   exploration.
3. Frontend base: editor wording "At least (≥)", "At most (≤)", new
   "Between (min..max)"; readable node/relation labels (`≥ 100`, `≤ 80`,
   `40–80`, MAX, MIN); a pure `numericProfileRequest` helper and a
   `fetchNumericProfile` client function the variants can reuse. No
   visualization yet.

## Out of scope

Visualizations (FE-026–FE-029), changing MAX/MIN semantics, legacy route
payloads, C# captures.

## Acceptance criteria

- [x] Profile route returns sorted numeric values, min/max/count and
      `truncated` for a Pokémon stat; non-numeric objects are excluded;
      invalid input gives 400; route documented in OpenAPI and API v1.
- [x] Between generates one combined FILTER and validates its bounds; 0–5
      behavior and captures unchanged.
- [x] Editor offers ≥/≤/Between; labels are readable; existing browser
      flows pass.
- [x] Kotlin gate and browser gate pass.

## Execution log

- 2026-10-07: Created from the user's request; implementation started on
  `main`.
- 2026-10-07: Implemented.
  - Backend: `Between` filter and `NumericProfileQuery` in
    `WikidataQueryGenerator.kt`; `NumericProfileService` runs an aggregate query
    (COUNT/MIN/MAX over distinct entity/value pairs with `isNumeric`) and a
    values page (ordered, labelled like stage candidates); route, DTOs and
    OpenAPI `profileNumericRelation`.
  - Frontend: `queryCalculations.filterTypeOf`, `parseBetween`,
    `filterLabel`, `numericProfileRequest`; `fetchNumericProfile` and
    `filterEdgeItems` in `app-core.js`; editor options At least (≥), At most
    (≤), Between; readable node labels; the editor edits the raw value of a
    filtered node.
  - **Bug found and fixed:** "Exact match"/"Exactly Equal" stored filterType
    `""`, which `buildFilters` turned into `0` (Starts with), so an exact 45
    also matched 450. It now sends no filterType (exact `str()` match).
  - Validation: `./gradlew ktlintFormat ktlintCheck detekt test` 148 tests,
    0 failures (new `NumericProfileRoutesTest`, Between generator cases,
    OpenAPI inventory/enum updated for the approved additive contract);
    `npm run test:browser` 68 passed; `npm run test:query` 29 passed;
    `npm run test:e2e` 3 passed; `npm run check:frontend-types`;
    `git diff --check`; docs check.
  - Limitations: `min`/`max` are JSON doubles (very large decimals lose
    precision; `value` keeps the lexical form). Between needs one relation;
    two separate ≥/≤ relations still constrain possibly different values of a
    multi-valued property. MAX/MIN keep their ordering-only meaning.
  Completion commit for this task.
