---
id: QUAL-021
title: Stop remote endpoints from reaching internal hosts and bound uploads
status: DONE
priority: P1
type: quality
depends_on: []
human_gate: false
created: 2026-10-27
updated: 2026-10-28
---
# Stop remote endpoints from reaching internal hosts and bound uploads

## Objective

Security plan threats 7–8 ([[../../08 - Quality/Security Test Plan]]).
`RemoteSparqlEndpoint.parse` accepts any http(s) host, so a request can
make the server call `localhost`, the `db` container or cloud metadata
(`169.254.169.254`), or hosts of the university network where the app will be deployed (user, 2026-10-27). Skills: `tcc-backend`, `tcc-test`.

## Decision (user, 2026-10-27): A, allowlist

## Decisions (user, 2026-10-28): READY

- Remote endpoints (A): allowlist with only the Wikidata query endpoint
  (`https://query.wikidata.org/sparql`) and the built-in graphs; any other
  remote `endpointUrl` is `400`.
- Turtle upload limit: 5 MB; above it `413` before any parsing.
- An uploaded graph stays readable by anyone who has its id (a GUID).
- SEC-001 is merged here (cancelled, superseded by this card): its cache
  and limit scope is covered by this card and QUAL-023.

## Options considered

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

Done 2026-10-28. `endpointUrl` must be a built-in graph id, an uploaded
graph id or exactly `https://query.wikidata.org/sparql`
(`REMOTE_ENDPOINT_ALLOWLIST`); anything else is 400 `Remote endpoint is not
allowed: …` before any request. The shared Wikidata client no longer
follows redirects (`remoteClientPolicy`). The Turtle upload is capped at
5 MiB (`MAX_UPLOAD_BODY_BYTES`, 413 before parsing, declared or streamed).
Uploaded graphs stay readable by id (documented). Results and the changed
old-behavior tests: [[../../08 - Quality/Security Test Plan#QUAL-021 results (2026-10-28)]];
contract: [[../../03 - Backend/API v1#Endpoint selection]].

Limitations: the compose smoke was not run for this task (Docker was in use
by other work); Caddy sets no `request_body` limit, so 5 MiB reaches the
backend, but no compose assertion was added. The OpenAPI upload operation
does not list 413 (like QUAL-023's routes). The editor's free "SPARQL
endpoint" text field (`#input-endpoint-sparql`) still accepts any URL; the
server now refuses anything but the allowlist, and the browser suites that
type `https://example.test/sparql` use the mock API.

## Execution log

- 2026-10-27: Decision A (allowlist).
- 2026-10-28: Upload limit and graph access decided; SEC-001 merged here.
  Implemented; Kotlin gate (`ktlintCheck detekt test`) green.
