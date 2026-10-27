# Deployment Learning Tracker

Your logbook for learning and deploying SPARQL EasyQuery. The plan is in
[[00 - Deployment Roadmap]]; each module has a task card (`LEARN-*`) with the
full objectives, lab, CLI self-checks and reading list.

## How to use this page

- Work top to bottom; a module can start when the modules it depends on are done.
- Tick `- [x]` boxes as you go (Obsidian renders them as checkboxes).
- Paste short command outputs that *prove* a step into **Evidence**
  (redact account IDs, IPs you consider private, and never paste secrets).
- Write anything unclear in **Questions** — they become the next session's agenda.
- Status legend: `todo`, `reading`, `lab`, `done`. Confidence: 1 (lost) to 5 (could teach it).
- When every **Done when** box of a module is ticked, tell Claude to close its card.

## Overview

| Module | Card | Status | Started | Finished | Hours | Confidence |
|---|---|---|---|---|---|---|
| L01 - Linux Shell and Networking | [[../../90 - Tasks/items/LEARN-001-linux-shell-networking]] | todo | | | | |
| L02 - Containers with Docker | [[../../90 - Tasks/items/LEARN-002-containers-docker]] | todo | | | | |
| L03 - Server Access and Hardening | [[../../90 - Tasks/items/LEARN-003-server-access-hardening]] | todo | | | | |
| L04 - The Server's Network: Ports, Firewall and Proxies | [[../../90 - Tasks/items/LEARN-004-server-network-firewall]] | todo | | | | |
| L05 - The Compose Stack on the Server by Hand | [[../../90 - Tasks/items/LEARN-005-compose-stack-on-server]] | todo | | | | |
| L06 - Releases: Tags, Image Builds and Rollback | [[../../90 - Tasks/items/LEARN-006-releases-tags-images]] | todo | | | | |
| L07 - PostgreSQL in the Compose Stack | [[../../90 - Tasks/items/LEARN-007-postgresql-in-compose]] | todo | | | | |
| L08 - Passwords, Sessions and Login Security | [[../../90 - Tasks/items/LEARN-008-passwords-sessions-auth]] | todo | | | | |
| L09 - Configuration and Secrets on the Server | [[../../90 - Tasks/items/LEARN-009-configuration-secrets]] | todo | | | | |
| L10 - The App's Name at the University (DNS) | [[../../90 - Tasks/items/LEARN-010-university-dns-name]] | todo | | | | |
| L11 - HTTPS and Reverse Proxy | [[../../90 - Tasks/items/LEARN-011-https-reverse-proxy]] | todo | | | | |
| L12 - CI/CD with GitHub Actions to the University Server | [[../../90 - Tasks/items/LEARN-012-github-actions-cicd]] | todo | | | | |
| L13 - Observability, Backups and Runbooks | [[../../90 - Tasks/items/LEARN-013-observability-backups-runbooks]] | todo | | | | |
| L14 - Go-Live Checklist for the User Test | [[../../90 - Tasks/items/LEARN-014-go-live-user-testing]] | todo | | | | |

## Deployment milestones (the real thing)

Tick these when they exist on the university server, not just in a lab.

- [ ] M1 — Key-based SSH access agreed with IT; checklist Access and Machine answered
- [ ] M2 — Network answers recorded (N1–N5, H2); only the web entry point exposed; HTTPS mode chosen
- [ ] M3 — Compose stack installed from a tag, healthy after a reboot
- [ ] M4 — A release updated and rolled back once by the runbook
- [ ] M5 — Database inspected read-only; restore drill done
- [ ] M6 — Production `.env` with generated secrets (600); one rotation practised
- [ ] M7 — The app's university name resolves where participants will be
- [ ] M8 — Trusted HTTPS on that name; HTTP redirects; `Secure` cookie
- [ ] M9 — CI green on `main`; deploy option chosen (OPS-005)
- [ ] M10 — Uptime alert reaches you; off-host encrypted backups; runbooks written
- [ ] M11 — Security suite (QUAL-019…023) passing on the released version
- [ ] M12 — Go-live checklist and dress rehearsal done
- [ ] M13 — First real participant used the app
- [ ] M14 — Test finished: data exported/kept/deleted as promised in the consent text

