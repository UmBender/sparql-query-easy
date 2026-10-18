# SPARQL EasyQuery

SPARQL EasyQuery is a graph-query application originally built with ASP.NET
Core/.NET 8 and dotNetRDF. Kotlin/JVM, Ktor, and Apache Jena provide the current
runtime. The retired C# source is recoverable from Git commit `0f20091`; its
reviewed compatibility captures remain in this repository.

## Current status

- All original controller routes and identified application-service use cases
  have Kotlin implementations.
- The reviewed C# characterization baseline contains 34 captures under
  `compatibility/expected/`.
- Three additional C# retirement success captures are kept separately under
  `compatibility/retirement-expected/`. Wikidata and generic remote SPARQL
  outputs match Kotlin. Kotlin's JSON health response is an approved intentional
  difference from the C# plain-text capture.
- The offline Kotlin comparator executes every valid capture and checks HTTP
  output, graph isomorphism, generated/executed SPARQL, projected variables,
  bindings, RDF terms, duplicate rows, and explicit ordering.
- Six C# exception-category captures are intentionally not HTTP-equivalence
  baselines because the in-process harness did not execute ASP.NET middleware.
  Kotlin's explicit JSON `400`/`404`/`502` behavior is the approved contract.
- The SvelteKit app in `frontend/` is the only frontend (FE-049 retired the
  legacy `index2.html` page after every parity row passed on the new app).
  Its offline browser tests and the real-stack suite contact no live service.

The remaining work is production hardening and approved additions rather than
another core feature port. OpenAPI 3.1 and Swagger UI are generated from the
Ktor route contract and tested for drift. Accounts (self-registration,
Argon2id, PostgreSQL sessions) are implemented (AUTH-001/AUTH-003). Recorded Wikidata route fixtures, production
endpoint/upload policy, TLS/CORS, deployment, monitoring, and
backup remain open.

The legacy .NET deployment workflow is archived outside the active GitHub
Actions directory on the Kotlin branch. No Kotlin deployment workflow or
hosting target is selected yet; see the
[archived workflow note](tcc/07%20-%20Operations/Archived%20.NET%20Deployment%20Workflow.md).

## Run locally

Requirements: JDK 21 and Node.js 22.

1. Start the Ktor API on port 8080 (accounts need `EASYQUERY_DB_URL`, see
   `.env.example`; query routes work without a database):

   ```sh
   ./gradlew run
   ```

2. Install and start the frontend (npm 11 installs its lockfile):

   ```sh
   (cd frontend && npx npm@11 ci && npm run dev)
   ```

3. Open `http://localhost:5173/`. Vite forwards `/api`, `/health` and
   `/openapi.json` to Ktor, so the browser sees one origin. Swagger UI is at
   `http://localhost:8080/swagger`.

The whole stack (PostgreSQL, Ktor, Caddy serving the built app) runs with
`docker compose up -d --build --wait` after setting `POSTGRES_PASSWORD` in
`.env`; see the [Compose runbook](tcc/07%20-%20Operations/Docker%20Compose%20Stack.md).
Ktor alone serves only the API.

## Verification

```sh
GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle \
  ./gradlew ktlintCheck detekt test --no-daemon
npm --prefix frontend run check
npm --prefix frontend run lint
npm --prefix frontend test
npm --prefix frontend run test:stack
```

The Kotlin tests and `test:stack` start PostgreSQL (`postgres:17-alpine`) in
Docker through Testcontainers, so they need a running Docker daemon reachable
by your user. CI (`.github/workflows/ci.yml`) runs the same gates. The live Wikidata
integration task is opt-in and is not part of normal validation.

## Documentation

- [Migration history and decisions](MIGRATION.md)
- [Current compatibility report](MIGRATION_REPORT.md)
- [Characterization corpus](compatibility/README.md)
- [Current remaining work](remaining.md)
- [Obsidian knowledge-base home](tcc/00%20-%20Home.md)
- [Task index](tcc/90%20-%20Tasks/TASKS.md)

## Source landmarks

- `src/main/kotlin/com/example/sparqlqueryeasy/Application.kt` — Kotlin entry
  point.
- `src/main/kotlin/com/example/sparqlqueryeasy/http/HttpModule.kt` — Ktor
  routes and default composition.
- `src/main/kotlin/com/example/sparqlqueryeasy/http/OpenApiModule.kt` —
  generated OpenAPI metadata and documentation routes.
- `frontend/` — the SvelteKit frontend (DEC-011, authoritative since FE-049).
- `compose.yaml`, `deploy/` — local Docker Compose stack (OPS-006).
- `compatibility/expected/index.json` — immutable original C# case index.
- `compatibility/retirement-expected/index.json` — three additional C# success
  captures retained after C# source removal.
- `src/test/kotlin/com/example/sparqlqueryeasy/http/CaptureDrivenCompatibilityTest.kt`
  — capture-driven comparator.
