# Brazilian Dataset Decision

**Status:** Approved option 1 (2026-09-16).

## Decision

`Sparql.QueryEasy/futebol_completo.ttl` is the sole canonical built-in
dataset. The `CampeonatoBrasileiro2023` endpoint continues to resolve this
asset, and Kotlin packaging must continue to copy this C# baseline unchanged.
`sparql/databases/brasileirao2023.ttl` is reference-only and is not an
interchangeable runtime dataset. Replacing the canonical asset requires an
explicit decision and reviewed C# baseline recapture.

## Evidence

| Asset | Role | SHA-256 | Packaging |
|---|---|---|---|
| `Sparql.QueryEasy/futebol_completo.ttl` | C# runtime built-in graph | `2345428c9513651dcf184835538fa910abae6c95fcb399e508709d646af7993f` | C# output; copied by Gradle to Kotlin resources as `futebol_completo.ttl` |
| `files/dados-campeonato-brasileiro-2023.ttl` | Source copy of C# runtime data | `2345428c9513651dcf184835538fa910abae6c95fcb399e508709d646af7993f` | Not referenced by runtime packaging |
| `sparql/databases/brasileirao2023.ttl` | Frontend-associated data asset | `56f9609aa7b4f3e732abc263d58c0cfbf71baded42641a1ce32a7b6e24fc802a` | Not copied by `build.gradle.kts` |

The two distinct assets differ in ontology declarations, base URI, predicates,
and data content. Treating them as interchangeable would change query results
and invalidate C# compatibility baselines.

## Alternatives considered

1. **Approved — keep C# asset canonical:** `CampeonatoBrasileiro2023`
   continues to resolve `futebol_completo.ttl`; retain the frontend asset only
   as reference/non-runtime data until it is explicitly retired or reconciled.
2. **Not approved — adopt frontend asset:** change Kotlin packaging/runtime source and approve
   C# baseline recapture plus fixture review.
3. **Not approved — support both:** define separate endpoint identifiers and add independent
   packaging, API documentation, and compatibility coverage.

## Source files

- `Sparql.QueryEasy/futebol_completo.ttl`
- `files/dados-campeonato-brasileiro-2023.ttl`
- `sparql/databases/brasileirao2023.ttl`
- `build.gradle.kts`
- `src/main/kotlin/com/example/sparqlqueryeasy/application/endpoints/EndpointContextResolver.kt`
