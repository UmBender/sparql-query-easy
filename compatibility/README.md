# C# Characterization Corpus

This directory is a baseline corpus for the existing ASP.NET Core/.NET 8
application. It contains only inputs, execution recipes, and empty locations
for captured baselines. It deliberately contains no invented response, status,
or query-output golden files.

The case catalogue is [cases/manifest.md](cases/manifest.md). Every case has a
stable ID, input files, C# route, behavior being characterized, and rationale.
`expected/` remains empty until an operator captures a baseline from the
running C# application.

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
└── expected/                    # generated C# baselines; initially empty
```

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

Do not create an expected file by hand. Capture it from the C# application,
then place it below `expected/<case-id>/` using this shape:

```text
expected/<case-id>/
├── request.json                 # materialized request, UUID redacted
├── response.status              # e.g. 200
├── response.headers             # selected stable headers only
├── response.body                # raw body after allowed normalization
├── generated.sparql             # only for /api/query/sparql cases
└── capture.md                   # environment, command, observations
```

For uploads, include the source Turtle path and SHA-256 in `capture.md`; do
not duplicate it. For parser/query failures, capture the status and body as
produced by the target environment, and describe environment-specific exception
pages in `capture.md`.

The current application has no stable application-level error schema. Baseline
captures are evidence, not permission to make a developer exception page a
permanent API contract.

## Permitted normalizations

Record every normalization in the relevant `capture.md` and apply the same rule
to the Kotlin comparison.

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

## Later Kotlin execution

The same Turtle and JSON templates will run through Ktor routes. A Kotlin runner
must start Ktor with test-local cache/resource loading, upload each fixture,
substitute its returned UUID, use a local fake for Wikidata, apply only allowed
normalizations, and stop the migration phase on a mismatch. Compare
application-owned RDF/result values and HTTP output—never Jena `toString()` or
implementation-specific blank-node labels.
