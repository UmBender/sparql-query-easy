# Docker Compose Stack — OPS-006

Stack of three services on one origin. HTTPS is a setting (OPS-008, below);
the production domain and CORS policy stay in OPS-002. Installing and
updating the server: [[Server Deploy Runbook]] (OPS-011); deploy automation
is OPS-005.

| Service | Image | Role |
|---|---|---|
| `db` | `postgres:17-alpine` | Accounts and sessions; data in the named volume `easyquery_db-data`; `pg_isready` health check |
| `backend` | `easyquery-backend:${EASYQUERY_VERSION}` (root `Dockerfile`, OPS-001) | Ktor on 8080, not published; Flyway migrations at startup (BE-005); waits for a healthy `db` |
| `backup` | `easyquery-backup:${EASYQUERY_VERSION}` (`deploy/backup.Dockerfile`: `postgres:17-alpine` + `age`) | `pg_dump` on `BACKUP_SCHEDULE` into `BACKUP_DIR`, retention, encrypted off-host copies (OPS-009, below); no port |
| `web` | `easyquery-web:${EASYQUERY_VERSION}` (`deploy/web.Dockerfile`) | Caddy on port 80 (and 443 in mode `auto`), published on `${WEB_BIND:-127.0.0.1}:${WEB_PORT:-8080}`: serves the SvelteKit build (`index.html` fallback) and proxies `/api/*`, `/health`, `/openapi.json` and `/swagger` to `backend` (`deploy/caddy/site.caddy`); certificates in the volume `easyquery_caddy-data` |

Caddy keeps the `Host` header, which the backend's same-origin check on
account routes compares with `Origin`, and sets `X-Forwarded-For` to the one
client address it determined (`{client_ip}`); the backend runs with
`EASYQUERY_TRUST_PROXY=true`, so the login rate limit applies per client. Nothing but `web` is reachable from the host.
`EASYQUERY_ADMIN_USERNAMES` (comma-separated, default empty) names the
accounts with the admin role (AUTH-005); set it in the server's `.env`.
`EASYQUERY_VERSION` (default `local`) tags the three built images; on the
server it is the deployed git tag, so the previous version's images stay for
a rollback (OPS-011, [[Server Deploy Runbook]]).

## Configuration

Copy `.env.example` to `.env` (git-ignored) and set at least
`POSTGRES_PASSWORD`; Compose refuses to start without it. Optional:
`POSTGRES_DB`, `POSTGRES_USER` (both default `easyquery`), `WEB_PORT`
(default 8080), `EASYQUERY_ENVIRONMENT` (default `production`: session
cookies are `Secure`; browsers accept them on `http://localhost` and
`http://127.0.0.1`, not on another host over plain HTTP — serve another
host through mode `auto` or `proxy`, below), `EASYQUERY_EXTREME_RESULT_LIMIT`,
`EASYQUERY_AUTH_ATTEMPTS_PER_MINUTE`.

## HTTPS modes (OPS-008)

`EASYQUERY_HTTPS_MODE` in `.env` selects the Caddyfile
(`/etc/caddy/<mode>.Caddyfile`); every mode imports the same site
(`deploy/caddy/site.caddy`). The server's mode is chosen at go-live from the
[[University Server Checklist]] answers (DEC-017 Q1, OPS-002).

