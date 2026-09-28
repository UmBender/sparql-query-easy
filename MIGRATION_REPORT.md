# Compatibility Audit Report

For current development decisions use
[Current Contracts](<tcc/09 - Decisions/Current Contracts.md>).
This report preserves historical audit and compatibility evidence.

Original audit date: 2026-09-10
Documentation reconciled: 2026-09-21
Original audited Kotlin revision: `720e9c3`
Original C# project: retired from the worktree; recoverable from Git commit
`0f20091`

The user approved the exact 24-file C# removal scope and repository rollback
plan on 2026-09-27. The deletion diff was checked against that scope and the
user requested commit and push. Neither capture corpus nor expected output was
changed. No deployment occurred.

## Executive summary

The Kotlin implementation has strong component-level coverage for RDF parsing,
local SPARQL, query generation, filtering, endpoint selection, upload, and the
separate Wikidata transports. The .NET 8 characterization harness has now
produced and committed 34 immutable C# captures under
`compatibility/expected/`. The capture-driven Kotlin HTTP comparator passes for
successful local and generated-query cases, subject to the documented
unordered-result comparison rule.

On 2026-09-27, three additional success captures were recorded separately
under `compatibility/retirement-expected/`, leaving the original 34 intact.
Kotlin matches the C# Wikidata and controlled generic remote SPARQL outputs.
The C# health status matches but its plain-text body differs from Kotlin JSON.
The user approved retaining Kotlin JSON under `DEC-009` as an intentional
difference, not as equivalent output.

Successful local fixture comparisons now include graph isomorphism, Kotlin's
actually executed SPARQL, projected variables, result-row multiplicity,
bound/unbound bindings, RDF term details, and the documented ordered versus
unordered comparison rule. Exception-only C# harness captures remain
non-equivalent because they do not represent ASP.NET middleware responses.

`SEARCH-LOCAL-001` and `BUILTIN-GRAPH-001` were repaired and recaptured on
2026-09-17. Harness instrumentation is now a `LocalQueryExecutor` subclass, so
the runtime-type test selects the production local-search branch. Both cases
are enabled in the Kotlin comparator and pass without weakened assertions.

No fixture is marked equivalent solely from source inspection. The completed
comparison found and corrected fragment-IRI acceptance, Unicode IRI ASCII
normalization, and .NET empty-authority-path normalization differences.

### Canonical built-in dataset

Option 1 was approved on 2026-09-16: the C# `Sparql.QueryEasy/futebol_completo.ttl`
asset (SHA-256
`2345428c9513651dcf184835538fa910abae6c95fcb399e508709d646af7993f`) remains
the sole built-in dataset. Since OPS-001, Gradle packages a byte-identical
Kotlin-owned copy at `src/main/resources/futebol_completo.ttl`;
`sparql/databases/brasileirao2023.ttl` is reference-only and no capture baseline
was changed.

## Commands and results

| Command | Result |
|---|---|
| `dotnet run --project compatibility/Compatibility.Harness/Compatibility.Harness.csproj` | Passed with .NET SDK 8.0.130; generated 34 reviewed C# captures. |
| `./gradlew test --tests 'com.example.sparqlqueryeasy.http.CaptureDrivenCompatibilityTest' --no-daemon --console=plain` | Passed offline on 2026-09-21. The comparator checks valid captured graphs, route HTTP output, generated/executed SPARQL, raw projected variables and rows, binding presence, RDF terms, duplicate rows, and documented ordering. |
| `./gradlew ktlintCheck detekt test --no-daemon --console=plain` | Passed the complete Kotlin quality gate on 2026-09-21. |
| `npm run test:browser` | Eight offline Playwright tests passed on 2026-09-21 using the local fixture server and CDN stubs. |
| `./gradlew test --tests 'com.example.sparqlqueryeasy.http.OpenApiRoutesTest' --no-daemon` | Passed on 2026-09-27; public Swagger/spec endpoints, exact eight-operation inventory, OpenAPI 3.1 validation, and representative schemas/errors are verified offline. |
| `./gradlew ktlintFormat ktlintCheck detekt test --no-daemon` | Passed the complete Kotlin quality gate on 2026-09-27 after the OpenAPI implementation. |
| `dotnet run --project compatibility/Compatibility.Harness/Compatibility.Harness.csproj --no-build -- --retirement-success` | Captured the three separately indexed C# retirement success cases on 2026-09-27 with .NET SDK 8.0.131 and no live upstream request. |
| `./gradlew ktlintFormat test --tests 'com.example.sparqlqueryeasy.http.RetirementSuccessCompatibilityTest' --tests 'com.example.sparqlqueryeasy.wikidata.client.WikidataHttpClientTest' --no-daemon` | Passed offline after mapping language-tagged remote SPARQL JSON literals to `rdf:langString`. |
| `./gradlew ktlintCheck detekt test --no-daemon` | Passed the full offline Kotlin gate on 2026-09-27 after the retirement captures and parser correction. |
| `./gradlew ktlintCheck detekt test installDist --no-daemon` | Passed on 2026-09-27 for the C# removal preflight; the distribution was rebuilt. |
| `npm run test:browser` | Passed 22/22 tests on 2026-09-27; external CSS/fonts remain a separate offline-determinism limitation. |
| Installed Kotlin distribution HTTP smoke | `/health` returned `200 application/json {"status":"ok"}`; `/index2.html` and `/openapi.json` returned HTTP 200. |
| `dotnet build compatibility/Compatibility.Harness/Compatibility.Harness.csproj --no-restore --verbosity quiet` | Final historical harness build passed with 0 errors and 20 existing warnings; no recapture. |

