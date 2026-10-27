---
id: LEARN-007
title: Learn PostgreSQL by hand in the stack's db container: psql, roles, migrations and restores
status: READY
priority: P1
type: learning
depends_on: [LEARN-005]
human_gate: true
created: 2026-10-07
updated: 2026-10-27
---
# Learn PostgreSQL by hand in the stack's db container: psql, roles, migrations and restores

Part of the [[../../07 - Operations/Deployment Learning Path/00 - Deployment Roadmap|Deployment Roadmap]];
progress goes in the [[../../07 - Operations/Deployment Learning Path/Deployment Learning Tracker|Deployment Learning Tracker]].
Prepares: OPS-009, OPS-004. Target: the university server (DEC-003); rewritten from the earlier AWS version on 2026-10-27.

## Why this matters for the deployment

PostgreSQL holds accounts, consent, attempts and questionnaire answers — the research data. You must be able to inspect it safely, understand the schema the migrations created, and restore it into a fresh stack.

## How this task is executed

1. **Claude writes the lesson** `tcc/07 - Operations/Deployment Learning Path/L07 - PostgreSQL in the Compose Stack.md`:
   a blog-post-style module that explains every concept below from first
   principles with diagrams, walks through the lab step by step with the
   expected output of each command, lists common errors and how to read
   them, and ends with a short quiz. It cites official documentation, and
   for commands it cannot run in the repository it marks the output as
   expected rather than observed.
2. **You do the lab by hand** in your own terminal and on the university
   server, run every self-check, and record results and questions in the tracker.
3. **Review together:** open questions go back into the lesson. The task
   is DONE when you tick every "Done when" item in the tracker (human gate).

Nothing is installed on the server, pushed or deployed by Claude without
your explicit request in the session; university rules come first.

## Learning objectives — after this you can

- Use `psql` in the `db` container: list databases, tables, roles; run read-only queries.
- Read the Flyway history and relate tables to features (accounts, study, forms).
- Explain the app's DB role and privileges; never use the superuser for the app.
- Run the backup/restore drill (OPS-009) into a separate stack and compare row counts.

## Concepts to study

- Databases, schemas, tables, roles, privileges; connections and `pg_stat_activity`.
- `pg_dump` custom format, encryption before leaving the server, retention (7 daily + 4 weekly).
- Personal data in the tables and who may read it (checklist D2).

## Hands-on lab

1. Open `psql`, list tables, count rows per study table, read `flyway_schema_history`.
2. Run a manual backup, restore it into a throwaway project, compare counts, remove it.

## Check it yourself (CLI)

Replace `<…>` placeholders with your values; `easyquery` is your `~/.ssh/config` host.

```sh
docker compose exec db psql -U easyquery easyquery -c '\dt'
```
Look for: the app's tables

```sh
docker compose exec db psql -U easyquery easyquery -c 'select version, description from flyway_schema_history order by installed_rank'
```
Look for: V1… migrations in order

```sh
docker compose exec db psql -U easyquery easyquery -c 'select count(*) from app_user'
```
Look for: the number of accounts (no personal data printed)

```sh
ls -lh "$BACKUP_DIR"
```
Look for: recent encrypted dumps with expected sizes

## Exercises — break it, then fix it

- Write a query that would leak personal data, explain why it must never be pasted in the tracker, and write the safe count-only version.

## Done when

- You can inspect the database read-only and explain each table's purpose.
- A restore drill succeeded and its time is recorded.

## Reading list

- PostgreSQL docs — psql, Database Roles, Backup and Restore (`pg_dump`, `pg_restore`)
- [[../../07 - Operations/Docker Compose Stack]] (Backups and restore)

## Execution log

- 2026-10-07: Created from the user's request for a hands-on deployment learning
  path (DOC-003), first written for AWS.
- 2026-10-27: Rewritten for the university server (user: "replaneje para o servidor
  da faculdade"); AWS content is in git history.
