---
id: LEARN-006
title: Learn to release a version by git tag, build its images on the server and roll back
status: READY
priority: P1
type: learning
depends_on: [LEARN-005]
human_gate: true
created: 2026-10-07
updated: 2026-10-27
---
# Learn to release a version by git tag, build its images on the server and roll back

Part of the [[../../07 - Operations/Deployment Learning Path/00 - Deployment Roadmap|Deployment Roadmap]];
progress goes in the [[../../07 - Operations/Deployment Learning Path/Deployment Learning Tracker|Deployment Learning Tracker]].
Prepares: OPS-011 update and roll back, OPS-005. Target: the university server (DEC-003); rewritten from the earlier AWS version on 2026-10-27.

## Why this matters for the deployment

A release must be repeatable and reversible: you need to know exactly which commit runs, update without losing data, and go back quickly if a study session is about to start and the new version is broken.

## How this task is executed

1. **Claude writes the lesson** `tcc/07 - Operations/Deployment Learning Path/L06 - Releases: Tags, Image Builds and Rollback.md`:
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

- Create an annotated tag for a release and see it in `git describe` on the server.
- Build the images tagged `EASYQUERY_VERSION` and keep the previous ones for rollback.
- Follow the runbook's Update and Roll back sections, including migrations that cannot be undone.
- Clean old images without deleting the one you may need to roll back to.

## Concepts to study

- Git tags vs branches; image tags vs digests; `EASYQUERY_VERSION` in `compose.yaml`.
- Forward-only database migrations (Flyway) and what that means for rollback (restore vs redeploy).
- Build cache, disk usage, `docker image prune` safely.

## Hands-on lab

1. Tag a test release, update the server to it, then roll back to the previous tag.
2. Record the time each step took; that is your rollback budget before a study session.

## Check it yourself (CLI)

Replace `<…>` placeholders with your values; `easyquery` is your `~/.ssh/config` host.

```sh
git describe --tags
```
Look for: the tag you are about to release

```sh
ssh easyquery 'docker image ls easyquery-*'
```
Look for: images for the current and previous versions

```sh
curl -sS https://<server-name>/health
```
Look for: healthy after update and after rollback

```sh
ssh easyquery 'docker system df'
```
Look for: how much disk images and build cache use

## Exercises — break it, then fix it

- A release added a migration and you must roll back: decide between redeploying the old image and restoring the backup taken before the update; explain why.

## Done when

- You released and rolled back once, following the runbook, with the times written down.

## Reading list

- [[../../07 - Operations/Server Deploy Runbook]] (Release, Update, Roll back)
- Pro Git — Tagging; Flyway docs — Concepts (migrations)

## Execution log

- 2026-10-07: Created from the user's request for a hands-on deployment learning
  path (DOC-003), first written for AWS.
- 2026-10-27: Rewritten for the university server (user: "replaneje para o servidor
  da faculdade"); AWS content is in git history.