The opt-in live Wikidata integration task was intentionally not run. Ordinary
verification must remain offline.

## Test coverage by category

| Category | Kotlin test evidence |
|---|---|
| Turtle upload, parsing, graph cache, lifecycle | `LocalDatabaseUploadServiceTest`, `LocalDatabaseRoutesTest`, `HttpModuleLifecycleTest` |
| RDF/Jena mapping, local SPARQL, graph comparison | `JenaRdfInfrastructureTest`, `JenaSmokeTest`, `CaptureDrivenCompatibilityTest` |
| Endpoint contexts and application query/search orchestration | endpoint, general-query, filtering, relationship, and search tests |
| Wikidata SPARQL/MediaWiki transport and generation | query-generator and HTTP-client tests using deterministic fakes/MockEngine |
| HTTP/static frontend | route tests, application tests, static-resource tests, and offline Playwright tests |
| OpenAPI/Swagger contract | runtime endpoint tests, exact operation inventory/schema assertions, and Swagger Parser validation |

Test counts are intentionally not frozen in this report because the suite has
continued to grow. The verification commands, not a historical count, are the
authoritative execution record.

## Fixture execution matrix

The C# captures are real .NET 8 harness output. For valid local-route cases,
the capture-driven Ktor test now compares successful response status/body,
Jena graph isomorphism, actual executed SPARQL, and raw bindings. The
exception-only cases below remain explicitly excluded, not silently
normalized.

| Fixture group | Cases | C# execution | Kotlin execution | Classification |
|---|---|---|---|---|
| Turtle/RDF | `TTL-SIMPLE-001`, `TTL-PREFIX-001`, `TTL-BASE-001`, `TTL-IRI-UNICODE-001`, `TTL-BNODE-001`, `TTL-LITERAL-001`, `TTL-NUMERIC-001`, `TTL-EMPTY-001`, `TTL-INVALID-001`, `TTL-INVALID-002` | Captured graph/exception evidence | Offline Jena graph-isomorphism comparator and route upload | Valid graphs compared; invalid-Turtle exception captures intentionally non-equivalent |
| Generated SELECT | `SELECT-BASIC-001`, `SELECT-OPTIONAL-001`, four filter cases, `SELECT-DISTINCT-001`, order/max/min, zero/two limit, empty, invalid | Captured generated query/raw results | Offline generated-query and local route comparator | Valid captures compared; invalid-query exception capture intentionally non-equivalent |
| Query boundaries | offset, generated-path, ASK/CONSTRUCT unavailable, injection-path | Generated-path capture where available | Offline generated-query comparator | Injection capture is generated-query evidence only; unsupported raw operations remain outside the public API |
| Relationships/filtering | `RELATIONSHIPS-LOCAL-001`, `RELATIONSHIP-LITERAL-001`, `RELATIONSHIP-RESOURCE-001`, `QUERY-EMPTY-WHERE-001` | Captured route/raw results | Offline route/raw-result comparator | Valid captures compared |
| Search/endpoints | `SEARCH-LOCAL-001`, `BUILTIN-GRAPH-001`, `LOCAL-CACHE-MISS-001` | Reviewed local-branch captures or exception capture | Offline route/raw-result comparator and deterministic service tests | Search captures compared; cache-miss exception remains intentionally non-equivalent |
| HTTP | Original exception captures; separate `HTTP-HEALTH-001` | Real ASP.NET host returned `200 text/plain Healthy` | Kotlin health route returns `200 application/json {"status":"ok"}` | Status matches; body/content type intentionally differ under approved DEC-009. Middleware-error equivalence was waived. |
| Wikidata | `WIKIDATA-GENERATION-001`; separate `WIKIDATA-SEARCH-CSHARP-001`; recorded success and controlled fault bodies | C# controller/service captured with the recorded public success body injected by a fail-closed handler | Ktor route replays the same body offline | Success status/JSON match; non-2xx JSON `502` remains an approved intentional difference. |
| Generic remote SPARQL | Separate `REMOTE-RELATIONSHIP-CSHARP-001` | C# controller/service/`RemoteQueryExecutor` with controlled SPARQL JSON; generated query, raw result, and response captured | Kotlin remote transport and route replay same body offline | Response, query, projected variables, binding presence, and RDF terms match; language literal `rdf:langString` mapping fixed without weakening assertions. |

