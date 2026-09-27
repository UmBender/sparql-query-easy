# C# to Kotlin Migration Status

## Verified status

| Original area | Kotlin evidence | Status |
|---|---|---|
| `GetElementRelationships` | `ElementRelationshipsService` | Confirmed ported |
| `GetRelationshipValue` | `RelationshipValueService` | Confirmed ported |
| Result filtering | `ResultFilteringService` | Confirmed ported |
| RDF/local SPARQL | Jena infrastructure | Confirmed ported |
| Wikidata SPARQL generation/transport | generator and Ktor client | Confirmed ported |
| Local upload/cache | upload service and route | Confirmed ported |
| Endpoint context | context resolver | Confirmed ported |
| SPARQL generation | generation service and route | Confirmed ported |
| General query/search | services and routes | Confirmed ported |
| Controller HTTP routes | Ktor module | Confirmed ported |

The earlier list of “remaining” application-service use cases is historical:
all listed areas now have Kotlin implementation and tests. Remaining work is
limited to explicit compatibility gaps and production/additive requirements,
not another core feature port.

## Dataset decision

**Approved (2026-09-16):** Kotlin retains the C# `futebol_completo.ttl` as the
sole canonical built-in dataset for `CampeonatoBrasileiro2023`. The frontend
dataset is not packaged or treated as equivalent; changing the source requires
explicit review and C# baseline recapture.

## Compatibility state

**Confirmed:** 34 C# harness captures are stored under `compatibility/expected/`. Kotlin comparison covers graph isomorphism, executed SPARQL, projected variables, bound/unbound values, RDF terms, duplicate rows, and documented ordering.

**Resolved (2026-09-17):** `BUG-001` replaced the C# harness wrapper with a
capturing `LocalQueryExecutor` subclass, recaptured `SEARCH-LOCAL-001` and
`BUILTIN-GRAPH-001`, and re-enabled both in the Kotlin comparator. The focused
suite also verifies the captured .NET empty-path IRI normalization required for
the built-in graph.

## MIG-001 verification record

**Confirmed (2026-09-16):** The focused offline
`CaptureDrivenCompatibilityTest` passes for every valid capture it can execute
through the Kotlin route boundary. It checks Jena graph isomorphism; recorded
local SPARQL text; projected variables; row multiplicity; bound and unbound
bindings; IRI, literal, language, datatype, and blank-node values; and row
ordering only where the captured query uses `ORDER BY`. The only query-text
normalization is the documented literal-variable suffix normalization.

**Explicit exclusions:** Only the six C# exception-category captures are not
HTTP equivalence baselines. The two reviewed local-search recaptures are now
included in ordinary response, query-text, and raw-result comparison.

The six exception captures are intentional non-equivalences, not unresolved
Kotlin error behavior. The approved Kotlin contract returns JSON `400` for
malformed/invalid input, `404` for an unavailable local graph, and `502` for an
upstream execution failure. The C# evidence remains an exception category
because the harness did not run ASP.NET middleware.

## Remaining migration-related work

- `QUAL-001`: approved Wikidata success/error recordings and full Ktor route
  replay.
- C# black-box evidence for health/middleware failure responses and a generic
  remote endpoint, if production equivalence requires those claims.
- `AUTH-000`/`AUTH-001`/`AUTH-002`: new authentication requirement.
- `OAPI-000`/`OAPI-001`: completed code-generated OpenAPI 3.1 and Swagger UI
  addition; future authentication metadata remains under `AUTH-000`.
- `BUG-002`: relationship executor failures still need the approved explicit
  JSON `502` mapping already used by search and general query.
- `SEC-001` and `OPS-001`–`OPS-004`: production security and operations.

Browser-level frontend coverage is already present under `frontend-tests/`.
Port `8080` and explicit JSON errors are approved intentional changes.

## Intentional differences

- Kotlin port is `8080`, unlike C# development `5242`/`7070`.
- Kotlin returns explicit JSON `400`/`404`/`502` errors.
- Kotlin validates/escapes several unsafe query/endpoint forms rather than preserving raw interpolation.

## Source files

- `MIGRATION.md`
- `MIGRATION_REPORT.md`
- `README.md`
- `remaining.md`
- `compatibility/README.md`
- `compatibility/cases/capture-status.tsv`
- `compatibility/Compatibility.Harness/Program.cs`
- `src/test/kotlin/com/example/sparqlqueryeasy/http/CaptureDrivenCompatibilityTest.kt`
- `src/main/kotlin/com/example/sparqlqueryeasy/rdf/jena/JenaRdfInfrastructure.kt`
- `frontend-tests/index2.spec.mjs`
