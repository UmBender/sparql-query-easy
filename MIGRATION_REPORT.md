# Compatibility Audit Report

Audit date: 2026-09-10  
Kotlin branch: `kotlin` at `720e9c3`
Original C# project: retained in `Sparql.QueryEasy/`

## Executive summary

The Kotlin implementation has strong component-level coverage for RDF parsing,
local SPARQL, query generation, filtering, endpoint selection, upload, and the
separate Wikidata transports. The .NET 8 characterization harness has now
produced and committed 34 immutable C# captures under
`compatibility/expected/`. The capture-driven Kotlin HTTP comparator passes for
successful local and generated-query cases, subject to the documented
unordered-result comparison rule.

Successful local fixture comparisons now include graph isomorphism, Kotlin's
actually executed SPARQL, projected variables, result-row multiplicity,
bound/unbound bindings, RDF term details, and the documented ordered versus
unordered comparison rule. Exception-only C# harness captures remain
non-equivalent because they do not represent ASP.NET middleware responses.

`SEARCH-LOCAL-001` and `BUILTIN-GRAPH-001` are currently excluded: the C#
harness wraps `LocalQueryExecutor`, making its `is LocalQueryExecutor` search
branch test false and producing a remote-branch capture. They require a harness
repair and reviewed C# recapture; their expected files were not changed.

No fixture is marked equivalent solely from source inspection. The completed
HTTP comparison found and corrected fragment-IRI acceptance and Unicode IRI
ASCII normalization differences.

## Commands and results

| Command | Result |
|---|---|
| `dotnet run --project compatibility/Compatibility.Harness/Compatibility.Harness.csproj` | Passed with .NET SDK 8.0.130; generated 34 reviewed C# captures. |
| `GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew test --tests 'com.example.sparqlqueryeasy.http.CaptureDrivenCompatibilityTest' --no-daemon` | Passed offline. The comparator checks valid captured graphs, route HTTP output, generated/executed SPARQL, raw projected variables and rows, binding presence, RDF terms, duplicate rows, and documented ordering. |
| `GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintFormat ktlintCheck detekt test integrationTest --no-daemon` | Passed formatting, ktlint, Detekt, and unit tests. The opt-in `integrationTest` task was skipped because `RUN_WIKIDATA_INTEGRATION=true` was not set. |

Offline integration tests were compiled but intentionally not run against live
Wikidata.

## Test coverage by category

| Category | Kotlin test evidence | Count |
|---|---|---:|
| Turtle upload, parsing, graph cache, lifecycle | `LocalDatabaseUploadServiceTest`, `LocalDatabaseRoutesTest` | 19 |
| RDF/Jena mapping, local SPARQL, graph comparison | `JenaRdfInfrastructureTest`, `JenaSmokeTest` | 8 |
| Endpoint contexts and application query/search orchestration | endpoint, general-query, filtering, relationship, search tests | 28 |
| Wikidata SPARQL/MediaWiki transport and generation | query-generator and HTTP-client tests | 13 |
| Domain validation, health, shared fixture availability | domain, application, fixture tests | 17 |

Counts overlap where an end-to-end test exercises more than one category; the
authoritative executed-test total is 85.

## Fixture execution matrix

The C# captures are real .NET 8 harness output. For valid local-route cases,
the capture-driven Ktor test now compares successful response status/body,
Jena graph isomorphism, actual executed SPARQL, and raw bindings. The
exception-only and C# harness-altered cases below remain explicitly excluded,
not silently normalized.

| Fixture group | Cases | C# execution | Kotlin execution | Classification |
|---|---|---|---|---|
| Turtle/RDF | `TTL-SIMPLE-001`, `TTL-PREFIX-001`, `TTL-BASE-001`, `TTL-IRI-UNICODE-001`, `TTL-BNODE-001`, `TTL-LITERAL-001`, `TTL-NUMERIC-001`, `TTL-EMPTY-001`, `TTL-INVALID-001`, `TTL-INVALID-002` | Captured graph/exception evidence | Offline Jena graph-isomorphism comparator and route upload | Valid graphs compared; invalid-Turtle exception captures intentionally non-equivalent |
| Generated SELECT | `SELECT-BASIC-001`, `SELECT-OPTIONAL-001`, four filter cases, `SELECT-DISTINCT-001`, order/max/min, zero/two limit, empty, invalid | Captured generated query/raw results | Offline generated-query and local route comparator | Valid captures compared; invalid-query exception capture intentionally non-equivalent |
| Query boundaries | offset, generated-path, ASK/CONSTRUCT unavailable, injection-path | Generated-path capture where available | Offline generated-query comparator | Injection capture is generated-query evidence only; unsupported raw operations remain outside the public API |
| Relationships/filtering | `RELATIONSHIPS-LOCAL-001`, `RELATIONSHIP-LITERAL-001`, `RELATIONSHIP-RESOURCE-001`, `QUERY-EMPTY-WHERE-001` | Captured route/raw results | Offline route/raw-result comparator | Valid captures compared |
| Search/endpoints | `SEARCH-LOCAL-001`, `BUILTIN-GRAPH-001`, `LOCAL-CACHE-MISS-001` | Harness-altered or exception capture | Deterministic service/route tests | Explicitly non-equivalent pending BUG-001/HTTP contract evidence |
| HTTP | `HTTP-HEALTH-001`, `HTTP-BAD-JSON-001`, `HTTP-MISSING-UPLOAD-001` | Successful and exception-category captures | Route tests and capture comparator where a response exists | Successful captures compared; exception categories intentionally non-equivalent |
| Wikidata | `WIKIDATA-GENERATION-001`, `WIKIDATA-SEARCH-RECORD-001`, `WIKIDATA-SEARCH-ERROR-001` | Generation harness unavailable; live search intentionally excluded | Offline generator and MockEngine client tests | Unresolved comparison |

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

