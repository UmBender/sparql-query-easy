# Kotlin/JVM + Ktor Migration Assessment

## Scope and evidence

This document is a read-only assessment of the complete tracked repository as
of 2026-09-09. No production source, configuration, data file, or build file
was changed while preparing it. The repository contains one .NET 8 ASP.NET
Core project, two checked-in Turtle source data files under `files/`, and one
runtime Turtle data file under the application project. There is no test
project, package lock/assets file, Dockerfile, or README.

`Sparql.QueryEasy/futebol_completo.ttl` is the runtime asset. It is copied to
the .NET output directory. The source data files under `files/` are not
referenced by production code. There is no Git LFS configuration for the data.

## 1. Project purpose and current behavior

Sparql.QueryEasy is an HTTP API for building and executing constrained SPARQL
queries against either:

1. a user-supplied Turtle graph kept in process memory for 12 hours;
2. a built-in Brazilian Campeonato Brasileiro 2023 Turtle graph; or
3. a caller-selected remote SPARQL endpoint.

It also provides a Wikidata-specific entity search that calls the Wikidata
MediaWiki API, not SPARQL. The API returns simplified `PropertyDto` objects
containing an identifier, display label, inferred application type, and (for
general queries) RDF class.

The query builder always emits `SELECT DISTINCT`, appends a `LIMIT`, and emits
an `ORDER BY` only for the `Max` and `Min` filter modes. There is no endpoint
allowlist, authentication, authorization policy, request validation, query
timeout, pagination, durable storage, or explicit error response mapping.

## 2. Architecture and directory structure

```text
.
├── Sparql.QueryEasy.sln                     # one-project Visual Studio solution
├── Sparql.QueryEasy/
│   ├── Program.cs                            # application bootstrap
│   ├── Sparql.QueryEasy.csproj               # .NET 8 Web project + packages
│   ├── Controllers/
│   │   ├── QueryController.cs                # JSON query routes
│   │   └── LocalDatabaseController.cs        # Turtle upload route
│   ├── Services/
│   │   ├── EndpointService.cs                # endpoint selection and orchestration
│   │   └── IEndpointService.cs
│   ├── Repositories/
│   │   ├── IQueryExecutor.cs                 # local/remote abstraction
│   │   ├── LocalQueryExecutor.cs             # in-memory graph execution
│   │   ├── RemoteQueryExecutor.cs            # remote SPARQL execution
│   │   └── BrasileiraoDatabase.cs            # built-in graph loader
│   ├── Utils/
│   │   ├── SparqlQueryBuilder.cs             # mutable SPARQL string builder
│   │   └── SparqlResultExtension.cs          # RDF result-to-string policy
│   ├── Requests/                             # JSON request records
│   ├── Dtos/                                 # response DTO
│   ├── Properties/launchSettings.json        # development launch profiles
│   ├── appsettings*.json                     # logging and host configuration
│   └── futebol_completo.ttl                  # runtime Turtle asset
├── files/                                    # unreferenced Turtle source material
└── .github/workflows/master_sparql-query-easy.yml
                                                # Azure App Service deployment
```

The functional request path is:

```text
ASP.NET controller
  -> EndpointService.SetEndpoint(request.endpointUrl)
       -> choose Local or Remote executor
       -> create a new SparqlQueryBuilder
  -> EndpointService operation
       -> build SPARQL or call Wikidata HTTP API
       -> execute graph/remote query
       -> map and application-filter PropertyDto values
  -> { "data": ... }
```

`BrasileiraoDatabase` is a singleton. `EndpointService` is registered as a
typed HTTP client (typed clients are transient by default) and stores mutable
endpoint-selection state (`_queryBuilder`, `_queryExecutor`, `_isWikidata`,
`_queryType`). It is normally created for a controller use, but its state must
not be shared across requests. The local and remote executor implementations
are keyed scoped services. Do not turn this stateful selection context into a
Kotlin singleton.

## 3. Application entry points

### Runtime

`Sparql.QueryEasy/Program.cs` is the top-level .NET application entry point.
It registers MVC controllers, memory cache, generic and typed `HttpClient`s,
Swagger/OpenAPI, health checks, the singleton built-in graph, keyed executors,
then starts the HTTP host with `app.Run()`.

Configured middleware/entry routes:

- `GET /health` via ASP.NET health checks.
- Swagger JSON/UI routes supplied by Swashbuckle (normally `/swagger` and
  `/swagger/v1/swagger.json`; no custom route is configured).
- Controller routes listed below.

### Development and deployment

`Properties/launchSettings.json` sets development URLs to
`http://localhost:5242` and `https://localhost:7070`, opens Swagger, and sets
`ASPNETCORE_ENVIRONMENT=Development` for launch profiles.

The GitHub Actions workflow builds and publishes .NET 8 on Windows, then
deploys the artifact to the Azure Web App named `sparql-query-easy`. The
Kotlin deployment replacement must also replace this workflow; it currently
cannot deploy a JVM/Ktor artifact.

## 4. HTTP contract

The application uses ASP.NET Core's web JSON defaults: JSON property names are
camel-cased. No custom serializer configuration exists. `FilterType` is an
enum and, without a configured string-enum converter, its JSON representation
is numeric: `Starts=0`, `Contains=1`, `Greater=2`, `Lesser=3`, `Max=4`,
`Min=5`.

All controller success paths call `Ok`, so their explicit success status is
`200 OK`. `PropertyDto` is serialized as `{propertyId, propertyLabel,
propertyType, propertyClass}`; null properties are not explicitly suppressed.
The returned `IEnumerable` values serialize as JSON arrays.

### `POST /api/local-database`

Content type is multipart/form-data. The form field is `ttlFile` and is bound
as `IFormFile`; no size or content-type limit is imposed in application code.

Success:

```json
{ "data": "c5d43c99-10c4-4cc0-b3e4-c8e7a7d18153" }
```

The UUID is an opaque, process-local cache key. It is valid until 12 hours
after the last cache access, subject to cache eviction or process restart.

### `POST /api/query/relationships`

JSON request (`endpointUrl` and `limit` are inherited defaults):

```json
{
  "endpointUrl": "https://query.wikidata.org/sparql",
  "limit": 20,
  "id": "<http://www.wikidata.org/entity/Q529207>"
}
```

`id` defaults to the value above. Returns `{ "data": [PropertyDto...] }`.

### `POST /api/query/relationship-value`

```json
{
  "endpointUrl": "https://query.wikidata.org/sparql",
  "limit": 20,
  "subjectId": "<IRI-or-variable>",
  "predicateId": "<IRI-or-variable>",
  "isLiteral": false
}
```

`limit` is accepted through inheritance but unused by this operation. Returns
`{ "data": [PropertyDto...] }`.

### `POST /api/query/search`

```json
{
  "endpointUrl": "https://query.wikidata.org/sparql",
  "limit": 20,
  "search": "football"
}
```

Returns `{ "data": [PropertyDto...] }`. An empty/null search returns `200`
with an empty array. For the Wikidata endpoint, `limit` is sent to the
MediaWiki entity search API. For non-local remote endpoints it becomes a
SPARQL `LIMIT`. For local endpoints it is ignored and application code takes
at most 20 results.

### `POST /api/query`

```json
{
  "endpointUrl": "https://query.wikidata.org/sparql",
  "limit": 20,
  "variableName": "?item",
  "ignoreWikidata": true,
  "where": [
    {
      "subject": "?item",
      "predicate": "<http://www.w3.org/2000/01/rdf-schema#label>",
      "object": "example",
      "filterType": 0
    }
  ]
}
```

Returns `{ "data": [PropertyDto...] }`. An empty `where` produces a broad
`?variable ?p ?o` query and then filters the mapped result to
`propertyType == "objetoClasse"`.

### `POST /api/query/sparql`

Uses the same request shape as `POST /api/query`, but returns the generated
query as `{ "data": "PREFIX ..." }` without executing it. It ignores
`ignoreWikidata`; generated labels always use `ignoreWikidata: true` here.

### Error status behavior

There are no explicit `400`, `404`, `422`, `429`, or mapped `5xx` responses.
There is also no `[ApiController]` attribute, no data annotations, and no
manual model-state check. Therefore malformed/missing values may reach service
code and fail with null dereferences, URI/parser/query exceptions, or external
HTTP failures. ASP.NET's environment-specific unhandled-exception behavior
decides the actual HTTP response (normally a generic `500` outside development).
An unsuccessful Wikidata API response is the exception: it is silently
converted to `200 {"data":[]}`. Invalid uploaded Turtle, unavailable cache
keys, invalid endpoint URIs, and SPARQL errors are not caught.

## 5. Configuration and environment

| File/value | Current behavior | Kotlin/Ktor treatment |
|---|---|---|
| `Sparql.QueryEasy.csproj` | `net8.0`, nullable references enabled, implicit usings enabled | Replace with Gradle Kotlin DSL and explicit dependencies |
| `appsettings.json` | log default `Information`, ASP.NET `Warning`, `AllowedHosts: *` | Move to `application.conf`/environment variables and Logback |
| `appsettings.Development.json` | same logging overrides | Ktor development environment/profile |
| `launchSettings.json` | dev ports and `ASPNETCORE_ENVIRONMENT=Development` | Ktor run configuration / `PORT` / `KTOR_ENV` convention |
| `ASPNETCORE_ENVIRONMENT` | only set by launch profiles; selects development configuration | No equivalent currently implemented; define explicitly if needed |
| Azure publish-profile secret | deployment credential only | Replace with an appropriate deployment secret/workload identity |

No application environment variables, database URLs, credentials, CORS
allowlists, endpoint allowlists, or timeout settings are defined. The hard-coded
Wikidata entity-search URL and default SPARQL endpoint are source constants.

## 6. Direct NuGet dependencies

Only these direct package references appear in `Sparql.QueryEasy.csproj`.
There is no restored `project.assets.json`, so transitive package versions
cannot be authoritatively enumerated from this checkout.

