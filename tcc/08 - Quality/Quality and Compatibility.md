# Quality and Compatibility

## Existing coverage

**Confirmed:** Kotlin tests cover domain values, Jena parsing/execution, graph cache/upload, endpoint selection, query generation, filtering, relationships, search, HTTP routes, static frontend serving, and Wikidata clients.

**Confirmed:** C# has no ordinary application test project. `compatibility/Compatibility.Harness` is the characterization mechanism.

**Confirmed:** `HttpModuleLifecycleTest` verifies that an owned application
resource is closed exactly once when the Ktor application stops. It prevents
the default shared CIO HTTP client from leaking across application shutdown.

## OpenAPI contract coverage

`OpenApiRoutesTest` uses three complementary offline test styles:

1. **HTTP smoke tests** fetch `/swagger` and `/openapi.json` and verify status,
   media type, and rendered UI content.
2. **Specification validation** parses the generated OpenAPI 3.1 JSON with the
   external Swagger Parser library and rejects validator messages.
3. **Drift/semantic assertions** compare the exact route-method inventory and
   inspect multipart `ttlFile`, request defaults, numeric filter values,
   nullable response fields, status responses, operation metadata, and the
   deliberate absence of security requirements.

Other valid approaches for future expansion are snapshot comparison (useful
for reviewed public contract releases but noisy for harmless ordering),
consumer-driven contract tests (useful once other clients exist), and generated
client compilation/execution (useful when a supported SDK becomes a product
deliverable). They complement rather than replace the current structural and
runtime checks.

## Browser coverage

Browser-level frontend workflows are covered offline by Playwright Firefox in
`frontend-tests/index2.spec.mjs`. It uses the actual static page, test-local
API responses, and CDN stubs. Coverage includes the persistent node-action
list's real left-click opening, retargeting, keyboard activation, node-type
actions, background dismissal, conversion/removal, edge rewiring, and
viewport positioning; run `npm run test:browser`. Broader visual-regression
and accessibility auditing remains outside the current suite. See
[[04 - Frontend/Request Flows]].

## Coverage gaps

- Recorded Wikidata success/error fixtures replayed through Ktor routes.
- CORS, TLS/reverse-proxy, deployment, resource-limit, backup, and monitoring
  tests.
- Explicit production behavior for remote endpoint policy and uploads.
- C# black-box health/middleware responses and a generic remote-endpoint
  comparison beyond the current in-process harness.

## RDF parity rules

Use graph isomorphism for graphs/blank-node labels, but preserve blank-node identity relationships in SELECT rows. Do not normalize literal lexical form, datatype, language, bindings, duplicate rows, or explicit ordering. Only documented literal-variable suffix normalization is allowed for generated SPARQL.

## Source files

- `AGENTS.md`
- `compatibility/README.md`
- `src/test/kotlin/com/example/sparqlqueryeasy/`
- `src/test/kotlin/com/example/sparqlqueryeasy/http/CaptureDrivenCompatibilityTest.kt`
- `src/test/kotlin/com/example/sparqlqueryeasy/http/OpenApiRoutesTest.kt`
- `frontend-tests/index2.spec.mjs`
- `frontend-tests/cdn-stubs.mjs`
