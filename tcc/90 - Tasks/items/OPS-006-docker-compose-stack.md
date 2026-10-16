---
id: OPS-006
title: Run db, backend and web together with Docker Compose
status: BACKLOG
priority: P1
type: operations
depends_on: [OPS-001, BE-005, FE-040]
human_gate: false
created: 2026-10-16
updated: 2026-10-16
---
# Run db, backend and web together with Docker Compose

## Objective

T11, the part that does not need server facts ([[DEC-003-production-hosting-target]]).
HTTPS, backups and deployment on the server stay in OPS-002, OPS-004 and
OPS-005, which remain blocked on those facts.

## What already exists (conflict report)

OPS-001 gives the backend image (non-root, health check, env file). Not yet
covered anywhere: db service, web proxy config, secrets, migrations at startup.

## Scope

- `compose.yaml`: `db` (PostgreSQL, named volume, health check), `backend`
  (OPS-001 image, waits for db, Flyway at startup via BE-005), `web` (Caddy:
  serves `frontend/` build, proxies `/api`, `/health`, `/swagger`,
  `/openapi.json` to backend; legacy page also reachable until FE-049).
- `.env.example` entries for database credentials; real `.env` git-ignored.
- Local HTTP only; TLS settings left for OPS-002.

## Acceptance criteria

- [ ] `docker compose up` from a clean checkout serves the SPA and API on one origin.
- [ ] Restarting keeps database data; `down -v` removes it.
- [ ] Runbook in `tcc/07 - Operations/` with start, stop, logs, reset.
