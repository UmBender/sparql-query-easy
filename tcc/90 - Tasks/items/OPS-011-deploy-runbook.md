---
id: OPS-011
title: Install, update, roll back, restore and rotate secrets on the server by following one runbook
status: BACKLOG
priority: P1
type: operations
depends_on: [DEC-017, DOC-005, OPS-008, OPS-009, OPS-010]
human_gate: true
created: 2026-10-20
updated: 2026-10-20
---
# Install, update, roll back, restore and rotate secrets on the server by following one runbook

## Objective

T11 runbook, as a follow-up to OPS-006 (EXTENDS). The current runbook covers
local start, stop, logs and reset. This card adds the server procedures and
the versioned images rollback needs, using the release method of DEC-017 Q5.
Automating the deploy from CI stays OPS-005. `human_gate`: the user runs the
first install on the real server (or a clean VM if the server is not
available yet). Skill: `tcc-backend` (operations files).

## Confirmed entry points

`compose.yaml` (images tagged `:local`, `build:`),
[[../../07 - Operations/Docker Compose Stack]], `.env.example`; DB password
is only read by PostgreSQL when the volume is first initialised.

## Scope

- Image tags from one `.env` variable (proposed `EASYQUERY_VERSION`,
  default `local`), so two versions can coexist on the host.
- `tcc/07 - Operations/Server Deploy Runbook.md` (proposed): prerequisites
  (from DOC-005), first install from a clean machine, update to a tag, roll
  back to the previous tag (and when a Flyway migration prevents it: restore
  the pre-update backup), restore from backup (OPS-009), rotate secrets
  (`POSTGRES_PASSWORD` with `ALTER ROLE` plus `.env` and a backend restart;
  admin usernames; ACME e-mail), a pre-update backup step, post-step checks
  (`/health` `database: ready`, login, one PokemonGen1 query).
- Go-live checklist that names SEC-001 and OPS-002 as gates (conflict
  report: go-live depends on SEC-001).

## Out of scope

- CI/CD to the server (OPS-005), registry setup unless DEC-017 Q5 B,
  changing DNS or the server.

## Acceptance criteria

- [ ] On a clean machine, following only the runbook, `docker compose up`
  serves the app on one origin with a migrated database (`/health`
  `database: ready`).
- [ ] Update from tag A to tag B and roll back to A, each followed by the
  post-step checks, done once and logged.
- [ ] Secret rotation done once: the old database password stops working,
  the app keeps working.
- [ ] Restore section points to the OPS-009 drill and was followed once.

## Validation

Focused: the runbook followed on a clean VM or a fresh clone in a new
directory with a new Compose project name. Closing: Compose row of the
Operational Map, `npm --prefix frontend run test:compose`, documentation
check.
