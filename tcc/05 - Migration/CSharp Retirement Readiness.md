# C# Retirement Readiness

## Current assessment

**Confirmed:** Kotlin/Ktor covers the original application routes and services,
and the immutable C# corpus contains 34 captures. The comparator runs valid
local cases; six exception-only captures represent intentionally different
HTTP behavior. This is sufficient to preserve the reviewed local baseline,
but it does not make the C# tree removable today.

**Confirmed blockers:**

1. `build.gradle.kts` still packages the canonical
   `Sparql.QueryEasy/futebol_completo.ttl`. Move this exact dataset to a
   Kotlin-owned resource path, preserve its approved hash, and verify the
   packaged graph and `BUILTIN-GRAPH-001` before deleting the C# directory.
2. `.github/workflows/master_sparql-query-easy.yml` still builds and deploys
   .NET. A tested Kotlin artifact, deployment workflow, health check, and
   rollback plan are required before production cutover.
3. The C# compatibility harness references the C# project and dataset.
   Decide whether further captures are needed; retain the committed corpus,
   inputs, provenance ledger, and Kotlin comparator as historical evidence.

**Coverage still open:** `MIGRATION_REPORT.md` and `compatibility/README.md`
identify uncaptured C# health/middleware behavior, recorded Wikidata
success/error responses, and a generic remote endpoint case. `QUAL-001` is
blocked pending approved recordings. The approved Kotlin JSON error contract
remains an intentional difference.

**Decision required:** Establish the retirement gate for these remaining
captures and production policies. Authentication is planned for later user
testing and is not C# parity. Two-variable exploration is a new frontend
feature, also not C# parity.

## Removal sequence

1. Capture any required remaining C# behavior while the harness still runs.
2. Relocate and verify the canonical Turtle dataset without changing bytes.
3. Pass Kotlin compatibility, quality, and browser suites.
4. Replace the .NET deployment path and verify packaging, operations, and
   rollback in the selected environment.
5. Review the removal diff, then remove the C# project, solution, and harness
   in a separately approved change. Keep the immutable captures.

No live deployment state was inspected during this audit.

## Source files

- `build.gradle.kts`
- `Sparql.QueryEasy/futebol_completo.ttl`
- `.github/workflows/master_sparql-query-easy.yml`
- `compatibility/Compatibility.Harness/Compatibility.Harness.csproj`
- `compatibility/Compatibility.Harness/Program.cs`
- `compatibility/cases/capture-status.tsv`
- `compatibility/README.md`
- `MIGRATION_REPORT.md`
- `src/test/kotlin/com/example/sparqlqueryeasy/http/CaptureDrivenCompatibilityTest.kt`
- `tcc/09 - Decisions/Brazilian Dataset Decision.md`
- `tcc/90 - Tasks/items/QUAL-001-recorded-wikidata-routes.md`
- `tcc/90 - Tasks/items/OPS-001-container-runtime.md`
