# Quality and Compatibility

## Existing coverage

**Confirmed:** Kotlin tests cover domain values, Jena parsing/execution, graph cache/upload, endpoint selection, query generation, filtering, relationships, search, HTTP routes, static frontend serving, and Wikidata clients.

**Confirmed:** C# has no ordinary application test project. `compatibility/Compatibility.Harness` is the characterization mechanism.

**Confirmed:** `HttpModuleLifecycleTest` verifies that an owned application
resource is closed exactly once when the Ktor application stops. It prevents
the default shared CIO HTTP client from leaking across application shutdown.

## Coverage gaps

- Browser-level frontend workflows are covered offline by Playwright Firefox in
  `frontend-tests/index2.spec.mjs`. It uses the actual static page, test-local
  API responses, and CDN stubs. Coverage includes the persistent node-action
  list's real left-click opening, retargeting, keyboard activation, node-type
  actions, background dismissal, conversion/removal, edge rewiring, and
  viewport positioning; run `npm run test:browser`. Broader visual-regression
  and accessibility auditing remains outside the current suite. See
  [[04 - Frontend/Request Flows]].
- Recorded Wikidata success/error fixtures replayed through Ktor routes.
- CORS, TLS/reverse-proxy, deployment, resource-limit, backup, and monitoring tests.
- Explicit production behavior for remote endpoint policy and uploads.

## RDF parity rules

Use graph isomorphism for graphs/blank-node labels, but preserve blank-node identity relationships in SELECT rows. Do not normalize literal lexical form, datatype, language, bindings, duplicate rows, or explicit ordering. Only documented literal-variable suffix normalization is allowed for generated SPARQL.

## Source files

- `AGENTS.md`
- `compatibility/README.md`
- `src/test/kotlin/com/example/sparqlqueryeasy/`
- `src/test/kotlin/com/example/sparqlqueryeasy/http/CaptureDrivenCompatibilityTest.kt`
- `frontend-tests/index2.spec.mjs`
- `frontend-tests/cdn-stubs.mjs`