| Package | Version | Source use |
|---|---:|---|
| `dotNetRdf` | 3.1.1 | Graph construction, Turtle parsing, local query execution, remote SPARQL client, result/node inspection; see the complete inventory below |
| `Microsoft.AspNetCore.OpenApi` | 7.0.7 | Direct source symbols are absent; supports registered OpenAPI/endpoints infrastructure |
| `Swashbuckle.AspNetCore` | 6.5.0 | `AddSwaggerGen`, `UseSwagger`, `UseSwaggerUI` in `Program.cs` |

The ASP.NET Core shared framework additionally supplies controllers, MVC model
binding, DI, memory caching, `HttpClientFactory`, health checks, CORS,
configuration, and JSON serialization. They are framework capabilities, not
direct NuGet package references here.

`EndpointService.cs` imports `AngleSharp.Dom`, `AngleSharp.Io`,
`System.Security.AccessControl`, `VDS.RDF.Query`, and `VDS.RDF.Storage` without
using symbols from them. Do not add a Kotlin dependency for these imports.

## 7. Complete dotNetRDF inventory, grouped by feature

The table records every dotNetRDF type or method actually used in source. An
import with no referenced symbol is listed separately at the end.

### Graph lifecycle and Turtle parsing

| dotNetRDF type/method | Source file and method | Purpose and observable behavior | Likely Apache Jena equivalent | Semantic differences / compatibility tests |
|---|---|---|---|---|
| `VDS.RDF.IGraph` | `BrasileiraoDatabase._graph`, constructor, `Database`; `LocalDatabaseController.Post`; `LocalQueryExecutor._graph`, `SetDatabase` | In-memory RDF graph interface. Built-in graph is loaded once; uploaded graph is cached by UUID and reused. | `org.apache.jena.rdf.model.Model` for a single default graph, or `org.apache.jena.graph.Graph` | Confirm graph scope is only the default graph. Test concurrent read access and lifecycle after cache expiry. |
| `new Graph()` | `BrasileiraoDatabase` constructor; `LocalDatabaseController.Post` | Creates empty graph before parsing. No explicit graph base URI is set by the application. | `ModelFactory.createDefaultModel()` | Parse the same fixture with relative IRIs and no `@base`; establish desired failure/resolution behavior. |
| `new TurtleParser()` | `BrasileiraoDatabase` constructor; `LocalDatabaseController.Post` | Creates a Turtle parser with default settings. | `RDFDataMgr.read(model, input, Lang.TURTLE)` / RIOT parser | Compare strictness, warning/error behavior, UTF-8 handling, prefix/base handling, and accepted Turtle extensions. |
| `StringParser.Parse(graph, ttlString, parser)` | `BrasileiraoDatabase` constructor | Reads all runtime TTL text then parses it into the built-in graph during startup. A parsing exception prevents application startup. | `RDFDataMgr.read(model, StringReader(ttl), null, Lang.TURTLE)` | Preserve no application-supplied base URI. Test startup with the checked-in file byte-for-byte. |
| `TurtleParser.Load(graph, TextReader)` | `LocalDatabaseController.Post` | Parses uploaded Turtle directly from a `StreamReader`; only caches after successful parse. | `RDFDataMgr.read(model, InputStream, Lang.TURTLE)` | Test malformed input returns the selected migration error contract and never creates a cache entry; compare whether partial triples remain in a model on parser failure. |

### Local and remote query execution

| dotNetRDF type/method | Source file and method | Purpose and observable behavior | Likely Apache Jena equivalent | Semantic differences / compatibility tests |
|---|---|---|---|---|
| `IGraph.ExecuteQuery(string)` | `LocalQueryExecutor.ExecuteAsync` | Parses and executes the generated string against the selected in-memory graph, then casts the result to `SparqlResultSet`. Only SELECT-style results are usable. Although the method is `async`, it performs synchronous CPU work. | `QueryExecution.create(queryString, model).execSelect()` | Jena query execution must be closed; run it on `Dispatchers.IO`/an appropriate executor. Compare syntax acceptance, SELECT variable order, unbound values, DISTINCT, OPTIONAL/FILTER/BIND/EXISTS, and error types. |
| `SparqlResultSet` | `IQueryExecutor.ExecuteAsync`, both executors; consumed in all query methods | Represents an enumerable SELECT result set. | `ResultSet`; materialize to `ResultSetRewindable` or DTO rows before closing execution | Jena `ResultSet` is streaming and tied to `QueryExecution`; materialize before returning from a `use` block. Test row ordering and variable order. |
| `new SparqlQueryClient(HttpClient, Uri)` | `RemoteQueryExecutor.SetDatabase` | Binds a fresh framework HTTP client and caller-supplied endpoint URI. Adds `User-Agent: .NET QueryEasy` before construction. | `QueryExecution.service(endpointUrl)` / `QueryExecutionHTTP.service(...)`, optionally with Jena HTTP context | Match GET/POST selection, accept headers, timeouts, redirects, response parsing, User-Agent, and error propagation against representative endpoints. |
| `SparqlQueryClient.QueryWithResultSetAsync(string)` | `RemoteQueryExecutor.ExecuteAsync` | Executes a remote SELECT query asynchronously. If `SetDatabase` was not called, code throws before this call. | Jena remote `QueryExecution` `execSelect()` wrapped in a Kotlin `suspend` boundary | Jena API is typically blocking. Test cancellation, timeouts, non-2xx responses, malformed SPARQL JSON/XML result responses, and remote blank-node labels. |

### Result and RDF-node inspection

| dotNetRDF type/method | Source file and method | Purpose and observable behavior | Likely Apache Jena equivalent | Semantic differences / compatibility tests |
|---|---|---|---|---|
| `ISparqlResult` | `SparqlResultExtension.GetStringValue` | One solution mapping, accepted as nullable by the extension. | `QuerySolution` | Jena's `QuerySolution` is normally non-null. Preserve the current empty-string result if a null/absent value reaches the adapter. |
| `ISparqlResult.TryGetValue(variableName, out node)` | `GetStringValue` | Checks whether a variable is bound. An absent or null binding becomes `""`. | `QuerySolution.contains(name)` + `get(name)` | Jena variable names should be passed without `?`; current callers do so after query execution. Test every selected variable bound/unbound. |
| `INode` | `GetStringValue` | Common RDF node value inspected after binding lookup. | `RDFNode` | Do not use `RDFNode.toString()` as API output; it has different rendering semantics. |
| `INode.NodeType` / `NodeType.Uri`, `Blank`, `Literal` | `GetStringValue` | Selects formatting rule by node category. | `RDFNode.isURIResource`, `isAnon`, `isLiteral` | Test URI, blank, literal, and any unsupported node category. |
| `IUriNode.Uri.AbsoluteUri` | `GetStringValue` | URI becomes `<absolute-uri>` normally, or unbracketed absolute URI when `removeSignals=true`. | `node.asResource().uri` | Test percent-encoding, Unicode IRIs, relative IRIs after parsing, and no double angle brackets. |
| `ILiteralNode.Value` | `GetStringValue` | Returns lexical text only; datatype and language tag are intentionally discarded. | `node.asLiteral().lexicalForm` | Jena `getString()` is not a safe substitute if it applies value conversion. Test plain, typed, language-tagged, escaped, multiline, and invalid lexical forms. |
| `RdfOutputException` | `GetStringValue` | Throws for any unexpected node type. | custom exception (or `IllegalStateException`) | Make the exception/error mapping deliberate; tests should ensure behavior does not silently stringify a new node type. |

### Imports with no direct runtime use

- `VDS.RDF.Query` and `VDS.RDF.Storage` in `Services/EndpointService.cs`.
- `VDS.RDF.Writing` is needed for the referenced `RdfOutputException` namespace,
  but no writer API is used.

