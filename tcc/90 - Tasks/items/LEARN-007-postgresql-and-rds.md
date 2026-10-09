---
id: LEARN-007
title: Learn PostgreSQL by hand, then run it on Amazon RDS
status: READY
priority: P1
type: learning
depends_on: [LEARN-002, LEARN-004]
human_gate: true
created: 2026-10-07
updated: 2026-10-07
---
# Learn PostgreSQL by hand, then run it on Amazon RDS

Part of the [[../../07 - Operations/Deployment Learning Path/00 - Deployment Roadmap|Deployment Roadmap]];
progress goes in the [[../../07 - Operations/Deployment Learning Path/Deployment Learning Tracker|Deployment Learning Tracker]].
Prepares: AUTH-001, OPS-004.

## Why this matters for the deployment

The login passwords (as hashes) and sessions will live in PostgreSQL. You need to create the database and its roles correctly, reach it only from the app, use TLS, and be able to back it up and restore it.

## How this task is executed

1. **Claude writes the lesson** `tcc/07 - Operations/Deployment Learning Path/L07 - PostgreSQL and Amazon RDS.md`:
   a blog-post-style module that explains every concept below from first
   principles with diagrams, walks through the lab step by step with the
   expected output of each command, lists common errors and how to read
   them, and ends with a short quiz. It cites official documentation, and
   for commands it cannot run in the repository it marks the output as
   expected rather than observed.
2. **You do the lab by hand** in your own terminal/AWS account, run every
   self-check, and record results and questions in the tracker.
3. **Review together:** open questions go back into the lesson. The task
   is DONE when you tick every "Done when" item in the tracker (human gate).

No AWS resource is created, and nothing is pushed or deployed, by Claude
without your explicit request in the session.

## Learning objectives — after this you can

- Use `psql` fluently: connect, list objects, create roles/databases/tables, grant privileges, explain a query.
- Run PostgreSQL locally in Docker for development and tests.
- Create an RDS PostgreSQL instance in private subnets, reachable only from the app security group, with TLS enforced.
- Take and restore backups (pg_dump/pg_restore locally; RDS snapshots and point-in-time restore).
- Understand schema migrations (e.g. Flyway) and how the Kotlin app will connect (JDBC, a connection pool like HikariCP).

## Concepts to study

- Cluster, database, schema, table, role; owner vs application role; least privilege (`GRANT`/`REVOKE`).
- Connection strings, `sslmode` (`require` vs `verify-full`) and the RDS CA bundle.
- Data types useful for users (e.g. `citext` or lower-cased unique email, `timestamptz`), unique constraints and indexes.
- Transactions and isolation at a basic level.
- RDS: instance class, storage, Multi-AZ (and why not now), automated backups/retention, maintenance windows, parameter groups, `rds.force_ssl`, master password managed in Secrets Manager.
- Backups vs snapshots vs point-in-time recovery; RPO/RTO.
- Migrations as versioned SQL files applied in order.

## Hands-on lab

1. Local: `docker run --name pg -e POSTGRES_PASSWORD=<local-only> -p 127.0.0.1:5432:5432 -d postgres:17` (or the current major); create role `easyquery_app` and database `easyquery` owned by an owner role; create a `users` table draft.
2. Dump and restore the local database into a second database.
3. AWS: create a DB subnet group (2 private subnets), an RDS PostgreSQL instance (smallest class, not publicly accessible, `easyquery-db` SG, automated backups on, deletion protection on).
4. From the EC2 instance, connect with `psql` over TLS using the RDS CA bundle and create the application role.
5. Take a manual snapshot and do a point-in-time restore into a temporary instance; delete it afterwards.

## Check it yourself (CLI)

Replace `<…>` placeholders with your values.

```sh
psql "host=127.0.0.1 user=postgres dbname=postgres" -c "SELECT version();"
```
Look for: server version

```sh
\l   \du   \dn   \dt   \d+ users   \conninfo
```
Look for: databases, roles, schemas, tables, a table definition, current connection (inside psql)

```sh
SELECT ssl, version, cipher FROM pg_stat_ssl WHERE pid = pg_backend_pid();
```
Look for: `t | TLSv1.3 | …` on RDS — proof the connection is encrypted

```sh
pg_dump -Fc -h 127.0.0.1 -U postgres easyquery > easyquery.dump && pg_restore --list easyquery.dump | head
```
Look for: a custom-format dump and its table of contents

```sh
aws rds describe-db-instances --query "DBInstances[].{id:DBInstanceIdentifier,status:DBInstanceStatus,engine:EngineVersion,public:PubliclyAccessible,backupDays:BackupRetentionPeriod,endpoint:Endpoint.Address}" --output table
```
Look for: `available`, `public: False`, backups > 0

```sh
nc -vz -w 5 <rds-endpoint> 5432
```
Look for: succeeds from EC2, times out from your laptop

```sh
psql "host=<rds-endpoint> user=easyquery_admin dbname=easyquery sslmode=verify-full sslrootcert=global-bundle.pem"
```
Look for: a TLS-verified session (download the RDS CA bundle first)

```sh
aws rds describe-db-snapshots --db-instance-identifier <id> --query "DBSnapshots[].{id:DBSnapshotIdentifier,type:SnapshotType,status:Status,created:SnapshotCreateTime}"
```
Look for: automated and manual snapshots

## Exercises — break it, then fix it

- Grant the app role only `SELECT, INSERT, UPDATE, DELETE` on its tables; try a `DROP TABLE` as the app role and read the error.
- Connect with `sslmode=disable` to RDS with `rds.force_ssl=1` and read the rejection.
- Time a point-in-time restore — that is your real recovery time (RTO).

## Done when

- You can create, secure, connect to, back up and restore PostgreSQL locally and on RDS.
- The RDS instance is private, encrypted in transit, backed up, and has deletion protection.

## Reading list

- PostgreSQL documentation — Tutorial, psql, Database Roles, Privileges, Backup and Restore: https://www.postgresql.org/docs/current/
- Amazon RDS User Guide — Amazon RDS for PostgreSQL, Using SSL/TLS, Backing up and restoring: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/
- Flyway documentation — Concepts: migrations
- HikariCP README (connection pooling basics)

## Execution log

- 2026-10-07: Created from the user's request for a hands-on deployment learning
  path (DOC-003).
