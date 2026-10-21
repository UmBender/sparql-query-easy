---
id: DEC-017
title: Decide how the T11 brief changes the deployment contract of OPS-001 and OPS-006
status: DONE
priority: P1
type: decision
depends_on: [OPS-006]
human_gate: true
created: 2026-10-20
updated: 2026-10-20
---
# Decide how the T11 brief changes the deployment contract of OPS-001 and OPS-006

## Objective

The T11 brief (2026-10-20, deployment with Docker Compose) restates OPS-006
(DONE: local HTTP stack) and adds HTTPS, backups, logs and limits, a deploy
runbook and an IT checklist. Most of it is additive (OPS-008 to OPS-011,
DOC-005). The points below either differ from a recorded decision or need a
fact only the user has. Nothing is changed until the user answers.

## Already decided, not reopened

- DEC-003: university server, Docker Compose, services `db`, `backend`, `web`
  on one origin. Caddy is the web server (OPS-006, so not Nginx).
- OPS-006 `compose.yaml`: `db` is `postgres:17-alpine` with the named volume
  `db-data`, a `pg_isready` health check and no published port; `backend`
  waits for a healthy `db` and runs Flyway at startup (BE-005); `web` serves
  the SPA with `index.html` fallback and proxies `/api/*`, `/health`,
  `/openapi.json`, `/swagger` (Caddyfile). `restart: unless-stopped` on all
  three. Real `.env` is git-ignored; `.env.example` documents every current
  variable.
- QUAL-017 smoke checks the stack through Caddy on `main` and nightly.
- DEC-015 lifted D5 for the study: consent gates forms and tasks.

## Coverage of the T11 target (evidence 2026-10-20)

| Target item | Status | Evidence / follow-up |
|---|---|---|
| `db`: PostgreSQL, named volume, health check, not exposed | Covered | `compose.yaml` (OPS-006) |
| `backend`: multi-stage build | Covered | root `Dockerfile` (OPS-001) |
| `backend`: fat JAR in a slim JDK image | Contradicted | `installDist` layout on `eclipse-temurin:21-jre-jammy` → Q2 |
| `backend`: config from `.env` | Covered | Compose interpolates `.env` into `EASYQUERY_*` |
| `backend`: waits for db health, Flyway at startup | Covered | `depends_on: service_healthy`; BE-005 |
| `web`: Caddy, SPA fallback, `/api` proxy, one origin | Covered | `deploy/Caddyfile`, QUAL-017 |
| `web`: one *public* origin | Partly | published on `127.0.0.1:${WEB_PORT}` only, HTTP, `auto_https off` → OPS-008, Q1 |
| `.env.example` documents every variable | Covered now | New variables are added by each follow-up card |
| HTTPS as a config switch | Missing | OPS-008; which mode applies → Q1 |
| Scheduled `pg_dump`, retention, tested restore | Missing | OPS-009; OPS-004 (plan) BLOCKED on SEC-001 → Q3, Q4 |
| Restart policies | Covered | `restart: unless-stopped` |
| Logs | Partly | `docker compose logs` works, but Docker's `json-file` log grows without limit and the backend has no SLF4J provider (OPS-004 finding 2026-10-07: NOP logger; only two `System.err` lines) → OPS-010 |
| Resource limits | Missing | OPS-010; whether the server is shared → Q6 |
| Runbook: first install, update, rollback, restore, rotate secrets | Partly | [[../../07 - Operations/Docker Compose Stack]] has start, stop, logs, reset only → OPS-011; release method → Q5 |
| Questions for the university IT | Partly | Four questions in [[../BLOCKERS]] → DOC-005 |

## Conflicts and open questions

| # | T11 brief | Current record | Affects if changed |
|---|---|---|---|
| Q1 | HTTPS by Caddy automatic certificates *or* behind the university's proxy, as a switch; "ask me which applies" | OPS-006: plain HTTP, `127.0.0.1` only; OPS-002 BLOCKED on DNS name and TLS issuer | Caddyfile site address, published ports (80/443 vs one internal port), `EASYQUERY_TRUST_PROXY` and Caddy `trusted_proxies`, `Secure` cookies, OPS-002 |
| Q2 | "Ktor fat JAR in a slim JDK image" | OPS-001 (DONE): Gradle `installDist` (start script + `lib/*.jar`) on `eclipse-temurin:21-jre-jammy`, non-root, with `curl` for the health check | `Dockerfile`, Shadow plugin in `build.gradle.kts`, image size, OPS-001 runbook, QUAL-017 images |
| Q3 | Backups are part of T11 | Conflict report (2026-10-16): "T11 backup job depends on OPS-004's plan"; OPS-004 depends on SEC-001 (endpoint/upload policy, BACKLOG) | Whether backups wait for SEC-001; OPS-004 scope |
| Q4 | "LGPD applies (minimal data, consent, restricted access)" | D5 "LGPD ignored for now" (DEC-003), lifted for the study only by DEC-015 | Backup encryption, retention length, who can read dumps |
| Q5 | Runbook covers update and rollback | `compose.yaml` builds images on the host (`build:`, tags `:local`); OPS-005 (deploy method) BLOCKED; QUAL-017 excludes a registry | How a version reaches the server and how rollback selects the previous one |
| Q6 | "Resource limits if the server is shared" | None set | Compose `deploy.resources`, JVM heap, PostgreSQL memory |

