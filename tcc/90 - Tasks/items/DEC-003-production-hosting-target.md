---
id: DEC-003
title: Host production with Docker Compose on the university server
status: DONE
priority: P0
type: decision
depends_on: []
human_gate: true
created: 2026-10-16
updated: 2026-10-16
---
# Host production with Docker Compose on the university server

## Decision

`DEC-003` was an open row in [[../../09 - Decisions/Open Decisions]]
(hosting platform, domain, DNS, TLS, frontend origin). User decision
(2026-10-16, answer D2 of
[[../../05 - Migration/Frontend Migration Conflict Report]]): "I will use my
university server". AWS is no longer the target; DOC-003's roadmap stays as
history.

Layout (from the user's target architecture): Docker Compose with
- `db`: PostgreSQL with a named volume;
- `backend`: the Ktor image from OPS-001;
- `web`: Caddy serving the SPA and proxying the API on the same origin.

## Still unknown (blocks go-live, not the Compose stack)

Public reachability on 80/443, the DNS name and who issues TLS, how a deploy
reaches the server, and where off-host backups go. Tracked in
[[../BLOCKERS]] and in OPS-002, OPS-004 and OPS-005, which keep their status.

## Effects

- OPS-003 (AWS plan) is `CANCELLED`, superseded by this decision.
- OPS-006 builds the Compose stack locally; OPS-002/004/005 cover HTTPS,
  backups and deployment on the server.
- LEARN-003/004/005/006/010/012 teach AWS-specific steps; their re-scoping is
  left to the user (not changed here).
- LGPD handling is deferred by the user (2026-10-16, D5).

## Execution log

- 2026-10-16: Recorded the user's answer. No infrastructure created.
