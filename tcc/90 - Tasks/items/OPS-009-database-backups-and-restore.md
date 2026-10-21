---
id: OPS-009
title: Back up PostgreSQL on a schedule with retention and restore it into a fresh stack
status: BACKLOG
priority: P1
type: operations
depends_on: [DEC-017, OPS-006, QUAL-017]
human_gate: false
created: 2026-10-20
updated: 2026-10-20
---
# Back up PostgreSQL on a schedule with retention and restore it into a fresh stack

## Objective

T11 backups, as a follow-up to OPS-006 (EXTENDS). Accounts, sessions, study
tasks, attempts, consent and questionnaire answers live only in the
`easyquery_db-data` volume. OPS-004 (monitoring/backup plan) is BLOCKED on
SEC-001; DEC-017 Q3 proposes doing backups here now and Q4 sets their data
protection. Uploaded Turtle graphs stay in memory and are not backed up
(DEC-005). Skill: `tcc-backend` (operations files) with `tcc-test`.

## Confirmed entry points

`compose.yaml` (`db`, `db-data`), `.env.example`, runbook
[[../../07 - Operations/Docker Compose Stack]], Flyway migrations in
`src/main/resources/db/`.

## Scope

- A `backup` service (proposed: same `postgres:17-alpine` image, no
  published port) that runs `pg_dump --format=custom` on a schedule from
  `.env` (default daily) into a host path from `.env`
  (`BACKUP_DIR`, proposed), file names with UTC timestamp, written to a
  temporary name and renamed when complete.
- Retention per DEC-017 Q4 (proposed 7 daily + 4 weekly), applied after a
  successful dump only.
- Optional off-host copy step selected in `.env` (none by default; the
  target is a server fact in DOC-005); encryption per DEC-017 Q4.
- `scripts/` restore command (proposed): stops `backend`, restores a chosen
  dump into an empty database, starts `backend`, prints `/health`.
- Written restore procedure in the runbook; a failed dump is visible in
  `docker compose logs backup` and leaves older dumps intact.

## Out of scope

- Monitoring/alerting on backup failure (OPS-004), uploaded graphs, point-in-
  time recovery/WAL archiving, the real off-host location.

## Acceptance criteria

- [ ] With a short schedule, dumps appear in `BACKUP_DIR`, and retention
  removes the oldest beyond the limit.
- [ ] Restore drill, done once and logged: create an account, a study task
  with an attempt and a consent; dump; bring up a fresh project with an
  empty volume; restore; log in with that account and see the attempt and
  consent; Flyway reports nothing to migrate.
- [ ] A dump of an older migration level restores and Flyway migrates it
  forward (if an older dump exists; otherwise noted).
- [ ] `.env.example` documents every new variable; no dump or key is
  committed (`.gitignore`).

## Validation

Focused: the scripted restore drill (proposed `scripts/backup-restore-check`)
as a separate Compose project, removed afterwards. Closing: Compose row of the
Operational Map and `npm --prefix frontend run test:compose`.