Apache Jena ARQ supports standard SPARQL and remote SPARQL access, and Jena
RIOT supports Turtle parsing. Consult the [Jena ARQ documentation](https://jena.apache.org/documentation/query/)
and [Jena RDF I/O documentation](https://jena.apache.org/documentation/io/)
when pinning the replacement version/API.

## 8. Local SPARQL execution behavior

The local executor selects a graph in `SetDatabase`:

- Exactly `CampeonatoBrasileiro2023` selects the preloaded singleton graph.
- A parseable GUID selects an uploaded graph from memory cache.
- A cache miss/null graph throws `Exception("Local database not available")`.

`ExecuteAsync` calls `_graph.ExecuteQuery(query)` and casts the result to
`SparqlResultSet`. It does not accept an arbitrary query result type even
though dotNetRDF's graph API may produce non-select results. Query text is not
validated or parsed separately. The graph does not persist across restarts;
its cache key has no user ownership or authorization.

The built-in data has one `@base`, seven prefixes, and many `@en` labels. A
quick source inspection found no explicit `^^datatype` literals or blank-node
syntax in that bundled file, but uploads are unrestricted Turtle and can
contain them. Numeric tokens occur in the bundled data. Migration tests must
therefore cover both the real dataset and a deliberately constructed semantic
fixture, not only the checked-in data.

Important compatibility cases:

- SPARQL parser acceptance of the generated bare `[]` object in relationship
  queries. The application emits it verbatim; do not normalize it without a
  baseline test.
- Default graph semantics only; no named graph/dataset API is used.
- Identical `SELECT DISTINCT` row equivalence.
- Result rows with unbound label/type/class variables from `OPTIONAL` clauses.
- Query execution result order when no `ORDER BY` is present: it is not a
  contractual order and may differ across engines.
- `ORDER BY ASC/DESC` behavior and comparison of numeric/untyped/language
  literals for `Min`/`Max`.
- `FILTER`, `BIND`, `IF`, `EXISTS`, `lang`, `STR`, `STRSTARTS`, `CONTAINS`,
  `rdf:type`, and `owl:Class` behavior.
- Property paths are not generated by application code, but `subject`,
  `predicate`, and object fragments are user-controlled raw SPARQL and can
  contain a property path. If preserving that permissive behavior, test it;
  otherwise treat the migration as an intentional security contract change.

## 9. Turtle parsing behavior

### IRI, prefixes, and base IRI

The bundled file declares `@base <urn:usp:ontology:futebol#> .` and explicit
`rdf`, `rdfs`, `owl`, `xml`, `xsd`, and `fut` prefixes. The application does
not supply a base URI to `Graph`, `TurtleParser`, or `StringParser.Parse`.
Thus document `@base` governs relative IRI resolution where present. Uploaded
files have no application-supplied fallback base visible in this code.

Required tests:

- Parse the built-in file and compare graph size and canonicalized triples.
- Parse a fixture with `@base`, relative IRIs, prefix expansion, an absolute
  IRI, and no base declaration.
- Test malformed prefix declarations and relative IRIs without a base.
- Verify that the Jena load call is explicitly `Lang.TURTLE`, rather than
  guessing a syntax from an upload filename/content type.

### Blank nodes

The current result formatter deliberately loses blank-node identity: every
bound blank node becomes the string `"blank"`. Graph identity still matters
during joins and query evaluation. Blank-node labels are parser/document scoped
and cannot be expected to match between dotNetRDF and Jena, nor across remote
SPARQL responses.

Required tests: a Turtle fixture with two distinct blank nodes, a repeated
blank-node label, blank nodes used in a join, and a query selecting them. Test
graph/join cardinality separately from public output, which must remain
`"blank"` if API compatibility is desired.

### Literals and escaping

The application never constructs RDF literals through dotNetRDF APIs. It parses
Turtle literals and later returns only `ILiteralNode.Value`/the lexical form.
It drops language and datatype information. The current builder makes text
filters with unescaped SPARQL string interpolation; it does not create typed,
language-tagged, or escaped literal terms.

Required tests must cover:

- plain string literals;
- `@en` and non-English language tags, including case behavior of `lang()`;
- `xsd:string`, integer, decimal, boolean, date/time, and custom typed
  literals;
- quote, backslash, newline, tab, Unicode, long-string, and escape sequences;
- lexical-form preservation in the API response;
- malformed escape sequences and invalid datatype lexical forms;
- equality and ordering semantics where a builder `Lesser`, `Greater`, `Min`,
  or `Max` filter reaches a literal.

### Parser errors

There is no catch around either parser call. For startup data, a parser error
prevents construction of the singleton/app startup. For uploads, it escapes the
route and no cache set occurs because caching follows parsing. The Kotlin
replacement should first pin this observed behavior in tests, then make any
planned API improvement (for example `400 Bad Request` with a stable error
body) an explicit compatibility decision.

## 10. RDF node creation and formatting behavior

The application creates graph containers (`new Graph`) but does not create RDF
nodes/triples programmatically. Nodes arrive from parsed Turtle or SPARQL
results. The one application-level rendering policy is:

| Node category | `removeSignals=false` | `removeSignals=true` |
|---|---|---|
| URI | `<absolute-uri>` | `absolute-uri` |
| blank node | `blank` | `blank` |
| literal | lexical value only | lexical value only |
| unbound/missing/null | empty string | empty string |
| any other node type | `RdfOutputException` | `RdfOutputException` |

`removeSignals=true` is only used for literal relationship values; in normal
flow it makes no difference for literal nodes. It exists in the URI branch and
should nonetheless be covered by a direct adapter test.

Do not use Jena's default node/string rendering to reproduce this API. Write a
dedicated Kotlin extension/function based on node category and lexical form.

## 11. Wikidata-specific behavior and query generation

Endpoint selection marks an endpoint as Wikidata only when `endpointUrl`
contains the exact substring `query.wikidata.org/sparql`. This is a string
test, not URI host validation. It controls two distinct behaviors:

1. `SparqlQueryBuilder.AddDefaultPrefixes` adds
   `PREFIX wikibase: <http://wikiba.se/ontology#>`.
2. Unless `ignoreWikidata=true`, `GetVariableLabel(?x)` emits:

   ```sparql
   OPTIONAL {
     ?xClaim wikibase:directClaim ?x .
     ?xClaim rdfs:label ?xLabel .
     FILTER (lang(?xLabel) = "en")
   }
   ```

For non-Wikidata (or when ignored) the label clause is:

```sparql
OPTIONAL {
  ?x rdfs:label ?xLabel .
  FILTER (lang(?xLabel) = "en")
}
```

This special form maps a Wikidata direct property (`wdt:P...`) to its property
entity (`wd:P...`) through `wikibase:directClaim`, then reads that entity's
English label. It is intended for properties, not arbitrary Wikidata entities.

`POST /api/query/search` takes a separate path for a Wikidata endpoint: it
calls a hard-coded `wbsearchentities` URL with `language=en`, `type=item`,
`uselang=en`, `origin=*`, and the raw caller `search`/`limit` substitutions.
For each result, it returns:

- `propertyId`: `<concepturi>` (angle brackets added by `NodeUri`);
- `propertyLabel`: `(<id>) <label>`;
- `propertyType`: `object`.

The code does not URL-encode `search` before replacing it into the URL string,
does not null-check `responseData`/`Search`, and returns an empty result on
non-success status. Tests must use real or recorded `Q...`, `P...`, direct
property (`wdt:`) and entity (`wd:`) cases, and strings containing space,
`&`, `#`, `%`, quotes, plus, Unicode, and invalid URI characters.

## 12. Result filtering, ordering, and deduplication

### SPARQL-level behavior

- Every builder `Select(fields)` emits `SELECT DISTINCT {fields}`.
- The selected field sequence is exactly the provided string; output mapping
  accesses variables by name, not position.
- No `ORDER BY` is emitted except `FilterType.Max`/`Min`, which replace the
  builder's one `_orderBy` value with `ORDER BY DESC(variable)` or
  `ORDER BY ASC(variable)`.
- When `_orderBy` is present, `Limit(limit)` emits `LIMIT 1`, ignoring the
  caller limit. Otherwise it emits the supplied integer verbatim, including
  zero or negative values.
- `Starts` emits `FILTER (STRSTARTS(STR(variable), "value"))`.
- `Contains` emits `FILTER (CONTAINS(STR(variable), "value"))`.
- `Lesser` / `Greater` emit numeric/SPARQL comparison text without quoting
  the value.
- `OPTIONAL` is used for labels; it can leave label variables unbound.
- `AddVariableParentType` uses `BIND(IF(EXISTS {...}, "objetoClasse",
  "outro") AS ?xParentType)`.
- `AddVariableType` uses nested `IF(EXISTS...)` to return `objeto`, `label`,
  or `outro` for a property.

No application code generates property paths. Raw user input can still inject
one where a predicate or another raw fragment is inserted.

### Application-level filtering

| Operation | Post-query filtering / shaping |
|---|---|
| relationships | Remote only: drops empty labels and `propertyType == "outro"`; local returns all rows, including empty labels/types |
| relationship-value | Drops empty `propertyLabel`; literal values use the lexical string as both ID and label and set type `text` |
| search (Wikidata) | No further filtering |
| search (remote non-Wikidata) | Server-side `STRSTARTS` and endpoint result order are retained |
| search (local) | Case-insensitive current-culture `.ToLower().Contains(...)`, type must be `objetoClasse`, then `.Take(20)`; no explicit ordering and caller limit ignored |
| query | Drops empty labels; if `where` is empty, also requires `propertyType == "objetoClasse"`; label falls back to `propertyId` before the empty-label filter |
| sparql | No execution or filtering |

`SELECT DISTINCT` de-duplicates full solution mappings, not the final
`PropertyDto` projection. The application does not perform a second
deduplication after mapping/filtering, so duplicate DTOs can remain when rows
differ only in a selected field later discarded from the DTO. Kotlin must
preserve this unless a behavior change is approved.

For unordered SPARQL, local iteration and remote endpoint response order are
observable but not guaranteed by SPARQL. Snapshot tests should assert sets or
multisets where no `ORDER BY` exists; only explicit `Min`/`Max` cases should
assert order/first-row selection.

## 13. Network, filesystem, and persistence operations

### Network

- A remote endpoint URL comes directly from `endpointUrl`; the server issues
  SPARQL HTTP requests to it. This is an SSRF/open-proxy risk.
- The remote executor sets `User-Agent: .NET QueryEasy`.
- Wikidata search calls `https://www.wikidata.org/w/api.php` with a raw,
  template-substituted query string.
- Swagger UI may be served publicly.
- CORS allows every origin, method, and header.
- HTTPS redirection is enabled, but external TLS/proxy deployment settings are
  not in this repository.
- No timeouts, retry policy, circuit breaker, maximum response size, or remote
  endpoint authorization is configured in application code.

### Filesystem

- Startup calls `File.ReadAllText` on
  `Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "futebol_completo.ttl")`.
- The project copies that file to output on every build.
- Uploads are read from the multipart request stream and are not written to
  disk by this code.

Kotlin should package the built-in TTL as a classpath resource, or retain an
explicit external-file deployment contract and test it. The former is normally
less fragile than relying on the process base directory.

### Persistence/cache

- Uploaded graphs reside only in `IMemoryCache`.
- Each gets a random UUID key and 12-hour sliding expiration.
- The built-in graph lives in a singleton for process lifetime.
- No graph is persisted, shared across instances, encrypted, access-scoped, or
  explicitly invalidated.

Use Caffeine with `expireAfterAccess(Duration.ofHours(12))` for the closest
local cache policy. Define maximum-size/memory behavior before production use;
the .NET code has no explicit bound.

## 14. Error-handling behavior

| Condition | Current handling |
|---|---|
| Missing/invalid cache UUID or expired local graph | Throws generic `Exception("Local database not available")`; unhandled by controller |
| Executor used before `SetDatabase` | Throws generic `Exception` |
| Invalid remote endpoint URI | `new Uri(database)` exception escapes |
| Remote SPARQL error/network failure | dotNetRDF/HTTP exception escapes |
| Invalid SPARQL generated/injected by input | parser/execution exception escapes |
| Built-in Turtle parse failure | app construction/startup fails |
| Uploaded Turtle parse failure | parser exception escapes; graph is not cached |
| Wikidata non-2xx response | returns empty `data` array, status 200 |
| Wikidata malformed/empty JSON | deserialization/null exception may escape |
| Missing label binding | converted to empty string, then most routes filter it out |
| Blank RDF node | silently becomes `blank` |
| Unexpected RDF node type | throws `RdfOutputException` |
| Bad JSON/multipart/model binding | framework-dependent error or null/default values; no explicit application contract |

The migration should establish a Ktor `StatusPages` policy, but it should not
be introduced silently. First capture current observable behavior with a
black-box baseline, then intentionally version any safer status/error contract.

## 15. C#/.NET features requiring Kotlin treatment

| .NET/C# feature | Kotlin/Ktor treatment |
|---|---|
| Top-level `Program.cs` statements | explicit `fun main()` plus Ktor `embeddedServer` or application module |
| ASP.NET middleware pipeline | Ktor plugins: content negotiation, CORS, status pages, compression/logging as chosen |
| MVC attributes/controllers/model binding | Ktor route DSL; explicit `receive<T>()`, `respond`, multipart extraction |
| `IFormFile` | `PartData.FileItem` and safe stream handling with `use` |
| `IActionResult` and anonymous `{ Data = ... }` | serializable `ApiResponse<T>(val data: T)` |
| DI service lifetimes and keyed services | Koin/Dagger/manual factory; preserve request-local selection context |
| `HttpClientFactory` | Ktor/OkHttp client lifecycle singleton; configure headers/timeouts intentionally |
| `Task<T>` / `async` | `suspend` functions/coroutines; do not run blocking Jena work on the event loop |
| `IEnumerable` + LINQ deferred filters | `List`, `Sequence`, and Kotlin collection operations; materialize Jena results before closing query execution |
| C# positional records with inheritance/defaults | Kotlin `data class`es; JSON polymorphism/inheritance is unnecessary—compose common fields or duplicate defaults |
| Nullable reference annotations | explicit Kotlin nullable types and input validation; avoid `!!` for current implicit failure paths unless intentionally preserving them |
| Extension method | Kotlin extension function for RDF result formatting |
| Switch expression/pattern match | exhaustive Kotlin `when` over `RDFNode` category |
| `Guid.TryParse` / random GUID | `UUID.fromString` wrapped in `runCatching`; `UUID.randomUUID()` |
| Range operator `[..5]` | `substring(0, 5)`; retain collision analysis for generated variable names |
| `using` resource scope | `.use {}` for streams and Jena `QueryExecution` |
| `AppDomain.CurrentDomain.BaseDirectory` | classpath resource or explicit configured `Path` |
| System.Text.Json web defaults | kotlinx.serialization or Jackson configured to preserve camelCase, default handling, and numeric enum behavior |
| `String.ToLower().Contains` | `contains(search, ignoreCase = true)` only if its Unicode/culture behavior is explicitly accepted; baseline special casing tests |

## 16. Proposed Kotlin/Ktor architecture

Use Kotlin/JVM, Gradle Kotlin DSL, Ktor Netty, kotlinx.serialization, Apache
Jena ARQ/RIOT, Caffeine, SLF4J/Logback, and a minimal DI approach (manual
wiring is sufficient; Koin is optional). Apache Jena is the closest JVM
replacement because it provides in-memory RDF models, RIOT Turtle parsing,
local ARQ query execution, remote SPARQL query execution, and RDF node APIs.

```text
src/main/kotlin/com/example/sparqlqueryeasy/
├── Application.kt                    # Ktor installation and route registration
├── api/
│   ├── QueryRoutes.kt
│   ├── LocalDatabaseRoutes.kt
│   ├── ApiResponse.kt
│   └── ErrorMapping.kt
├── model/
│   ├── Requests.kt                    # @Serializable request DTOs
│   ├── PropertyDto.kt
│   └── WikidataDtos.kt
├── service/
│   ├── EndpointService.kt             # stateless; receives EndpointContext
│   ├── EndpointContext.kt             # executor, builder mode, local/remote kind
│   └── WikidataSearchClient.kt
├── sparql/
│   ├── SparqlQueryBuilder.kt
│   ├── FilterType.kt
│   └── SparqlInputPolicy.kt           # preserve/replace raw interpolation deliberately
├── rdf/
│   ├── JenaGraphLoader.kt
│   ├── JenaQueryExecutor.kt
│   ├── LocalQueryExecutor.kt
│   ├── RemoteQueryExecutor.kt
│   └── RdfNodeFormatter.kt
├── storage/
│   ├── LocalGraphCache.kt
│   └── BrasileiraoDatabase.kt
└── config/
    └── AppConfig.kt

src/main/resources/
├── application.conf
└── futebol_completo.ttl

src/test/kotlin/com/example/sparqlqueryeasy/
├── api/RouteContractTest.kt
├── rdf/TurtleCompatibilityTest.kt
├── rdf/NodeFormatterTest.kt
├── rdf/LocalQueryCompatibilityTest.kt
├── sparql/QueryBuilderGoldenTest.kt
└── service/EndpointServiceBehaviorTest.kt
```

Recommended boundaries:

- `EndpointResolver` returns an immutable context for each request instead of
  mutating fields in a scoped service.
- `QueryExecutor` returns a materialized list/sequence of an internal result
  representation, never a live Jena `ResultSet` past a closed resource.
- `RdfNodeFormatter` is the sole location that turns a Jena node into current
  public strings.
- `SparqlQueryBuilder` initially preserves the exact output as golden strings.
  A later secure parameterization/validation redesign should be separately
  versioned because it changes behavior.
- `LocalGraphCache` owns UUID lookup, TTL, and cache semantics.

## 17. Risk-ranked migration plan

### Critical risk

1. **Raw user-controlled SPARQL and endpoint selection.** `endpointUrl`,
   `variableName`, subject, predicate, object, filter value, and search values
   are inserted into network/queries without robust escaping/allowlisting.
   Preserving this exactly preserves SPARQL injection and SSRF; changing it
   changes accepted query semantics. Decide and version the security boundary.
2. **RDF/SPARQL semantic parity.** dotNetRDF and Jena can differ on parsing
   tolerance, relative IRIs/base resolution, blank labels, literal comparison,
   query optimization, unsupported syntax, and result order. Build fixture and
   golden-query tests before replacing execution.
3. **Public string projection loses RDF information.** URI brackets, lexical
   literal rendering, collapsed blank nodes, and empty unbound values are API
   behavior. Do not rely on Jena `toString()`.

### High risk

4. **Remote SPARQL HTTP compatibility.** Compare protocol method, headers,
   result formats, timeouts, cancellation, redirects, error mapping, and
   endpoint-specific quirks for Wikidata and at least one non-Wikidata service.
5. **Unordered result behavior.** Existing local and remote output often lacks
   `ORDER BY`; do not create brittle exact-order tests or accidentally sort in
   Kotlin.
6. **Upload/cache resource safety.** Unbounded, unauthenticated graph uploads
   can consume memory; cache IDs are bearer-like access tokens. Preserve
   behavior only behind resource limits appropriate for deployment.

### Medium risk

7. **JSON binding differences.** Kotlin serializer defaults, missing fields,
   nulls, defaults, enum values, and camel case must be explicitly specified.
8. **Mutable DI-lifetime behavior.** Preserve per-request endpoint isolation
   with immutable context; test parallel local/remote calls.
9. **Deployment and resource packaging.** Replace Azure .NET publish workflow,
   app ports, health endpoint, CORS, and TTL resource lookup.

### Lower risk

10. **Swagger and health endpoints.** Straightforward Ktor plugin/routes once
    the main API contract is stable.
11. **Logging/configuration.** Translate after core compatibility behavior is
    tested.

## Independently verifiable migration checklist

- [x] Run the Kotlin scaffold compilation and test commands. On 2026-09-09,
  main/test compilation, focused domain tests, the complete Kotlin suite,
  KtLint, Detekt, and `check` passed with Gradle 9.7.1 and Temurin JDK 21; see
  the Prompt 6 verification record below.
- [ ] Capture the existing C# baseline using the input-only
  [`compatibility/`](compatibility/README.md) corpus. The corpus and capture
  rules are in place; no expected output is considered valid until it is
  captured from a running C# instance and reviewed. A production-code-reusing
  [`Compatibility.Harness`](compatibility/Compatibility.Harness/README.md)
  now writes structured graph, raw-result, generated-SPARQL, controller-response,
  and exception captures; this environment lacks the .NET SDK, so no baseline
  output has yet been generated or approved here.
- [ ] Freeze this repository's baseline: capture representative HTTP request/
  response fixtures for every route, local dataset mode, uploaded dataset mode,
  Wikidata mode, and one non-Wikidata remote endpoint.
- [ ] Add a Kotlin Gradle/Ktor skeleton with only `/health`; verify packaging,
  startup port, and deployment artifact independently.
- [ ] Add the built-in TTL as a classpath resource; parse it with Jena RIOT and
  compare canonicalized triples/count against the dotNetRDF baseline.
- [ ] Add semantic Turtle fixtures for base/prefix resolution, relative IRIs,
  blank nodes, plain/typed/language literals, escapes, and malformed input.
- [ ] Implement and unit-test the Jena node formatter against all rows in the
  formatting table, including unbound values and blank-node collapse.
- [ ] Port the SPARQL builder as a pure Kotlin component; golden-test every
  generated query string for each `FilterType`, Wikidata mode, empty `where`,
  and `Min`/`Max` limit behavior.
- [ ] Execute those golden queries locally in dotNetRDF and Jena; compare
  result multisets, bound variables, and ordered results only where ordering is
  explicit.
- [ ] Implement local graph cache/upload; verify UUID selection, 12-hour
  access-based expiry, malformed upload behavior, and restart behavior.
- [ ] Implement remote Jena query execution; compare User-Agent, endpoint
  protocol behavior, result parsing, failure behavior, and cancellation/timeouts.
- [ ] Implement the Wikidata API branch with recorded fixtures; verify Q/P IDs,
  `concepturi` brackets, labels, raw-search encoding decision, and non-2xx
  empty-result behavior.
- [ ] Implement Ktor JSON/multipart routes and response wrappers; contract-test
  request defaults, numeric enums, null/missing input, content types, status
  codes, and JSON property names.
- [ ] Make an explicit, reviewed decision on input validation, SPARQL
  parameterization, endpoint allowlisting, CORS, upload limits, and structured
  error responses; treat approved hardening as a versioned behavior change.
- [ ] Replace the Azure deployment workflow only after the Kotlin artifact,
  runtime configuration, health check, and resource packaging are verified.

## Kotlin scaffold commands

The Kotlin project is alongside the C# project at the repository root. It uses
Gradle Kotlin DSL and reads the shared `compatibility/` directory as test
resources. Install a Gradle version compatible with Kotlin 2.2.20 (Gradle 8.14
or newer is recommended), then run these commands from the repository root:

```sh
gradle clean
gradle compileKotlin compileTestKotlin
gradle ktlintCheck
gradle detekt
gradle test
gradle check
```

The complete verification command is:

```sh
gradle clean check
```

The minimal application can be started with:

```sh
gradle run
```

The initial Kotlin HTTP contract is intentionally limited to `GET /health`.
Ktor tests use `testApplication`; ordinary tests do not contact Wikidata.

## Prompt 6 recovery: framework-independent RDF and SPARQL domain model

### Recovery audit and scope

On 2026-09-09, the interrupted Prompt 6 work was audited before any source
was edited. The Kotlin scaffold, compatibility corpus, Gradle configuration,
and this assessment were all untracked worktree files and were preserved. The
recovered `domain/model/DomainModels.kt` contained only a generic `RdfValue`
record and SELECT-shaped result records. `rdf/RdfAbstractions.kt` contained
only generic store and executor interfaces. Neither file was truncated,
duplicated, empty, or visibly syntactically malformed.

The isolated `rdf/jena/JenaRdfStore.kt` smoke adapter was valid and was left
unchanged. Apache Jena imports remain confined to the `rdf.jena`
infrastructure package; no Jena type is exposed by a domain or application
API.

### Recovered and completed work

`src/main/kotlin/com/example/sparqlqueryeasy/domain/model/DomainModels.kt` now
provides immutable application-owned representations for:

- absolute `Iri` values, `BlankNode` identities, and `Literal` lexical forms;
- optional literal datatype and language, with a language-tag/datatype
  invariant that allows only `rdf:langString` when a datatype is explicit;
- `RdfStatement`, `RdfGraph`, and `RdfGraphHandle`;
- SPARQL variables, bound bindings, explicit unbound bindings, ordered SELECT
  projections and rows, ASK results, and CONSTRUCT results;
- Turtle parsing and SPARQL query-execution failures with diagnostic text,
  query/base-IRI context, and optional causes.

`src/main/kotlin/com/example/sparqlqueryeasy/rdf/RdfAbstractions.kt` now adds
narrow application-owned interfaces for Turtle parsing, local SPARQL
execution, RDF value formatting, and generic source-to-domain RDF value
mapping. The generic mapper permits a future Jena implementation to remain in
RDF infrastructure without placing a Jena type in the interface declaration.
No Jena parser or query adapter was added in this phase.

`src/test/kotlin/com/example/sparqlqueryeasy/domain/model/DomainModelsTest.kt`
was added with focused coverage for IRI equality/validation, blank-node
identity, plain/language-tagged/typed literals, invalid literal combinations,
statement equality, projected-variable ordering, bound/unbound/missing
variables, duplicate rows, ASK and CONSTRUCT results, failure diagnostics, and
the invariant that every projected variable is explicitly represented in a
result row.

The C# implementation exposes only SELECT result sets; it does not use ASK or
CONSTRUCT execution. The domain result variants are therefore boundary
completeness types, not a migration of a C# feature.

### Verification results

The following initial Gradle commands were attempted from the repository root:

```sh
gradle compileKotlin compileTestKotlin --no-daemon
gradle compileKotlin
gradle compileTestKotlin
gradle test --tests 'com.example.sparqlqueryeasy.domain.model.DomainModelsTest'
gradle test
gradle ktlintCheck
gradle detekt
```

They initially failed before Gradle started with `zsh: command not found:
gradle`. After Gradle, Java, and Kotlin were installed, the following commands
were run using the JDK 27 compiler at
`/usr/lib/jvm/java-latest-openjdk`:

```sh
gradle --no-daemon -Dorg.gradle.java.home=/usr/lib/jvm/java-latest-openjdk compileKotlin
gradle --no-daemon -Dorg.gradle.java.home=/usr/lib/jvm/java-latest-openjdk compileTestKotlin
gradle --no-daemon -Dorg.gradle.java.home=/usr/lib/jvm/java-latest-openjdk test --tests 'com.example.sparqlqueryeasy.domain.model.DomainModelsTest'
gradle --no-daemon -Dorg.gradle.java.home=/usr/lib/jvm/java-latest-openjdk test
```

All four commands passed. The initial main-compilation attempt found that Java
compilation defaulted to the JDK 27 target while Kotlin targeted JVM 21. The
build was repaired by explicitly setting Java source/target compatibility to
JVM 21, matching the existing Kotlin target. The Detekt task was also assigned
JVM target 21 to match the project.

After Temurin JDK 21 was installed through SDKMAN, all remaining operations
were completed with the following commands:

```sh
gradle --no-daemon ktlintCheck
gradle --no-daemon detekt
gradle --no-daemon check
```

All three commands passed. The earlier scaffold formatting violations in
`Application.kt`, `HttpModule.kt`, `ApplicationTest.kt`, and
`CompatibilityFixtureTest.kt` were repaired with formatting-only edits. Detekt
then identified and verified a Prompt 6 correction: `Iri` now catches the
specific `URISyntaxException` instead of the overly broad `Exception`.

A manual source-integrity scan found no trailing whitespace, and a boundary
scan found Jena imports only in `rdf/jena/JenaRdfStore.kt`.

### Known differences and deferred decisions

No parser, formatter, mapper implementation, or query executor was introduced
here, so dotNetRDF/Jena differences in Turtle parser behavior, IRI/base
resolution, blank-node identity, literal mapping, query semantics, result
ordering, and error mapping remain deferred to their dedicated compatibility
phases. This model deliberately stores literal lexical forms without coercion,
does not use display formatting for equality, and requires local adapters to
record each projected variable as either bound or explicitly unbound.

### Phase status

Prompt 6 is complete: its source compiles, focused RDF-domain tests and the
complete Kotlin suite pass, all configured formatting and static-analysis
checks pass, and no Apache Jena type escapes the RDF infrastructure package.
Prompt 7 can safely begin.

## Prompt 7: Jena RDF infrastructure

### Completed slice

The RDF infrastructure phase is implemented in `rdf/jena` without exposing
Jena types from the domain or application packages. `JenaTurtleParser` uses
RIOT with an explicit `Lang.TURTLE` setting (never filename inference), and
accepts an optional caller base IRI. Turtle `@base` and prefix declarations are
left to the Turtle parser, so relative terms in the captured base/prefix
fixtures resolve according to the document contract.

`JenaRdfValueMapper` maps URI resources, blank nodes, and literals into the
application-owned domain values. It preserves literal lexical form, datatype
IRI, and language tag. In particular, Jena represents RDF 1.1 plain string
literals with `xsd:string`; that datatype is retained instead of being erased
at the infrastructure boundary. `DotNetRdfValueFormatter` is explicit rather
than based on `RDFNode.toString()`: it reproduces the C# formatter's `<IRI>` /
unwrapped-IRI switch, its public `blank` value for all blank nodes, and lexical
literal output with datatype/language omitted.

`JenaLocalSparqlExecutor` parses and executes local SELECT, ASK, CONSTRUCT,
and DESCRIBE queries. SELECT projected variables come from Jena's result-set
variable list in projection order. Every row is materialized before the query
execution closes, every absent projected value becomes `UnboundSparqlBinding`,
and rows are appended without deduplication or adapter-imposed sorting. Query
and parser exceptions are converted to `SparqlQueryExecutionFailure` and
`TurtleParsingFailure`, respectively, retaining the original cause and a
diagnostic message. `JenaRdfGraphComparator` uses Jena model isomorphism so
serialized triple order and blank-node labels do not affect graph comparison.

### Compatibility evidence and known differences

Focused regressions in `JenaRdfInfrastructureTest` cover the checked-in Turtle
base/prefix, literal, blank-node, optional/unbound, duplicate-row, and ordered
query fixtures; parser and query failure diagnostics; semantic graph equality;
and the captured C# formatting policy. The complete fixture catalogue cannot
yet be compared as golden HTTP output: `compatibility/expected/` intentionally
contains no C# captures (see its README and `capture-status.tsv`). No expected
result was invented or changed in this phase.

Known Jena/dotNetRDF differences recorded for this slice:

- Blank-node internal identifiers are implementation-specific. The application
  formatter deliberately collapses them to `blank`, while graph comparisons
  use isomorphism.
- Jena assigns `xsd:string` to plain RDF 1.1 string literals. This is a term
  mapping difference from APIs that report no datatype for a simple literal;
  it is semantic metadata at the RDF boundary but representationally invisible
  in the existing C# formatter, which returns only lexical text. The regression
  retains Jena's datatype rather than silently discarding it. A C# RDF-term
  capture is needed before declaring compatibility with any downstream API
  that exposes literal datatype metadata.
- Unordered SPARQL result sequence is not asserted or normalized. The adapter
  adds no ordering; only an explicit `ORDER BY` fixture asserts row order.

### Verification

The following completed successfully from the repository root using the Gradle
wrapper and a temporary Gradle user home:

```sh
GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew test --no-daemon
GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintCheck detekt test --no-daemon
```

## Prompt 9: typed Wikidata SPARQL query generation

`wikidata/query/WikidataQueryGenerator.kt` now ports the query construction
performed by C# `SparqlQueryBuilder` and its `EndpointService` callers as an
independently testable Kotlin component. It has no Ktor dependency. Structured
inputs cover Wikidata entities (`Q...`), properties (`P...`), variables, IRIs,
direct-claim property paths, literal values, blank-node patterns, and the
six C# filter modes. `GeneralSelectQuery`, `DisplaySelectQuery`,
`RelationshipQuery`, `RelationshipValueQuery`, and `SearchSelectQuery` cover
all SPARQL-producing `EndpointService` paths.

The deterministic renderer preserves the C# prefixes, `SELECT DISTINCT`
projection names, OPTIONAL label blocks, `lang(...)=\"en\"` selection,
Wikidata `wikibase:directClaim` convention, parent/property type binds,
filter/order-before-limit flow, `Max`/`Min` `LIMIT 1` behavior, and empty
collection paths. `WikidataQueryGeneratorTest` supplies stable exact snapshots
for the Wikidata generation fixture and structural Jena parser checks for every
generated form, including multiple patterns, property paths, filters, language
selection, empty inputs, invalid IDs, and escaped literal/filter values.

Intentional security differences from the C# builder are documented and tested:
the C# implementation directly interpolates request strings (including raw
property paths and filters) and generates random literal variable suffixes.
Kotlin rejects malformed entity/property/variable/numeric identifiers, accepts
property paths only as validated `P...` lists, escapes literal/string filter
content explicitly, and names literal variables by deterministic pattern index.
These are compatibility-layer changes required to prevent SPARQL injection;
they are not represented as a silent snapshot update. The C# golden-output
directory remains empty, so no captured C# snapshot can yet be compared beyond
the source-derived `WIKIDATA-GENERATION-001` stable snapshot.

Focused validation passed:

```sh
GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintFormat test \
  --tests 'com.example.sparqlqueryeasy.wikidata.query.WikidataQueryGeneratorTest' --no-daemon
```

Complete formatting, static analysis, and compatibility validation passed:

```sh
GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintFormat ktlintCheck detekt test --no-daemon
```

## Prompt 10: Kotlin Wikidata SPARQL HTTP client

`wikidata/client/WikidataHttpClient.kt` adds `KtorWikidataHttpClient`, a
transport-only client that accepts generated query text and a configurable
HTTP(S) endpoint. Query generation remains in the independent Wikidata query
generator. The default User-Agent remains the C# value (`.NET QueryEasy`) and
can be overridden. `createWikidataHttpClient` supplies CIO plus explicit
connect (10 seconds) and request (30 seconds) timeout configuration; callers
injecting a client (including MockEngine) retain control of its engine and
configuration. The client is `AutoCloseable` and does not retry requests.

SPARQL JSON responses are decoded into application-owned `SparqlSelectResult`
values. `head.vars` determines projected-variable order; every row includes an
explicit `UnboundSparqlBinding` for an absent variable. URI, blank-node, plain,
language-tagged, and typed literal bindings preserve their value, lexical form,
datatype IRI, and language tag. Unknown binding types, invalid domain values,
missing required response fields, and bindings absent from `head.vars` become a
diagnostic `WikidataHttpFailure`.

HTTP status handling is explicit. Every non-2xx response retains endpoint,
query, status code, bounded response diagnostics, and `Retry-After`. HTTP 429
is marked `retryable` for a higher-level policy but is never retried here;
400/500 and other permanent failures are not retried. Request timeouts become a
failure with timeout diagnostics, preserving the original cause. This keeps
the C# client's exception-on-SPARQL-transport-failure behavior while exposing
structured status data to the application layer. The separate C# Wikidata
entity-search branch still has its documented non-2xx empty-result behavior and
is not conflated with this SPARQL transport.

`WikidataHttpClientTest` uses Ktor MockEngine and recorded JSON strings for
successful, empty, missing-binding, language-tagged, typed-literal, malformed,
400, 429, 500, and timeout cases. It asserts request query encoding, Accept and
User-Agent headers, endpoint validation, timeout configuration, and the
no-retry guarantee. No live Wikidata call is made by the normal test task. A
live integration-test task remains intentionally unconfigured/opt-in for a
future phase.

An opt-in `integrationTest` source set/task now contains a basic live Wikidata
SELECT check. It is skipped unless `RUN_WIKIDATA_INTEGRATION=true`; the endpoint
can be overridden with `WIKIDATA_SPARQL_ENDPOINT`. The normal `test` task never
contacts Wikidata.

The HTTP client tests add six passing transport regressions. Formatting and
static analysis pass.

## Prompt 8: pure Kotlin result filtering and RDF business rules

### Migrated functions

`application/query/ResultFilteringService.kt` ports the post-execution portions
of these C# `EndpointService` functions without introducing a Ktor route,
Jena type, query builder, or endpoint dependency:

| Kotlin function | C# source function | Preserved behavior |
|---|---|---|
| `elementRelationships` | `GetElementRelationships` | Maps `property`, `propertyLabel`, and `propertyType` in row order; local results are returned unchanged; non-local results then remove empty labels and exact `outro` types. |
| `relationshipValues` | `GetRelationshipValue` | Literal values use lexical text as both ID and label with type `text`; resource values use bracketed IRIs; blank nodes are `blank`; empty labels are removed after mapping. |
| `search` | `GetSearch` local/remote post-query paths | An empty search returns an empty list; remote mappings are otherwise untouched; local mappings use current-culture lowercase containment, exact `objetoClasse`, then `Take(20)`, with no trim or deduplication. |
| `query` | `GetQuery` post-query path | Removes every `?` from the requested variable name, falls back from an empty label to the ID, removes empty final labels, then applies the exact `objetoClasse` filter only for empty-where requests. |

All lookups treat missing and explicit unbound bindings as the C# extension's
empty string. Literal rendering deliberately uses lexical form only: language
tags and datatype IRIs remain on the domain value and are neither coerced nor
included in the C#-compatible display/comparison strings. Whitespace is not
trimmed. The pipeline materializes a `List` in original row order and does not
remove duplicates.

`ResultFilteringServiceTest` ties its cases to the existing
`RELATIONSHIPS-LOCAL-001`, `RELATIONSHIP-LITERAL-001`,
`RELATIONSHIP-RESOURCE-001`, `SEARCH-LOCAL-001`, and
`QUERY-EMPTY-WHERE-001` fixture names. The expected-output directory still has
no captured C# baselines, so these focused tests encode only directly observed
C# source behavior and fixture RDF terms; no golden result was added or
changed.

### Remaining work

Ktor routes, request binding, endpoint state selection, and local-cache
behavior remain unported. In particular, the C# query builder's
projection-name discrepancy in
the empty-where path is documented by the existing compatibility catalogue but
is not corrected or hidden by this result-filtering layer.

Focused validation passed:

```sh
GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintFormat test \
  --tests 'com.example.sparqlqueryeasy.application.query.ResultFilteringServiceTest' --no-daemon
```

Complete validation also passed (37 tests, zero failures):

```sh
GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintCheck detekt test --no-daemon
```

## Prompt 11: element-relationships application service

This slice ports C# `EndpointService.GetElementRelationships` and its
controller entry flow up to (but excluding) HTTP routing.
`ElementRelationshipsService` accepts a typed endpoint URL plus a typed RDF
subject (`ElementRelationshipsRequest`), resolves a request-scoped
`EndpointExecution`, generates the relationship query, executes it, and
delegates C#-compatible row mapping/filtering to `ResultFilteringService`.

Inputs are the endpoint URL and element RDF term. Dependencies are injected
`EndpointExecutionResolver`, `WikidataQueryGenerator`, and
`ResultFilteringService`; the endpoint capability exposes only `isLocal`,
`isWikidata`, and application-owned suspend SELECT execution. The output is an
ordered, duplicate-preserving `List<PropertyResult>`. No mutable endpoint
state, Ktor type, or Jena type crosses this boundary.

`ElementRelationshipsServiceTest` characterizes `RELATIONSHIPS-LOCAL-001`
(`relationships.ttl` and `relationships-query.json`) for local and remote
branches. It asserts the exact C# order—map rows, then apply non-local
empty-label/`outro` filtering while leaving local rows unchanged—plus Wikidata
direct-claim label generation, regular local labels, explicit unbound values,
and resolver-failure propagation. The service intentionally does not catch or
reorder dependency exceptions.

Focused validation passed:

```sh
GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintFormat test \
  --tests 'com.example.sparqlqueryeasy.application.relationships.ElementRelationshipsServiceTest' --no-daemon
```

## Prompt 12: relationship-value application service

This slice ports C# `EndpointService.GetRelationshipValue` through the
application boundary, without adding a Ktor route. `RelationshipValueService`
accepts an endpoint URL, typed subject and predicate terms, and the literal
mode; it resolves an injected `EndpointExecution`, generates the corresponding
typed Wikidata query, executes it, and applies the existing C#-compatible
relationship-value mapping.

Inputs are `endpointUrl`, `subject`, `predicate`, and `isLiteral`. The output
is an ordered, duplicate-preserving `List<PropertyResult>`. Dependencies are
the injected endpoint resolver, query generator, and result-filtering service.
Only application-owned RDF/SPARQL types cross the boundary; Jena, Ktor, and
global mutable state are not exposed. Endpoint capability controls Wikidata
prefixes while the query generator preserves the C# distinction between
literal values (no label OPTIONAL) and resource values (regular `rdfs:label`).

`RelationshipValueServiceTest` reproduces the characterization fixtures
`RELATIONSHIP-LITERAL-001` (`literals.ttl`, `relationship-literal-query.json`)
and `RELATIONSHIP-RESOURCE-001` (`simple.ttl`, relationship-resource query).
It verifies lexical literal preservation for language-tagged and typed values,
blank-node formatting, missing/unbound values, resource label filtering,
deterministic query capabilities, and unchanged execution-exception behavior.

Focused validation passed:

```sh
GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintFormat test \
  --tests 'com.example.sparqlqueryeasy.application.relationships.RelationshipValueServiceTest' --no-daemon
```

Complete compatibility validation for this phase is run after the focused
slice review; no golden outputs were changed.

## Prompt 13: local-database-upload application service

This slice ports the application behavior of C#
`LocalDatabaseController.Post` without adding a Ktor multipart route.
`LocalDatabaseUploadService` accepts `LocalDatabaseUploadRequest`, whose
nullable `TurtleUpload` is an application boundary rather than an `IFormFile`,
Ktor type, Java stream, Jena model, or dotNetRDF graph. A future HTTP adapter
must encapsulate its multipart stream behind `TurtleUpload.readUtf8()` and
must rely on the service to call `close()` exactly once for a present upload.

The C# controller creates `Guid.NewGuid().ToString()` before dereferencing its
`ttlFile`, creates an empty graph, parses the complete stream without an
application-supplied base IRI, then calls `IMemoryCache.Set` only after parsing
succeeds. Its `using` block closes the upload stream; empty Turtle is a valid
empty graph; invalid Turtle and read/cache failures escape; a missing
`ttlFile` dereferences null and also escapes. `RandomUuidLocalGraphHandleGenerator`
preserves the externally visible lower-case hyphenated UUID representation by
using `UUID.randomUUID().toString()` and is injectable for deterministic tests.

`LocalGraphCache` and `InMemoryLocalGraphCache` are the new application-owned
local-graph storage boundary. The cache owns references to immutable
application `RdfGraph` values, never Jena models. `put` explicitly replaces a
handle collision, matching `IMemoryCache.Set`, and `get` uses the C# 12-hour
sliding-access expiration behavior. Entries are expired lazily on lookup;
there is no global cache instance, background eviction, or Ktor dependency.
Parsing completes before `put`, ensuring a malformed graph is never visible.

The service returns application results: `Success(databaseId)`,
`MissingUpload`, or `InvalidTurtle(TurtleParsingFailure)`. The latter two
make failure states usable by a later route while retaining parser diagnostics.
This is the one intentional application-boundary difference from the C#
controller's unhandled null/parser exceptions; no HTTP status/body behavior
has been selected or changed in this phase. Unexpected upload-read, close,
cache, and non-parser failures still propagate unchanged.

`LocalDatabaseUploadServiceTest` characterizes `TTL-SIMPLE-001`,
`TTL-PREFIX-001`, `TTL-BASE-001`, `TTL-IRI-UNICODE-001`, `TTL-BNODE-001`,
`TTL-LITERAL-001`, `TTL-NUMERIC-001`, `TTL-EMPTY-001`, `TTL-INVALID-001`,
`TTL-INVALID-002`, and `HTTP-MISSING-UPLOAD-001`. It also verifies deterministic
UUID output, successful and missing cache lookup, independent uploads,
replacement-on-collision, sliding expiration, no insertion after parser/read
failure, read/cache failure propagation, and upload lifecycle closure.

Focused validation passed:

```sh
GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintFormat test \
  --tests 'com.example.sparqlqueryeasy.application.localdatabase.LocalDatabaseUploadServiceTest' --no-daemon
```

Complete JDK 21 validation passed:

```sh
GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew clean compileKotlin \
  compileTestKotlin ktlintCheck detekt test --no-daemon
```

This application use case is complete; Ktor upload routing and endpoint-context
are deliberately not part of this slice.

## Prompt 14: endpoint-context application service

This slice ports C# `EndpointService.SetEndpoint` as the stateless
`EndpointContextResolver`. It replaces the C# typed client's mutable
`_queryBuilder`, `_queryExecutor`, `_isWikidata`, and `_queryType` fields with
a newly created immutable `EndpointContext` for each resolution. Contexts are
`BuiltInGraphEndpointContext`, `UploadedGraphEndpointContext`,
`WikidataEndpointContext`, or `RemoteSparqlEndpointContext`; each owns a
request-scoped execution capability supplied by injected local or remote
executor factories. Resolution never executes a SPARQL query.

The supported C# endpoint forms are preserved as follows:

- Exactly case-sensitive `CampeonatoBrasileiro2023` selects the local built-in
  graph. Trailing text, slash, whitespace, or case changes do not select it.
- C# `Guid.TryParse` forms (`D`, `N`, braced `B`, parenthesized `P`, and
  hexadecimal `X`, including surrounding whitespace for classification) select
  the local uploaded-graph path. The original, unnormalized text remains the
  cache key, matching `LocalQueryExecutor.SetDatabase`; only the canonical
  lower-case UUID emitted by upload normally reaches an existing cache entry.