## Decision log

Record each decision when you make it; the card in brackets is where it is
formally recorded.

| Date | Decision | Choice | Why | Card |
|---|---|---|---|---|
| | HTTPS mode (`auto` or `proxy`) | | | OPS-008 |
| | The app's university DNS name | | | OPS-002 |
| | Login contract (users, anonymous access, protected routes) | | | AUTH-000 |
| | Password hash algorithm and parameters | | | AUTH-000 |
| | Release approval and rollback method | | | OPS-005 |
| | Log retention, alarms, backup retention (RPO/RTO) | | | OPS-004 |
| | Upload limit (remote endpoints: allowlist, 2026-10-27) | | | QUAL-021 |
| | Test period and shutdown date | | | — |

## L01 - Linux Shell and Networking

Card: [[../../90 - Tasks/items/LEARN-001-linux-shell-networking|LEARN-001]] — Learn the Linux shell and networking needed to debug a web app. Needs: nothing.

Status: todo · Started: · Finished: · Hours: · Confidence:

**Lesson**

- [x] Lesson written (Claude) — [[L01 - Linux Shell and Networking]]
- [ ] Lesson read
- [ ] Reading list skimmed

**Lab**

- [ ] Build and start the app locally (`./gradlew installDist` then `./build/install/sparql-query-easy-kotlin/bin/sparql-query-easy-kotlin`).
- [ ] In a second terminal find the Java process and its listening port; stop it gracefully with `kill <pid>` and watch the log.
- [ ] Send an HTTP request by hand over a raw TCP connection with `nc` and compare with `curl -v`.
- [ ] Resolve a few public names with `dig`, follow one with `dig +trace`, and draw the chain you saw.
- [ ] Inspect the certificate of a public HTTPS site with `openssl s_client` and identify subject, issuer, validity and SANs.
- [ ] Every command in "Check it yourself" run and understood
- [ ] Exercises done (break it, then fix it)

**Done when**

- [ ] You can explain the request path DNS → TCP → TLS → HTTP without notes.
- [ ] You can find a listening process, read its logs and stop it gracefully.
- [ ] You can diagnose refused vs timeout vs DNS failure with the commands above.

**Evidence**

```text

```

**Notes**

- 

**Questions**

- 

## L02 - Containers with Docker

Card: [[../../90 - Tasks/items/LEARN-002-containers-docker|LEARN-002]] — Learn containers by running and inspecting the app image. Needs: LEARN-001.

Status: todo · Started: · Finished: · Hours: · Confidence:

**Lesson**

- [x] Lesson written (Claude) — [[L02 - Containers with Docker]]
- [ ] Lesson read
- [ ] Reading list skimmed

**Lab**

- [ ] `docker build -t sparql-query-easy:local .` and time it; rebuild after changing only a frontend file and explain which layers were reused.
- [ ] Run it detached on 127.0.0.1:8080, watch the health status go from `starting` to `healthy`.
- [ ] Exec into the container, confirm the user and the files under `/opt/sparql-query-easy`.
- [ ] Run with `--memory 256m` and a too-large `-Xmx`; observe what happens and fix it.
- [ ] Write a local `compose.yaml` (lab only, in your scratch folder) with `app`, `postgres` and `caddy` services on one network; only Caddy publishes ports.
- [ ] Every command in "Check it yourself" run and understood
- [ ] Exercises done (break it, then fix it)

**Done when**

- [ ] You can build, run, inspect and debug the app container without notes.
- [ ] Your local Compose lab starts app + PostgreSQL + Caddy and `curl` reaches the app through Caddy.
- [ ] You can explain why secrets never go into the image.

**Evidence**

```text

```

**Notes**

- 

**Questions**

- 

## L03 - Server Access and Hardening

Card: [[../../90 - Tasks/items/LEARN-003-server-access-hardening|LEARN-003]] — Learn to reach the university server safely with SSH keys, least privilege and updates. Needs: LEARN-001.

Status: todo · Started: · Finished: · Hours: · Confidence:

**Lesson**

