---
id: LEARN-011
title: Learn HTTPS and reverse proxying with Caddy, either with its own certificates or behind the university proxy
status: READY
priority: P1
type: learning
depends_on: [LEARN-005, LEARN-010]
human_gate: true
created: 2026-10-07
updated: 2026-10-27
---
# Learn HTTPS and reverse proxying with Caddy, either with its own certificates or behind the university proxy

Part of the [[../../07 - Operations/Deployment Learning Path/00 - Deployment Roadmap|Deployment Roadmap]];
progress goes in the [[../../07 - Operations/Deployment Learning Path/Deployment Learning Tracker|Deployment Learning Tracker]].
Prepares: OPS-008, OPS-002. Target: the university server (DEC-003); rewritten from the earlier AWS version on 2026-10-27.

## Why this matters for the deployment

Passwords must only travel over HTTPS, the session cookie is `Secure`, and browsers warn on plain HTTP. The stack's Caddy either obtains certificates itself (mode `auto`) or sits behind a university proxy that terminates TLS (mode `proxy`); you need to understand both.

## How this task is executed

1. **Claude writes the lesson** `tcc/07 - Operations/Deployment Learning Path/L11 - HTTPS and Reverse Proxy.md`:
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

- Explain TLS certificates, chains, ACME HTTP-01 and why port 80 must be reachable for `auto`.
- Configure the stack's `EASYQUERY_HTTPS_MODE` for the server and verify the certificate.
- In `proxy` mode, explain which forwarded headers Caddy trusts and from which address.
- Check security headers and the cookie flags through the real name.

## Concepts to study

- TLS handshake, SNI, certificate validity and renewal; Let's Encrypt rate limits.
- Reverse proxy chains: university proxy → Caddy → backend; `X-Forwarded-*`; trusted proxies.
- HSTS, redirects, `Secure`/`HttpOnly`/`SameSite` cookies (security plan QUAL-022).

## Hands-on lab

1. Set the mode chosen in LEARN-004, restart `web`, and verify HTTPS from your laptop.
2. Read Caddy's logs during a certificate issuance or a proxied request.

## Check it yourself (CLI)

Replace `<…>` placeholders with your values; `easyquery` is your `~/.ssh/config` host.

```sh
curl -sSI https://<server-name>/
```
Look for: `HTTP/2 200` and the security headers

```sh
openssl s_client -connect <server-name>:443 -servername <server-name> </dev/null | openssl x509 -noout -issuer -dates
```
Look for: a trusted issuer and future expiry

```sh
curl -sSI http://<server-name>/
```
Look for: a redirect to HTTPS

```sh
ssh easyquery 'cd easyquery && docker compose logs web --since 1h | tail'
```
Look for: certificate obtained/renewed or proxied requests, no errors

## Exercises — break it, then fix it

- Explain what breaks if the university proxy does not forward `X-Forwarded-Proto` (cookie, redirects).

## Done when

- The app is served over trusted HTTPS on its name; HTTP redirects; the cookie is `Secure`.

## Reading list

- Caddy docs — Automatic HTTPS, reverse_proxy, trusted_proxies
- [[../../07 - Operations/Docker Compose Stack]] (HTTPS modes)

## Execution log

- 2026-10-07: Created from the user's request for a hands-on deployment learning
  path (DOC-003), first written for AWS.
- 2026-10-27: Rewritten for the university server (user: "replaneje para o servidor
  da faculdade"); AWS content is in git history.