- Every other value is remote. Wikidata mode is the original raw,
  case-sensitive `Contains("query.wikidata.org/sparql")` check, including a
  trailing slash or the marker in another host/path. Case variants are generic
  remote endpoints, as in C#.

`InMemoryLocalGraphCache` from Prompt 13 is used directly. A missing local
graph returns explicit `LocalGraphUnavailable(endpointUrl)` rather than C#'s
unhandled `Exception("Local database not available")`; this is an intentional
application-boundary result difference, with no HTTP status/body decision made.
Likewise invalid remote values return `InvalidRemoteEndpoint` with diagnostics.

The one necessary validation change is that Kotlin accepts only absolute HTTP
or HTTPS endpoints with a host and rejects surrounding whitespace; C# passes
all non-local strings to `new Uri(database)`, whose broader and normalization
behavior has not been captured. The Kotlin context preserves otherwise valid
input text without scheme/path/trailing-slash normalization. This restriction
is documented as a deliberate endpoint safety boundary for later route review.

The C# `BrasileiraoDatabase` reads and parses
`Sparql.QueryEasy/futebol_completo.ttl` once at application construction and
is registered as a singleton. Gradle now packages that exact tracked asset as
`futebol_completo.ttl`; `ClasspathTurtleTextSource` closes the classpath stream
internally, and `ParsedBuiltInGraphProvider` parses it eagerly once when
constructed, retaining an application-owned immutable graph for its lifetime.
Any missing resource raises `BuiltInGraphLoadingFailure`; parser failures retain
the existing `TurtleParsingFailure` type. Application composition remains a
later phase, so no Ktor route or singleton wiring was added here.

