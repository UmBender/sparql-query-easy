# Server Deploy Runbook — OPS-011

How to install, update, roll back, restore and rotate secrets for SPARQL
EasyQuery on the university server (DEC-003). Releases are built on the
server from a git tag; images carry that tag, so the previous version stays
available for a rollback (DEC-017 Q5). Automating this from CI is OPS-005.
Service details: [[Docker Compose Stack]]. Questions for the IT:
[[University Server Checklist]].

Every command runs in the checkout directory (`/srv/easyquery/app` below) as
a user allowed to run Docker. `V` stands for a release tag such as `v1.0.0`.

## Prerequisites

- Docker Engine with Compose v2.24 or newer (`docker compose version`), git,
  curl; Docker starts at boot (`systemctl is-enabled docker`).
- The server reaches GitHub, Docker Hub, npm and Maven Central (images are
  built there), and Wikidata at runtime (checklist N3, N4).
- The HTTPS mode is known: `auto` (DNS name pointing at the server, 80 and
  443 open) or `proxy` (the university proxy's address) (checklist H1–H3).
- A backup directory on this server and, if available, an off-host one
  (checklist D1), and an `age` key pair made on your own computer
  (`age-keygen -o easyquery-backup.agekey`; private key kept in two places,
  never on the server).
- Go-live gates (not needed for a trial install): SEC-001 (remote endpoint
  and upload limits for public users) and OPS-002 (domain and CORS policy).

## Release a version (on your computer)

```sh
git tag -a v1.0.0 -m "v1.0.0"   # on a commit whose CI is green
git push origin v1.0.0
```

## First install

```sh
sudo install -d -o "$USER" /srv/easyquery
git clone https://github.com/UmBender/sparql-query-easy.git /srv/easyquery/app
cd /srv/easyquery/app
git checkout V
cp .env.example .env && chmod 600 .env
```

Edit `.env` (every variable is explained there):

| Setting | Value |
|---|---|
| `EASYQUERY_VERSION` | `V` |
| `POSTGRES_PASSWORD` | a long random value: `openssl rand -base64 32` |
| `EASYQUERY_ENVIRONMENT` | `production` |
| `EASYQUERY_ADMIN_USERNAMES` | the researchers' usernames |
| HTTPS, mode `auto` | `EASYQUERY_HTTPS_MODE=auto`, `EASYQUERY_DOMAIN`, `EASYQUERY_TLS=<your e-mail>`, `WEB_BIND=0.0.0.0`, `WEB_PORT=80`, `WEB_HTTPS_BIND=0.0.0.0`, `WEB_HTTPS_PORT=443` |
| HTTPS, mode `proxy` | `EASYQUERY_HTTPS_MODE=proxy`, `EASYQUERY_TRUSTED_PROXIES=<proxy address>/32`, `WEB_BIND`/`WEB_PORT` the proxy reaches |
| Backups | `BACKUP_DIR=/srv/easyquery/backups`, `BACKUP_AGE_RECIPIENT=<public key age1…>`, `BACKUP_OFFSITE_DIR=<off-host mount>` |
| Limits | raise `*_MEMORY_LIMIT` on a dedicated machine (checklist M1, M2) |

Then build and start, and run the [checks](#checks):

```sh
docker compose up -d --build --wait
```

## Checks

After every install, update, rollback, restore or rotation:

1. `docker compose ps`: `db`, `backend`, `web` healthy or running, `backup`
   running.
2. `curl -fsS https://<domain>/health` (or `http://127.0.0.1:<WEB_PORT>/health`
   in `local`/`proxy` mode) answers `{"status":"ok","database":"ready"}`.
3. In a browser: log in, open the editor, run one PokemonGen1 query.
4. `docker compose logs --tail=50 backend` shows `EasyQuery: database
   migrations applied` and request lines, no `ERROR`.

## Update to a new version

```sh
cd /srv/easyquery/app
docker compose exec backup easyquery-backup          # pre-update backup
docker compose exec backup sh -c 'cp -p "$(ls -t /backups/easyquery-*.dump | head -1)" /backups/pre-NEW.dump'
git fetch --tags && git checkout NEW
sed -i 's/^EASYQUERY_VERSION=.*/EASYQUERY_VERSION=NEW/' .env
diff <(grep -o '^[A-Z_]*=' .env.example | sort) <(grep -o '^[A-Z_]*=' .env | sort)   # new settings?
docker compose up -d --build --wait
```

Add any setting the `diff` lists (read its comment in `.env.example`), then
run the checks. The previous images stay as `easyquery-*:OLD`. Flyway
applies the new version's migrations at backend start.

Retention keeps only the newest dump of each day, so the next backup run
on the same day deletes the pre-update dump; `pre-NEW.dump` is a copy that
retention never touches. Delete it (`docker compose exec backup rm
/backups/pre-NEW.dump`) once `OLD` is no longer a rollback target.

## Roll back

```sh
cd /srv/easyquery/app
git checkout OLD
sed -i 's/^EASYQUERY_VERSION=.*/EASYQUERY_VERSION=OLD/' .env
docker compose up -d --wait          # the OLD images still exist; nothing is built
```

Run the checks. If the newer version added database migrations
(`git diff --stat OLD NEW -- src/main/resources/db/migration` lists files),
the old backend still starts (Flyway ignores migrations newer than its code)
but may not work with the changed tables: then also
[restore](#restore-from-a-backup) the pre-update backup
(`scripts/restore-backup.sh pre-NEW.dump`), which loses everything written
since the update, and run the checks again.

Old images can be removed once a version is no longer a rollback target:
`docker image rm easyquery-backend:OLD easyquery-web:OLD easyquery-backup:OLD`.

## Restore from a backup

```sh
docker compose exec backup ls -l /backups /offsite      # pick a dump
scripts/restore-backup.sh easyquery-<stamp>.dump
scripts/restore-backup.sh easyquery-<stamp>.dump.age ~/easyquery-backup.agekey   # encrypted copy, key brought for this run
```

The script stops `backend` and `backup`, replaces the database, starts them
and prints `/health`. If it stops with an error (wrong name, wrong key, not a
dump), the database was not replaced but `backend` and `backup` stay
stopped: fix the argument and run it again, or start them with `docker
compose up -d --wait`. On a new server: do the [first install](#first-install)
with the same version (or newer), copy the dump into `BACKUP_DIR` (as root)
or pass its path, run the script, then the checks. Details and the drill:
[[Docker Compose Stack#Backups and restore (OPS-009)]].

## Rotate secrets

| Secret | Steps |
|---|---|
| Database password | `NEW=$(openssl rand -base64 32)`; `docker compose exec db psql -U easyquery -d easyquery -c "ALTER ROLE easyquery PASSWORD '$NEW'"`; put `$NEW` in `POSTGRES_PASSWORD` in `.env`; `docker compose up -d --wait` (recreates the services that use it; PostgreSQL reads `POSTGRES_PASSWORD` only when the volume is first created, so the `ALTER ROLE` is what changes it). Sessions stay valid. |
| Admin accounts | edit `EASYQUERY_ADMIN_USERNAMES`; `docker compose up -d --wait backend` |
| Backup key | make a new pair on your computer, set `BACKUP_AGE_RECIPIENT`, `docker compose up -d --wait backup`; keep the old private key until the last copy encrypted with it has expired (4 weeks) |
| ACME e-mail (`auto`) | edit `EASYQUERY_TLS`; `docker compose up -d --wait web` |
| All user sessions (suspected leak) | `docker compose exec db psql -U easyquery -d easyquery -c "DELETE FROM user_session"`: everyone logs in again |

## Verified (2026-10-21)

Drill on the development machine (same Docker host, warm build cache),
following only this note in a fresh clone of a scratch remote holding tags
`v0.0.1-drill` and `v0.0.2-drill`, with these deviations: checkout and
backup directories under a scratch directory instead of `/srv/easyquery`,
`COMPOSE_PROJECT_NAME=easyquery-drill`, mode `local` on port 18300 (no DNS
name or proxy). Done: first install; update to the second tag and roll back
(no build, old images reused, account kept); restore of the pre-update dump
and of its `.age` copy with the key (an account created after the backup
was gone); database password rotation (old password rejected by
PostgreSQL, app and backups kept working). Checks passed after each step.
Log: OPS-011's execution log. Not yet done on the university server
(human gate).

## Source files

`compose.yaml`, `.env.example`, `scripts/restore-backup.sh`,
[[Docker Compose Stack]], [[University Server Checklist]],
[[../90 - Tasks/items/OPS-011-deploy-runbook]].
