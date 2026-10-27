---
id: LEARN-014
title: Learn the go-live checklist for a safe and legal user test on the university server
status: READY
priority: P1
type: learning
depends_on: [LEARN-008, LEARN-013]
human_gate: true
created: 2026-10-07
updated: 2026-10-27
---
# Learn the go-live checklist for a safe and legal user test on the university server

Part of the [[../../07 - Operations/Deployment Learning Path/00 - Deployment Roadmap|Deployment Roadmap]];
progress goes in the [[../../07 - Operations/Deployment Learning Path/Deployment Learning Tracker|Deployment Learning Tracker]].
Prepares: go-live (STUDY-*, QUAL-019…023). Target: the university server (DEC-003); rewritten from the earlier AWS version on 2026-10-27.

## Why this matters for the deployment

Opening the app to real participants means their data is collected under a consent text and university rules (LGPD, research ethics). Going live is a checklist, not a deploy command.

## How this task is executed

1. **Claude writes the lesson** `tcc/07 - Operations/Deployment Learning Path/L14 - Go-Live Checklist for the User Test.md`:
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

- Walk through security (QUAL-019…023 results), privacy (consent, D2 rules), operations and study readiness.
- Run a small load test that mimics a study session and check limits and response times.
- Plan the end of the test: closing registrations, exporting data, keeping or deleting it as promised.

## Concepts to study

- LGPD basics for research data; the consent text as a promise you must keep.
- Admin accounts (`EASYQUERY_ADMIN_USERNAMES`), test accounts and removing them.
- Load testing at the scale of a class (tens of concurrent users), not internet scale.

## Hands-on lab

1. Do a dress rehearsal with two or three colleagues on the real name: consent, tasks, questionnaires, export.
2. Fill the go-live checklist in the tracker and get the open items closed or accepted.

## Check it yourself (CLI)

Replace `<…>` placeholders with your values; `easyquery` is your `~/.ssh/config` host.

```sh
curl -sSI https://<server-name>/ | grep -iE 'strict-transport|content-security|x-content-type'
```
Look for: the security headers

```sh
ssh easyquery 'cd easyquery && grep ADMIN_USERNAMES .env'
```
Look for: only the real admins

```sh
ssh easyquery 'cd easyquery && docker compose ps'
```
Look for: everything healthy before the session

## Exercises — break it, then fix it

- A participant asks to delete their data after the test: write the steps, using the admin export and the database.

## Done when

- The go-live checklist is complete and the dress rehearsal passed.
- The end-of-test plan (export, retention, shutdown) is written and agreed.

## Reading list

- Lei Geral de Proteção de Dados (LGPD) — research data provisions; your university's research ethics guidance
- [[../../08 - Quality/Security Test Plan]], [[../../07 - Operations/University Server Checklist]]

## Execution log

- 2026-10-07: Created from the user's request for a hands-on deployment learning
  path (DOC-003), first written for AWS.
- 2026-10-27: Rewritten for the university server (user: "replaneje para o servidor
  da faculdade"); AWS content is in git history.