`EndpointContextResolverTest` covers `BUILTIN-GRAPH-001`,
`LOCAL-CACHE-MISS-001`, `WIKIDATA-GENERATION-001`, canonical and alternative
GUID forms, built-in and uploaded local contexts, generic remotes, empty and
malformed endpoints, whitespace/trailing-slash/case behavior, raw Wikidata URL
variants, interleaved independent contexts/executors, no execution during
resolution, bundled-resource availability, eager one-time loading, and resource
or parser failure behavior.

Focused validation passed:

```sh
GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintFormat test \
  --tests 'com.example.sparqlqueryeasy.application.endpoints.EndpointContextResolverTest' --no-daemon
```

Complete JDK 21 validation passed:

```sh
GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintFormat \
  ktlintCheck detekt test --no-daemon
```

This application use case is complete; `GetSparqlQuery`, `GetQuery`,
`GetSearch`, and all Ktor routes remain deliberately unported in this slice.

## Prompt 15: sparql-query-generation application service

This slice ports C# `EndpointService.GetSparqlQuery` into the Ktor-free
`SparqlQueryGenerationService`. `SparqlQueryGenerationRequest` accepts typed
`QueryVariable` and `TriplePattern` values, with the C# default limit of 20;
zero is retained and an empty pattern collection produces an empty `WHERE`.
The service converts the request to the existing `DisplaySelectQuery` and
returns an application-owned success or explicit invalid-input/generated-query
failure. It never executes the selected endpoint context.

