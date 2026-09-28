# Backend and API Contract

The complete source-derived current contract is [[API v1]]. This inventory is
kept as a concise architecture reference; update both notes when the public
HTTP contract changes.

## Entry points

| Status | Entry point | Behavior |
|---|---|---|
| Historical | `Sparql.QueryEasy/Program.cs` | Removed C# bootstrap and middleware; recoverable from Git commit `0f20091`. |
| Confirmed | `Application.kt` | Ktor `EngineMain` bootstrap. |
| Confirmed | `application.conf` | Kotlin port `8080`. |
| Confirmed | `OpenApiModule.kt` | Public generated OpenAPI 3.1 JSON at `/openapi.json` and Swagger UI at `/swagger`. |

## HTTP routes

| Route | Request | Success response | Kotlin error contract |
|---|---|---|---|
| `GET /` | none | redirect to `/index2.html` | Unverified for production proxy behavior |
| `GET /health` | none | `{"status":"ok"}` | none documented |
| `POST /api/local-database` | multipart `ttlFile` | `{"data":"<uuid>"}` | `400 {"error":"..."}` for missing/invalid Turtle |
| `POST /api/query` | `endpointUrl`, `limit`, `where`, `variableName`, `ignoreWikidata` | `{"data":[PropertyDto]}` | `400`, `404`, `502` JSON errors |
| `POST /api/query/sparql` | general-query body | `{"data":"<SPARQL>"}` | `400`, `404` JSON errors |
| `POST /api/query/relationships` | `endpointUrl`, `id` | `{"data":[PropertyDto]}` | `400`, `404`, `502` JSON errors |
| `POST /api/query/relationship-value` | `endpointUrl`, `subjectId`, `predicateId`, `isLiteral` | `{"data":[PropertyDto]}` | `400`, `404`, `502` JSON errors |
| `POST /api/query/search` | `endpointUrl`, `search`, `limit` | `{"data":[PropertyDto]}` | `400`, `404`, `502` where applicable |

`PropertyDto` is serialized as `propertyId`, `propertyLabel`, optional `propertyType`, and optional `propertyClass`.

## Query/filter contract

**Confirmed:** `filterType` is numeric: `0 Starts`, `1 Contains`, `2 Greater`, `3 Lesser`, `4 Max`, `5 Min`. Kotlin accepts these integers and preserves `0`.

**Intended:** Kotlin explicit JSON errors are the approved behavior replacing C# framework/controller exceptions. The C# harness captures exceptions, not real ASP.NET middleware responses, for several invalid cases.

## RDF and endpoint behavior

- Built-in endpoint identifier: `CampeonatoBrasileiro2023`.
- Uploaded graphs are UUID-addressed in an in-memory 12-hour sliding cache.
- Wikidata is identified by a case-sensitive endpoint substring and uses a separate MediaWiki entity search client.
- Local RDF execution uses Jena. Remote execution uses Ktor HTTP.

## Source files

- `src/main/kotlin/com/example/sparqlqueryeasy/http/HttpModule.kt`
- `src/main/kotlin/com/example/sparqlqueryeasy/http/QueryHttpModels.kt`
- `src/main/kotlin/com/example/sparqlqueryeasy/http/OpenApiModule.kt`
- `Sparql.QueryEasy/Controllers/QueryController.cs`
- `Sparql.QueryEasy/Controllers/LocalDatabaseController.cs`
- `Sparql.QueryEasy/Requests/QueryRequests.cs`
