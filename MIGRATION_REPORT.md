# Compatibility Audit Report

Audit date: 2026-09-10  
Kotlin branch: `kotlin` at `1e2fb01`  
Original C# project: retained in `Sparql.QueryEasy/`

## Executive summary

The Kotlin implementation has strong component-level coverage for RDF parsing,
local SPARQL, query generation, filtering, endpoint selection, upload, and the
separate Wikidata transports. It is not yet possible to make a complete
fixture-by-fixture C# versus Kotlin assertion in this environment:

- `dotnet` is unavailable, so the production C# compatibility harness cannot
  execute.
- `compatibility/expected/` has no captured C# results and
  `capture-status.tsv` contains only its header.
- The Kotlin HTTP surface includes `/health`, `POST /api/local-database`, and
  all five C# `QueryController` routes. Direct C#-to-Kotlin HTTP comparison
  still awaits captured C# fixtures.

No fixture is marked equivalent solely from source inspection. No Kotlin fix
was made in this audit because no C# execution evidence exists to confirm a
behavioral mismatch. The missing QueryController routes are a confirmed Kotlin
HTTP-API completeness gap, listed below for the next migration slice.

## Commands and results

| Command | Result |
|---|---|
| `dotnet run --project compatibility/Compatibility.Harness/Compatibility.Harness.csproj` | Failed before execution: `zsh: command not found: dotnet` (exit 127). |
| `GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintFormat ktlintCheck detekt test integrationTest --no-daemon` | Passed formatting, ktlint, Detekt, and unit tests. The opt-in `integrationTest` task was skipped because `RUN_WIKIDATA_INTEGRATION=true` was not set. |

The last Gradle test report contains 93 executed unit-test cases across 17
test classes. Offline integration tests were compiled but intentionally not
run against live Wikidata.

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

The C# column is uniformly `unresolved` because the harness did not start.
The Kotlin column means the stated behavior has an offline component or route
test; it does not mean an output was compared to C#.

| Fixture group | Cases | C# execution | Kotlin execution | Classification |
|---|---|---|---|---|
| Turtle/RDF | `TTL-SIMPLE-001`, `TTL-PREFIX-001`, `TTL-BASE-001`, `TTL-IRI-UNICODE-001`, `TTL-BNODE-001`, `TTL-LITERAL-001`, `TTL-NUMERIC-001`, `TTL-EMPTY-001`, `TTL-INVALID-001`, `TTL-INVALID-002` | Unresolved | Offline upload/parser tests; HTTP only for simple/empty/invalid | Unresolved comparison |
| Generated SELECT | `SELECT-BASIC-001`, `SELECT-OPTIONAL-001`, four filter cases, `SELECT-DISTINCT-001`, order/max/min, zero/two limit, empty, invalid | Unresolved | Generator/general-query tests | Unresolved comparison |
| Query boundaries | offset, generated-path, ASK/CONSTRUCT unavailable, injection-path | Unresolved | Generator safety tests and documented boundaries | Intentional change for unsafe interpolation; otherwise unresolved |
| Relationships/filtering | `RELATIONSHIPS-LOCAL-001`, `RELATIONSHIP-LITERAL-001`, `RELATIONSHIP-RESOURCE-001`, `QUERY-EMPTY-WHERE-001` | Unresolved | Application tests | Unresolved comparison |
| Search/endpoints | `SEARCH-LOCAL-001`, `BUILTIN-GRAPH-001`, `LOCAL-CACHE-MISS-001` | Unresolved | Endpoint/search tests | Unresolved comparison |
| HTTP | `HTTP-HEALTH-001`, `HTTP-BAD-JSON-001`, `HTTP-MISSING-UPLOAD-001` | Unresolved | Health, local-database, and QueryController route tests; malformed JSON remains untested | Mixed: documented route-boundary changes; otherwise unresolved |
| Wikidata | `WIKIDATA-GENERATION-001`, `WIKIDATA-SEARCH-RECORD-001`, `WIKIDATA-SEARCH-ERROR-001` | Generation harness unavailable; live search intentionally excluded | Offline generator and MockEngine client tests | Unresolved comparison |

## Detailed compatibility findings

### Equivalent representation candidates — not yet confirmed

The Kotlin Jena boundary keeps IRIs, blank nodes, literal lexical forms,
datatype IRIs, language tags, projected variable order, explicit unbound
bindings, duplicate rows, and graph-isomorphism comparison in application
types. These are covered by Kotlin tests, but require C# harness output before
being promoted to an equivalent classification.

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

### Confirmed Kotlin defects / incomplete compatibility

- C# QueryController routes are implemented and covered by deterministic Ktor
  tests, but no C# execution evidence is available for black-box comparison.
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