Endpoint context affects only the default prefix set: local and generic remote
contexts use the RDF/RDFS/OWL prefixes, while Wikidata contexts additionally
use `wikibase`. Labels remain ordinary `rdfs:label` labels because the C# call
passes `ignoreWikidata: true`. The existing typed Wikidata generator remains
the sole query-building implementation; output is deterministic and exact
snapshot assertions are separate from Jena syntax-validation assertions.

The C# method does not pass `WhereRequest.FilterType` to `Where`, so the
compatibility service deliberately clears typed filters for this use case.
The resulting literal behavior is the builder's string-equality filter; the
generator's StartsWith, Contains, numeric, and ordering support remains covered
for the later `GetQuery` slice. Typed identifiers reject unsafe path/IRI input
and negative limits before generation. This is an intentional safety and API
boundary difference from C#'s raw string interpolation and is covered by
`SPARQL-INJECTION-PATH-001` regression assertions.

`SparqlSyntaxValidator` is the application-owned validation boundary and
`JenaSparqlSyntaxValidator` uses `QueryFactory.create` without executing a
query. `SparqlQueryGenerationServiceTest` covers
`SELECT-BASIC-001`, `SELECT-OPTIONAL-001`, all listed filter/order fixtures,
`SELECT-LIMIT-ZERO-001`, `SELECT-LIMIT-TWO-001`,
`SPARQL-INJECTION-PATH-001`, `WIKIDATA-GENERATION-001`, and
`SELECT-INVALID-001`, plus local/generic/Wikidata contexts, deterministic
repeated generation, malformed generated output, typed validation, and the
no-execution contract.

