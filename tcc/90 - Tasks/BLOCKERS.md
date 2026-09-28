# Project Blockers

## DEV-002 and DEC-008 — Ordered query exploration is paused

The user will revise `AGENTS.md`, the development loop, testing/branch policy,
and per-task commit practice before any new ordered-query implementation task
starts. `DEV-002` remains `BLOCKED` until that process is available and
approved. `DEC-008` remains `BLOCKED` until the exact 2+ variable behavior is
approved. The intended numbered Scratch-like order menu and hover/focus
next-variable preview are recorded, but limits, RDF binding contract, final
result action, and the node-versus-predicate-variable scope are unresolved.
Do not run `INV-002`, `API-002`, `BE-001/002`, `FE-005/006/008/009/010`, or
`QUAL-002` under the old task loop.

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

OPS-001 defines local JVM/container packaging. Production domain, hosting,
security, TLS/CORS, monitoring, and backup decisions are still open under
OPS-002–OPS-004 and SEC-001. No deployment or infrastructure mutation is
authorized; see [[../07 - Operations/Local JVM and Container Runtime]].

## AUTH-000 — Authentication contract

Authentication is intentionally deferred until user testing. Its eventual
implementation is approved, but credentials, sessions,
anonymous access, protected routes, cookie/CSRF/rate-limit policy, and
registration/recovery scope are not.

**Question when this work resumes:** Approve the recommended first
contract—environment-configured
bootstrap user(s) with password hashes, server-side same-origin session cookie,
no anonymous graph/API access, public login/logout/session and health routes,
no registration/password recovery, and public Swagger/OpenAPI documentation—or
specify the changes.
