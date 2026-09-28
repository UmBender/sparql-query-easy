# Brazilian Dataset Decision

**Status:** Approved option 1 (2026-09-16).

## Decision

The approved dataset is the exact byte sequence originally captured from
`Sparql.QueryEasy/futebol_completo.ttl`. The `CampeonatoBrasileiro2023`
endpoint continues to resolve that dataset. Kotlin owns a byte-identical copy
at `src/main/resources/futebol_completo.ttl`; the former C# copy was removed
locally with the original implementation and remains recoverable from Git
commit `0f20091`.
`sparql/databases/brasileirao2023.ttl` is reference-only and is not an
interchangeable runtime dataset. Replacing the canonical asset requires an
explicit decision and reviewed C# baseline recapture.

## Evidence

| Asset | Role | SHA-256 | Packaging |
|---|---|---|---|
| `Sparql.QueryEasy/futebol_completo.ttl` (historical Git path) | Original C# runtime built-in graph and byte baseline | `2345428c9513651dcf184835538fa910abae6c95fcb399e508709d646af7993f` | Removed locally; recover from commit `0f20091` |
| `src/main/resources/futebol_completo.ttl` | Kotlin-owned byte-identical runtime copy | `2345428c9513651dcf184835538fa910abae6c95fcb399e508709d646af7993f` | Gradle main resources and distribution |
| `files/dados-campeonato-brasileiro-2023.ttl` | Source copy of C# runtime data | `2345428c9513651dcf184835538fa910abae6c95fcb399e508709d646af7993f` | Not referenced by runtime packaging |
| `sparql/databases/brasileirao2023.ttl` | Frontend-associated data asset | `56f9609aa7b4f3e732abc263d58c0cfbf71baded42641a1ce32a7b6e24fc802a` | Not copied by `build.gradle.kts` |

The historical C# and current Kotlin runtime copies have identical bytes. The distinct frontend asset
differs in ontology declarations, base URI, predicates,
and data content. Treating them as interchangeable would change query results
and invalidate C# compatibility baselines.

## Alternatives considered

1. **Approved — preserve C# baseline bytes:** `CampeonatoBrasileiro2023`
   continues to resolve `futebol_completo.ttl`; OPS-001 made the Kotlin copy
   independent of the C# project without changing data or captured results.
   Retain the frontend asset only as reference/non-runtime data until it is
   explicitly retired or reconciled.
2. **Not approved — adopt frontend asset:** change Kotlin packaging/runtime source and approve
   C# baseline recapture plus fixture review.
3. **Not approved — support both:** define separate endpoint identifiers and add independent
   packaging, API documentation, and compatibility coverage.

## Source files

- `Sparql.QueryEasy/futebol_completo.ttl` (historical, Git commit `0f20091`)
- `src/main/resources/futebol_completo.ttl`
- `files/dados-campeonato-brasileiro-2023.ttl`
- `sparql/databases/brasileirao2023.ttl`
- `build.gradle.kts`
- `src/main/kotlin/com/example/sparqlqueryeasy/application/endpoints/EndpointContextResolver.kt`
