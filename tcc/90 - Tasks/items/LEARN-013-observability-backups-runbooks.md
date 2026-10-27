---
id: LEARN-013
title: Learn monitoring, logs, backups and incident runbooks for the app on the university server
status: READY
priority: P1
type: learning
depends_on: [LEARN-007, LEARN-012]
human_gate: true
created: 2026-10-07
updated: 2026-10-27
---
# Learn monitoring, logs, backups and incident runbooks for the app on the university server

Part of the [[../../07 - Operations/Deployment Learning Path/00 - Deployment Roadmap|Deployment Roadmap]];
progress goes in the [[../../07 - Operations/Deployment Learning Path/Deployment Learning Tracker|Deployment Learning Tracker]].
Prepares: OPS-004, OPS-009, OPS-010 (checklist D1, D3, O1, O2). Target: the university server (DEC-003); rewritten from the earlier AWS version on 2026-10-27.

## Why this matters for the deployment

During a study session someone must notice quickly when the app is down, and data must survive losing the server. The stack already writes readable logs, rotates them and backs up the database; you need to read them, alert on failure and keep one copy off the server.

## How this task is executed

1. **Claude writes the lesson** `tcc/07 - Operations/Deployment Learning Path/L13 - Observability, Backups and Runbooks.md`:
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

- Read and search the backend and Caddy logs (`docker compose logs`, request ids, levels).
- Set up an external uptime check on `/health` (a free monitor, or the university's) that alerts you.
- Copy encrypted backups off the server (D1) and run a restore drill from that copy.
- Write short runbooks: site down, deploy broke, disk full, database restore.

## Concepts to study

- Logs vs metrics vs alerts; log rotation and retention (OPS-010).
- RPO/RTO for a study: how much data you can lose and how long you can be down.
- Off-host copies, encryption keys kept separately, restore tests as the only proof a backup works.

## Hands-on lab

1. Stop `backend` during a quiet time and time how long until you are alerted.
2. Restore yesterday's off-host dump into a throwaway stack and compare counts.

## Check it yourself (CLI)

Replace `<…>` placeholders with your values; `easyquery` is your `~/.ssh/config` host.

```sh
ssh easyquery 'cd easyquery && docker compose logs --since 1h backend | grep -c " ERROR "'
```
Look for: errors in the last hour (ideally 0)

```sh
ssh easyquery 'df -h /; docker system df'
```
Look for: free disk; what Docker uses

```sh
ssh easyquery 'ls -lt "$BACKUP_DIR" | head'
```
Look for: a dump from today

```sh
curl -sS https://<server-name>/health
```
Look for: healthy, as the monitor sees it

## Exercises — break it, then fix it

- Write the "site is down during a study session" runbook in five steps, and test it once.

## Done when

- An alert reaches you when `/health` fails; off-host backups exist and a restore from them worked.
- Runbooks are written next to the Server Deploy Runbook.

## Reading list

- [[../../07 - Operations/Docker Compose Stack]] (Backups, Logs and limits), [[../../07 - Operations/Server Deploy Runbook]]
- Google SRE Book — Monitoring Distributed Systems (chapter 6), Being On-Call (concepts only)

## Execution log

- 2026-10-07: Created from the user's request for a hands-on deployment learning
  path (DOC-003), first written for AWS.
- 2026-10-27: Rewritten for the university server (user: "replaneje para o servidor
  da faculdade"); AWS content is in git history.