### Intentional behavior changes requiring approval

- Typed query terms reject arbitrary raw path/IRI interpolation and negative
  limits. This is a documented SPARQL-injection safety correction.
- Generic endpoints are restricted to absolute HTTP(S) URLs with a host.
- MediaWiki entity-search HTTP failures are explicit Kotlin application
  failures; C# returned an empty result on non-success status.
- `POST /api/local-database` maps absent `ttlFile` and invalid Turtle to
  `400` JSON errors. The C# controller dereferenced a missing file or let parse
  failures escape.

These changes are recorded in `MIGRATION.md`; approval for public contract
changes is still required before production rollout.

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

### Captured error cases — non-equivalent pending approval

The .NET 8 in-process harness now has reviewed captures for the cases below in
`compatibility/expected/`. They are deliberately **not** marked equivalent:
the C# harness records an exception category before ASP.NET Core middleware
produces an HTTP response, whereas Kotlin exposes an explicit route response.
The C# baseline must remain unchanged. A production-contract decision is
required before any Kotlin status/body is called compatible.

| Case | C# capture | Kotlin behavior | Classification |
|---|---|---|---|
| `HTTP-BAD-JSON-001` | `System.Text.Json.JsonReaderException` during request JSON parsing | Ktor route-level malformed-request response | Non-equivalent pending approval |
| `HTTP-MISSING-UPLOAD-001` | `System.NullReferenceException` from controller invocation without `ttlFile` | `400` JSON error, `Missing required upload: ttlFile` | Non-equivalent pending approval |
| `LOCAL-CACHE-MISS-001` | `System.Exception` from controller/query invocation | `404` JSON error for an unavailable local graph | Non-equivalent pending approval |
| `TTL-INVALID-001` | dotNetRDF `RdfParseException` | `400` JSON Turtle parsing error | Non-equivalent pending approval |
| `TTL-INVALID-002` | dotNetRDF `RdfParseException` | `400` JSON Turtle parsing error | Non-equivalent pending approval |

These error cases are excluded from normal response-equality assertions in the
capture-driven Kotlin suite. This records the difference rather than weakening
either C# capture or Kotlin route assertions.

### Incomplete compatibility coverage

- Two C# local-search captures are invalid because the harness wrapper changes
  the executor runtime type; `BUG-001` must repair and recapture them before
  equivalence is claimed.
- Kotlin has no equivalent Swagger/OpenAPI routes or C# HTTPS-redirection/CORS
  middleware configuration.
- `application.conf` defaults to HTTP port `8080`; C# development profiles use
  `http://localhost:5242` and `https://localhost:7070` with
  `ASPNETCORE_ENVIRONMENT=Development`.

### Unresolved risks

- dotNetRDF versus Jena parser acceptance/error diagnostics, blank-node labels,
  numeric comparison edge cases, and unspecified SPARQL row ordering have not
  been directly compared.
- C# HTTP framework error bodies/statuses for malformed JSON, invalid Turtle,
  missing upload, cache miss, and remote failures have not been black-box
  captured.
- Live Wikidata responses are intentionally absent from normal tests; recorded
  production fixtures must be supplied before a live-contract claim.

## Manual verification procedure

1. Install .NET 8 SDK and run the C# harness command above from repository
   root. Commit the produced `compatibility/expected/<case-id>/case.json`,
   `index.json`, and reviewed `capture-status.tsv` metadata.
2. Start the Kotlin application and execute the same upload/query sequence.
   Do not use live Wikidata; configure recorded/fake transports for its cases.
3. Normalize generated upload UUIDs and blank-node encounter labels only. Do
   not normalize row order, lexical literal values, language/datatype fields,
   response status, or JSON property presence.
4. Compare controller status/body, generated query text, raw projected
   variables, bindings, graph snapshots, and diagnostics. Add a minimal
   regression before correcting each confirmed Kotlin difference.
5. Black-box capture C# middleware behavior separately for malformed JSON and
   uncaught controller failures, because the in-process harness deliberately
   does not model developer exception pages.

## Deployment and rollback recommendations

- Do not remove the C# project or switch production traffic until every fixture
  has a reviewed capture.
- Deploy Kotlin behind a reversible path/host or weighted rollout; keep the C#
  deployment artifact and its 12-hour local-cache semantics available.
- Monitor route status distribution, upload parse failures, cache misses,
  remote/SPARQL/MediaWiki status codes, response schema errors, and latency.
- Roll back by routing traffic to the C# artifact if compatibility checks or
  production telemetry show an unapproved status/body/order difference.