- [ ] Lesson written (Claude)
- [ ] Lesson read
- [ ] Reading list skimmed

**Lab**

- [ ] Generate an ed25519 key with a passphrase; send only the `.pub` to IT; add a `Host easyquery` block to `~/.ssh/config`.
- [ ] Log in, compare the host key fingerprint with the one IT gives you, and note the OS, CPU, RAM and disk (M1, M3).
- [ ] Check whether you are in `sudo`/`docker` groups and what that allows; write the answer to A2 in the checklist.
- [ ] Check automatic updates and NTP; ask IT about maintenance windows if unclear.
- [ ] Every command in "Check it yourself" run and understood
- [ ] Exercises done (break it, then fix it)

**Done when**

- [ ] You log in with a passphrase-protected key; no shared password is used.
- [ ] Checklist answers A1–A3 and M1–M4 are recorded with dates.
- [ ] You can explain the privilege you have on the server and its risks.

**Evidence**

```text

```

**Notes**

- 

**Questions**

- 

## L04 - The Server's Network: Ports, Firewall and Proxies

Card: [[../../90 - Tasks/items/LEARN-004-server-network-firewall|LEARN-004]] — Learn the university server's network: open ports, firewall, proxies and reachability. Needs: LEARN-003.

Status: todo · Started: · Finished: · Hours: · Confidence:

**Lesson**

- [ ] Lesson written (Claude)
- [ ] Lesson read
- [ ] Reading list skimmed

**Lab**

- [ ] On the server, list listening sockets before and after `docker compose up` and explain each line.
- [ ] From your laptop on campus/VPN and from a phone on mobile data, `curl -I` the server; record what works.
- [ ] From the server, `curl -I https://query.wikidata.org/sparql` and the registries; note any proxy needed.
- [ ] Write the N1–N5 and H2 answers into the checklist and pick the OPS-008 mode.
- [ ] Every command in "Check it yourself" run and understood
- [ ] Exercises done (break it, then fix it)

**Done when**

- [ ] You know which ports are reachable from where, and only the web entry point is exposed.
- [ ] Checklist N1–N5 and H2 are answered and the OPS-008 mode is chosen.

**Evidence**

```text

```

**Notes**

- 

**Questions**

- 

## L05 - The Compose Stack on the Server by Hand

Card: [[../../90 - Tasks/items/LEARN-005-compose-stack-on-server|LEARN-005]] — Learn to install and run the Docker Compose stack on the university server by hand. Needs: LEARN-002, LEARN-004.

Status: todo · Started: · Finished: · Hours: · Confidence:

**Lesson**

- [ ] Lesson written (Claude)
- [ ] Lesson read
- [ ] Reading list skimmed

**Lab**

- [ ] Do the runbook's First install on the server with a test `.env` (no real participants yet).
- [ ] Open the app from your laptop; register a test account; run a query on PokemonGen1.
- [ ] Reboot the server (in an agreed window) and confirm the stack comes back healthy.
- [ ] Stop `backend`, watch `/health` and Caddy's response, start it again.
- [ ] Every command in "Check it yourself" run and understood
- [ ] Exercises done (break it, then fix it)

**Done when**

- [ ] The stack runs on the server from a tag, healthy after a reboot.
- [ ] You did each runbook step yourself and noted anything unclear in the runbook.

**Evidence**

```text

```

**Notes**

- 

**Questions**

- 

## L06 - Releases: Tags, Image Builds and Rollback

Card: [[../../90 - Tasks/items/LEARN-006-releases-tags-images|LEARN-006]] — Learn to release a version by git tag, build its images on the server and roll back. Needs: LEARN-005.

Status: todo · Started: · Finished: · Hours: · Confidence:

**Lesson**

- [ ] Lesson written (Claude)
- [ ] Lesson read
- [ ] Reading list skimmed

**Lab**

- [ ] Tag a test release, update the server to it, then roll back to the previous tag.
- [ ] Record the time each step took; that is your rollback budget before a study session.
- [ ] Every command in "Check it yourself" run and understood
- [ ] Exercises done (break it, then fix it)

**Done when**

- [ ] You released and rolled back once, following the runbook, with the times written down.

