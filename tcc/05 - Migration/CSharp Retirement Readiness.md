# C# Retirement Readiness

## Current assessment

**Confirmed:** Kotlin/Ktor covers the original application routes and services.
The user approved removal of the C# solution/project/harness; the 24-file
deletion was checked against its manifest, and the user requested its commit
and push on `kotlin`.
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

**Completed repository gate:** The final local gates passed before and after the
deletion. Both capture corpora, inputs, provenance ledger, and Kotlin
comparators remain. The user approved the 24-file scope and rollback plan in
[[CSharp Removal Review]]; the user then requested commit and push. MIG-002 is
DONE for repository-level retirement, not for production deployment.

**Workflow status:** The .NET YAML is archived on `kotlin`. `master` still
tracks the old YAML, but the user reports no enabled workflow in this fork's
GitHub Actions UI; the remote execution state was not independently queried.
Merging the removal change should include the archive so the old YAML does not
remain under `.github/workflows/`. A new Kotlin workflow awaits the hosting
decision under OPS-005.

**Capture decision completed (2026-09-27):** The user requested actual C#
health, recorded-body Wikidata search, and controlled generic remote SPARQL
success captures, and waived further middleware-error equivalence. All three
were captured without changing any original 34-case file. Kotlin's Wikidata
and remote route outputs match. The remote raw-result comparator uncovered a
missing Kotlin `rdf:langString` datatype; the mapper and regression were fixed
without weakening expected results. Kotlin's JSON health response was approved
as an intentional C# difference under DEC-009; health-body parity is not
claimed.

**Decision required:** Decide future production deployment independently.
Local Kotlin packaging does not imply production readiness.
Authentication is planned for later user testing and is
not C# parity. Two-variable exploration is a new frontend feature, also not
C# parity.

## Removal sequence

1. Preserve the reviewed 34 original and three new C# captures and their
   provenance. Additional middleware-error equivalence was waived.
2. Verify the Kotlin-owned canonical Turtle copy, packaged bytes, and graph
   compatibility (OPS-001); no source data or golden result changes.
3. DEC-009 is resolved; Kotlin compatibility, quality, browser, and local
   runtime suites passed. The removal was separately reviewed against
   [[CSharp Removal Review]].
4. Include the inactive .NET workflow archive when merging the removal diff;
   preserve its configuration as historical evidence. This is not a deployment
   and does not require a separate GitHub disable action given the user's
   report that this fork has no enabled workflow.
5. The C# project, solution, and harness are deleted within the approved
   scope. The user authorized commit and push after the diff check; retain the
   immutable captures and historical Git recovery anchor.

No live deployment state was inspected during this audit.

OPS-002 (domain/TLS/CORS), OPS-003 (AWS architecture/deployment), OPS-004
(monitoring/backup), and SEC-001 (production policy) remain open for a future
production launch, even if C# is retired from the repository first.

## Source files

- `build.gradle.kts`
- `Sparql.QueryEasy/futebol_completo.ttl`
- `src/main/resources/futebol_completo.ttl`
- `Dockerfile`
- `.github/archived-workflows/master_sparql-query-easy.yml`
- `tcc/07 - Operations/Archived .NET Deployment Workflow.md`
- `tcc/05 - Migration/CSharp Removal Review.md`
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
