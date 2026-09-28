---
id: MIG-002
title: Retire the C# project after compatibility and operations gates
status: DONE
priority: P1
type: migration
depends_on: [MIG-001, QUAL-001, OPS-001, DEC-009]
human_gate: true
created: 2026-09-27
updated: 2026-09-27
---
# Retire the C# project after compatibility and operations gates

## Objective

Remove the C# implementation only after its remaining evidence and runtime
dependencies are resolved. See [[../../05 - Migration/CSharp Retirement Readiness]]
and the [[../../05 - Migration/CSharp Removal Review|24-file removal diff]].

## Evidence and relevant files

`build.gradle.kts` now packages a Kotlin-owned, byte-identical Turtle file;
`.github/archived-workflows/master_sparql-query-easy.yml` preserves the former
.NET deployment configuration outside the active workflow directory on the
Kotlin migration tree and the integrated `main` tree; the user reports no
enabled workflow in the fork's GitHub Actions UI. The compatibility harness
references the C# project.

## Exact scope

Approve the remaining capture requirements; verify the Kotlin-owned copy of
the canonical dataset without changing bytes; preserve the immutable corpus;
replace or disable the .NET-only workflow before removing the C# tree in a
separately reviewed change. Production cutover is a different decision.

## Explicitly out of scope

Changing golden results, silently changing HTTP contracts, removing the
capture corpus, or deleting C# before the gate is approved.

## Dependencies

MIG-001, QUAL-001, OPS-001, and the health-contract decision `DEC-009` for
**repository-level** retirement. OPS-002,
OPS-003, OPS-004, and SEC-001 remain independent prerequisites for a future
production launch, not for keeping C# source out of a local Kotlin build.
Removal still requires an explicit human decision.

## Acceptance criteria

- [x] Remaining C# capture requirements are decided and completed or waived.
- [x] The captured C# versus Kotlin health-body difference is approved under DEC-009.
- [x] Canonical dataset is Kotlin-owned, byte-identical, packaged, and tested.
- [x] Kotlin build, compatibility, browser, and local runtime gates pass on
      2026-09-27; the browser suite's external CSS/font dependency remains a
      separate FE-003/FE-004 review issue.
- [x] The .NET-only workflow is inactive on the fork by the user's GitHub
      Actions observation; its YAML is archived on `kotlin` and must be
      removed from `.github/workflows/` when integrating the deletion diff.
- [x] Capture preservation and repository-level rollback are documented and
      approved for the 24-file removal scope.
- [x] C# removal diff is reviewed separately; its 24 deleted paths match the
      approved manifest, and the user requested commit and push after review.

## Verification commands

```sh
GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintCheck detekt test installDist --no-daemon
npm run test:browser
git diff --check
```

Also verify the approved dataset hash and local Kotlin artifact. Production
deployment verification belongs to OPS-002–OPS-004, not this removal gate.

## Expected documentation updates

`MIGRATION.md`, `MIGRATION_REPORT.md`, `remaining.md`, and
[[../../05 - Migration/CSharp Retirement Readiness]].

## Risks

Premature deletion leaves the .NET deployment workflow and C# harness without
a buildable project. Do not silently imply that local C# removal approves
production deployment or deletes its historical capture evidence.

## Execution log

- 2026-09-27: Created from a read-only background audit. No C# file was removed.
- 2026-09-27: OPS-001 made the Kotlin resource independent of the C# tree.
  The user deferred deployment, so repository-level retirement no longer
  depends on production-only OPS-002/003/004 or SEC-001. Human approval,
  capture decisions, workflow replacement/disablement, and local gates remain.
- 2026-09-27: User required three additional C# success captures and waived
  further middleware-error equivalence. Captured all three separately from
  the original 34; Kotlin matches Wikidata and remote SPARQL output. The
  actual C# health body is plain text rather than Kotlin JSON, so DEC-009
  blocked retirement until its contract was approved or aligned.
- 2026-09-27: User approved Kotlin JSON `/health` as an intentional C#
  difference under DEC-009. MIG-002 remains blocked on the separate human
  deletion approval, final local gates, .NET workflow replacement/disablement,
  preservation/rollback documentation, and removal-diff review.
- 2026-09-27: User deferred choosing the Kotlin deployment platform and
  requested disabling the .NET workflow while retaining its configuration.
  Moved the legacy YAML out of `.github/workflows/` into
  `.github/archived-workflows/` on `kotlin` and documented its jobs, trigger,
  and Azure secret reference without exposing a secret value. The default
  branch still needs the archive change integrated;
  no Kotlin deployment workflow was invented and no C# source was removed.
- 2026-09-27: User clarified that this repository is a fork with no enabled
  workflow visible in GitHub Actions. The tracked YAML on `master` was
  incorrectly treated as proof of an active deployment; it is not. Removed
  remote disablement as a prerequisite, while retaining the requirement to
  integrate the archived-file change with the eventual removal diff.
- 2026-09-27: Final review gate passed: Gradle
  `ktlintCheck detekt test installDist --no-daemon`, 22/22 browser tests,
  installed-distribution `/health`, frontend, and OpenAPI HTTP smoke, packaged
  dataset SHA-256, and 37 capture/ledger ID checks. Offline C# harness build
  passed with 0 errors and 20 existing warnings. The initial Gradle call was
  interrupted by an accidental user click before a result; the resumed run
  passed. Prepared [[../../05 - Migration/CSharp Removal Review]] with the
  exact 24-file proposed deletion and repository rollback plan. No C# file or
  capture was deleted. Human approval and a separate removal diff remain.
- 2026-09-27: User approved the exact 24-file scope and repository rollback
  plan. Deleted only the solution, C# project (including its byte-identical
  dataset copy), and C# harness files via a separate worktree diff. Updated
  current docs to distinguish historical C# commands from runnable Kotlin
  commands. Post-deletion Gradle quality/compatibility/installDist and all
  22 browser tests and post-deletion distribution HTTP smoke passed; captures
  and `files/` data remained unchanged.
  The diff was left in REVIEW for a separate publication decision.
- 2026-09-27: Checked the exact deletion path list against the approved
  24-file manifest and reviewed the documentation diff. The user requested
  commit and push. Created pre-removal rollback anchor `03d8057` containing
  DEC-009 and the archived workflow. The removal is now approved for its
  separate commit; task acceptance criteria are complete.
