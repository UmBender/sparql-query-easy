# Project Blockers

## DEC-009 — Captured health response

The actual C# host returns `200 text/plain Healthy`; Kotlin returns `200`
JSON `{"status":"ok"}`. The success-status match does not make the response
equivalent. Before `MIG-002` can remove C#, choose whether to approve Kotlin
JSON as an intentional difference or align Kotlin to the C# body/content type.
The three approved C# success captures are complete; additional C#
middleware-error equivalence was explicitly waived.

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
