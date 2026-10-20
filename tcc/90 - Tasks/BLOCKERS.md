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

## DEC-015 — T9 brief vs STUDY-002

The T9 brief differs from STUDY-002, D5 and DEC-014 Q6 in six points.
STUDY-008/009/010/011 stay BACKLOG until the user decides.

**Question:** Q1 consent gates only the forms, or the forms and the proposed
tasks? Q2 form definitions from versioned files synced to a table, or admin
routes? Q3 profile before the tasks and usability after the final
submission, or both free on `/study`? Q4 per-page progress in the browser, or
a server draft table? Q5 export with the internal user id, or also the
username? Q6 one response per form, or one per form version?
(Recommended: forms and tasks, files, before/after, browser, user id only,
one per form.) The real questions and consent text are also the user's.
