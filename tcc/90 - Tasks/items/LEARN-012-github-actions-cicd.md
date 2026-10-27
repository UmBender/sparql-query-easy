---
id: LEARN-012
title: Learn CI/CD with GitHub Actions and a safe deploy path to the university server
status: READY
priority: P1
type: learning
depends_on: [LEARN-006, LEARN-009, LEARN-011]
human_gate: true
created: 2026-10-07
updated: 2026-10-27
---
# Learn CI/CD with GitHub Actions and a safe deploy path to the university server

Part of the [[../../07 - Operations/Deployment Learning Path/00 - Deployment Roadmap|Deployment Roadmap]];
progress goes in the [[../../07 - Operations/Deployment Learning Path/Deployment Learning Tracker|Deployment Learning Tracker]].
Prepares: OPS-005 (checklist A4). Target: the university server (DEC-003); rewritten from the earlier AWS version on 2026-10-27.

## Why this matters for the deployment

CI already runs every gate on GitHub. Deploying is the open part: the university may not let GitHub reach the server. You need to know the options and their risks before automating anything.

## How this task is executed

1. **Claude writes the lesson** `tcc/07 - Operations/Deployment Learning Path/L12 - CI/CD with GitHub Actions to the University Server.md`:
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

- Read `.github/workflows/ci.yml`: jobs, triggers, artifacts; reproduce a failure locally.
- Compare deploy options: manual runbook on tag (today), SSH from Actions with a restricted key and a GitHub Environment approval, or a pull-based script on the server.
- Explain what a deploy key may do and how to limit it (`command=` in `authorized_keys`, dedicated user).
- Pick an option with IT's answer to A4 and record it in OPS-005.

## Concepts to study

- Workflows, jobs, runners, secrets, environments and required reviewers.
- Inbound (push) vs outbound (pull) deployment; least-privilege deploy users.
- Health check after deploy and automatic rollback trigger.

## Hands-on lab

1. Open a PR that breaks a test and watch CI fail; fix it.
2. Write (not enable) a deploy job for the chosen option and review it against the runbook.

## Check it yourself (CLI)

Replace `<…>` placeholders with your values; `easyquery` is your `~/.ssh/config` host.

```sh
gh run list --limit 5
```
Look for: recent CI runs and their status

```sh
gh run view --log-failed
```
Look for: the failing step of a broken run

```sh
ssh easyquery 'cat ~/.ssh/authorized_keys | cut -c1-60'
```
Look for: a restricted deploy key, if the SSH option was chosen

## Exercises — break it, then fix it

- A deploy key leaks: what can the attacker do with your restrictions, and how do you revoke it?

## Done when

- The deploy option is chosen and recorded in OPS-005; a dry run follows the runbook.

## Reading list

- GitHub Docs — Understanding GitHub Actions; Using environments for deployment; Encrypted secrets
- `sshd(8)` AUTHORIZED_KEYS FILE FORMAT (`command=`, `restrict`)

## Execution log

- 2026-10-07: Created from the user's request for a hands-on deployment learning
  path (DOC-003), first written for AWS.
- 2026-10-27: Rewritten for the university server (user: "replaneje para o servidor
  da faculdade"); AWS content is in git history.
