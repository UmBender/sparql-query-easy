# Characterization Case Catalogue

Reviewed C# outputs for the original 34 executable cases remain under
`../expected/<case-id>/` and indexed by `../expected/index.json`. Three
additional success captures are stored separately under
`../retirement-expected/`. Capture provenance for both sets is recorded in
`capture-status.tsv`. Boundary-only catalogue cases and controlled Wikidata
faults are not C# HTTP goldens. Upload-based requests use the `__DATABASE_ID__`
placeholder after uploading the listed Turtle input. Fixture paths in the
tables are relative to `compatibility/`.

## Turtle upload and graph parsing

| Case ID | Inputs and route | Behavior characterized | Why it matters |
|---|---|---|---|
| `TTL-SIMPLE-001` | `turtle/simple.ttl` → `POST /api/local-database` | Minimal graph parse and UUID response. | Establishes upload success, graph creation, and wrapper shape. |
| `TTL-PREFIX-001` | `prefixes.ttl` upload; `requests/prefix-query.json` → `/api/query` | Prefix expansion into locally queried terms. | Prefix resolution must match Jena. |
| `TTL-BASE-001` | `base-iri.ttl` upload; `base-iri-query.json` → `/api/query` | Relative IRI resolution using document `@base`. | Base IRI changes graph identity and matches. |
| `TTL-IRI-UNICODE-001` | `escaped-unicode-iris.ttl` upload; `iri-unicode-query.json` → `/api/query` | `\\u` escaped and direct Unicode IRI parsing/formatting. | URI normalization must not silently change. |
| `TTL-BNODE-001` | `blank-nodes.ttl` upload; `blank-node-query.json` → `/api/query` | Distinct blank-node join/select behavior and public `"blank"` output. | Internal identity and public formatting are separate contracts. |
| `TTL-LITERAL-001` | `literals.ttl` upload; `literal-value-query.json` → `/relationship-value` | Plain, language-tagged, typed, and escaped literal parsing; lexical output. | Output drops datatype/language, while RDF/SPARQL semantics retain them. |
| `TTL-NUMERIC-001` | `numeric-literals.ttl` upload; `numeric-filter-query.json` → `/api/query` | Integers, decimals, doubles, booleans, and typed integer parse/filter behavior. | Numeric semantics can differ by RDF engine. |
| `TTL-EMPTY-001` | `empty.ttl` upload; `empty-result-query.json` → `/api/query` | Empty graph is valid; valid query yields no rows. | Distinguishes zero data from parser/cache failure. |
| `TTL-INVALID-001` | `invalid-unclosed-string.ttl` → upload | Invalid literal parser failure status/body and lack of usable cache ID. | Parser-error contract must be known before Ktor error handling. |
| `TTL-INVALID-002` | `invalid-prefix.ttl` → upload | Invalid prefix parser behavior. | Parser tolerance may differ between dotNetRDF and Jena. |

## Generated SELECT/SPARQL behavior

| Case ID | Inputs and route | Behavior characterized | Why it matters |
|---|---|---|---|
| `SELECT-BASIC-001` | `simple.ttl`; `simple-query.json` → `/api/query` and `/api/query/sparql` | Basic `SELECT DISTINCT`, URI bracket formatting, variable mapping, and query text. | Fundamental local execution contract. |
| `SELECT-OPTIONAL-001` | `optional-unbound.ttl`; `optional-unbound-query.json` → both query routes | Generated `OPTIONAL` label clause plus absent label/type/class bindings. | Jena must preserve unbound-variable behavior. |
| `SELECT-FILTER-STARTS-001` | `filters.ttl`; `filter-starts-query.json` → both query routes | `FilterType.Starts`, `STRSTARTS(STR(...))`, and results. | Tests generated filter and raw literal handling. |
| `SELECT-FILTER-CONTAINS-001` | `filters.ttl`; `filter-contains-query.json` → both query routes | `FilterType.Contains`, `CONTAINS(STR(...))`, and results. | Captures case/lexical behavior. |
| `SELECT-FILTER-GREATER-001` | `numeric-literals.ttl`; `filter-greater-query.json` → both query routes | `FilterType.Greater` comparison semantics. | Numeric coercion/error behavior is engine-sensitive. |
| `SELECT-FILTER-LESSER-001` | `numeric-literals.ttl`; `filter-lesser-query.json` → both query routes | `FilterType.Lesser` comparison semantics. | Same for `<=` and literal types. |
| `SELECT-DISTINCT-001` | `duplicates.ttl`; `duplicates-query.json` → `/api/query` | Full-row DISTINCT with multiple label bindings for one resource. | Prevents Kotlin from collapsing valid distinct solution rows or adding post-query deduplication. |
| `SELECT-ORDER-MAX-001` | `ordering.ttl`; `order-max-query.json` → both query routes | Descending order and forced `LIMIT 1`. | `Max` overrides caller limit. |
| `SELECT-ORDER-MIN-001` | `ordering.ttl`; `order-min-query.json` → both query routes | Ascending order and forced `LIMIT 1`. | Same contract for `Min`. |
| `SELECT-LIMIT-ZERO-001` | `simple.ttl`; `limit-zero-query.json` → `/api/query/sparql` | LIMIT generation at zero. | Do not assume Kotlin clamps/validates existing input. |
| `SELECT-LIMIT-TWO-001` | `simple.ttl`; `limit-two-query.json` → `/api/query/sparql` | LIMIT generation at an ordinary boundary. | Captures the exact generated clause. |
| `SELECT-OFFSET-UNAVAILABLE-001` | `queries/offset-not-supported.md` | No request or builder support for OFFSET. | Records an API boundary; no output to capture. |
| `SELECT-PATH-UNAVAILABLE-001` | `queries/property-path-not-generated.md` | Builder does not itself create property paths. | Records normal-path behavior. |
| `SPARQL-INJECTION-PATH-001` | `user-controlled-fragments.md`; `property-path-observation.json` → `/api/query/sparql` only | Raw predicate/path interpolation without execution. | Documents security-sensitive generated text safely. |
| `SELECT-EMPTY-001` | `empty.ttl`; `empty-result-query.json` → `/api/query` | Empty JSON data array for valid query. | Differentiates no rows from an error. |
| `SELECT-INVALID-001` | `simple.ttl`; `invalid-sparql-request.json` → `/api/query` and `/api/query/sparql` | Parser/error behavior from malformed user-controlled query text. | Ktor/Jena error mapping cannot be silently substituted. |
| `ASK-CONSTRUCT-UNAVAILABLE-001` | `queries/ask-construct-not-exposed.md` | No public ASK or CONSTRUCT route. | Avoids invented HTTP behavior. |