| Mode | File | Use when | Settings |
|---|---|---|---|
| `local` (default) | `deploy/Caddyfile` | development, tests | HTTP on `WEB_BIND:WEB_PORT` (127.0.0.1:8080) |
| `auto` | `deploy/caddy/auto.Caddyfile` | the server is reachable on 80 and 443 under its own DNS name | `EASYQUERY_DOMAIN`, `EASYQUERY_TLS` (Let's Encrypt e-mail), `WEB_BIND=0.0.0.0`, `WEB_PORT=80`, `WEB_HTTPS_BIND=0.0.0.0`, `WEB_HTTPS_PORT=443`; HTTP redirects to HTTPS; HSTS one year without subdomains; HTTP/1.1 and 2 only |
| `proxy` | `deploy/caddy/proxy.Caddyfile` | the university proxy ends TLS | `EASYQUERY_TRUSTED_PROXIES` (CIDR list), `WEB_BIND`/`WEB_PORT` the proxy reaches; the proxy must forward the original `Host` |

A missing required setting stops Caddy with its name in the error (`docker
compose logs web`). In `proxy` mode Caddy reads `X-Forwarded-For` from the
right and stops at the first address that is not a trusted proxy
(`trusted_proxies_strict`), so a client cannot choose its own address for
the login limit. With `EASYQUERY_ENVIRONMENT=production` cookies are
`Secure`, which browsers accept only over HTTPS or on localhost.

Check: `node scripts/check-https-modes.mjs` starts `auto` (domain
`easyquery.localhost`, Caddy's internal CA, 127.0.0.1:18180/18543) and
`proxy` (behind a stand-in proxy `edge` on 18191, web direct on 18190, three
login attempts per minute) as throwaway projects from `deploy/test/` and
`compose.test.yaml`, checks them with curl and removes them.

## Backups and restore (OPS-009)

The `backup` service runs busybox `crond` with `BACKUP_SCHEDULE` (default
`17 2 * * *`, UTC). Each run (`deploy/backup/easyquery-backup`) writes
`easyquery-<UTC stamp>.dump` (`pg_dump --format=custom`) under a temporary
name and renames it when complete, mode `0600`, in `BACKUP_DIR` (default
`./backups`, a host directory: `docker compose down -v` does not touch it;
Docker creates it owned by root with mode 700; remove a test copy with
`docker run --rm --security-opt label=disable -v "$PWD:/r" alpine:3 rm -rf /r/backups`). With `BACKUP_AGE_RECIPIENT`
(an `age` public key) it also writes `<name>.age` to `BACKUP_OFFSITE_DIR`;
mount off-host storage there or copy that directory off the server. Then
`easyquery-prune` keeps the newest dump of each of the last 7 days and of
each of the last 4 ISO weeks (`BACKUP_KEEP_DAILY`, `BACKUP_KEEP_WEEKLY`) in
each directory and deletes the other dumps. A failed run logs
`easyquery-backup: FAILED ...` and changes nothing. Uploaded Turtle graphs
are in the backend's memory and are not backed up (DEC-005).

Keys (DEC-017 Q4): create a key pair once on your own computer with
`age-keygen -o easyquery-backup.agekey` (or `docker run --rm
easyquery-backup:local age-keygen`), put the printed public key in
`BACKUP_AGE_RECIPIENT` on the server, and keep the private key file off the
server in two places (for example your computer and a password manager).
Without it the `.age` copies cannot be restored.

| Task | Command |
|---|---|
| Back up now | `docker compose exec backup easyquery-backup` |
| List dumps | `docker compose exec backup ls -l /backups /offsite` |
| Backup log | `docker compose logs backup` |
| Restore a local dump | `scripts/restore-backup.sh easyquery-20261020T021700Z.dump` |
| Restore an encrypted copy | `scripts/restore-backup.sh easyquery-20261020T021700Z.dump.age ~/easyquery-backup.agekey` (a name in `BACKUP_OFFSITE_DIR`, or a path to a copied file) |

`scripts/restore-backup.sh` stops `backend` and `backup`, replaces the
database (`DROP DATABASE ... WITH (FORCE)`, `CREATE DATABASE`, `pg_restore
--no-owner`; `deploy/backup/easyquery-restore`), starts them again (Flyway
applies migrations newer than the dump) and prints `/health`. Everything
written after the dump is lost: take `easyquery-backup` first if the
current database may still be needed. The private key text goes to that one
`docker compose run` container's environment and is not stored. The script
uses the same Compose settings as `docker compose` (`.env`, or
`COMPOSE_PROJECT_NAME`, `COMPOSE_FILE`, `COMPOSE_ENV_FILES`).

Restore into a fresh stack (for example a new server): clone, copy `.env`,
`docker compose up -d --build --wait` (empty, migrated database), copy the
dump into `BACKUP_DIR` (as root) or pass its path, run
`scripts/restore-backup.sh`.

Drill: `node scripts/check-backup-restore.mjs` runs all of this against
throwaway projects (`easyquery-drill-a`, `-b`, port 18200, a temporary
backup directory, a fresh key pair): retention on dummy files, a scheduled
dump and its encrypted copy, a failed dump, restore of both into a fresh
stack, every table compared and the account, consent and attempt checked
through the API.

## Logs and limits (OPS-010)

The backend logs through Logback (`src/main/resources/logback.xml`) to
stdout, one line per event: `<UTC time> <level> <logger> - <message>`.

| Line | Example |
|---|---|
| Migrations at startup (Flyway) | `INFO  DbMigrate - Successfully applied 11 migrations to schema "public", now at version v11` |
| Database ready | `INFO  Database - EasyQuery: database migrations applied` (or `WARN ... database unavailable, will retry on use: <reason>`) |
| Each request except `/health` | `INFO  Requests - 401 POST /api/auth/login 496 ms`, `INFO  Requests - 502 POST /api/query/count 204 ms` |

Request lines carry only status, method, path and duration: no query
string, header, cookie or body, so passwords, session tokens and answers are
never logged (`RequestLoggingTest`). `EASYQUERY_LOG_LEVEL` sets the
application's level; libraries log only warnings (Flyway's migration lines
excepted). Reading a failure: find the request's status line, then the
`WARN`/`ERROR` lines just before it.

Every service's Docker log rotates (`json-file`, `LOG_MAX_SIZE` 10m ×
`LOG_MAX_FILES` 3). Memory caps from `.env` (DEC-017 Q6): `db` and
`backend` 1 GiB, `web` and `backup` 256 MiB; CPU caps default to none
(`*_CPU_LIMIT=0`). The JVM heap may use `BACKEND_HEAP_PERCENT` (75) % of the
backend's cap (`JAVA_OPTS`). Measured on 2026-10-20 after start: backend
252 MiB, db 93 MiB, web 57 MiB, backup under 1 MiB. Check with `docker
stats` and `docker inspect -f '{{.HostConfig.Memory}}
{{.HostConfig.LogConfig.Config}}' <container>`.

