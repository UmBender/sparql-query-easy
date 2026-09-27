# C# Characterization Corpus

This directory is a baseline corpus for the existing ASP.NET Core/.NET 8
application. It contains inputs, execution recipes, and reviewed captures from
the in-process C# harness. It deliberately contains no invented response,
status, or query-output golden files.

The case catalogue is [cases/manifest.md](cases/manifest.md). Every case has a
stable ID, input files, C# route, behavior being characterized, and rationale.
`expected/` contains the captured baseline recorded in
`cases/capture-status.tsv`. New or changed cases must still be captured from
the running C# application; never hand-author expected output.

## Layout

```text
compatibility/
├── README.md
├── cases/
│   ├── manifest.md              # case catalogue and capture matrix
│   └── capture-status.tsv       # fill only after a real capture
├── turtle/                      # Turtle uploads, including invalid inputs
├── queries/                     # query-capability boundaries and notes
├── requests/                    # JSON request-body templates
├── wikidata-responses/          # recorded-only HTTP fixtures and policy
└── expected/                    # 34 reviewed C# harness captures + index
```

## Current baseline and comparator

`expected/index.json` lists 34 captured cases. Provenance, runtime, status,
normalizations, and observations are recorded in
`cases/capture-status.tsv`; 32 entries have status `captured` and the two
repaired local-search entries have status `recaptured-reviewed`.

`CaptureDrivenCompatibilityTest` executes every valid capture through Kotlin's
real route/service boundary. It compares graph isomorphism, response status and
JSON, generated or executed SPARQL, projected variables, binding presence, RDF
term details, row multiplicity, and ordering only for captured `ORDER BY`
queries. Its only query-text normalization is the documented random literal
variable suffix. Six exception-category captures remain explicit intentional
differences because the in-process C# harness did not produce middleware HTTP
responses.

## Running a fixture against C#

The preferred capture path is the in-process production harness:

```sh
dotnet run --project compatibility/Compatibility.Harness/Compatibility.Harness.csproj
```

It invokes the production controllers, endpoint service, query builder, and
local executor, writing structured captures to `expected/`. It additionally
captures parsed graph statements and raw `SparqlResultSet` bindings so RDF node
type, lexical form, datatype, language, variable order, row duplicates, and
unbound values remain observable. See
[Compatibility.Harness/README.md](Compatibility.Harness/README.md).

The direct HTTP procedure below remains useful when a full middleware response
(for example a developer exception page or `/health`) must be recorded.

Run the existing project in one terminal. The HTTPS launch profile avoids an
HTTP-to-HTTPS redirect changing the captured request.

```sh
dotnet run --project Sparql.QueryEasy/Sparql.QueryEasy.csproj --launch-profile https
```

In another terminal, use the following convention:

```sh
export API_BASE=https://localhost:7070
curl --silent --show-error --insecure \
  --form ttlFile=@compatibility/turtle/simple.ttl \
  "$API_BASE/api/local-database"
```

Save the returned `data` UUID for the current process. Substitute it for the
literal `__DATABASE_ID__` in request templates before posting them. Never add
that generated UUID to a template or a committed expected response.

For a JSON route, capture status, headers, and body separately. The following
example is a capture command shape, not a golden assertion:

```sh
curl --silent --show-error --insecure \
  --request POST "$API_BASE/api/query" \
  --header 'Content-Type: application/json' \
  --data-binary @/tmp/compatibility-request.json \
  --dump-header /tmp/headers.txt \
  --output /tmp/body.json \
  --write-out '%{http_code}\n'
```

Generate `/tmp/compatibility-request.json` by replacing `__DATABASE_ID__` only
in the request template. Keep the input template itself unchanged. A capture
must record the case ID, C# commit SHA, runtime/OS, launch profile, request
path/body/content type, status, stable headers, body, and error stage. UUIDs
belong only in local capture notes, never stable expected data.

Use the exact route in the manifest. Upload cases require a fresh graph upload
unless the case explicitly tests cache identity or expiry. The built-in graph
cases use `"endpointUrl":"CampeonatoBrasileiro2023"` and need no upload.

