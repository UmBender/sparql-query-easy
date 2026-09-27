# C# Retirement Readiness

## Current assessment

**Confirmed:** Kotlin/Ktor covers the original application routes and services.
The immutable original C# corpus contains 34 captures; three further
retirement success captures are indexed separately under
`compatibility/retirement-expected/`. The comparators run the valid local,
Wikidata success, and generic remote SPARQL cases. Six original exception-only
captures represent intentionally different HTTP behavior; the user explicitly
waived further C# middleware-error equivalence capture.

**Resolved local build dependency (OPS-001):** Kotlin now packages
`src/main/resources/futebol_completo.ttl`, whose SHA-256 matches the approved
C# asset. `build.gradle.kts` no longer reads the C# tree. The Gradle
distribution and local container design are documented in
[[../07 - Operations/Local JVM and Container Runtime]].

**Confirmed remaining blockers:**

1. The actual C# health response is `200 text/plain Healthy`; Kotlin returns
   `200` JSON `{"status":"ok"}`. `DEC-009` requires human approval of this
   difference or a Kotlin alignment change. Only the status is equivalent.
2. `.github/workflows/master_sparql-query-easy.yml` still builds and deploys
   .NET. Replace or disable this workflow before deleting the C# project;
   a production Kotlin deployment/rollback plan is separately deferred to
   OPS-002 through OPS-004 and SEC-001.
3. The C# compatibility harness references the C# project and dataset.
   Preserve both corpora, inputs, provenance ledger, and Kotlin comparators
   as historical evidence before separately reviewing harness removal.

**Capture decision completed (2026-09-27):** The user requested actual C#
health, recorded-body Wikidata search, and controlled generic remote SPARQL
success captures, and waived further middleware-error equivalence. All three
were captured without changing any original 34-case file. Kotlin's Wikidata
and remote route outputs match. The remote raw-result comparator uncovered a
missing Kotlin `rdf:langString` datatype; the mapper and regression were fixed
without weakening expected results. Health-body parity is still unresolved.

**Decision required:** Resolve `DEC-009` and approve the eventual C# tree
removal. Local Kotlin packaging does not imply production readiness.
Authentication is planned for later user testing and is
not C# parity. Two-variable exploration is a new frontend feature, also not
C# parity.

## Removal sequence

1. Preserve the reviewed 34 original and three new C# captures and their
   provenance. Additional middleware-error equivalence was waived.
2. Verify the Kotlin-owned canonical Turtle copy, packaged bytes, and graph
   compatibility (OPS-001); no source data or golden result changes.
3. Resolve `DEC-009`; then pass Kotlin compatibility, quality, browser, and
   local runtime suites.
4. Replace or disable the .NET workflow; preserve its configuration evidence
   in the vault for the future OPS-002–OPS-004 plans. This is not a deployment.
5. Review the removal diff, then remove the C# project, solution, and harness
   in a separately approved change. Keep the immutable captures.

No live deployment state was inspected during this audit.

OPS-002 (domain/TLS/CORS), OPS-003 (AWS architecture/deployment), OPS-004
(monitoring/backup), and SEC-001 (production policy) remain open for a future
production launch, even if C# is retired from the repository first.

## Source files

- `build.gradle.kts`
- `Sparql.QueryEasy/futebol_completo.ttl`
- `src/main/resources/futebol_completo.ttl`
- `Dockerfile`
- `.github/workflows/master_sparql-query-easy.yml`
- `compatibility/Compatibility.Harness/Compatibility.Harness.csproj`
- `compatibility/Compatibility.Harness/Program.cs`
- `compatibility/cases/capture-status.tsv`
- `compatibility/retirement-expected/README.md`
- `src/test/kotlin/com/example/sparqlqueryeasy/http/RetirementSuccessCompatibilityTest.kt`
- `tcc/90 - Tasks/items/DEC-009-health-response-contract.md`
- `compatibility/README.md`
- `MIGRATION_REPORT.md`
- `src/test/kotlin/com/example/sparqlqueryeasy/http/CaptureDrivenCompatibilityTest.kt`
- `tcc/09 - Decisions/Brazilian Dataset Decision.md`
- `tcc/90 - Tasks/items/QUAL-001-recorded-wikidata-routes.md`
- `tcc/90 - Tasks/items/OPS-001-container-runtime.md`
