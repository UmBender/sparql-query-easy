---
id: LEARN-011
title: Learn HTTPS and reverse proxying with Caddy and Let's Encrypt
status: READY
priority: P1
type: learning
depends_on: [LEARN-005, LEARN-010]
human_gate: true
created: 2026-10-07
updated: 2026-10-07
---
# Learn HTTPS and reverse proxying with Caddy and Let's Encrypt

Part of the [[../../07 - Operations/Deployment Learning Path/00 - Deployment Roadmap|Deployment Roadmap]];
progress goes in the [[../../07 - Operations/Deployment Learning Path/Deployment Learning Tracker|Deployment Learning Tracker]].
Prepares: OPS-002.

## Why this matters for the deployment

Passwords must only travel over HTTPS, cookies must be `Secure`, and browsers warn on plain HTTP. A reverse proxy terminates TLS, renews certificates and keeps the app port private.

## How this task is executed

1. **Claude writes the lesson** `tcc/07 - Operations/Deployment Learning Path/L11 - HTTPS and Reverse Proxy.md`:
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

- Explain the TLS handshake, certificates, chain of trust and the ACME HTTP-01 challenge.
- Run Caddy in front of the app on the same Docker network, with automatic Let's Encrypt certificates and an HTTP→HTTPS redirect.
- Configure forwarded headers so the app knows the original scheme and client IP, and add security headers (HSTS).
- Verify certificates, redirects and headers from the command line and with an external scanner.

## Concepts to study

- Reverse proxy vs load balancer; why only the proxy publishes ports 80/443.
- ACME, Let's Encrypt rate limits and the staging environment.
- Persisting Caddy's data directory so certificates survive restarts.
- `X-Forwarded-For`/`X-Forwarded-Proto` and Ktor's ForwardedHeaders/XForwardedHeaders plugin (trust only the proxy).
- HSTS, `Content-Security-Policy` basics, `X-Content-Type-Options`.
- Same-origin frontend and API: why CORS stays closed (OPS-002).
- Alternative: Application Load Balancer + ACM certificate (managed, but hourly cost).

## Hands-on lab

1. On EC2, create a Docker network; run the app without published ports and Caddy publishing 80 and 443 with a Caddyfile `app.<domain> { reverse_proxy app:8080 }`.
2. First use the Let's Encrypt staging CA, check the (untrusted) certificate, then switch to production.
3. Add HSTS and other headers; check the HTTP→HTTPS redirect.
4. Restart Caddy and confirm it reuses the stored certificate.

## Check it yourself (CLI)

Replace `<…>` placeholders with your values.

```sh
curl -sI http://app.<domain>/
```
Look for: a `308 Permanent Redirect` with `Location: https://app.<domain>/`

```sh
curl -sv https://app.<domain>/health -o /dev/null 2>&1 | grep -E "SSL connection|subject:|issuer:|expire date|HTTP/"
```
Look for: TLS version, certificate subject/issuer/expiry and `HTTP/2 200`

```sh
openssl s_client -connect app.<domain>:443 -servername app.<domain> </dev/null 2>/dev/null | openssl x509 -noout -issuer -subject -dates -ext subjectAltName
```
Look for: issued by Let's Encrypt for your name, about 90 days validity

```sh
curl -sI https://app.<domain>/ | grep -i -E "strict-transport|x-content-type|server"
```
Look for: your security headers

```sh
docker logs caddy 2>&1 | grep -i -E "certificate obtained|challenge|error"
```
Look for: the ACME challenge and certificate events

```sh
nc -vz -w 5 <elastic-ip> 8080
```
Look for: times out — the app port is not public

```sh
nmap --script ssl-enum-ciphers -p 443 app.<domain>
```
Look for: only modern TLS versions and ciphers

## Exercises — break it, then fix it

- Close port 80 in the security group and explain why renewal (HTTP-01) would fail.
- Make the app log the client IP with and without forwarded-header handling and compare.
- Run an external test (e.g. SSL Labs) and explain every point it deducts.

## Done when

- `https://app.<domain>` works with a trusted certificate, HTTP redirects, the app port is private.
- You can read a certificate and diagnose TLS errors from the command line.

## Reading list

- Caddy documentation — Automatic HTTPS, reverse_proxy, Caddyfile concepts: https://caddyserver.com/docs/
- Let's Encrypt documentation — How it works, Challenge types, Rate limits, Staging environment: https://letsencrypt.org/docs/
- Ktor documentation — Forwarded headers
- MDN — Strict-Transport-Security; Mozilla Server Side TLS guidelines

## Execution log

- 2026-10-07: Created from the user's request for a hands-on deployment learning
  path (DOC-003).
