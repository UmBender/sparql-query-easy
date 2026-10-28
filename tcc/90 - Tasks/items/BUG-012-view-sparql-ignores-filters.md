---
id: BUG-012
title: View SPARQL shows a MAX, MIN or other value filter as an exact value
status: DONE
priority: P1
type: bug
depends_on: []
human_gate: false
created: 2026-10-28
updated: 2026-10-28
---
# View SPARQL shows a MAX, MIN or other value filter as an exact value

## Objective

On a literal value with a MAX or MIN filter, View SPARQL
(`POST /api/query/sparql`) shows the filter as an exact value
(`FILTER (str(?literalValue0) = "14")`), while Run Query (`POST /api/query`)
and the study's answer check apply MAX/MIN (BE-004). The SPARQL shown must
be the query that runs. Requested by the user on 2026-10-28.
Skill: `tcc-backend`.

## Evidence

- `SparqlQueryGenerationService.generate`
  (`application/querygeneration/SparqlQueryGenerationService.kt`) drops every
  pattern filter (`patterns.map { it.copy(filter = null) }`) to keep the C#
  `GetSparqlQuery`, which passed no `FilterType` to the builder.
- So every literal filter is shown as an exact `str()` match: MAX, MIN, and
  also Starts with, Contains, At least, At most and Between. The frontend
  sends the same `where` (with `filterType`) to both routes
  (`frontend/src/lib/domain/request-parity.spec.ts`).
- Contract: [[../../03 - Backend/API v1#`POST /api/query/sparql`]] said
  "`filterType` is intentionally ignored".

## Decision

The user asked for the shown SPARQL to reflect the real filter and to record
the departure from C#. Applied to every `filterType`, not only 4/5, because
the other types had the same mismatch (worker's choice, to review).

## Acceptance criteria

- [x] `POST /api/query/sparql` with `filterType` 4/5 returns the BE-004 extreme
      subquery and `FILTER (?literalValue0 = ?__extreme0)`, with the extreme
      `LIMIT` cap, and no exact `str()` match for that literal.
- [x] Filter types 0, 1, 2, 3 and 6 render the same condition as `POST /api/query`.
- [x] An omitted or `null` `filterType` still renders the exact `str()` match.
- [x] For the same request, the displayed query has the same value
      conditions and extreme subqueries as the query `POST /api/query` runs
      (the general query adds its type and label patterns).
- [x] API v1 and Current Contracts record the change from C#.

## Validation

Focused: `SparqlQueryGenerationServiceTest`, `QueryRoutesTest`. Closing gate:
Kotlin gate.

## Conclusion

- **Fix:** `SparqlQueryGenerationService` passes the request's patterns with
  their filters to `DisplaySelectQuery` instead of clearing them, so the
  existing generator renders each condition and the BE-004 extreme subquery
  (with the `EASYQUERY_EXTREME_RESULT_LIMIT` cap) in the preview as well.
- **Tests:** `SparqlQueryGenerationServiceTest` has the exact MAX output,
  MIN with the 100-row cap, the other five filter types, a literal without a
  filter type (still exact), and the same filter lines as the executed
  `GeneralSelectQuery` for six filters. The old test that fixed the C#
  behavior was replaced. `QueryRoutesTest`: the Starts-with route test now
  expects `STRSTARTS`, and a new route test covers `filterType` 4.
- **Docs:** API v1 (general-query filters and `POST /api/query/sparql`),
  Current Contracts "Numeric filters" (marked as a departure from C#), the
  OpenAPI description (snapshot and `schema.d.ts` regenerated), and the video
  base note, whose warning about this bug is now a history note.
- **Validation:** Kotlin gate `ktlintCheck detekt test` passes (326 tests).
  Frontend gate: check and lint pass; Vitest 264 + 25 components pass;
  offline e2e 125/126 on the first run. The one failure was
  `a11y.e2e.ts` "/ in the light theme" (`#status-api` not found on the
  suite's first page load, 21.7 s), which passed on a rerun of that file
  (22/22): a cold-start flake, unrelated. `test:stack` 22/22 passes.
- **Limitation:** the extension to filter types 0–3 and 6 was the worker's
  choice (see Decision). The completion commit for this task.
