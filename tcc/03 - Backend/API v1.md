# API v1 — Kotlin/Ktor Current Contract

**Status:** Current source-derived development contract. The routes themselves
are not URL-versioned; “v1” identifies this documented contract revision.

**Base URL:** `http://localhost:8080` in the checked-in development
configuration. JSON uses `application/json`. Successful API responses use
`{"data": ...}`. Application-owned failures use `{"error":"<diagnostic>"}`.
Kotlin serialization emits `null` fields explicitly.

## Interactive and machine-readable documentation

**Confirmed:** Ktor generates an OpenAPI 3.1 document from runtime route
metadata. The raw JSON is public at `GET /openapi.json` and Swagger UI is
public at `GET /swagger` in every environment. Neither endpoint nor any
application operation has an OpenAPI security requirement yet because
authentication is explicitly deferred until user testing. No production
server hostname is embedded in the document.

The OpenAPI inventory covers the nine operations below exactly once. Static
frontend resources are intentionally excluded. Route metadata is maintained
in `OpenApiModule.kt`; `OpenApiRoutesTest` validates the document with Swagger
Parser and detects route/schema drift.

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
Less-or-equal, `4` Maximum, `5` Minimum and `6` Between (BE-003). Between takes
`object` as `min..max` (both numeric, min not above max, both inclusive) and
renders one `FILTER (?lit >= min && ?lit <= max)`; other forms return `400`.
`4`/`5` (BE-004) keep every row whose value equals that relation's maximum/
minimum over the rest of the query, ties included: a subquery computes the
extreme (other filters apply; other Maximum/Minimum relations only bind their
value) and `FILTER (?lit = ?extreme)` compares by value (`3` = `3.0`).
Several Maximum/Minimum filters must all hold. Such a query's `LIMIT` is the
request `limit` capped by `EASYQUERY_EXTREME_RESULT_LIMIT` (default 100). The
C# behavior (`ORDER BY`, forced `LIMIT 1`) is retired; `SELECT-ORDER-MAX-001`
and `SELECT-ORDER-MIN-001` keep their captures and still match by result.
An omitted `filterType` produces an exact `str()` match. The `/api/query/sparql` display route deliberately ignores a
provided `filterType`, preserving C# behavior.

## Routes

### `GET /`

Returns `302 Found` redirecting to `/index2.html`.

There is no application-owned error response for this redirect route.

### `GET /health`

Returns `200 OK` with `Content-Type: application/json`:

```json
{ "status": "ok" }
```

There is no application-owned error response for this route.
The actual C# host returned `200 text/plain Healthy` in
`compatibility/retirement-expected/HTTP-HEALTH-001/case.json`. The Kotlin
body/content type are **not equivalent**. The user approved retaining Kotlin
JSON as an intentional difference under
[[../90 - Tasks/items/DEC-009-health-response-contract]].

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

Missing or invalid request values use the shared `400` response and unavailable
local graphs use `404`. An application-owned `SparqlQueryExecutionFailure`
from the selected executor uses `502 Bad Gateway` with the shared error
envelope, for example `{"error":"<executor diagnostic>"}`. Other unexpected
exceptions remain server failures and are not relabeled as upstream failures.

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
compatibility but unused. Missing or invalid request values use the shared
`400` response and unavailable local graphs use `404`. An application-owned
`SparqlQueryExecutionFailure` from the selected executor uses `502 Bad Gateway`
with `{"error":"<executor diagnostic>"}`. Other unexpected exceptions remain
server failures and are not relabeled as upstream failures.

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
for example `{"error":"Missing required field: subjectId"}`. The generated
OpenAPI contract documents the shared `400`, `404`, and `502` error responses.

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

### `POST /api/query/stage`

Additive staged-exploration route (API-002, approved 2026-09-28 with DEC-008).
It returns one bounded page of distinct typed candidates for one variable under
previously committed typed bindings. It never changes `POST /api/query`.

Request fields and defaults:

```json
{
  "endpointUrl": "https://query.wikidata.org/sparql",
  "variableName": "?team",
  "where": [
    {"subject": "?team", "predicate": "<https://example.test/city>", "object": "?city"},
    {"subject": "?team", "predicate": "?relation", "object": "<https://example.test/league>"}
  ],
  "bindings": [
    {"variableName": "?city", "term": {"type": "iri", "value": "https://example.test/porto-alegre"}},
    {"variableName": "?relation", "term": {"type": "iri", "value": "https://example.test/playsIn"}}
  ],
  "limit": 20,
  "offset": 0
}
```

- `where` uses the `/api/query` item shape and must be non-empty. Filter types
  `4`/`5` (Maximum/Minimum) are rejected (staged pages cannot apply them).
- `variableName` and every binding variable must occur in `where`. Bindings are
  distinct, exclude `variableName`, and number at most 16.
- A term is `{"type":"iri","value":"<absolute IRI without brackets>"}` or
  `{"type":"literal","value":"...","datatype":"<IRI>|null","language":"<tag>|null"}`.
  `language` and a non-`rdf:langString` datatype are mutually exclusive.
  `bnode` terms are rejected as bindings.
- `limit` is 1..50 (default 20); `offset` is 0..10000 (default 0).
- Variable names starting with `__stage` are reserved.

Generated shape: `SELECT ?v (SAMPLE(label) AS ?label)` over a server-rendered
`VALUES` row, the `where` patterns and an optional English `rdfs:label`
(plus the Wikidata direct-claim label on Wikidata), `GROUP BY ?v ORDER BY ?v
LIMIT limit+1 OFFSET offset`. Bindings are validated terms, never interpolated
request text.

