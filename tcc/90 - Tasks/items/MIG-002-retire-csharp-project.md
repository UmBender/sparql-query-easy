---
id: MIG-002
title: Retire the C# project after compatibility and operations gates
status: BLOCKED
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
dependencies are resolved. See [[../../05 - Migration/CSharp Retirement Readiness]].

## Evidence and relevant files

`build.gradle.kts` now packages a Kotlin-owned, byte-identical Turtle file;
`.github/workflows/master_sparql-query-easy.yml` still deploys .NET;
the compatibility harness references the C# project.

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
- [ ] The captured C# versus Kotlin health-body difference is resolved under DEC-009.
- [x] Canonical dataset is Kotlin-owned, byte-identical, packaged, and tested.
- [ ] Kotlin build, compatibility, browser, and local runtime gates pass.
- [ ] The .NET-only workflow is replaced or disabled before C# deletion.
- [ ] Capture preservation and repository-level rollback are documented and approved.
- [ ] C# removal diff is reviewed separately.

## Verification commands

```sh
GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintCheck detekt test --no-daemon
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
  blocks retirement until its contract is approved or aligned.
