---
id: OPS-011
title: Install, update, roll back, restore and rotate secrets on the server by following one runbook
status: REVIEW
priority: P1
type: operations
depends_on: [DEC-017, DOC-005, OPS-008, OPS-009, OPS-010]
human_gate: true
created: 2026-10-20
updated: 2026-10-21
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

- [x] On a clean machine, following only the runbook, `docker compose up`
  serves the app on one origin with a migrated database (`/health`
  `database: ready`).
- [x] Update from tag A to tag B and roll back to A, each followed by the
  post-step checks, done once and logged.
- [x] Secret rotation done once: the old database password stops working,
  the app keeps working.
- [x] Restore section points to the OPS-009 drill and was followed once.

## Validation

Focused: the runbook followed on a clean VM or a fresh clone in a new
directory with a new Compose project name. Closing: Compose row of the
Operational Map, `npm --prefix frontend run test:compose`, documentation
check.

## Execution log

- 2026-10-20/21: `compose.yaml` tags `easyquery-backend`, `-web` and
  `-backup` with `${EASYQUERY_VERSION:-local}`; `.env.example` documents it.
  [[../../07 - Operations/Server Deploy Runbook]]: prerequisites and go-live
  gates (SEC-001, OPS-002), tagging a release, first install, checks, update
  with a pre-update backup, rollback (with restore when migrations changed),
  restore, secret rotation. [[../../07 - Operations/Docker Compose Stack]]
  and the Operational Map link it. No HTTP behavior changed.
- Drill (2026-10-21, development machine, project `easyquery-drill`, mode
  `local` on 127.0.0.1:18300, scratch remote with tags `v0.0.1-drill` and
  `v0.0.2-drill`, stack and images removed afterwards). Each step was
  followed by the runbook checks (`/health` `{"status":"ok","database":"ready"}`,
  admin login, PokemonGen1 search for Pikachu, `database migrations applied`
  in the log, no `ERROR`):
  - first install: all four services up, admin role from
    `EASYQUERY_ADMIN_USERNAMES`;
  - update to `v0.0.2-drill`: pre-update dump and `.age` copy written, the
    `.env` diff listed no new setting, images `:v0.0.2-drill` built next to
    `:v0.0.1-drill`, the release-B change served, account kept;
  - rollback to `v0.0.1-drill`: no build, old images and content served;
  - restore: an account created after the backup was gone after restoring
    the plain dump and again after the `.age` copy with the private key;
  - rotation: `ALTER ROLE`, `.env`, `up -d --wait` recreated db, backend and
    backup; the old password was rejected over the network, the new one
    accepted; app checks and a backup run passed.
- Found by the drill and fixed in the runbook: retention keeps the newest
  dump per day, so a later same-day run deleted the pre-update dump (the
  update step now copies it to `pre-NEW.dump`, which retention ignores;
  checked in the backup image); a restore that fails before replacing the
  database leaves `backend` and `backup` stopped (now stated, with the
  command to start them).
- An earlier session's drill left no log (its scratch directory was gone)
  and its stack and `*-drill` images were removed; the drill above replaces it.
- Gates: `node scripts/check-project-docs.mjs` and `git diff --check`
  passed; `test:compose` 4 passed; `node scripts/check-backup-restore.mjs`
  passed (16 checks).
- Commit: completion commit for this task.

## Human validation

Follow the runbook once on the university server (or a clean VM): first
install and the checks, ideally one update and rollback. Then mark DONE.
