# Project Blockers

## DEC-008 — Ordered query product decisions

The user supplied and authorized DEV-001 to revise the development policy;
DEV-002 is superseded and does not require another process approval.
`DEC-008` remains `BLOCKED` until the exact 2+ variable behavior is
approved. The intended numbered Scratch-like order menu and hover/focus
next-variable preview are recorded, but limits, RDF binding contract, final
result action, and the node-versus-predicate-variable scope are unresolved.
The implementation cards remain BACKLOG; DEV-001 does not authorize running
the ordered-query feature or a frontend stack migration.

**Decision question after the workflow update:** Should ordering and preview
include predicate variables as well as variable nodes, and should hover show
only the next variable's candidates (recommended) or also mutate a temporary
graph preview? Confirm request caps and final selection behavior in DEC-008.

## MIG-002 — Resolved C# removal gate

DEC-009 is resolved: the user approved Kotlin's `200 application/json`
`{"status":"ok"}` health response as an intentional difference from the
captured C# `200 text/plain Healthy`. The two responses are not equivalent.
The three approved C# success captures are complete; additional C#
middleware-error equivalence was explicitly waived. The user approved the
24-file C# removal scope and repository rollback plan; those files are deleted
locally and post-deletion tests passed. After the diff was checked against the
approved manifest, the user requested commit and push. See
[[../05 - Migration/CSharp Removal Review]].
The .NET YAML is archived in the integrated `main` tree, outside
`.github/workflows/`. The user reports no enabled workflow in the fork's
Actions UI. The archive change accompanies the removal diff;
remote workflow disablement is not a separate blocker. Production deployment
decisions remain deferred.

## Production operations tasks

OPS-001 defines local JVM/container packaging. Hosting is decided (DEC-003,
university server); domain, TLS, monitoring, backup and security limits are
still open under OPS-002, OPS-004, OPS-005 and SEC-001. No deployment or infrastructure mutation is
authorized; see [[../07 - Operations/Local JVM and Container Runtime]].

## University server facts (OPS-002, OPS-004, OPS-005)

DEC-003 chose the university server with Docker Compose. Go-live stays
blocked until these are known:

**Questions:** Is the server publicly reachable on 80/443? Under which DNS
name, and who issues its TLS certificate (Let's Encrypt or the university)?
How can a deploy reach it (SSH, VPN, nothing from GitHub)? Where can off-host
database backups be stored?

## DEC-012 — Test database engine

The T6 brief asks for Testcontainers; BE-005 chose embedded PostgreSQL 17
(no Docker, offline). Nothing changes until the user decides.

**Question:** Keep embedded PostgreSQL (recommended), switch every
persistence test to Testcontainers, or keep embedded and add one opt-in
Testcontainers smoke outside the normal gate?