**Evidence**

```text

```

**Notes**

- 

**Questions**

- 

## L07 - PostgreSQL in the Compose Stack

Card: [[../../90 - Tasks/items/LEARN-007-postgresql-in-compose|LEARN-007]] — Learn PostgreSQL by hand in the stack's db container: psql, roles, migrations and restores. Needs: LEARN-005.

Status: todo · Started: · Finished: · Hours: · Confidence:

**Lesson**

- [ ] Lesson written (Claude)
- [ ] Lesson read
- [ ] Reading list skimmed

**Lab**

- [ ] Open `psql`, list tables, count rows per study table, read `flyway_schema_history`.
- [ ] Run a manual backup, restore it into a throwaway project, compare counts, remove it.
- [ ] Every command in "Check it yourself" run and understood
- [ ] Exercises done (break it, then fix it)

**Done when**

- [ ] You can inspect the database read-only and explain each table's purpose.
- [ ] A restore drill succeeded and its time is recorded.

**Evidence**

```text

```

**Notes**

- 

**Questions**

- 

## L08 - Passwords, Sessions and Login Security

Card: [[../../90 - Tasks/items/LEARN-008-passwords-sessions-auth|LEARN-008]] — Learn secure password storage, sessions and login protection. Needs: LEARN-001.

Status: todo · Started: · Finished: · Hours: · Confidence:

**Lesson**

- [ ] Lesson written (Claude)
- [ ] Lesson read
- [ ] Reading list skimmed

**Lab**

- [ ] Hash the same password twice with Argon2id (e.g. the `argon2` CLI or a small script) and explain why the outputs differ yet both verify.
- [ ] Measure how long one hash takes with your parameters; estimate an attacker's guesses per second.
- [ ] Draft a `users` and a `sessions` table (columns, types, constraints, indexes) in your local PostgreSQL.
- [ ] Once AUTH-001 exists locally: log in with `curl -c cookies.txt`, inspect `Set-Cookie`, call a protected route with and without the cookie, log out and retry.
- [ ] Write your answers to every AUTH-000 question in the tracker.
- [ ] Every command in "Check it yourself" run and understood
- [ ] Exercises done (break it, then fix it)

**Done when**

- [ ] You can defend each choice in the AUTH-000 contract with a reason.
- [ ] You can verify cookie flags and session invalidation from the command line.

**Evidence**

```text

```

**Notes**

- 

**Questions**

- 

## L09 - Configuration and Secrets on the Server

Card: [[../../90 - Tasks/items/LEARN-009-configuration-secrets|LEARN-009]] — Learn configuration and secret management for the app on the university server. Needs: LEARN-005, LEARN-007.

Status: todo · Started: · Finished: · Hours: · Confidence:

**Lesson**

- [ ] Lesson written (Claude)
- [ ] Lesson read
- [ ] Reading list skimmed

**Lab**

- [ ] Write the production `.env` from the example with generated secrets; set `chmod 600`.
- [ ] Rotate the DB password once in a test window and confirm the app reconnects.
- [ ] Every command in "Check it yourself" run and understood
- [ ] Exercises done (break it, then fix it)

**Done when**

- [ ] Production secrets exist only in `.env` (600) and your offline copy; a rotation was practised.

**Evidence**

```text

```

**Notes**

- 

**Questions**

- 

## L10 - The App's Name at the University (DNS)

Card: [[../../90 - Tasks/items/LEARN-010-university-dns-name|LEARN-010]] — Learn domains and DNS by getting the app its university name and checking it with dig. Needs: LEARN-004.

Status: todo · Started: · Finished: · Hours: · Confidence:

**Lesson**

- [ ] Lesson written (Claude)
- [ ] Lesson read
- [ ] Reading list skimmed

**Lab**

- [ ] Trace the university domain with `dig +trace` and find who is authoritative.
- [ ] After IT creates the record, check it from campus/VPN and from mobile data.
- [ ] Every command in "Check it yourself" run and understood
- [ ] Exercises done (break it, then fix it)

**Done when**

- [ ] The app's name is decided, recorded in the checklist (H1) and resolves where participants will be.

**Evidence**

