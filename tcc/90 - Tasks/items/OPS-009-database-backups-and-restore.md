---
id: OPS-009
title: Back up PostgreSQL on a schedule with retention and restore it into a fresh stack
status: DONE
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

- [x] With a short schedule, dumps appear in `BACKUP_DIR`, and retention
  removes the oldest beyond the limit.
- [x] Restore drill, done once and logged: create an account, a study task
  with an attempt and a consent; dump; bring up a fresh project with an
  empty volume; restore; log in with that account and see the attempt and
  consent; Flyway reports nothing to migrate.
- [x] A dump of an older migration level restores and Flyway migrates it
  forward (if an older dump exists; otherwise noted): noted, none exists.
- [x] `.env.example` documents every new variable; no dump or key is
  committed (`.gitignore`).

## Validation

Focused: the scripted restore drill (proposed `scripts/backup-restore-check`)
as a separate Compose project, removed afterwards. Closing: Compose row of the
Operational Map and `npm --prefix frontend run test:compose`.

## Execution log

- 2026-10-20: DEC-017 Q3 A, Q4 A. `deploy/backup.Dockerfile`
  (`postgres:17-alpine` + `age` 1.3) with `deploy/backup/`:
  `easyquery-backup-schedule` (busybox `crond`, `BACKUP_SCHEDULE` UTC),
  `easyquery-backup` (`pg_dump -Fc` to a `.partial-` name, renamed when
  complete, `umask 077`; optional `age` copy to `/offsite`; prune after
  success only), `easyquery-prune` (newest per day for 7 days and per ISO
  week for 4 weeks; only `easyquery-<stamp>.dump[.age]` files),
  `easyquery-restore` (name in `/backups` or `/offsite`, or stdin; `.age`
  needs `AGE_IDENTITY`; `pg_restore --list` check, `DROP DATABASE ... WITH
  (FORCE)`, `CREATE DATABASE`, `pg_restore --no-owner --exit-on-error`).
  `scripts/restore-backup.sh` stops `backend` and `backup`, restores, starts
  them and prints `/health`. `compose.yaml` service `backup` (bind mounts
  `BACKUP_DIR`/`BACKUP_OFFSITE_DIR` with `:z` for SELinux; host paths so
  `down -v` keeps them); `/backups/` in `.gitignore` and `.dockerignore`.
  `.env.example`, runbook section, Operational Map, Operations Inventory.
- Drill `scripts/check-backup-restore.mjs` (passes 16 checks): retention on
  50 dummy dumps keeps the 9 expected plus non-matching files; with a
  one-minute schedule a dump and its `.age` copy appear, all `0600`, the
  copy is not readable by `pg_restore`; a dump with a wrong password logs
  `FAILED`, exits 1 and leaves the directory unchanged; the plain dump and
  then the encrypted copy (with the private key) restored into a fresh
  project make every public table (with `flyway_schema_history`) equal to
  the source by per-table md5, and the participant logs in and still has the
  consent and one attempt; the backend starts on the restored database.
- `npm --prefix frontend run test:compose`: 4 passed with the fourth
  service. It creates `./backups` (root, 700) at the repository root because
  `deploy/compose-test.env` (QUAL-017, not edited) does not set
  `BACKUP_DIR`; ignored by git and the Docker build context.
- Limitations: no older-migration dump exists yet, so forward migration of
  a restored dump is untested; the off-host location is a server fact
  (DOC-005 D1); alerting on failure stays OPS-004.
- Commit: completion commit for this task.
