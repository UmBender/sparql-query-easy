---
id: LEARN-009
title: Learn configuration and secret management for the app on the university server
status: READY
priority: P1
type: learning
depends_on: [LEARN-005, LEARN-007]
human_gate: true
created: 2026-10-07
updated: 2026-10-27
---
# Learn configuration and secret management for the app on the university server

Part of the [[../../07 - Operations/Deployment Learning Path/00 - Deployment Roadmap|Deployment Roadmap]];
progress goes in the [[../../07 - Operations/Deployment Learning Path/Deployment Learning Tracker|Deployment Learning Tracker]].
Prepares: OPS-011 (Rotate secrets). Target: the university server (DEC-003); rewritten from the earlier AWS version on 2026-10-27.

## Why this matters for the deployment

The database password, the backup encryption key and the admin list live in `.env` on a shared machine. A secret in Git, in an image layer or in a log is a leak; knowing where each one lives lets you rotate it calmly.

## How this task is executed

1. **Claude writes the lesson** `tcc/07 - Operations/Deployment Learning Path/L09 - Configuration and Secrets on the Server.md`:
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

- List every setting in `.env.example`, which ones are secrets, and who needs each.
- Protect `.env` (owner-only permissions, never in Git or images) and keep an offline copy safely.
- Rotate the DB password and the backup key by following the runbook.
- Verify no secret appears in `docker inspect`, logs or the repository history.

## Concepts to study

- Environment-based configuration for Ktor; Compose variable substitution; `.env` precedence.
- File permissions on shared servers; secrets vs configuration; rotation and revocation.
- `EASYQUERY_ADMIN_USERNAMES` as a security setting (who is admin).

## Hands-on lab

1. Write the production `.env` from the example with generated secrets; set `chmod 600`.
2. Rotate the DB password once in a test window and confirm the app reconnects.

## Check it yourself (CLI)

Replace `<…>` placeholders with your values; `easyquery` is your `~/.ssh/config` host.

```sh
ssh easyquery 'stat -c "%a %U" easyquery/.env'
```
Look for: `600` and your user

```sh
openssl rand -base64 32
```
Look for: a strong random value (for passwords and keys)

```sh
git log -p -S 'EASYQUERY_DB_PASSWORD=' -- . ':!*.example' | head
```
Look for: nothing: no real secret was ever committed

```sh
ssh easyquery 'cd easyquery && docker compose logs | grep -ci password'
```
Look for: `0` or only setting names, never values

## Exercises — break it, then fix it

- Someone saw your `.env` on screen during a meeting: list what you rotate, in which order, and how you check the app afterwards.

## Done when

- Production secrets exist only in `.env` (600) and your offline copy; a rotation was practised.

## Reading list

- Docker docs — Compose: set environment variables, interpolation
- [[../../07 - Operations/Server Deploy Runbook]] (Rotate secrets); OWASP Secrets Management Cheat Sheet

## Execution log

- 2026-10-07: Created from the user's request for a hands-on deployment learning
  path (DOC-003), first written for AWS.
- 2026-10-27: Rewritten for the university server (user: "replaneje para o servidor
  da faculdade"); AWS content is in git history.
