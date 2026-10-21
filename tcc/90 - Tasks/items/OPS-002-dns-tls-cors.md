---
id: OPS-002
title: Define DNS TLS reverse-proxy and production CORS policy
status: BLOCKED
priority: P2
type: operations
depends_on: [OPS-001]
human_gate: true
created: 2026-09-16
updated: 2026-10-20
---
# Define DNS TLS reverse-proxy and production CORS policy

## Objective
Design domain ownership, TLS termination, proxy headers, redirect behavior, and restrictive frontend-origin CORS.

## Evidence and relevant files
`MIGRATION.md`; `Sparql.QueryEasy/Program.cs`; `HttpModule.kt`.

## Scope
Approved production origins and allowed methods/headers; integration tests for accepted/rejected origins.

## Out of scope
Registering domains, changing DNS, issuing certificates, or deploying.

## Dependencies
Container/runtime choice and human domain decision.

## Acceptance criteria
Written policy and test plan; no wildcard production CORS.

## Verification commands
Future Ktor integration tests.

## Expected documentation updates
Operations and decisions notes.

## Risks
Origin mistakes can break browser access or expose APIs.

## Execution log
- 2026-09-16: Blocked; production domain is unknown.
- 2026-10-16: DEC-003 chose the university server with Docker Compose
  (OPS-006 builds the stack locally). Still `BLOCKED` on server facts: public
  80/443 reachability, DNS name and TLS issuer, deploy access, off-host backup
  location (see BLOCKERS).
- 2026-10-20: DEC-017 Q1 C. OPS-008 implements the HTTPS mechanism (Caddy
  modes `local`, `auto`, `proxy`); this card keeps the policy: production
  domain, chosen mode, CORS and redirects. Still `BLOCKED` on the DOC-005
  answers.
