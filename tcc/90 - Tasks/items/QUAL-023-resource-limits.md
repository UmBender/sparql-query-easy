---
id: QUAL-023
title: Prove oversized or slow requests cannot exhaust the server
status: DONE
priority: P2
type: quality
depends_on: []
human_gate: false
created: 2026-10-27
updated: 2026-10-28
---
# Prove oversized or slow requests cannot exhaust the server

## Objective

Security plan threat 12 ([[../../08 - Quality/Security Test Plan]]).
Skills: `tcc-test`, `tcc-backend`.

## Scope and acceptance

- Every route with `limit`/`offset`/`maxResults` caps them (record the caps;
  `400` or clamp per contract); a request body above a fixed size is `413`.
- A query that runs too long on a local graph is cancelled by a timeout
  (fake slow executor) with the contract error, and the server keeps
  serving other requests.
- Login/register flooding hits the existing `429`; study submissions get a
  per-user rate limit if missing (decide value; record).
- Deeply nested or very large `where` arrays are rejected before
  generation.
- Found by QUAL-020 (2026-10-28): a task or attempt text containing U+0000
  answers `503 Accounts are temporarily unavailable` (PostgreSQL cannot
  store NUL), and an attempt whose answer variable is longer than 64
  characters answers `500` (column width). Both must become `400` with the
  contract error, validated before persistence; the QUAL-020 study
  injection test excludes these two cases until then.

## Validation

Kotlin gate.

## Decisions (worker, 2026-10-28; the user asked for values based on what the code uses)

- Body 1 MiB: a drawn query or questionnaire answer is a few KB; the Turtle
  upload keeps its own limit (QUAL-021, 5 MB).
- `limit` ≤ 10,000 on query/sparql/search: the study's `MAX_MAX_RESULTS` and
  the stage `STAGE_MAX_OFFSET`; the UI field allows 1,000. 400 above, no clamp.
- 100 `where` patterns and 100 `variableFilters` (no previous cap; a drawn
  graph has tens).
- Local query timeout 30 s: the remote request timeout
  (`WikidataHttpClient.DEFAULT_REQUEST_TIMEOUT`); 502 like a remote timeout.
- 30 attempts a minute per user, in memory like `AttemptLimiter` for login;
  DEC-014 Q1 A (unlimited attempts) still holds for the total.
- Found while testing: JSON depth capped at 32 (see Conclusion).

## Conclusion

- **Body:** `http/RequestLimits.kt` `RequestBodyLimit` (on `ReceiveRequestBytes`):
  a declared `Content-Length` over 1 MiB, or a chunked body counted past it
  while read, is `413` before a route sees it (`PayloadTooLargeException`,
  also unwrapped from ContentNegotiation's `BadRequestException`). The Turtle
  upload path is skipped here (QUAL-021). Installed in `configureRouting`.
- **Caps:** `checkedLimit()` on query/sparql/search; `toPatterns()` and
  `toVariableFilters()` (`QueryHttpModels.kt`) check the list sizes on every
  query route and on drawn queries. Existing caps (stage 1–50 / 0–10,000,
  16 bindings, profile 1–1,000, task `maxResults` 1–10,000) are recorded and
  tested.
- **Timeout:** `JenaLocalSparqlExecutor` runs on `Dispatchers.IO` with Jena's
  overall timeout (`LOCAL_QUERY_TIMEOUT` 30 s); `QueryCancelledException` is
  `SparqlQueryExecutionFailure("Query timed out after 30s")`, so `502`.
- **Rate limit:** `StudyHttpDependencies.submissionLimiter` (30/min, key
  `user:<id>`) on `POST /api/study/tasks/{key}/submissions`, `429`.
- **QUAL-020 findings fixed:** `receiveLenient` (every stored study/admin
  body) refuses U+0000 anywhere in a string or key (`400`) before decoding;
  `toDrawnQuery` refuses an answer variable over 63 characters (`400`). The
  QUAL-020 study injection test now sends every payload to every field (its
  limiter is lifted: it makes hundreds of attempts).
- **New finding:** a lenient body with an ignored field nested ~1,000 levels
  deep overflowed kotlinx's recursive array parser (StackOverflowError,
  `500`). `requireShallowJson` caps nesting at 32 before parsing. Strict
  (query and auth) bodies already failed with `400` at the unknown key.
- **Tests:** `security/RequestLimitsRoutesTest` (7) and
  `http/StudyRequestLimitsRoutesTest` (4); see the Security Test Plan.
  `JenaRdfInfrastructureTest`'s helper assumed the executor never suspends;
  it now uses `runBlocking` (assertions unchanged).
- **Docs:** API v1 "Request limits (QUAL-023)" and the attempts section;
  OpenAPI (submit 400/429 descriptions; snapshot and `schema.d.ts`
  regenerated); Current Contracts "Request limits"; Security Test Plan;
  Operational Map.
- **Validation:** Kotlin gate passes (337 tests); frontend gate passes
  (Vitest 264 + 25, e2e 126); `test:stack` passes (22).
- **Limitations:** the limiters are per process and in memory (one backend).
  Caddy has no `request_body` limit: an oversized body reaches Ktor, which
  stops reading it at 1 MiB. The completion commit for this task.
