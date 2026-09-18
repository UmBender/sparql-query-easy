# Workspace Inventory

## Repositories and major directories

| Status | Path | Role |
|---|---|---|
| Confirmed | `Sparql.QueryEasy/` | Original .NET 8 ASP.NET Core application. |
| Confirmed | `src/` | Kotlin/JVM Ktor migration, unit tests, and opt-in integration tests. |
| Confirmed | `compatibility/` | C# characterization harness, Turtle/request fixtures, and captured outputs. |
| Confirmed | `sparql/` | Static browser client; `index2.html` is the documented authoritative page. |
| External | `tcc/` | Obsidian thesis vault and reference PDFs; intentionally kept outside the application repository. |
| Confirmed | `files/` | Turtle source files not referenced by current Kotlin runtime packaging. |
| Confirmed | `.github/workflows/` | Azure-oriented .NET GitHub Actions workflow. |

## Technology inventory

| Area | Confirmed technology |
|---|---|
| Original backend | C#, .NET 8, ASP.NET Core MVC, dotNetRDF 3.1.1 |
| Migration backend | Kotlin 2.2.20, JVM 21, Ktor 3.5.1, Netty |
| RDF/SPARQL | Apache Jena 6.2.0 in Kotlin; dotNetRDF in C# |
| Build | Gradle Kotlin DSL; .NET SDK project/solution |
| Serialization | `kotlinx.serialization`; ASP.NET Core JSON defaults |
| Frontend | HTML, JavaScript, jQuery, Cytoscape, Materialize, Intro.js |

## Runtime data

**Confirmed:** `Sparql.QueryEasy/futebol_completo.ttl` is the C# runtime asset and Gradle copies that same file to Kotlin resources. `sparql/databases/brasileirao2023.ttl` exists but is not included by `processResources`.

**Decision:** Option 1 approved (2026-09-16): the C# `futebol_completo.ttl` is
the sole canonical built-in dataset; the frontend asset is reference-only.

## Source files

- `Sparql.QueryEasy/Sparql.QueryEasy.csproj`
- `build.gradle.kts`
- `settings.gradle.kts`
- `Sparql.QueryEasy/futebol_completo.ttl`
- `sparql/databases/brasileirao2023.ttl`
