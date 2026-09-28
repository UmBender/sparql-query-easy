# Workspace Inventory

## Repositories and major directories

| Status | Path | Role |
|---|---|---|
| Historical | `Sparql.QueryEasy/` | Original .NET 8 ASP.NET Core application; removed locally under MIG-002, recoverable from Git commit `0f20091`. |
| Confirmed | `src/` | Kotlin/JVM Ktor migration, unit tests, and opt-in integration tests. |
| Confirmed | `compatibility/` | Turtle/request fixtures and preserved C# captured outputs; the executable C# harness was removed locally under MIG-002. |
| Confirmed | `sparql/` | Static browser client; `index2.html` is the documented authoritative page. |
| Confirmed | `tcc/` | Versioned Obsidian Markdown knowledge base and task system. |
| Confirmed | `tcc/PDF/` | Local-only folder for thesis reference PDFs. Untracked and ignored since `REPO-001`; a clean checkout has no PDFs. Obtain copies from the thesis author or the original publishers and place them here. |
| Confirmed | `files/` | Turtle source files not referenced by current Kotlin runtime packaging. |
| Confirmed | `.github/archived-workflows/` | Historical, inactive Azure-oriented .NET GitHub Actions YAML on `kotlin`. |

## Technology inventory

| Area | Confirmed technology |
|---|---|
| Historical backend | C#, .NET 8, ASP.NET Core MVC, dotNetRDF 3.1.1; source in pre-removal Git commit `0f20091` |
| Migration backend | Kotlin 2.2.20, JVM 21, Ktor 3.5.1, Netty |
| RDF/SPARQL | Apache Jena 6.2.0 in Kotlin; dotNetRDF only in historical C# source |
| Build | Gradle Kotlin DSL; historical .NET SDK project/solution removed locally |
| Serialization | `kotlinx.serialization`; historical ASP.NET Core JSON defaults in captures |
| Frontend | HTML, JavaScript, jQuery, Cytoscape, Materialize, Intro.js |

## Runtime data

**Confirmed:** Kotlin packages the approved built-in dataset from
`src/main/resources/futebol_completo.ttl`. Its bytes match the historical C#
asset from Git commit `0f20091`; the C# copy was removed locally. The frontend
`sparql/databases/brasileirao2023.ttl` is not included by `processResources`.

**Decision:** Option 1 approved (2026-09-16): the historical C#
`futebol_completo.ttl` bytes are the canonical built-in dataset, now owned by
the Kotlin resource; the frontend asset is reference-only.

## Source files

- `Sparql.QueryEasy/Sparql.QueryEasy.csproj` (historical, Git commit `0f20091`)
- `build.gradle.kts`
- `settings.gradle.kts`
- `Sparql.QueryEasy/futebol_completo.ttl` (historical, Git commit `0f20091`)
- `src/main/resources/futebol_completo.ttl`
- `sparql/databases/brasileirao2023.ttl`
- `tcc/90 - Tasks/items/REPO-001-untrack-reference-pdfs.md`
