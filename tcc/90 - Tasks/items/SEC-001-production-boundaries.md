---
id: SEC-001
title: Decide and implement production endpoint, upload, and cache boundaries
status: BACKLOG
priority: P1
type: security
depends_on: [API-001, DEC-001]
human_gate: true
created: 2026-09-16
updated: 2026-09-16
---
# Decide and implement production endpoint, upload, and cache boundaries

## Objective
Approve a security contract for remote endpoints, graph uploads, cache ownership, limits, and errors.

## Evidence and relevant files
`EndpointContextResolver.kt`; `HttpModule.kt`; `LocalGraphCache.kt`; `SparqlQueryBuilder.cs`; `MIGRATION.md`.

## Scope
Endpoint allow-list policy, request/graph limits, timeout policy, cache retention/access scope, and corresponding tests/documentation.

## Out of scope
Silent behavioral hardening without approved versioned contract.

## Dependencies
API documentation and human policy decisions.

## Acceptance criteria
Approved policy, tested enforcement, and documented intentional compatibility changes.

## Verification commands
Focused route/security tests and full Gradle quality gate.

## Expected documentation updates
API, operations, decisions, migration report.

## Risks
Changes accepted remote/SPARQL behavior and requires compatibility review.

## Execution log
- 2026-09-16: Backlog pending policy approval.
