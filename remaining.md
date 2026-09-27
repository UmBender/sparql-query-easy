# Remaining work

All identified core C# application features are ported. Kotlin implements
local graph upload/cache, built-in graph loading, endpoint selection, SPARQL
generation/execution, Wikidata search/transport, result filtering, both C#
controllers, and all five `QueryController` routes.

The reviewed baseline contains 34 C# harness captures. Kotlin's offline
capture-driven suite compares every valid case through the route/service
boundary. Six exception-only captures remain intentional non-equivalences
because they do not contain an ASP.NET middleware response; Kotlin's explicit
JSON `400`/`404`/`502` contract is approved.

## Approved additions and deferred decisions

- `AUTH-000` must define identity, session, authorization, cookie/CSRF, and
  registration/recovery behavior before `AUTH-001` and `AUTH-002` implement
  login and frontend integration.
- `OAPI-001` is complete: code-generated OpenAPI 3.1 is public at
  `/openapi.json`, Swagger UI is public at `/swagger`, and automated validation
  covers all eight operations. Authentication requirements will be added only
  after `AUTH-000` is approved.

## Compatibility and production work

- `QUAL-001` replays a provenance-recorded public Wikidata success body and
  controlled `429`/malformed bodies through Ktor offline. The C# success route
  and one generic remote SPARQL route are now captured separately from the
  original 34 and compared with Kotlin; middleware-error equivalence was
  explicitly waived.
- `DEC-009`: decide whether to approve Kotlin's JSON `/health` response as an
  intentional change or align it to captured C# `text/plain Healthy`.
- `SEC-001`: decide production remote-endpoint and upload/cache limits.
- `OPS-001` provides local JVM/container packaging. `OPS-002`–`OPS-004`
  still define hosting, DNS/TLS, restrictive production CORS, deployment,
  monitoring, backup, and recovery.
- `REPO-001`: stop tracking thesis reference PDFs while preserving local
  copies; no history rewrite is approved.
- `BUG-002` is complete: relationship and relationship-value executor failures
  use the approved JSON `502` envelope.

Port `8080` is an approved intentional development change, not unfinished C#
port parity. Local frontend and API requests are same-origin through Ktor, so
CORS is deliberately deferred until a production frontend domain exists.
Deterministic Playwright tests already cover the authoritative frontend's
search-to-node, upload, relationship, query, and node-action-menu flows.

See `tcc/90 - Tasks/TASKS.md` and `tcc/90 - Tasks/BLOCKERS.md` for authoritative
task state and human gates.
