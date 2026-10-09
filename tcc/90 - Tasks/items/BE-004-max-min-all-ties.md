---
id: BE-004
title: Make MAX and MIN keep every entity with the extreme value, capped by a configurable limit
status: DONE
priority: P1
type: fullstack
depends_on: [FE-035]
human_gate: false
created: 2026-10-09
updated: 2026-10-09
---
# Make MAX and MIN keep every entity with the extreme value, capped by a configurable limit

## Objective

User request (2026-10-09): MAX/MIN should return all variables with the max/min
value, support several MAX/MIN filters in one query, and stop at an upper limit
of 100 that is configurable in a `.env`-style file. Skill: `tcc-fullstack`.

Approved contract change: filterType `4`/`5` used to only order the results
(`ORDER BY DESC/ASC`, forced `LIMIT 1`, legacy C# behavior pinned by
`SELECT-ORDER-MAX-001`/`SELECT-ORDER-MIN-001`). They now filter.

## Scope

- `WikidataQueryGenerator` (`GeneralSelectQuery`, `DisplaySelectQuery`): each
  MAX/MIN literal pattern gets a subquery computing `MAX`/`MIN` of that
  relation over the rest of the query (other filters apply; other MAX/MIN
  relations keep their triple pattern without their extreme constraint) and
  `FILTER (?literal = ?extreme)`. No `ORDER BY`. `LIMIT` is the caller limit
  capped by the configured extreme limit.
- Setting `EASYQUERY_EXTREME_RESULT_LIMIT` (default 100, 1–10000): process
  environment first, else `.env` in the working directory (git/docker ignored;
  `.env.example` committed), else default. Invalid values fail startup.
- Filter editor (FE-035): MAX/MIN show the tied winners from the profile
  (MIN always; MAX when the profile is complete), highlight their bar, and
  cycle when more than five tie.
- Exclusions: staged exploration and numeric profiles still reject MAX/MIN.
  Capture corpora stay unchanged (the ordering fixture has no ties, so its
  HTTP results still match).

## Acceptance criteria

- [x] Ties return every tied entity on a local graph; two MAX/MIN filters
      combine; the cap limits rows; generated queries parse.
- [x] The limit is read from the environment, then `.env`, then 100; invalid
      values are rejected with a clear message.
- [x] Editor shows MAX/MIN winners (offline browser test).
- [x] Kotlin `ktlintCheck detekt test`, `npm run test:query`,
      `npm run check:frontend-types` and `npm run test:browser` pass.

## Execution log

- 2026-10-09: Created; branch `BE-004-max-min-ties` from FE-035.
- 2026-10-09: Implemented. Generator: `QueryText.extremes` adds one
  `SELECT (MAX|MIN(...) AS ?__extremeN)` subquery per extreme pattern plus
  `FILTER (?literalValueN = ?__extremeN)`; no `ORDER BY`; `LIMIT` =
  min(request, cap); `CSharpCompatibleWikidataQueryGenerator(extremeResultLimit)`.
  `config/AppSettings.kt` loads `EASYQUERY_EXTREME_RESULT_LIMIT` (environment >
  `.env` > 100), wired in `defaultHttpDependencies`; `.env.example` committed,
  `.env` git/docker-ignored. `CaptureDrivenCompatibilityTest` records the two
  ordering captures as approved query-text changes (captures unchanged; HTTP
  bodies and executed rows still compared). Editor: MAX/MIN winners and
  partial-profile MAX message. Validation: `./gradlew ktlintCheck detekt test`
  exit 0 (new `ExtremeFilterExecutionTest`, `AppSettingsTest`),
  `npm run test:query` 35/35, `npm run check:frontend-types` clean,
  `npm run test:browser` 80/80, docs check and `git diff --check` clean.
  Smoke on `installDist` with `.env` = 10, PokemonGen1: MAX evolutionStage
  (16 ties) → 10 rows, caller limit 4 → 4, MIN specialDefense → 3 ties
  (Magikarp, Caterpie, Weedle); `.env` = 0 stops startup with the message.
  Limitation: on Wikidata the subquery repeats the other patterns and may be
  slower. Completion commit for this task.
