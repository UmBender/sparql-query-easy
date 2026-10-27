---
id: LEARN-004
title: Learn the university server's network: open ports, firewall, proxies and reachability
status: READY
priority: P1
type: learning
depends_on: [LEARN-003]
human_gate: true
created: 2026-10-07
updated: 2026-10-27
---
# Learn the university server's network: open ports, firewall, proxies and reachability

Part of the [[../../07 - Operations/Deployment Learning Path/00 - Deployment Roadmap|Deployment Roadmap]];
progress goes in the [[../../07 - Operations/Deployment Learning Path/Deployment Learning Tracker|Deployment Learning Tracker]].
Prepares: OPS-002, OPS-008 (checklist N1–N5, H2). Target: the university server (DEC-003); rewritten from the earlier AWS version on 2026-10-27.

## Why this matters for the deployment

Whether participants can open the app depends on what the university network lets through: public reachability, ports 80/443 or a university reverse proxy, outbound access to Wikidata and package registries. Only `web` (Caddy) should ever listen on the network.

## How this task is executed

1. **Claude writes the lesson** `tcc/07 - Operations/Deployment Learning Path/L04 - The Server's Network: Ports, Firewall and Proxies.md`:
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

- List what listens on the server and on which interface (`ss -tlnp`), and explain 0.0.0.0 vs 127.0.0.1.
- Read the host firewall (`ufw`/`firewalld`/`nft`) and know how Docker-published ports bypass some of it.
- Test reachability from inside and outside the university (VPN vs internet) and record N1/N2.
- Test outbound access to Wikidata, Docker Hub, npm and Maven (N3–N5) and configure an HTTP proxy if one is required.
- Choose the HTTPS mode `auto` or `proxy` (OPS-008) from the answers.

## Concepts to study

- Interfaces, private vs public addresses, NAT; how the university network reaches your server.
- Ports, listening sockets, firewalls; Docker's iptables rules and `ports:` bound to `127.0.0.1`.
- Forward and reverse proxies; `X-Forwarded-For`/`-Proto` and why the backend trusts only Caddy.
- Outbound proxies (`HTTPS_PROXY`) for Docker builds and the JVM.

## Hands-on lab

1. On the server, list listening sockets before and after `docker compose up` and explain each line.
2. From your laptop on campus/VPN and from a phone on mobile data, `curl -I` the server; record what works.
3. From the server, `curl -I https://query.wikidata.org/sparql` and the registries; note any proxy needed.
4. Write the N1–N5 and H2 answers into the checklist and pick the OPS-008 mode.

## Check it yourself (CLI)

Replace `<…>` placeholders with your values; `easyquery` is your `~/.ssh/config` host.

```sh
ssh easyquery 'sudo ss -tlnp'
```
Look for: only Caddy on 80/443 (or the one proxy port) once the stack runs; db and backend not exposed

```sh
ssh easyquery 'sudo ufw status verbose || sudo firewall-cmd --list-all'
```
Look for: the allowed inbound ports

```sh
curl -sSI http://<server-name>/ ; curl -sSI https://<server-name>/health
```
Look for: a response (or a timeout that tells you it is blocked)

```sh
ssh easyquery 'curl -sSI https://query.wikidata.org/sparql | head -1'
```
Look for: `HTTP/2 200`/`405`, not a timeout

```sh
ssh easyquery 'env | grep -i _proxy'
```
Look for: the proxy settings the university requires, if any

## Exercises — break it, then fix it

- Publish a test container on `0.0.0.0:5432` and on `127.0.0.1:5432`; check from your laptop which one is reachable, then remove it.
- Explain why the backend must not trust `X-Forwarded-For` from anyone but Caddy (EASYQUERY_TRUST_PROXY).

## Done when

- You know which ports are reachable from where, and only the web entry point is exposed.
- Checklist N1–N5 and H2 are answered and the OPS-008 mode is chosen.

## Reading list

- Docker docs — Packet filtering and firewalls (Docker and ufw/iptables)
- `ss(8)`, `curl(1)` manual pages
- [[../../07 - Operations/University Server Checklist]]

## Execution log

- 2026-10-07: Created from the user's request for a hands-on deployment learning
  path (DOC-003), first written for AWS.
- 2026-10-27: Rewritten for the university server (user: "replaneje para o servidor
  da faculdade"); AWS content is in git history.
