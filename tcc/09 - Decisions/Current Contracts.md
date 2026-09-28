# Current Contracts

This is the canonical compact register for active development decisions.
Follow linked details only for the contract being changed. Historical phase
notes remain evidence; they do not reopen resolved decisions.

| Area | Active contract and evidence |
|---|---|
| Runtime | Kotlin/Ktor; local port 8080, frontend/API same origin. Production domain, TLS/CORS and hosting deferred. `application.conf`; [[Open Decisions]]; OPS-001/002/003/005. |
| Frontend | `sparql/index2.html` authoritative; retain numeric filterType 0. [[../04 - Frontend/Frontend Architecture]]; `frontend-tests/index2.spec.mjs`. |
| Errors | Explicit JSON 400 invalid input, 404 local graph unavailable, 502 upstream failure; C# exception captures are not HTTP-equivalent. [[../03 - Backend/API v1]]; `http/HttpModule.kt` (under Kotlin package root). |
| Health | DEC-009 approves 200 JSON `{"status":"ok"}`; recorded C# plaintext remains non-equivalent. [[../90 - Tasks/items/DEC-009-health-response-contract]]. |
| OpenAPI | OAPI-000: code-generated 3.1 at /openapi.json and /swagger, public in all environments for now. [[OpenAPI and Swagger Contract]]. |
| Authentication | Deferred to user testing; AUTH-000 choices remain blocked. Do not implement auth as a side effect. [[Open Decisions]]. |
| RDF/compatibility | Jena behind application types; exact RDF terms/binding presence/duplicates; unordered rows as multisets, ORDER BY order preserved. `http/CaptureDrivenCompatibilityTest.kt` under tests. |
| Baseline | Keep original 34 + separate 3 retirement captures, provenance and expected JSON. C# source retired; no recapture without a specific decision. [[../05 - Migration/CSharp Retirement Readiness]]. |
| Built-in graph | DATA-001: retain byte-identical canonical C# asset in `src/main/resources/futebol_completo.ttl`. [[Brazilian Dataset Decision]]. |
| Menus/predicates | Left-click node action list, background dismissal; predicate choice binds edges in place. [[../04 - Frontend/Predicate Variable Edge Contract]]. |
| Multiple variables | Current exactly-two panel sends no candidate call; repeated parallel predicate alternatives are rejected. Ordered 2+ exploration is intended and still needs DEC-008. [[../04 - Frontend/Two Variable Exploration Contract]]. |
| Git/vault | Markdown versioned; PDFs to be untracked through REPO-001 preserving local copies. Automatic local task commits; push/merge/deploy only with explicit authorization. [[Development Workflow]]. |

## Source files

- `src/main/kotlin/com/example/sparqlqueryeasy/http/HttpModule.kt`
- `src/test/kotlin/com/example/sparqlqueryeasy/http/CaptureDrivenCompatibilityTest.kt`
- `compatibility/cases/capture-status.tsv`
- `sparql/index2.html`
- `AGENTS.md`
