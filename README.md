# SPARQL EasyQuery

SPARQL EasyQuery is a graph-query application with an original ASP.NET
Core/.NET 8 and dotNetRDF implementation and a Kotlin/JVM, Ktor, and Apache
Jena migration. The repository retains the C# application as compatibility
evidence while Kotlin provides the current development runtime.

## Current status

- All original controller routes and identified application-service use cases
  have Kotlin implementations.
- The reviewed C# characterization baseline contains 34 captures under
  `compatibility/expected/`.
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
endpoint/upload policy, containers, TLS/CORS, deployment, monitoring, and
backup remain open.

## Run locally

Requirements: JDK 21. Start the Kotlin/Ktor application on the approved local
development port `8080`:

```sh
./gradlew run
```

Then open `http://localhost:8080/`; Ktor redirects to the packaged frontend.
Swagger UI is at `http://localhost:8080/swagger`, and the raw generated
OpenAPI 3.1 JSON is at `http://localhost:8080/openapi.json`.

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
- `Sparql.QueryEasy/Program.cs` — retained C# entry point.
- `src/test/kotlin/com/example/sparqlqueryeasy/http/CaptureDrivenCompatibilityTest.kt`
  — capture-driven comparator.