## Options and recommendation

- **Q1 HTTPS mode.** Implement both modes behind one variable (OPS-008)
  either way; the question is which one the server uses.
  A: Caddy gets certificates itself (needs public 80/443 and a DNS name that
  points at the server). B: the university proxy terminates TLS and forwards
  plain HTTP to one port of `web` (needs the proxy's address for
  `trusted_proxies` and forwarded `Host`/`X-Forwarded-Proto`).
  C: not known yet; build the switch, choose at go-live (recommended unless
  the user already knows: it is a server fact listed in DOC-005).
- **Q2 image layout.** A: keep OPS-001 (`installDist`, JRE) (recommended:
  same runtime result, smaller than a JDK, already verified by QUAL-017 and
  the OPS-001 runbook; a fat JAR adds the Shadow plugin and changes nothing a
  user sees). B: switch to a Shadow fat JAR on a slim JRE/JDK image as the
  brief says.
- **Q3 backup sequencing.** A: OPS-009 implements local `pg_dump` backups
  and the restore drill now, depending only on OPS-006/QUAL-017; OPS-004
  keeps monitoring/alerting and references OPS-009 for backups (recommended:
  account and study data exist today and SEC-001 concerns query limits, not
  the database). B: keep backups behind OPS-004 and SEC-001.
- **Q4 backup data protection.** A: dumps readable only by the backup user
  (mode `0600`), off-host copies encrypted (e.g. `age` with a public key on
  the server, private key kept off it), retention 7 daily + 4 weekly
  (recommended: cheap, and dumps contain consent and questionnaire answers).
  B: plain dumps on the mounted path, retention by count only; full LGPD
  stays D5.
- **Q5 release method.** A: build on the server from a git tag; images tagged
  `easyquery-*:<tag>` through one `.env` variable; rollback = check out and
  start the previous tag (recommended: no registry or GitHub access to the
  server needed; OPS-005 can automate it later). B: CI pushes images to a
  registry (e.g. GHCR) and the server pulls a tag (needs the server to reach
  the registry and a pull credential).
- **Q6 limits.** A: set per-service memory/CPU limits with `.env` defaults
  (db 1 GiB, backend 1 GiB with the JVM sized from the container, web
  256 MiB, backup 256 MiB) and log rotation (10 MB × 3) (recommended: harmless
  on a dedicated machine, needed on a shared one). B: rotation only, no limits.

## Decision

- 2026-10-20: The user accepted every recommendation ("DO the
  recommendations for T11"), after an explanation of Q3 and Q4, and asked
  to implement T11.
- **Q1 C.** OPS-008 builds the switch with modes `local`, `auto` and
  `proxy`; the server's mode is chosen at go-live from the DOC-005 answers.
- **Q2 A.** Keep the OPS-001 image (`installDist` on the Temurin 21 JRE).
- **Q3 A.** OPS-009 implements backups now, depending on OPS-006 only; OPS-004
  keeps monitoring and alerting and points to OPS-009 for backups.
- **Q4 A.** Dumps `0600`; off-host copies encrypted with `age` (public key on
  the server, private key off it, kept in two places, tested by the restore
  drill); retention 7 daily + 4 weekly.
- **Q5 A.** Build on the server from a git tag; image tags from one `.env`
  variable; rollback = start the previous tag (restore the pre-update backup
  when a migration prevents it). OPS-005 may automate it later.
- **Q6 A.** Memory/CPU limits per service from `.env` with defaults, JVM
  sized from the container, log rotation 10 MB × 3.

## Effects once answered

OPS-008 to OPS-011 and DOC-005 stay BACKLOG until this card is DONE (DOC-005
needs no answer). OPS-002, OPS-004 and OPS-005 keep their status; the
proposed amendments are listed in the report and applied only after the
answer.

## Execution log

- 2026-10-20: Created from the T11 brief with the coverage table above. Stops
  for the user's answers to Q1–Q6.
- 2026-10-20: Answered (all recommendations). OPS-002 and OPS-004 received
  the proposed amendments as dated notes; their status is unchanged.
