---
id: OPS-003
title: Produce AWS deployment plan
status: BLOCKED
priority: P2
type: operations
depends_on: [OPS-001, OPS-002]
human_gate: true
created: 2026-09-16
updated: 2026-09-16
---
# Produce AWS deployment plan

## Objective
Produce a decision-ready AWS architecture only after the hosting/domain/runtime choices are known.

## Evidence and relevant files
No AWS configuration exists in the repository; current CI targets Azure.

## Scope
Compare approved AWS service options, deployment/rollback, IAM boundaries, cost assumptions, and non-secret configuration flow.

## Out of scope
Creating AWS resources, credentials, DNS, or deployment pipelines.

## Dependencies
OPS-001, OPS-002, human hosting decision.

## Acceptance criteria
Approved architecture diagram and implementation backlog.

## Verification commands
Design review only until implementation approval.

## Expected documentation updates
Operations and decisions notes.

## Risks
Assumptions about AWS services or costs before requirements exist.

## Execution log
- 2026-09-16: Blocked; AWS is requested as a planning family but not configured or selected.