## Detailed compatibility findings

### Confirmed valid-capture representation coverage

The Kotlin Jena boundary keeps IRIs, blank nodes, literal lexical forms,
datatype IRIs, language tags, projected variable order, explicit unbound
bindings, duplicate rows, and graph-isomorphism comparison in application
types. `CaptureDrivenCompatibilityTest` compares these against the available
valid C# harness output through the Kotlin route boundary. It preserves a row
multiset for unordered queries and retains order only for captured `ORDER BY`
queries.

### Existing C# defects intentionally preserved

- `QUERY-EMPTY-WHERE-001`: C# binds `?itemParentType`, projects `?itemType`,
  then filters on the unprojected parent type. Kotlin preserves the resulting
  empty behavior; see `MIGRATION.md` Prompt 16.
- Local search retains executor row order and performs filtering before its
  fixed `Take(20)`. It does not claim stable ordering where SPARQL lacks
  `ORDER BY`.

### Intentional behavior changes

- Typed query terms reject arbitrary raw path/IRI interpolation and negative
  limits. This is a documented SPARQL-injection safety correction.
- Generic endpoints are restricted to absolute HTTP(S) URLs with a host.
- MediaWiki entity-search HTTP failures are explicit Kotlin application
  failures; C# returned an empty result on non-success status.
- `POST /api/local-database` maps absent `ttlFile` and invalid Turtle to
  `400` JSON errors. The C# controller dereferenced a missing file or let parse
  failures escape.

The explicit JSON `400`/`404`/`502` route contract is approved. The stricter
query-term and generic-endpoint policies still require the production security
decision tracked by `SEC-001`; capture evidence is not being rewritten to hide
either difference.

### Approved production-contract decisions

The Kotlin development port remains `8080`; this is an approved intentional
difference from the C# `5242`/`7070` profiles. Kotlin's explicit JSON error
responses are approved: invalid input is `400`, an unavailable local graph is
`404`, and upstream execution failure is `502`. The frontend contract is
`sparql/index2.html`; the legacy `index.html` was removed because it discarded
the valid `filterType: 0` (`Starts`) value.

Production CORS is deliberately deferred until a frontend domain is selected.
Local development should serve the frontend and API together from Ktor at
`http://localhost:8080`, requiring no CORS policy. The future deployment task
is a restrictive origin allow-list with integration coverage; wildcard CORS is
not approved.

### Captured error cases — approved Kotlin contract, still non-equivalent

The .NET 8 in-process harness now has reviewed captures for the cases below in
`compatibility/expected/`. They are deliberately **not** marked equivalent:
the C# harness records an exception category before ASP.NET Core middleware
produces an HTTP response, whereas Kotlin exposes an explicit route response.
The C# baseline remains unchanged. The Kotlin JSON error contract is approved,
so these are intentional differences rather than pending decisions or false
compatibility claims.

| Case | C# capture | Kotlin behavior | Classification |
|---|---|---|---|
| `HTTP-BAD-JSON-001` | `System.Text.Json.JsonReaderException` during request JSON parsing | `400` JSON malformed-request response | Intentional non-equivalence; Kotlin contract approved |
| `HTTP-MISSING-UPLOAD-001` | `System.NullReferenceException` from controller invocation without `ttlFile` | `400` JSON error, `Missing required upload: ttlFile` | Intentional non-equivalence; Kotlin contract approved |
| `LOCAL-CACHE-MISS-001` | `System.Exception` from controller/query invocation | `404` JSON error for an unavailable local graph | Intentional non-equivalence; Kotlin contract approved |
| `SELECT-INVALID-001` | dotNetRDF query/parser exception | `400` JSON invalid-query response | Intentional non-equivalence; Kotlin contract approved |
| `TTL-INVALID-001` | dotNetRDF `RdfParseException` | `400` JSON Turtle parsing error | Intentional non-equivalence; Kotlin contract approved |
| `TTL-INVALID-002` | dotNetRDF `RdfParseException` | `400` JSON Turtle parsing error | Intentional non-equivalence; Kotlin contract approved |

