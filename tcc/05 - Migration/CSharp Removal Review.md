# C# Removal Diff — Approved for Commit

## State and decision boundary

**Applied locally and approved for publication (2026-09-27):** The user approved the exact
24-file scope and repository rollback plan. Those C# solution, project, and
harness files are deleted in the current `kotlin` worktree; no capture file
was deleted. After the removal diff and rollback sequence were reported, the
user explicitly requested commit and push. The DEC-009 and workflow-archive
changes were committed separately as the pre-removal rollback anchor
`03d8057`. Production deployment is not part of this work.

## Final local evidence

| Check | Result |
|---|---|
| Kotlin `ktlintCheck detekt test installDist --no-daemon` | Passed; 18 Gradle tasks, 4 executed and 14 up-to-date. The offline capture comparators are part of `test`. |
| `npm run test:browser` | Passed: 22/22 Playwright tests. These tests still load external CSS/fonts, so this is not proof of fully offline browser execution. FE-003/FE-004 remain REVIEW for that separate concern. |
| Installed distribution smoke | `/health` returned `200 application/json` and exact `{"status":"ok"}`; `/index2.html` returned `200 text/html`; `/openapi.json` returned `200 application/json`. The temporary local server was stopped. |
| Canonical built-in Turtle bytes | C# source, Kotlin source, processed resource, and installed application JAR all yielded SHA-256 `2345428c9513651dcf184835538fa910abae6c95fcb399e508709d646af7993f`. |
| C# harness `dotnet build --no-restore` | Passed with 0 errors and 20 existing nullable/async warnings. No recapture was performed. |
| Capture inventory | 34 original + 3 separate retirement cases; both indexes' IDs match the 37 provenance-ledger IDs. Capture result files are unchanged in the worktree. |

The original corpus has Git tree ID
`5d80371f11a7a20574fba61e2c1be7170af9eea5`; the retirement corpus has
tree ID `4265085c0d20621c51c0ff80e3ef435df05a437f`. The current committed
pre-removal source anchor is `0f2009175f5aeb88cd0c64ecf5cc489b23e6155b`;
it contains C# project tree `cef8b4e716a1c65a6c8abff41b2cd4cd2baf5bf9`
and harness tree `a9bdff1ddf4211e9bfda7ec0d7046ba8aefba675`.

## Exact applied deletion (24 tracked files)

The C# removal pathspec diff contains exactly these solution/project/harness
files, plus related documentation edits elsewhere. Do **not** remove
`compatibility/expected/`, `compatibility/retirement-expected/`,
`compatibility/cases/capture-status.tsv`, `compatibility/requests/`,
`compatibility/remote-responses/`, the recorded Wikidata bodies, or the Kotlin
tests that replay them.

```text
Sparql.QueryEasy.sln
Sparql.QueryEasy/Controllers/LocalDatabaseController.cs
Sparql.QueryEasy/Controllers/QueryController.cs
Sparql.QueryEasy/Dtos/PropertyDto.cs
Sparql.QueryEasy/Program.cs
Sparql.QueryEasy/Properties/launchSettings.json
Sparql.QueryEasy/Repositories/BrasileiraoDatabase.cs
Sparql.QueryEasy/Repositories/IQueryExecutor.cs
Sparql.QueryEasy/Repositories/LocalQueryExecutor.cs
Sparql.QueryEasy/Repositories/RemoteQueryExecutor.cs
Sparql.QueryEasy/Requests/BaseRequest.cs
Sparql.QueryEasy/Requests/QueryRequests.cs
Sparql.QueryEasy/Services/EndpointService.cs
Sparql.QueryEasy/Services/IEndpointService.cs
Sparql.QueryEasy/Sparql.QueryEasy.csproj
Sparql.QueryEasy/Utils/SparqlQueryBuilder.cs
Sparql.QueryEasy/Utils/SparqlResultExtension.cs
Sparql.QueryEasy/appsettings.Development.json
Sparql.QueryEasy/appsettings.json
Sparql.QueryEasy/futebol_completo.ttl
compatibility/Compatibility.Harness/Compatibility.Harness.csproj
compatibility/Compatibility.Harness/Program.cs
compatibility/Compatibility.Harness/README.md
compatibility/Compatibility.Harness/RetirementCaptureHarness.cs
```

**Retain:** the two independent Turtle reference files in `files/`, the
Kotlin-owned `src/main/resources/futebol_completo.ttl`, all 37 captures and
provenance, the archived .NET workflow under `.github/archived-workflows/`,
and all Kotlin comparator tests. The C# harness will no longer be runnable
from the post-removal tree; its source and exact dependency graph remain
recoverable from the pre-removal Git commit above.

## References and rollback

The Kotlin build/test/runtime path does not reference the C# project;
`.dockerignore` still has a harmless C# path exclusion. The removal diff
updates `README.md`, `MIGRATION.md`, `MIGRATION_REPORT.md`, `remaining.md`,
`compatibility/README.md`, `compatibility/retirement-expected/README.md`,
and current vault notes that gave live `dotnet` or harness instructions.
Historical capture provenance stays intact; its command paths are labeled
historical rather than runnable.

For repository rollback, use pre-removal commit `03d8057`, which contains
the health-contract and workflow-archive changes without deleting C#.
If the removal causes a regression, revert **the removal commit** in a new
commit, then rerun Kotlin quality and browser checks. Do not rewrite the
immutable captures or use a destructive worktree reset. This is repository
rollback only; no production deployment or production rollback path has been
approved.

**Post-deletion checks:** `ktlintCheck detekt test installDist --no-daemon`
passed, as did 22/22 browser tests. The installed Kotlin distribution again
served `/health`, `/index2.html`, and `/openapi.json` with HTTP 200, then was
stopped. The capture indexes/ledger still contain
34+3 matching IDs, and no capture result files changed. The C# files are
recoverable from Git commit `0f20091`; the ignored .NET `bin/`/`obj/` build
outputs, if present locally, were not part of the approved 24-file deletion.

## Publication decision

- The exact 24-file deletion and accompanying documentation diff were checked
  against the approved scope; the user then requested commit and push.
- Keep the pre-removal anchor and deletion as separate commits, so reverting
  only the deletion commit restores the C# source without re-enabling the
  archived workflow.
- Keep OPS-002–OPS-005 and SEC-001 for later production decisions; no Kotlin
  deploy workflow is required for repository-level C# retirement.

## Source files

- `Sparql.QueryEasy.sln`
- `Sparql.QueryEasy/Sparql.QueryEasy.csproj`
- `compatibility/Compatibility.Harness/Compatibility.Harness.csproj`
- `compatibility/expected/index.json`
- `compatibility/retirement-expected/index.json`
- `compatibility/cases/capture-status.tsv`
- `src/main/resources/futebol_completo.ttl`
- `src/test/kotlin/com/example/sparqlqueryeasy/http/CaptureDrivenCompatibilityTest.kt`
- `src/test/kotlin/com/example/sparqlqueryeasy/http/RetirementSuccessCompatibilityTest.kt`
- `build.gradle.kts`
- `.github/archived-workflows/master_sparql-query-easy.yml`
