# Docker Compose Stack — OPS-006

Local HTTP stack of three services on one origin. TLS, backups and server
deployment stay in OPS-002, OPS-004 and OPS-005.

| Service | Image | Role |
|---|---|---|
| `db` | `postgres:17-alpine` | Accounts and sessions; data in the named volume `easyquery_db-data`; `pg_isready` health check |
| `backend` | `easyquery-backend:local` (root `Dockerfile`, OPS-001) | Ktor on 8080, not published; Flyway migrations at startup (BE-005); waits for a healthy `db` |
| `web` | `easyquery-web:local` (`deploy/web.Dockerfile`) | Caddy on port 80, published on `127.0.0.1:${WEB_PORT:-8080}`: serves the SvelteKit build (`index.html` fallback) and proxies `/api/*`, `/health`, `/openapi.json` and `/swagger` to `backend` (`deploy/Caddyfile`) |

Caddy keeps the `Host` header, which the backend's same-origin check on
account routes compares with `Origin`, and sets `X-Forwarded-For`; the
backend runs with `EASYQUERY_TRUST_PROXY=true`, so the login rate limit
applies per client. Nothing but `web` is reachable from the host.
`EASYQUERY_ADMIN_USERNAMES` (comma-separated, default empty) names the
accounts with the admin role (AUTH-005); set it in the server's `.env`.

## Configuration

Copy `.env.example` to `.env` (git-ignored) and set at least
`POSTGRES_PASSWORD`; Compose refuses to start without it. Optional:
`POSTGRES_DB`, `POSTGRES_USER` (both default `easyquery`), `WEB_PORT`
(default 8080), `EASYQUERY_ENVIRONMENT` (default `production`: session
cookies are `Secure`; browsers accept them on `http://localhost` and
`http://127.0.0.1`, not on another host over plain HTTP — use
`development` there until OPS-002 adds TLS), `EASYQUERY_EXTREME_RESULT_LIMIT`,
`EASYQUERY_AUTH_ATTEMPTS_PER_MINUTE`.

## Runbook

From the repository root:

| Task | Command |
|---|---|
| Build and start | `docker compose up -d --build --wait` |
| Open | `http://localhost:8080/` (editor), `/login`, `/swagger` |
| Status | `docker compose ps` |
| Logs | `docker compose logs -f backend` (or `web`, `db`); the backend prints `EasyQuery: database migrations applied` at startup |
| Stop, keep data | `docker compose down` |
| Restart one service | `docker compose restart backend` |
| Rebuild after code changes | `docker compose up -d --build --wait` |
| Reset (deletes accounts and sessions) | `docker compose down -v` |
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

## Source files

`compose.yaml`, `compose.dev.yaml` (OPS-007), `deploy/web.Dockerfile`, `deploy/Caddyfile`, `Dockerfile`,
`.env.example`, `.dockerignore`.