Focused validation passed:

```sh
GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintFormat test \
  --tests 'com.example.sparqlqueryeasy.application.querygeneration.SparqlQueryGenerationServiceTest' --no-daemon
```

Complete JDK 21 validation passed:

```sh
GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintFormat \
  ktlintCheck detekt test --no-daemon
```

The `sparql-query-generation` use case is complete. `GetQuery`, `GetSearch`,
general query execution, and Ktor routes remain deliberately unported.

## Prompt 16: general-query application service

This slice ports C# `EndpointService.GetQuery` as the suspend, Ktor-free
`GeneralQueryService`. `GeneralQueryRequest` supplies typed query variable,
triple patterns, filters, limit, and `ignoreWikidata`; the service delegates
all SPARQL construction to `CSharpCompatibleWikidataQueryGenerator`, syntax
checking to `SparqlSyntaxValidator`, execution to the immutable
`EndpointContext` capability, and post-execution mapping/filtering to the
existing `ResultFilteringService.query`.

The pipeline is deliberately ordered as C# does it: typed request conversion;
generator-side triple/filter/order/limit construction; syntax validation;
local or remote execution selected by the context; then `PropertyResult`
mapping, empty-label fallback, label filtering, and—only for empty WHERE—the
parent-type filtering. SPARQL therefore performs `DISTINCT`, ordering, and
limit before application filtering. No application order is introduced when
the query has no `ORDER BY`; projected variables, unbound bindings, and rows
are passed directly to the established application-owned result types.