## Endpoint service and application filtering

| Case ID | Inputs and route | Behavior characterized | Why it matters |
|---|---|---|---|
| `RELATIONSHIPS-LOCAL-001` | `relationships.ttl`; `relationships-query.json` → `/api/query/relationships` | Local property relationship rows. | Local bypasses remote-only empty-label/`outro` filter. |
| `RELATIONSHIP-LITERAL-001` | `literals.ttl`; `relationship-literal-query.json` → `/relationship-value` | Literal lexical text becomes both ID and label; type is `text`. | Captures the specialized RDF node-formatting branch. |
| `RELATIONSHIP-RESOURCE-001` | `simple.ttl`; `relationship-resource-query.json` → `/relationship-value` | URI has brackets and label-filter behavior. | Captures default URI formatting. |
| `SEARCH-LOCAL-001` | `search.ttl`; `local-search-query.json` → `/api/query/search` | Case-insensitive local contains, `objetoClasse`, fixed `Take(20)`. | Caller limit is ignored locally. |
| `QUERY-EMPTY-WHERE-001` | `search.ttl`; `empty-where-query.json` → `/api/query` | Broad `?item ?p ?o` fallback and `objetoClasse` post-filter. | Captures a high-cardinality special branch. |
| `BUILTIN-GRAPH-001` | `builtin-search-query.json` → `/api/query/search` | Named startup-loaded built-in graph selection. | Protects resource-loading/named-database behavior. |
| `LOCAL-CACHE-MISS-001` | `cache-miss-query.json` → `/api/query` | Unknown UUID error response. | Defines cache-miss/error behavior. |

## HTTP and Wikidata behavior

| Case ID | Inputs and route | Behavior characterized | Why it matters |
|---|---|---|---|
| `HTTP-HEALTH-001` | Actual ASP.NET host `GET /health`; `../retirement-expected/HTTP-HEALTH-001/case.json` | `200 text/plain Healthy`; Kotlin currently returns `200` JSON `{"status":"ok"}`. | Health-body difference requires approval or correction; not equivalent yet. |
| `HTTP-BAD-JSON-001` | `malformed.json` → `POST /api/query` | Framework/model-binding malformed JSON response. | Ktor behavior must be chosen deliberately. |
| `HTTP-MISSING-UPLOAD-001` | `POST /api/local-database` without `ttlFile` | Missing multipart field behavior. | Captures current validation/error boundary. |
| `WIKIDATA-GENERATION-001` | `wikidata-query-generation.json` → `/api/query/sparql` | Wikidata prefix and `wikibase:directClaim` label text. | Safe, no-network characterization of Wikidata logic. |
| `WIKIDATA-SEARCH-RECORD-001` | One public response recorded under `wikidata-responses/` | Raw upstream input reused in C# and Kotlin route tests. | No ordinary test contacts Wikidata. |
| `WIKIDATA-SEARCH-CSHARP-001` | Recorded upstream body → original C# `POST /api/query/search`; `../retirement-expected/WIKIDATA-SEARCH-CSHARP-001/case.json` | Controller result and upstream request are captured. | Kotlin route output is compared offline. |
| `REMOTE-RELATIONSHIP-CSHARP-001` | Controlled SPARQL JSON → original C# `POST /api/query/relationship-value`; `../retirement-expected/REMOTE-RELATIONSHIP-CSHARP-001/case.json` | Production `RemoteQueryExecutor` query/result and controller response captured. | Kotlin route, SPARQL text, projected variables and RDF bindings are compared offline. |
| `WIKIDATA-SEARCH-ERROR-001` | Controlled local `429` fixture, not Wikidata traffic | C# non-success empty-data versus Kotlin JSON `502` behavior. | Explicit intentional difference, tested offline. |
| `WIKIDATA-SEARCH-MALFORMED-001` | Controlled local malformed `200` fixture | Kotlin JSON `502` parsing failure. | Error-path replay is offline; not a C# middleware capture. |

## Capture status

Use [capture-status.tsv](capture-status.tsv) as the authoritative capture
ledger. A case is baseline-complete only after a real capture, environment
metadata, and reviewed normalization note; catalogue entries absent from that
ledger remain uncaptured boundaries or planned recordings.
