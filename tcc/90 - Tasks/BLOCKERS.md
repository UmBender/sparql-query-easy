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

## University server facts (OPS-002, OPS-004, OPS-005, OPS-011)

DEC-003 chose the university server with Docker Compose. Go-live stays
blocked until these are known:

**Questions:** the checklist for the university IT in
[[../07 - Operations/University Server Checklist]] (DOC-005): access, network,
DNS name and HTTPS, machine, off-host backup location, operations. The four
open facts are still public 80/443 reachability, DNS name and TLS issuer,
deploy access and the off-host backup location.

## DEC-018 — T12 cutover brief

FE-049 already made the SvelteKit app the only frontend. FE-054, DOC-006 and
QUAL-018 wait for the user's answers to Q1–Q5 in
[[items/DEC-018-t12-cutover-brief-differences]] (hidden legacy path, kept
oracles, superseded marks, user guide location, tour text and video).
DOC-007 does not wait.