Wikidata contexts always include the `wikibase` prefix, matching the C# query
builder selected by `SetEndpoint`; `ignoreWikidata` only selects whether the
Wikidata direct-claim label form is used. Local uploaded and built-in contexts,
generic remote contexts, and Wikidata contexts execute only through their
request-scoped supplied executor. `EndpointContextResolution` cache misses and
invalid endpoints become explicit application results, and RDF/query transport
failures become `ExecutionFailure` retaining the original `RdfFailure` cause
and diagnostic. Invalid typed input and invalid generated SPARQL are also
explicit results. Unexpected non-RDF runtime exceptions continue to propagate,
as in C#.

One C# behavior is intentionally preserved although it is likely a defect:
the empty-WHERE branch binds `?itemParentType` but the SELECT clause projects
`?itemType`; `ResultFilteringService.query` then filters on the unprojected
parent-type value. A real executor therefore returns no empty-WHERE values.
This is covered by `QUERY-EMPTY-WHERE-001`; it has not been silently corrected.
The typed generator continues to reject unsafe identifiers and values, rather
than C#'s raw interpolation, as documented in Prompt 15.

`GeneralQueryServiceTest` covers `SELECT-BASIC-001`,
`SELECT-OPTIONAL-001`, `SELECT-FILTER-STARTS-001`,
`SELECT-FILTER-CONTAINS-001`, `SELECT-FILTER-GREATER-001`,
`SELECT-FILTER-LESSER-001`, `SELECT-DISTINCT-001`,
`SELECT-ORDER-MAX-001`, `SELECT-ORDER-MIN-001`, `SELECT-EMPTY-001`,
`SELECT-INVALID-001`, `QUERY-EMPTY-WHERE-001`, `TTL-PREFIX-001`,
`TTL-BASE-001`, `TTL-IRI-UNICODE-001`, `TTL-BNODE-001`,
`TTL-NUMERIC-001`, and `LOCAL-CACHE-MISS-001`. It uses an actual Jena local
executor for the recorded Turtle-style local-graph path and fakes for generic
remote/Wikidata/failure responses; no live endpoint is contacted. It also
covers unbound optional labels, duplicate preservation after execution,
generator `DISTINCT`, ordering/limit placement, built-in/uploaded contexts,
invalid syntax, failures, and interleaved context isolation.

Focused validation passed:

```sh
GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintFormat test \
  --tests 'com.example.sparqlqueryeasy.application.query.GeneralQueryServiceTest' --no-daemon
```

Complete JDK 21 validation passed:

```sh
GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintFormat \
  ktlintCheck detekt test --no-daemon
```

The `general-query` use case is complete. Search, Ktor routes, and endpoint
composition remain deliberately unported.

## Prompt 17: search application service

This slice ports C# `EndpointService.GetSearch` as `SearchService`, with three
immutable-context branches. Local uploaded and built-in graph contexts generate
an unfiltered `SearchSelectQuery`, execute through their supplied local
capability, and delegate current-locale case-insensitive label matching,
exact `objetoClasse` selection, and the fixed first-20 result cap to
`ResultFilteringService.search`. Generic non-Wikidata remotes generate a
SPARQL `STRSTARTS` label filter and supplied SPARQL limit, then map results
without further filtering or limiting. No order is introduced before the local
filter-and-`take(20)` pipeline; the executor's result sequence is retained.

Wikidata endpoint contexts do not run SPARQL search. They use the independent
`WikidataEntitySearchClient` MediaWiki `wbsearchentities` transport and map a
record to C#-compatible `PropertyResult` strings (`<concepturi>`, `(id) label`,
and `object`). `KtorWikidataEntitySearchClient` has its own configurable API
endpoint, User-Agent, connection/request timeouts, JSON parsing, and explicit
HTTP/timeout/malformed-response failure. It is deliberately separate from the
existing Wikidata SPARQL JSON client.

Empty search text returns an empty success before endpoint selection, matching
C# `string.IsNullOrEmpty`; whitespace remains searchable. Kotlin passes text
as a Ktor URL parameter and the SPARQL generator escapes it as a literal. This
replaces C# MediaWiki URL-template interpolation, preventing query-string and
SPARQL injection; special characters and Unicode have regression coverage.
Negative limits are explicit invalid input; zero is retained. MediaWiki HTTP
non-success responses are explicit application failures, whereas C# silently
returned an empty collection for a non-success `HttpClient` response. This is
an intentional error-contract correction for the later route phase.

`SearchServiceTest` covers `SEARCH-LOCAL-001`, `BUILTIN-GRAPH-001`,
`TTL-EMPTY-001`, `LOCAL-CACHE-MISS-001`, local fewer/more-than-20 result order,
generic remote SPARQL behavior, Unicode and injection-like input, Wikidata
branch selection, missing MediaWiki fields, MediaWiki errors, empty input,
executor failures, and interleaved contexts. `WikidataEntitySearchHttpClientTest`
uses Ktor `MockEngine` recorded data for `WIKIDATA-SEARCH-RECORD-001` and
`WIKIDATA-SEARCH-ERROR-001`, encoding, malformed JSON, timeout, and HTTP 400,
429, and 500. No test contacts live Wikidata; any live test remains opt-in in
the existing `integrationTest` task.

Focused validation passed:

```sh
GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintFormat test \
  --tests 'com.example.sparqlqueryeasy.application.search.SearchServiceTest' \
  --tests 'com.example.sparqlqueryeasy.wikidata.entitysearch.WikidataEntitySearchHttpClientTest' --no-daemon
```

Complete JDK 21 validation passed:

```sh
GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintFormat \
  ktlintCheck detekt test --no-daemon
```

The `search` use case is complete. All identified application-service use
cases are ready for the Ktor route phase; no routes were implemented here.

## Prompt 18: local-database HTTP route group

This slice ports `LocalDatabaseController.Post` as
`POST /api/local-database`. The Ktor handler is intentionally thin: it reads
the `multipart/form-data` field `ttlFile`, materializes a request-owned upload
adapter, invokes the existing `LocalDatabaseUploadService`, and maps its
application result. Successful responses preserve the C# `200 OK` camelCase
wrapper: `{"data":"<uuid>"}` with `application/json`. Multipart parsing,
Turtle parsing, UUID generation, graph caching, and stream ownership remain in
the application/RDF layers rather than the route.

Missing `ttlFile` and invalid Turtle are mapped to explicit `400 Bad Request`
JSON error responses. The C# controller dereferenced a missing form file and
would surface an unhandled server exception; this explicit validation status is
an intentional HTTP-boundary correction, while the application-level
`MissingUpload` distinction remains preserved. The route disposes every
multipart part and the upload service closes its upload boundary after reading.
The default application composition uses the Jena Turtle parser and the
12-hour sliding in-memory graph cache; tests inject deterministic UUID/cache
dependencies.

`LocalDatabaseRoutesTest` covers successful `TTL-SIMPLE-001` upload, exact
status/content type/JSON shape, `HTTP-MISSING-UPLOAD-001`, `TTL-INVALID-001`
without cache insertion, and `TTL-EMPTY-001`. Application-level tests retain
the remaining Turtle compatibility fixtures, cleanup, and failure behavior.

Focused validation passed:

```sh
GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintFormat test \
  --tests 'com.example.sparqlqueryeasy.http.LocalDatabaseRoutesTest' --no-daemon
```

Complete JDK 21 validation passed:

```sh
GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintFormat \
  ktlintCheck detekt test --no-daemon
```

The local-database route group is complete. The QueryController group
(`/api/query`, `/api/query/relationships`, `/api/query/relationship-value`,
`/api/query/search`, and `/api/query/sparql`) remains for the next route slice;
no QueryController routes were modified here.

## Prompt 19: QueryController HTTP route group

This slice ports all five `QueryController` routes under `/api/query`: the
base query endpoint plus `relationships`, `relationship-value`, `search`, and
`sparql`. Request DTOs retain the C# field names and defaults, and successful
responses use the `{"data": ...}` camel-case envelope. The application-owned
endpoint context resolver creates request-scoped local Jena or remote SPARQL
execution capabilities, keeping Jena types within `rdf.jena`.

Missing local uploaded graphs map to `404`, malformed request values and
invalid generated SPARQL map to `400`, and explicit remote execution failures
map to `502`. The latter statuses are Kotlin HTTP-boundary diagnostics; the C#
controller delegated many of these cases to framework exception handling, so
they require contract approval before public rollout. `/api/query/sparql`
deliberately ignores `filterType`, matching the C# `GetSparqlQuery` path.

`QueryRoutesTest` covers response envelopes and nullable `PropertyDto` fields,
invalid query input without execution, cache misses, generated-query behavior,
empty search behavior, relationship-value validation, and a deterministic
remote failure. No test contacts Wikidata.

Complete JDK 21 validation passed:

```sh
GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintFormat \
  ktlintCheck detekt test --daemon
```

The QueryController route group is complete. Direct C# fixture capture remains
blocked until the .NET harness can run.