```text

```

**Notes**

- 

**Questions**

- 

## L11 - HTTPS and Reverse Proxy

Card: [[../../90 - Tasks/items/LEARN-011-https-reverse-proxy|LEARN-011]] — Learn HTTPS and reverse proxying with Caddy, either with its own certificates or behind the university proxy. Needs: LEARN-005, LEARN-010.

Status: todo · Started: · Finished: · Hours: · Confidence:

**Lesson**

- [ ] Lesson written (Claude)
- [ ] Lesson read
- [ ] Reading list skimmed

**Lab**

- [ ] Set the mode chosen in LEARN-004, restart `web`, and verify HTTPS from your laptop.
- [ ] Read Caddy's logs during a certificate issuance or a proxied request.
- [ ] Every command in "Check it yourself" run and understood
- [ ] Exercises done (break it, then fix it)

**Done when**

- [ ] The app is served over trusted HTTPS on its name; HTTP redirects; the cookie is `Secure`.

**Evidence**

```text

```

**Notes**

- 

**Questions**

- 

## L12 - CI/CD with GitHub Actions to the University Server

Card: [[../../90 - Tasks/items/LEARN-012-github-actions-cicd|LEARN-012]] — Learn CI/CD with GitHub Actions and a safe deploy path to the university server. Needs: LEARN-006, LEARN-009, LEARN-011.

Status: todo · Started: · Finished: · Hours: · Confidence:

**Lesson**

- [ ] Lesson written (Claude)
- [ ] Lesson read
- [ ] Reading list skimmed

**Lab**

- [ ] Open a PR that breaks a test and watch CI fail; fix it.
- [ ] Write (not enable) a deploy job for the chosen option and review it against the runbook.
- [ ] Every command in "Check it yourself" run and understood
- [ ] Exercises done (break it, then fix it)

**Done when**

- [ ] The deploy option is chosen and recorded in OPS-005; a dry run follows the runbook.

**Evidence**

```text

```

**Notes**

- 

**Questions**

- 

## L13 - Observability, Backups and Runbooks

Card: [[../../90 - Tasks/items/LEARN-013-observability-backups-runbooks|LEARN-013]] — Learn monitoring, logs, backups and incident runbooks for the app on the university server. Needs: LEARN-007, LEARN-012.

Status: todo · Started: · Finished: · Hours: · Confidence:

**Lesson**

- [ ] Lesson written (Claude)
- [ ] Lesson read
- [ ] Reading list skimmed

**Lab**

- [ ] Stop `backend` during a quiet time and time how long until you are alerted.
- [ ] Restore yesterday's off-host dump into a throwaway stack and compare counts.
- [ ] Every command in "Check it yourself" run and understood
- [ ] Exercises done (break it, then fix it)

**Done when**

- [ ] An alert reaches you when `/health` fails; off-host backups exist and a restore from them worked.
- [ ] Runbooks are written next to the Server Deploy Runbook.

**Evidence**

```text

```

**Notes**

- 

**Questions**

- 

## L14 - Go-Live Checklist for the User Test

Card: [[../../90 - Tasks/items/LEARN-014-go-live-user-testing|LEARN-014]] — Learn the go-live checklist for a safe and legal user test on the university server. Needs: LEARN-008, LEARN-013.

Status: todo · Started: · Finished: · Hours: · Confidence:

**Lesson**

- [ ] Lesson written (Claude)
- [ ] Lesson read
- [ ] Reading list skimmed

**Lab**

- [ ] Do a dress rehearsal with two or three colleagues on the real name: consent, tasks, questionnaires, export.
- [ ] Fill the go-live checklist in the tracker and get the open items closed or accepted.
- [ ] Every command in "Check it yourself" run and understood
- [ ] Exercises done (break it, then fix it)

**Done when**

- [ ] The go-live checklist is complete and the dress rehearsal passed.
- [ ] The end-of-test plan (export, retention, shutdown) is written and agreed.

**Evidence**

```text

```

**Notes**

- 

**Questions**

- 

## Source files

- `tcc/90 - Tasks/items/LEARN-*.md`
- [[00 - Deployment Roadmap]]
