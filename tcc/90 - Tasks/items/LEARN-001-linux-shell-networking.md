---
id: LEARN-001
title: Learn the Linux shell and networking needed to debug a web app
status: REVIEW
priority: P1
type: learning
depends_on: []
human_gate: true
created: 2026-10-07
updated: 2026-10-20
---
# Learn the Linux shell and networking needed to debug a web app

Part of the [[../../07 - Operations/Deployment Learning Path/00 - Deployment Roadmap|Deployment Roadmap]];
progress goes in the [[../../07 - Operations/Deployment Learning Path/Deployment Learning Tracker|Deployment Learning Tracker]].
Prepares: all later phases.

## Why this matters for the deployment

Every later step (EC2, Docker, DNS, HTTPS, PostgreSQL) fails in ways you can only see from a terminal: a port not listening, a firewall dropping packets, DNS pointing somewhere else, a certificate expired. This module gives you the vocabulary and the tools to tell those apart.

## How this task is executed

1. **Claude writes the lesson** `tcc/07 - Operations/Deployment Learning Path/L01 - Linux Shell and Networking.md`:
   a blog-post-style module that explains every concept below from first
   principles with diagrams, walks through the lab step by step with the
   expected output of each command, lists common errors and how to read
   them, and ends with a short quiz. It cites official documentation, and
   for commands it cannot run in the repository it marks the output as
   expected rather than observed.
2. **You do the lab by hand** in your own terminal/AWS account, run every
   self-check, and record results and questions in the tracker.
3. **Review together:** open questions go back into the lesson. The task
   is DONE when you tick every "Done when" item in the tracker (human gate).

No AWS resource is created, and nothing is pushed or deployed, by Claude
without your explicit request in the session.

## Learning objectives — after this you can

- Explain what happens, layer by layer, when a browser opens `https://app.example.com/health` (DNS → TCP → TLS → HTTP).
- Find which process listens on which port and why a request gets "connection refused" versus a timeout.
- Read and write file permissions, manage processes and services, and read logs with `journalctl`.
- Make HTTP requests by hand and read status codes, headers and timings.

## Concepts to study

- Processes, signals (`SIGTERM` vs `SIGKILL`), exit codes, environment variables.
- Users, groups and permissions (`rwx`, octal modes, `sudo`), why the app runs as non-root.
- systemd units and `journalctl`.
- IP addresses, private vs public ranges (10/8, 172.16/12, 192.168/16), CIDR notation, ports, TCP handshake, localhost vs 0.0.0.0.
- HTTP methods, status codes, headers, redirects, keep-alive.
- DNS resolution chain (stub resolver → recursive resolver → root → TLD → authoritative).
- TLS in one page: certificates, chain of trust, SNI.
- SSH keys (`ssh-keygen`, `~/.ssh/config`) — and why AWS Session Manager can replace open SSH later.

## Hands-on lab

1. Build and start the app locally (`./gradlew installDist` then `./build/install/sparql-query-easy-kotlin/bin/sparql-query-easy-kotlin`).
2. In a second terminal find the Java process and its listening port; stop it gracefully with `kill <pid>` and watch the log.
3. Send an HTTP request by hand over a raw TCP connection with `nc` and compare with `curl -v`.
4. Resolve a few public names with `dig`, follow one with `dig +trace`, and draw the chain you saw.
5. Inspect the certificate of a public HTTPS site with `openssl s_client` and identify subject, issuer, validity and SANs.

## Check it yourself (CLI)

Replace `<…>` placeholders with your values.

```sh
ss -ltnp
```
Look for: every listening TCP socket and its process; the app should show `*:8080` (or `0.0.0.0:8080`) owned by `java`

```sh
ps -o pid,user,rss,etime,cmd -C java
```
Look for: the JVM, its user, memory (RSS) and uptime

```sh
curl -v http://127.0.0.1:8080/health
```
Look for: the TCP connect line, request headers, `HTTP/1.1 200 OK` and `{"status":"ok"}`

```sh
curl -sS -o /dev/null -w '%{http_code} %{time_connect} %{time_total}\n' http://127.0.0.1:8080/health
```
Look for: status code and timing breakdown

```sh
printf 'GET /health HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n' | nc 127.0.0.1 8080
```
Look for: a raw HTTP response — this is all `curl` does

```sh
curl -v http://127.0.0.1:8081/
```
Look for: `Connection refused` (nothing listening) — compare with a timeout to a firewalled host

```sh
dig github.com A +short ; dig +trace github.com
```
Look for: the address, then each delegation step from the root

```sh
ip -brief addr ; ip route
```
Look for: your interfaces/addresses and the default gateway

```sh
openssl s_client -connect github.com:443 -servername github.com </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer -dates -ext subjectAltName
```
Look for: who the certificate is for, who signed it and when it expires

```sh
journalctl --since "15 min ago" -p warning
```
Look for: recent warnings from all services

```sh
df -h ; free -h
```
Look for: disk and memory headroom — the two things that silently kill small servers

## Exercises — break it, then fix it

- Start the app twice: what error does the second JVM give, and which command proves the port is taken?
- Bind the app only to 127.0.0.1 vs 0.0.0.0 (e.g. with Docker `-p 127.0.0.1:8080:8080` later) — which machines can reach it?
- Make `curl` show a 404, a 400 (send an invalid JSON body to `/api/query`) and a 308/301 redirect; explain each.
- Explain in your own words the difference between "connection refused", "connection timed out" and "could not resolve host".

## Done when

- You can explain the request path DNS → TCP → TLS → HTTP without notes.
- You can find a listening process, read its logs and stop it gracefully.
- You can diagnose refused vs timeout vs DNS failure with the commands above.

## Reading list

- The Missing Semester of Your CS Education (MIT) — shell, data wrangling, command-line environment: https://missing.csail.mit.edu/
- Julia Evans — zines and blog posts on networking, DNS and debugging (https://wizardzines.com/, https://jvns.ca/)
- MDN Web Docs — An overview of HTTP: https://developer.mozilla.org/en-US/docs/Web/HTTP
- `man ss`, `man curl`, `man dig`, `man journalctl`

## Execution log

- 2026-10-07: Created from the user's request for a hands-on deployment learning
  path (DOC-003).
- 2026-10-07: Lesson written: [[../../07 - Operations/Deployment Learning Path/L01 - Linux Shell and Networking]].
  Every output in it was observed on the dev machine (app built from
  `main`, Fedora, `curl` 8.18, `ncat` 7.92). Lesson findings: the app has no
  SLF4J backend, so it writes no logs (recorded on OPS-004); `HEAD /`
  returns 405 while `GET /` redirects (monitoring caveat); Fedora `nc` needs
  a pause to show the reply. Status REVIEW: the user does the lab and ticks
  "Done when" in the tracker to close it (human gate). Validation:
  `node scripts/check-project-docs.mjs`, `git diff --check`.
- 2026-10-20: DEC-018 amendment. FE-049 retired `index2.html` and Ktor's
  `GET /` redirect (both now 404), so the timing exercise curls `/health`.
  The lesson L01 still shows the outputs observed on 2026-10-07 (`302` from
  `/` to `/index2.html`); re-observe them when the lab is redone. Status
  unchanged.