These error cases are excluded from normal response-equality assertions in the
capture-driven Kotlin suite. This records the difference rather than weakening
either C# capture or Kotlin route assertions.

### Incomplete compatibility and production coverage

- Code-generated OpenAPI 3.1 is implemented and public at `/openapi.json`, with
  Swagger UI at `/swagger`. Offline tests validate it with Swagger Parser and
  enforce the exact eight-operation inventory and representative schemas.
- Authentication is a new approved requirement, not C# parity; `AUTH-000` must
  define its contract before backend/frontend implementation.
- HTTPS termination and restrictive production CORS are deferred to `OPS-002`
  until the hosting/domain/frontend-origin decision exists. Same-origin local
  development at `http://localhost:8080` requires no CORS policy.
- `application.conf` defaults to HTTP port `8080`; C# development profiles use
  `http://localhost:5242` and `https://localhost:7070`. Port `8080` is an
  approved intentional change, not missing parity.
- The C# health response was captured from the actual ASP.NET host. Its
  `text/plain Healthy` body differs from Kotlin's JSON `{"status":"ok"}`;
  the user approved retaining JSON under `DEC-009` as an intentional change.
  Response equivalence is not claimed.
- The user explicitly waived additional C# middleware-error equivalence
  captures. Existing exception-only evidence remains intact; no claim of
  equivalent error status/body is made.

### Unresolved risks

- Valid captured dotNetRDF/Jena graphs and raw query results are compared.
  Parser diagnostic text for invalid Turtle, additional numeric edge cases,
  and unspecified row order outside the fixtures remain broader risks.
- C# HTTP framework error bodies/statuses for malformed JSON, invalid Turtle,
  missing upload, cache miss, and remote failures are not black-box goldens by
  the approved waiver. Kotlin's explicit JSON errors remain intentional.
- One public Wikidata success body is stored with provenance and replayed in
  both C# and Kotlin without normal-test network access. The non-2xx and
  malformed cases are controlled faults, not observed Wikidata responses.
  Three additional C# retirement captures are separate from the immutable
  34-case corpus; see `compatibility/retirement-expected/README.md`.

## Manual verification procedure

1. Treat the 34 committed captures and `capture-status.tsv` as immutable
   reviewed evidence. Recapture only after an approved harness correction or
   intentional C# baseline change, and review every diff before committing it.
2. Run `CaptureDrivenCompatibilityTest`; it executes the valid upload/query
   sequence through Ktor without live Wikidata.
3. Normalize generated upload UUIDs, blank-node encounter labels, and the
   documented literal-variable suffix only. Do
   not normalize row order, lexical literal values, language/datatype fields,
   response status, or JSON property presence.
4. Compare controller status/body, generated query text, raw projected
   variables, bindings, graph snapshots, and diagnostics. Add a minimal
   regression before correcting each confirmed Kotlin difference.
5. Preserve the explicit waiver of further C# middleware-error captures;
   never label those in-process exception categories as response-equivalent.

## Deployment and rollback recommendations

- The health-body decision is complete. The .NET deployment YAML was archived
  outside `.github/workflows/` on `kotlin`, while the default branch still
  tracks the old YAML. The user reports no enabled workflow in this fork's
  GitHub Actions UI; tracked YAML alone was not evidence of active deployment.
  Include the archive change when merging. The user approved the 24-file
  removal scope and rollback plan; local checks passed before and after
  deletion. The user authorized publication after the diff check. Production traffic
  remains a separate, deferred decision; OPS-005 will design new Kotlin CI/CD
  only after a hosting/release decision.
- The exact 24-file C# project/solution/harness removal scope, preserved
  captures and dataset, pre-removal Git anchors, and repository rollback plan
  are documented in `tcc/05 - Migration/CSharp Removal Review.md`. The user
  approved the scope/plan; the 24 files were deleted and the exact diff was
  reviewed before the requested commit and push.
- A future Kotlin deployment needs its own approved rollback plan; do not
  assume the C# artifact remains deployable after repository-level retirement.
- Monitor route status distribution, upload parse failures, cache misses,
  remote/SPARQL/MediaWiki status codes, response schema errors, and latency.
- Plan rollback to a previously verified Kotlin artifact before deployment;
  no deployment or production rollback path is approved in this phase.
