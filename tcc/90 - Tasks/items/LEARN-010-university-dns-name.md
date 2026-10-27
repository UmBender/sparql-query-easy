---
id: LEARN-010
title: Learn domains and DNS by getting the app its university name and checking it with dig
status: READY
priority: P1
type: learning
depends_on: [LEARN-004]
human_gate: true
created: 2026-10-07
updated: 2026-10-27
---
# Learn domains and DNS by getting the app its university name and checking it with dig

Part of the [[../../07 - Operations/Deployment Learning Path/00 - Deployment Roadmap|Deployment Roadmap]];
progress goes in the [[../../07 - Operations/Deployment Learning Path/Deployment Learning Tracker|Deployment Learning Tracker]].
Prepares: OPS-002 (checklist H1). Target: the university server (DEC-003); rewritten from the earlier AWS version on 2026-10-27.

## Why this matters for the deployment

Cookies, HTTPS certificates and the links you send to participants all use one name. The university controls its DNS zone, so you must know what to ask IT for and how to verify it.

## How this task is executed

1. **Claude writes the lesson** `tcc/07 - Operations/Deployment Learning Path/L10 - The App's Name at the University (DNS).md`:
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

- Explain zones, delegation, A/AAAA/CNAME records and TTL using the university's own domain.
- Ask IT for the record (H1) with the exact name and address, and verify it with `dig`.
- Distinguish internal-only names (split DNS) from public ones and test from both sides.

## Concepts to study

- The DNS tree, authoritative servers, recursive resolvers and caching; `dig +trace`.
- Split-horizon DNS on campus networks; why a name may resolve on VPN but not at home.
- One origin for the SPA and API (no CORS needed) and the cookie's host.

## Hands-on lab

1. Trace the university domain with `dig +trace` and find who is authoritative.
2. After IT creates the record, check it from campus/VPN and from mobile data.

## Check it yourself (CLI)

Replace `<…>` placeholders with your values; `easyquery` is your `~/.ssh/config` host.

```sh
dig +short <server-name>
```
Look for: the server's address (or the university proxy's)

```sh
dig +trace <server-name> | tail -5
```
Look for: the university's authoritative servers answering

```sh
dig +short <server-name> @1.1.1.1
```
Look for: the same answer from a public resolver (or nothing if internal-only)

## Exercises — break it, then fix it

- The name works on campus but not at home: list three causes and how `dig` tells them apart.

## Done when

- The app's name is decided, recorded in the checklist (H1) and resolves where participants will be.

## Reading list

- Julia Evans — "How DNS works" zine / blog posts; `dig(1)` manual
- [[../../07 - Operations/University Server Checklist]] (Name and HTTPS)

## Execution log

- 2026-10-07: Created from the user's request for a hands-on deployment learning
  path (DOC-003), first written for AWS.
- 2026-10-27: Rewritten for the university server (user: "replaneje para o servidor
  da faculdade"); AWS content is in git history.
