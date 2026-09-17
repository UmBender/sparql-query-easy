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

The earlier list of “remaining” application-service use cases is stale: all listed areas now have Kotlin implementation and tests. End-to-end compatibility remains incomplete.

## Compatibility state

**Confirmed:** 34 C# harness captures are stored under `compatibility/expected/`. Kotlin comparison covers graph isomorphism, executed SPARQL, projected variables, bound/unbound values, RDF terms, duplicate rows, and documented ordering.

**Confirmed bug:** `SEARCH-LOCAL-001` and `BUILTIN-GRAPH-001` are not valid equivalence evidence. The C# harness wraps `LocalQueryExecutor`; C# checks its runtime type and therefore incorrectly uses its remote-search branch. Existing captures must not be modified merely to pass Kotlin; repair harness first, then perform reviewed recapture.

## MIG-001 verification record

**Confirmed (2026-09-16):** The focused offline
`CaptureDrivenCompatibilityTest` passes for every valid capture it can execute
through the Kotlin route boundary. It checks Jena graph isomorphism; recorded
local SPARQL text; projected variables; row multiplicity; bound and unbound
bindings; IRI, literal, language, datatype, and blank-node values; and row
ordering only where the captured query uses `ORDER BY`. The only query-text
normalization is the documented literal-variable suffix normalization.

**Explicit exclusions:** The six C# exception-category captures are not HTTP
equivalence baselines. `SEARCH-LOCAL-001` and `BUILTIN-GRAPH-001` remain
excluded because of the confirmed C# harness defect tracked by `BUG-001`; no
C# expected result was edited.

## Intentional differences

- Kotlin port is `8080`, unlike C# development `5242`/`7070`.
- Kotlin returns explicit JSON `400`/`404`/`502` errors.
- Kotlin validates/escapes several unsafe query/endpoint forms rather than preserving raw interpolation.

## Source files

- `MIGRATION.md`
- `MIGRATION_REPORT.md`
- `compatibility/cases/capture-status.tsv`
- `compatibility/Compatibility.Harness/Program.cs`
- `src/test/kotlin/com/example/sparqlqueryeasy/http/CaptureDrivenCompatibilityTest.kt`