Success (`200 OK`):

```json
{
  "data": {
    "variableName": "?team",
    "offset": 0,
    "limit": 20,
    "hasMore": false,
    "candidates": [
      {"term": {"type": "iri", "value": "https://example.test/gremio", "datatype": null, "language": null}, "label": "Grêmio", "selectable": true},
      {"term": {"type": "literal", "value": "1903", "datatype": "http://www.w3.org/2001/XMLSchema#integer", "language": null}, "label": null, "selectable": true},
      {"term": {"type": "literal", "value": "Grêmio", "datatype": "http://www.w3.org/1999/02/22-rdf-syntax-ns#langString", "language": "pt"}, "label": null, "selectable": true},
      {"term": {"type": "bnode", "value": "b0", "datatype": null, "language": null}, "label": null, "selectable": false}
    ]
  }
}
```

Candidates keep server order (ordered by term), are distinct by term, and omit
unbound values. `hasMore` reports whether another page exists. An empty page is
`200` with `"candidates": []`. Invalid input returns `400`, an unavailable
local graph `404`, and execution failure `502` (diagnostic text as in
`/api/query`), with the shared error envelope.
Normal tests use local graphs or fake executors only.

### `POST /api/query/numeric-profile`

BE-003, additive. Distribution of one numeric relation under the rest of a
query, for filter visualizations. Request:

```json
{
  "endpointUrl": "PokemonGen1",
  "where": [{"subject": "?p", "predicate": "<http://easyquery.example.org/pokemon#hasType>", "object": "<http://easyquery.example.org/pokemon#FireType>"}],
  "subject": "?p",
  "predicate": "<http://easyquery.example.org/pokemon#speed>",
  "limit": 3
}
```

`where` is the query without the profiled relation (default `[]`; Maximum/
Minimum filters are rejected). `subject` is a variable or IRI; `predicate` a
single IRI; `limit` 1–1000 (default 500). Response:

```json
{
  "data": {
    "subject": "?p",
    "predicate": "<http://easyquery.example.org/pokemon#speed>",
    "count": 12, "min": 60.0, "max": 105.0, "truncated": true,
    "values": [
      {"entity": {"type": "iri", "value": "http://easyquery.example.org/pokemon#Growlithe", "datatype": null, "language": null},
       "label": "Growlithe", "value": "60", "datatype": "http://www.w3.org/2001/XMLSchema#integer", "number": 60.0}
    ]
  }
}
```

`count`, `min` and `max` cover every distinct entity/value pair whose value is a
numeric literal (`isNumeric`); `values` holds up to `limit` of them ordered by
value then entity, and `truncated` is true when it holds fewer than `count`.
No numeric values gives `count` 0 and null `min`/`max`. Errors as for
`/api/query/stage`. Two SPARQL queries are run (aggregate and values page).

## Endpoint selection

`endpointUrl` accepts the built-in identifiers `CampeonatoBrasileiro2023` and
`PokemonGen1`, an uploaded graph handle, or a remote absolute HTTP(S) endpoint with a host. The
Wikidata behavior is selected when the endpoint contains the documented
Wikidata marker. An invalid remote endpoint produces `400`; a syntactically
valid but unavailable local handle produces `404`.

The built-in identifier resolves the approved C# baseline bytes from the
Kotlin-owned `src/main/resources/futebol_completo.ttl`; the
frontend `sparql/databases/brasileirao2023.ttl` file is not a runtime
alternative.

`PokemonGen1` (DATA-002) is an additional Kotlin-only built-in graph with no C#
equivalent: the 151 Kanto Pokémon with current-game types, base stats, the
18-type effectiveness chart, per-Pokémon weaknesses, evolution lines and
Pokédex neighbours, under `http://easyquery.example.org/pokemon#`. It is parsed
once at startup from `src/main/resources/pokemon_gen1.ttl`, which is generated
by `node scripts/generate-pokemon-dataset.mjs` (`--check` verifies the
committed bytes). It behaves like the other local graphs on every route.
DATA-003 adds per-Pokémon offensive strengths (`strongAgainst`: the types at
least one of its own types hits super effectively) and reviewed Pokédex lore
links between species of the 151 (`pokedexMentions`, inverse
`mentionedInPokedexOf`, plus a short paraphrased `pokedexLoreNote` naming the
source game). Lore coverage is deliberately partial: only well-known entries
are included.

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
- `src/main/kotlin/com/example/sparqlqueryeasy/http/OpenApiModule.kt`
- `src/main/kotlin/com/example/sparqlqueryeasy/application/query/ResultFilteringService.kt`
- `src/main/kotlin/com/example/sparqlqueryeasy/application/query/GeneralQueryService.kt`
- `src/main/kotlin/com/example/sparqlqueryeasy/application/query/StageQueryService.kt`
- `src/main/kotlin/com/example/sparqlqueryeasy/application/querygeneration/SparqlQueryGenerationService.kt`
- `src/test/kotlin/com/example/sparqlqueryeasy/http/QueryRoutesTest.kt`
- `src/test/kotlin/com/example/sparqlqueryeasy/http/StageQueryRoutesTest.kt`
- `src/test/kotlin/com/example/sparqlqueryeasy/http/LocalDatabaseRoutesTest.kt`
- `src/test/kotlin/com/example/sparqlqueryeasy/http/OpenApiRoutesTest.kt`
- `src/test/kotlin/com/example/sparqlqueryeasy/ApplicationTest.kt`
- `Sparql.QueryEasy/Controllers/QueryController.cs`
- `Sparql.QueryEasy/Controllers/LocalDatabaseController.cs`
