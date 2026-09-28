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
- Deterministic browser tests cover the authoritative `sparql/index2.html`
  workflows. Ordinary tests do not contact live Wikidata.

The remaining work is production hardening and approved additions rather than
another core feature port. OpenAPI 3.1 and Swagger UI are generated from the
Ktor route contract and tested for drift. Authentication is intentionally
deferred until user testing. Recorded Wikidata route fixtures, production
endpoint/upload policy, TLS/CORS, deployment, monitoring, and
backup remain open.

The legacy .NET deployment workflow is archived outside the active GitHub
Actions directory on the Kotlin branch. No Kotlin deployment workflow or
hosting target is selected yet; see the
[archived workflow note](tcc/07%20-%20Operations/Archived%20.NET%20Deployment%20Workflow.md).

## Run locally

Requirements: JDK 21. Start the Kotlin/Ktor application on the approved local
development port `8080`:

```sh
./gradlew run
```

Then open `http://localhost:8080/`; Ktor redirects to the packaged frontend.
Swagger UI is at `http://localhost:8080/swagger`, and the raw generated
OpenAPI 3.1 JSON is at `http://localhost:8080/openapi.json`.

For a local JVM distribution, run `./gradlew installDist`, then
`./build/install/sparql-query-easy-kotlin/bin/sparql-query-easy-kotlin`.
An optional Docker build is available with
`docker build -t sparql-query-easy:local .`; it uses Java 21, listens on
port `8080`, and checks `/health`. This is local packaging, not a deployment
pipeline. See [the runtime notes](tcc/07%20-%20Operations/Local%20JVM%20and%20Container%20Runtime.md).

## Verification

```sh
GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle \
  ./gradlew ktlintCheck detekt test --no-daemon
npm run test:browser
```

The live Wikidata integration task is opt-in and is not part of normal
validation.

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
- `sparql/index2.html` — authoritative static frontend.
- `compatibility/expected/index.json` — immutable original C# case index.
- `compatibility/retirement-expected/index.json` — three additional C# success
  captures retained after C# source removal.
- `src/test/kotlin/com/example/sparqlqueryeasy/http/CaptureDrivenCompatibilityTest.kt`
  — capture-driven comparator.
