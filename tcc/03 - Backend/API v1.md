# API v1 — Kotlin/Ktor Current Contract

**Status:** Current source-derived development contract. The routes themselves
are not URL-versioned; “v1” identifies this documented contract revision.

**Base URL:** `http://localhost:8080` in the checked-in development
configuration. JSON uses `application/json`. Successful API responses use
`{"data": ...}`. Application-owned failures use `{"error":"<diagnostic>"}`.
Kotlin serialization emits `null` fields explicitly.

## Shared representations

### Property item

Every query result is a `PropertyDtoResponse`. `propertyType` and
`propertyClass` are present with `null` when that route does not provide them.

```json
{
  "propertyId": "<https://example.test/item>",
  "propertyLabel": "Item",
  "propertyType": "objetoClasse",
  "propertyClass": "<https://example.test/Class>"
}
```

### Error response

```json
{ "error": "Missing required field: variableName" }
```

`400` represents malformed JSON, missing/invalid route input, invalid endpoint
text, or invalid generated SPARQL. `404` represents a missing or expired local
RDF graph. `502` represents an upstream SPARQL/endpoint execution failure.
Unexpected failures have no separately versioned application error envelope.

### Query terms and filters

Values used as query `subject`/`predicate`, relationship `id`, and relationship
identifiers must be a SPARQL variable (for example `?item`) or an angle-bracket
IRI (for example `<https://example.test/p>`). A slash-separated sequence of
angle-bracket IRIs is accepted as a safe property-path subset. Query objects
may additionally be a literal string or `[]` for a blank node.

`filterType` is numeric: `0` Starts, `1` Contains, `2` Greater-or-equal, `3`
Less-or-equal, `4` Maximum, and `5` Minimum. An omitted `filterType` produces
no filter. The `/api/query/sparql` display route deliberately ignores a
provided `filterType`, preserving C# behavior.

## Routes

### `GET /`

Returns `302 Found` redirecting to `/index2.html`.

There is no application-owned error response for this redirect route.

### `GET /health`

Returns `200 OK`:

```json
{ "status": "ok" }
```

There is no application-owned error response for this route.

### `POST /api/local-database`

Accepts `multipart/form-data` with one file field named `ttlFile`. The first
such file is parsed as Turtle and placed into a process-local, 12-hour sliding
cache.

Success (`200 OK`):

```json
{ "data": "00000000-0000-0000-0000-000000000001" }
```

The identifier is an opaque UUID-like handle; it is not durable across process
restart or cache eviction.

Failures (`400 Bad Request`):

```json
{ "error": "Missing required upload: ttlFile" }
```

An invalid Turtle document also returns `400` with its parser diagnostic (or
`Invalid Turtle` when no diagnostic is available). It is not cached.

### `POST /api/query/relationships`

Request fields and defaults:

```json
{
  "endpointUrl": "https://query.wikidata.org/sparql",
  "limit": 20,
  "id": "<http://www.wikidata.org/entity/Q529207>"
}
```

`limit` is accepted for C# shape compatibility; the service does not consume it
for this operation.

Success (`200 OK`):

```json
{
  "data": [{
    "propertyId": "<https://example.test/p>",
    "propertyLabel": "Property",
    "propertyType": "objeto",
    "propertyClass": null
  }]
}
```

Failures use the shared `400`, `404`, or `502` response as applicable.

### `POST /api/query/relationship-value`

Request fields and defaults:

```json
{
  "endpointUrl": "https://query.wikidata.org/sparql",
  "limit": 20,
  "subjectId": "<https://example.test/item>",
  "predicateId": "<https://example.test/p>",
  "isLiteral": false
}
```

`subjectId` and `predicateId` are required. `limit` is accepted for C# shape
compatibility but unused.

Success (`200 OK`, resource form):

```json
{
  "data": [{
    "propertyId": "<https://example.test/value>",
    "propertyLabel": "Value",
    "propertyType": null,
    "propertyClass": null
  }]
}
```

When `isLiteral` is true, `propertyId` and `propertyLabel` carry the literal
lexical text and `propertyType` is `"text"`. Missing identifiers return `400`,
for example `{"error":"Missing required field: subjectId"}`; other failures
use the shared `400`, `404`, or `502` response.

### `POST /api/query/search`

Request fields and defaults:

