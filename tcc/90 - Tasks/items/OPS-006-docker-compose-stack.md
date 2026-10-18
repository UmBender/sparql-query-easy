---
id: OPS-006
title: Run db, backend and web together with Docker Compose
status: DONE
priority: P1
type: operations
depends_on: [OPS-001, BE-005, FE-040]
human_gate: false
created: 2026-10-16
updated: 2026-10-18
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

- [x] `docker compose up` from a clean checkout serves the SPA and API on one origin.
- [x] Restarting keeps database data; `down -v` removes it.
- [x] Runbook in `tcc/07 - Operations/` with start, stop, logs, reset.

## Execution log

- 2026-10-18: `compose.yaml` (`db` postgres:17-alpine with volume and
  `pg_isready`; `backend` from the OPS-001 Dockerfile with
  `EASYQUERY_DB_*` from `POSTGRES_*`, `EASYQUERY_TRUST_PROXY=true`, a 5 s
  health check, waits for a healthy db; `web` from `deploy/web.Dockerfile`:
  Node 22 builds the SPA with npm 11, Caddy 2.10 serves it and proxies the API,
  docs and legacy page files to the backend, published on 127.0.0.1 only).
  `POSTGRES_PASSWORD` is required (Compose fails with a message without it).
  `.env.example` gained the Compose entries. Runbook:
  [[../../07 - Operations/Docker Compose Stack]].
- Verified with Docker 29.8 / Compose 5.6: build and start, one-origin smoke
  (SPA, fallback, health, endpoints, OpenAPI, Swagger, legacy page, a
  PokemonGen1 count), register/session/foreign-Origin through Caddy, data kept
  across `down`/`up`, removed by `down -v`. Stack torn down afterwards.
