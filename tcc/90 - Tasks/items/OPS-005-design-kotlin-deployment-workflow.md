---
id: OPS-005
title: Design a new Kotlin deployment workflow after hosting is chosen
status: BLOCKED
priority: P2
type: operations
depends_on: [OPS-001]
human_gate: true
created: 2026-09-27
updated: 2026-09-27
---
# Design a new Kotlin deployment workflow after hosting is chosen

## Objective

Create a Kotlin/JVM deployment workflow from scratch only after the owner
chooses a hosting target, release method, credential model, and rollback
strategy. The archived .NET workflow is historical evidence, not a template.

## Evidence and relevant files

`Dockerfile` and `tcc/07 - Operations/Local JVM and Container Runtime.md`
describe the local artifact. The old Azure workflow is preserved at
`.github/archived-workflows/master_sparql-query-easy.yml`. See
[[../../07 - Operations/Archived .NET Deployment Workflow]].

## Exact scope

After a human deployment decision, define build/test gates, artifact
provenance, target authentication, environment separation, secrets handling,
promotion, smoke checks, and rollback; then implement and test an appropriate
Kotlin workflow.

## Explicitly out of scope

Assuming AWS or Azure, deploying now, copying the old .NET YAML as a Kotlin
workflow, creating credentials, or changing DNS/TLS without separate approval.

## Dependencies

OPS-001 is complete. Hosting, domain, security, and deployment/rollback
choices under OPS-002–OPS-004 or their successors require human approval
before this task becomes READY.

## Acceptance criteria

- [ ] Hosting/release target and credential model are approved.
- [ ] A Kotlin workflow is implemented for that target with build, tests,
      artifact handling, smoke checks, and rollback.
- [ ] Secret values are never committed and least-privilege access is reviewed.
- [ ] A non-production validation run and documentation review pass.

## Verification commands

Choose workflow validation commands after selecting the platform. The local
baseline is `GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew
ktlintCheck detekt test --no-daemon`.

## Expected documentation updates

Operations inventory, deployment runbook, migration report, and task index.

## Risks

An assumed platform or copied C# deployment could publish the wrong artifact
or access a live environment without an approved rollout/rollback plan.

## Execution log

- 2026-09-27: Created when the user deferred choosing where/how to deploy
  Kotlin and requested archiving the old .NET workflow. No Kotlin CI/CD or
  deployment was created.
