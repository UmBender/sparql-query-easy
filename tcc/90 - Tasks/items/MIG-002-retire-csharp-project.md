---
id: MIG-002
title: Retire the C# project after compatibility and operations gates
status: BACKLOG
priority: P1
type: migration
depends_on: [MIG-001, QUAL-001, OPS-001, OPS-002, OPS-003, OPS-004, SEC-001]
human_gate: true
created: 2026-09-27
updated: 2026-09-27
---
# Retire the C# project after compatibility and operations gates

## Objective

Remove the C# implementation only after its remaining evidence and runtime
dependencies are resolved. See [[../../05 - Migration/CSharp Retirement Readiness]].

## Evidence and relevant files

`build.gradle.kts` packages a Turtle file from `Sparql.QueryEasy/`;
`.github/workflows/master_sparql-query-easy.yml` still deploys .NET;
the compatibility harness references the C# project.

## Exact scope

Approve the remaining capture requirements; relocate the canonical dataset
without changing bytes; replace and verify deployment and rollback; preserve
the immutable corpus; remove the C# tree only in a separate reviewed change.

## Explicitly out of scope

Changing golden results, silently changing HTTP contracts, removing the
capture corpus, or deleting C# before the gate is approved.

## Dependencies

MIG-001, QUAL-001, OPS-001 through OPS-004, and SEC-001. Production cutover
requires an explicit human decision.

## Acceptance criteria

- [ ] Remaining C# capture requirements are decided and completed or waived.
- [ ] Canonical dataset is Kotlin-owned, byte-identical, packaged, and tested.
- [ ] Kotlin build, compatibility, browser, and deployment gates pass.
- [ ] Rollback and capture preservation are documented and approved.
- [ ] C# removal diff is reviewed separately.

## Verification commands

```sh
GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintCheck detekt test --no-daemon
npm run test:browser
git diff --check
```

Also verify the approved dataset hash and the future deployment artifact.

## Expected documentation updates

`MIGRATION.md`, `MIGRATION_REPORT.md`, `remaining.md`, and
[[../../05 - Migration/CSharp Retirement Readiness]].

## Risks

Premature deletion breaks the Kotlin packaged dataset and leaves the .NET
deployment workflow without a buildable project.

## Execution log

- 2026-09-27: Created from a read-only background audit. No C# file was removed.
