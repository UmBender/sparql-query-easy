---
id: LEARN-005
title: Learn to install and run the Docker Compose stack on the university server by hand
status: READY
priority: P1
type: learning
depends_on: [LEARN-002, LEARN-004]
human_gate: true
created: 2026-10-07
updated: 2026-10-27
---
# Learn to install and run the Docker Compose stack on the university server by hand

Part of the [[../../07 - Operations/Deployment Learning Path/00 - Deployment Roadmap|Deployment Roadmap]];
progress goes in the [[../../07 - Operations/Deployment Learning Path/Deployment Learning Tracker|Deployment Learning Tracker]].
Prepares: OPS-011 first install. Target: the university server (DEC-003); rewritten from the earlier AWS version on 2026-10-27.

## Why this matters for the deployment

The production app is the same Compose project you run locally (db, backend, web, backup). Installing it once by hand, following the runbook, is how you learn what each piece needs and how to recover when something fails.

## How this task is executed

1. **Claude writes the lesson** `tcc/07 - Operations/Deployment Learning Path/L05 - The Compose Stack on the Server by Hand.md`:
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

- Install Docker Engine and Compose v2.24+ (or confirm IT did) and start Docker at boot.
- Follow the Server Deploy Runbook "First install": clone at a tag, write `.env`, build, `up --wait`.
- Read `docker compose ps`, health checks and logs; restart one service; survive a reboot.
- Explain the resource limits and restart policies (OPS-010) and the volumes that hold data.

## Concepts to study

- Compose project, services, networks, named volumes; `unless-stopped`; health checks and `--wait`.
- Building images on the server from a git tag (DEC-017 Q5) vs pulling from a registry.
- Where data lives: the `db` volume, `BACKUP_DIR`, uploaded graphs in memory only.

## Hands-on lab

1. Do the runbook's First install on the server with a test `.env` (no real participants yet).
2. Open the app from your laptop; register a test account; run a query on PokemonGen1.
3. Reboot the server (in an agreed window) and confirm the stack comes back healthy.
4. Stop `backend`, watch `/health` and Caddy's response, start it again.

## Check it yourself (CLI)

Replace `<…>` placeholders with your values; `easyquery` is your `~/.ssh/config` host.

```sh
ssh easyquery 'docker compose version; systemctl is-enabled docker'
```
Look for: `v2.24+` and `enabled`

```sh
ssh easyquery 'cd easyquery && docker compose ps'
```
Look for: db, backend, web, backup `healthy`/`running`

```sh
curl -sS https://<server-name>/health
```
Look for: `{"status":"ok",…}` with the database ready

```sh
ssh easyquery 'cd easyquery && docker compose logs --since 10m backend | tail'
```
Look for: startup lines, no stack traces

```sh
ssh easyquery 'docker volume ls; docker stats --no-stream'
```
Look for: the db volume; memory within the limits

## Exercises — break it, then fix it

- Break `.env` (wrong DB password), start, read the error, fix it.
- Explain what is lost and what survives `docker compose down` vs `down -v`.

## Done when

- The stack runs on the server from a tag, healthy after a reboot.
- You did each runbook step yourself and noted anything unclear in the runbook.

## Reading list

- [[../../07 - Operations/Server Deploy Runbook]], [[../../07 - Operations/Docker Compose Stack]]
- Docker docs — Install Docker Engine (your distribution), Compose file reference

## Execution log

- 2026-10-07: Created from the user's request for a hands-on deployment learning
  path (DOC-003), first written for AWS.
- 2026-10-27: Rewritten for the university server (user: "replaneje para o servidor
  da faculdade"); AWS content is in git history.