```json
{
  "endpointUrl": "https://query.wikidata.org/sparql",
  "limit": 20,
  "search": "football"
}
```

`search` may be null or omitted and then behaves as an empty search.

Success (`200 OK`):

```json
{
  "data": [{
    "propertyId": "<https://example.test/item>",
    "propertyLabel": "Item",
    "propertyType": "objetoClasse",
    "propertyClass": null
  }]
}
```

An empty search returns `{"data":[]}`. Local graph results are filtered to
`objetoClasse` and capped at 20; a Wikidata endpoint uses its separate entity
search client. Failures use the shared `400`, `404`, or `502` response.

### `POST /api/query`

Request fields and defaults:

```json
{
  "endpointUrl": "https://query.wikidata.org/sparql",
  "limit": 20,
  "variableName": "?item",
  "ignoreWikidata": true,
  "where": [{
    "subject": "?item",
    "predicate": "<http://www.w3.org/2000/01/rdf-schema#label>",
    "object": "example",
    "filterType": 0
  }]
}
```

`variableName` and `where` are required; `where` may be an empty array. The
empty form produces the broad query form and filters results to
`objetoClasse`. `ignoreWikidata` controls whether the general query requests
Wikidata labels when the resolved endpoint is Wikidata.

Success (`200 OK`):

```json
{
  "data": [{
    "propertyId": "<https://example.test/item>",
    "propertyLabel": "Item",
    "propertyType": "objetoClasse",
    "propertyClass": "<https://example.test/Class>"
  }]
}
```

Missing `variableName`, missing `where`, invalid terms/filters, malformed JSON,
or invalid generated SPARQL return `400`; unavailable local graph returns
`404`; execution failure returns `502`.

### `POST /api/query/sparql`

Uses exactly the same request structure and validation as `POST /api/query`,
but generates and returns SPARQL without executing it. `ignoreWikidata` is not
used by this route and `filterType` is intentionally ignored.

Success (`200 OK`):

```json
{ "data": "SELECT DISTINCT ?item WHERE { ... } LIMIT 20" }
```

Missing/invalid input or invalid generated query returns `400`; an unavailable
local graph returns `404`. This route does not perform remote execution, so it
does not produce the route's `502` execution response.

## Endpoint selection

`endpointUrl` accepts the built-in identifier `CampeonatoBrasileiro2023`, an
uploaded graph handle, or a remote absolute HTTP(S) endpoint with a host. The
Wikidata behavior is selected when the endpoint contains the documented
Wikidata marker. An invalid remote endpoint produces `400`; a syntactically
valid but unavailable local handle produces `404`.

## C# compatibility differences

- C# development URLs were HTTP `5242` and HTTPS `7070`; Kotlin's approved
  development port is HTTP `8080`.
- C# allowed framework/controller exceptions to decide many error responses.
  Kotlin's explicit JSON `400`/`404`/`502` responses are an approved contract
  change. The C# in-process captures for malformed JSON, missing upload,
  missing local graph, invalid Turtle, and invalid query are exception evidence,
  not C# HTTP response equivalence baselines.
- Kotlin adds the root redirect and static frontend hosting. C# instead exposed
  Swagger, HTTPS redirection, and broad CORS middleware; production CORS/TLS
  configuration remains deferred.

## Source files

- `src/main/kotlin/com/example/sparqlqueryeasy/http/HttpModule.kt`
- `src/main/kotlin/com/example/sparqlqueryeasy/http/QueryHttpModels.kt`
- `src/main/kotlin/com/example/sparqlqueryeasy/application/query/ResultFilteringService.kt`
- `src/main/kotlin/com/example/sparqlqueryeasy/application/query/GeneralQueryService.kt`
- `src/main/kotlin/com/example/sparqlqueryeasy/application/querygeneration/SparqlQueryGenerationService.kt`
- `src/test/kotlin/com/example/sparqlqueryeasy/http/QueryRoutesTest.kt`
- `src/test/kotlin/com/example/sparqlqueryeasy/http/LocalDatabaseRoutesTest.kt`
- `src/test/kotlin/com/example/sparqlqueryeasy/ApplicationTest.kt`
- `Sparql.QueryEasy/Controllers/QueryController.cs`
- `Sparql.QueryEasy/Controllers/LocalDatabaseController.cs`