## Runbook

From the repository root:

| Task | Command |
|---|---|
| Build and start | `docker compose up -d --build --wait` |
| Open | `http://localhost:8080/` (editor), `/login`, `/swagger` |
| Status | `docker compose ps` |
| Logs | `docker compose logs -f backend` (or `web`, `db`, `backup`); see Logs and limits below |
| Stop, keep data | `docker compose down` |
| Restart one service | `docker compose restart backend` |
| Rebuild after code changes | `docker compose up -d --build --wait` |
| Reset (deletes accounts and sessions; dumps in `BACKUP_DIR` stay) | `docker compose down -v` |
| Database shell | `docker compose exec db psql -U easyquery easyquery` |

## Development database (OPS-007)

For `./gradlew run` (or the Vite dev server against it), start only `db`,
published on `127.0.0.1:${DB_PORT:-5432}` by the `compose.dev.yaml`
override. The service, image and volume are the ones above. `compose.yaml`
alone still publishes no database port.

In `.env`, set `POSTGRES_PASSWORD`, then point the app at the database
(`.env.example` lists the lines):
`EASYQUERY_DB_URL=jdbc:postgresql://127.0.0.1:5432/easyquery` (change the
port to match `DB_PORT` and the database name to `POSTGRES_DB`),
`EASYQUERY_DB_USER` = `POSTGRES_USER`, `EASYQUERY_DB_PASSWORD` =
`POSTGRES_PASSWORD`. The compose `backend` service sets its own
`EASYQUERY_DB_*` values, so these lines don't affect the full stack.

| Task | Command |
|---|---|
| Start only PostgreSQL | `docker compose -f compose.yaml -f compose.dev.yaml up -d --wait db` |
| Run the API against it | `./gradlew run` (Flyway applies V1 and V2 on an empty volume; `/health` reports `"database":"ready"`) |
| Stop, keep data | `docker compose -f compose.yaml -f compose.dev.yaml stop db` |
| Reset (deletes accounts and sessions) | `docker compose -f compose.yaml -f compose.dev.yaml down -v` |
| Database shell | `docker compose exec db psql -U easyquery easyquery` |

The dev database and the full stack share the `easyquery_db-data` volume,
so accounts created in one are visible in the other, and a reset removes
both. Running the full stack with the override also publishes the database
port; use `compose.yaml` alone for that.

Uploaded Turtle graphs live in the backend's memory and are lost when it
restarts (unchanged from OPS-001).

## Verified (2026-10-18, Docker 29.8 / Compose 5.6, `WEB_PORT=18180`)

- `up -d --build`: `db` healthy, then `backend` healthy, then `web`.
- One origin: `/` and `/login` return the SPA; `/health`, `/api/endpoints`,
  `/openapi.json`, `/swagger` (and, before FE-049, the legacy page files) and
  `POST /api/query/count` (PokemonGen1, 295) answer through Caddy.
- Accounts: register sets the `HttpOnly`, `Secure` session cookie; the session
  route returns the user; a foreign `Origin` gets `403`.
- `down` then `up`: the earlier session and login still work (volume kept);
  `down -v` removes the volume and the login fails.

## Automated smoke (QUAL-017)

`npm --prefix frontend run test:compose` builds both images and starts the
stack as the separate project `easyquery-test` with the `compose.test.yaml`
override and `deploy/compose-test.env` instead of `.env` (throwaway password,
`WEB_PORT=18097`, `EASYQUERY_ENVIRONMENT=production`, admin `stack-admin`,
a high login attempt limit). The override keeps the database in tmpfs and
tags the images `:test`, so the `easyquery` project, its volume and the
`:local` images are untouched. Playwright (`tests-compose/`, Firefox) then
checks through Caddy: `/health` with a ready database, `/api/endpoints`,
`/openapi.json`, the
SPA fallback and route guard, registration with the `HttpOnly`/`Secure`
cookie, logout, a staged PokemonGen1 query from the saved Fire query, and a
proposed task seeded through the admin API and answered correctly. Finally
`down --volumes --remove-orphans` removes the project whatever the result;
on failure the script prints the `web` and `backend` logs. CI runs it on
pushes to `main`, nightly and on manual runs (DEC-016 Q1 C). It complements
`test:stack`, which does not use Caddy or the images.

## Source files

`compose.yaml`, `compose.dev.yaml` (OPS-007), `compose.test.yaml` and `deploy/compose-test.env` (QUAL-017), `deploy/web.Dockerfile`, `deploy/Caddyfile`, `deploy/caddy/` and `deploy/test/` with `scripts/check-https-modes.mjs` (OPS-008), `deploy/backup.Dockerfile`, `deploy/backup/`, `scripts/restore-backup.sh`, `scripts/check-backup-restore.mjs` (OPS-009), `src/main/resources/logback.xml` and `http/RequestLogging.kt` (OPS-010), `Dockerfile`,
`.env.example`, `.dockerignore`.
