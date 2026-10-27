---
id: QUAL-021
title: Stop remote endpoints from reaching internal hosts and bound uploads
status: BACKLOG
priority: P1
type: quality
depends_on: []
human_gate: true
created: 2026-10-27
updated: 2026-10-27
---
# Stop remote endpoints from reaching internal hosts and bound uploads

## Objective

Security plan threats 7–8 ([[../../08 - Quality/Security Test Plan]]).
`RemoteSparqlEndpoint.parse` accepts any http(s) host, so a request can
make the server call `localhost`, the `db` container or cloud metadata
(`169.254.169.254`) once deployed on AWS. Skills: `tcc-backend`, `tcc-test`.

## Decision needed (before READY)

- A: allowlist (Wikidata query service and built-in graphs; other remote
  endpoints only with a later decision, consistent with DEC-004), or
- B: allow public hosts but block loopback, private, link-local, unique
  local and metadata addresses after DNS resolution and on every redirect.
- Upload size limit (e.g. 5 MB) and whether an uploaded graph id stays a
  bearer token readable by anyone who has it.

## Acceptance (after the decision)

- Tests with a fake resolver/transport: each blocked address family,
  DNS rebinding (resolve once, connect to the checked address), redirects
  to blocked hosts, non-HTTP schemes, userinfo tricks
  (`http://wikidata@127.0.0.1`), decimal/octal/IPv6-mapped IPs.
- Upload: over-limit body `413` before parsing; malformed Turtle `400`
  without stack trace; a huge-literal file does not exhaust memory.

## Validation

Kotlin gate; compose smoke for the body limit through Caddy.

## Conclusion