## Capturing expected outputs

Do not create an expected file by hand. The C# harness writes this structure:

```text
expected/<case-id>/
└── case.json                    # request, HTTP, graph, query/result, or exception evidence
expected/index.json              # ordered list of captured case IDs
```

Each upload capture embeds the Turtle filename and SHA-256. Record capture
timestamp, C# commit, .NET runtime/OS, status, expected path, every
normalization, and observations in `cases/capture-status.tsv`. Exception cases
record exception type/message/stack evidence in `case.json`; a separate
black-box capture is required for environment-specific middleware responses.

The C# in-process exception captures are not stable middleware response
schemas. Kotlin deliberately uses the approved JSON `400`/`404`/`502` error
contract; this intentional difference remains documented rather than being
normalized into false HTTP equivalence.

## Permitted normalizations

Record every normalization in `cases/capture-status.tsv` and apply the same
rule to the Kotlin comparison.

- Replace upload UUIDs and later request substitutions with `__DATABASE_ID__`.
- In generated SPARQL, replace only random suffixes matching
  `?literalValue[0-9a-f]{5}` with `?literalValue__ID__`.
- Normalize transport-only headers such as `Date`, connection metadata, and
  server banner. Retain content type and status.
- Normalize CRLF/LF in generated SPARQL and textual error output.
- Canonicalize JSON object key order and insignificant whitespace. Never sort
  JSON arrays unless the manifest explicitly declares a multiset comparison.
- For results without `ORDER BY`, compare a documented multiset of rows while
  retaining the raw C# array as evidence.

## Differences that must never be normalized

These require a failing compatibility test, documentation in `MIGRATION.md`,
and explicit approval before change:

- HTTP route/method/content type/status, response wrapper, JSON field name,
  null/default behavior, or request enum representation.
- IRI, prefix, or base resolution; resolved URI text; and URI bracket format.
- Blank-node join/cardinality behavior or public `"blank"` formatting.
- Literal lexical form, language/datatype semantics, escaping, and parser
  acceptance/rejection.
- Selected variable names/order, unbound variables, parse success/failure,
  `DISTINCT`, `OPTIONAL`, `FILTER`, `BIND`, `EXISTS`, and accepted paths.
- Row multiplicity; do not introduce post-projection deduplication.
- Ordered output with generated `ORDER BY`, including `Min`/`Max` forcing
  `LIMIT 1`.
- Application filters: empty labels, `objetoClasse`, local `Take(20)`, and
  Wikidata identifier/label shape.

## Capability boundaries

The API does not accept arbitrary SPARQL. Its builder only emits SELECT, has no
OFFSET operation, and does not itself generate property paths. ASK and CONSTRUCT
therefore have no public HTTP fixture. The files in `queries/` record these
boundaries. Raw user-controlled fields can still inject a property path; the
corpus records generated text only and never executes such probes remotely.

## Wikidata policy

Ordinary characterization/unit runs must not contact live Wikidata. The C#
service hard-codes its URL and has no injection seam, so deterministic C# HTTP
responses cannot be replayed without changing production code. Use the
`WIKIDATA-*` cases only as manually approved, one-time recordings; then store
sanitized raw responses under `wikidata-responses/` and test Kotlin through a
local fake server. See [wikidata-responses/README.md](wikidata-responses/README.md).

## Kotlin execution

The Turtle and JSON templates run through Ktor in
`CaptureDrivenCompatibilityTest`. The test uses a test-local cache and resource
loader, uploads each required graph, substitutes its returned UUID, forbids
remote execution, applies only the normalizations above, and reports mismatches
by fixture ID. Comparisons use application-owned RDF/result values and HTTP
output—never Jena `toString()` or implementation-specific blank-node labels.

Recorded Wikidata success/error responses are still absent. They require the
separate approved one-time recording process described in
[`wikidata-responses/README.md`](wikidata-responses/README.md) before route-level
replay can be added.
