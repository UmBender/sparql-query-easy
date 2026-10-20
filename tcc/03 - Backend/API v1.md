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
public at `GET /swagger` in every environment. Query operations are public;
the account operations (AUTH-001) use the `easyquery_session` cookie and say
so in their descriptions (no OpenAPI security scheme is declared). No
production server hostname is embedded in the document.

The OpenAPI inventory covers the operations below exactly once. Static
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

### Variable filters (FE-034)

`POST /api/query`, `/api/query/sparql`, `/api/query/stage`, `/api/query/count`
and `/api/query/numeric-profile` accept an optional `variableFilters` list. It
restricts a variable object to literal values, so the filtered value is a real
query variable that can be a stage, a Run Query target or a result. Requests
without it are unchanged, and the literal-object `filterType` form above stays
as it is.

```json
"variableFilters": [
  {"variableName": "?hp", "filterType": 2, "value": "90"}
]
```

Each item renders one `FILTER (isLiteral(?v) && …)` after the patterns, and
inside every Maximum/Minimum subquery:

- Without `filterType` or `value`, the item keeps any literal (`FILTER (isLiteral(?v))`).
- With `value` but no `filterType`, it is an exact `str(?v) = "value"` match.
- `filterType` `0`, `1`, `2`, `3` and `6` work as in the literal form, with `value` as the operand.

The display route applies variable filters, because they are new. The request
returns `400` when:

- `variableName` is not a variable or is not the object of a `where` pattern;
- a variable has two filters;
- `filterType` is set without `value`;
- `filterType` is `4`/`5` (Maximum/Minimum are not offered on a variable);
- a numeric value or a Between range is invalid.

## Routes

### `GET /`

Removed in FE-049: Ktor serves the API only and `GET /` returns `404`; the
SvelteKit app is served by the web service or Vite on the same origin.

There is no application-owned error response for this redirect route.

### `GET /health`

Returns `200 OK` with `Content-Type: application/json`:

```json
{ "status": "ok", "database": "ready" }
```

`database` (BE-007, additive) is `ready` (migrated and reachable),
`not-configured` (no `EASYQUERY_DB_URL`) or `unavailable` (configured but not
reached). The answer stays `200` and `status` stays `ok` whatever the database
state: query routes work without a database, and Docker/compose healthchecks
only test HTTP success. The route returns the connector's last known state
without waiting. When a database is configured, a poll starts at most one
background check per 5 s retry interval: a reconnection (with migrations)
while there is no pool, otherwise a connection check of the pool, so a
database lost after startup turns `unavailable` and returns to `ready`. The
next poll shows the result. No host, URL or error text is exposed.

There is no application-owned error response for this route.
The actual C# host returned `200 text/plain Healthy` in
`compatibility/retirement-expected/HTTP-HEALTH-001/case.json`. The Kotlin
body/content type are **not equivalent**. The user approved retaining Kotlin
JSON as an intentional difference under
[[../90 - Tasks/items/DEC-009-health-response-contract]].

### `GET /api/endpoints`

BE-006. Returns `200 OK` with the endpoints the frontend offers, built from
the constants `EndpointContextResolver` accepts (`SELECTABLE_ENDPOINTS`):

```json
{ "data": [
  { "id": "CampeonatoBrasileiro2023", "label": "Campeonato Brasileiro 2023", "kind": "local" },
  { "id": "PokemonGen1", "label": "Pokémon (generation 1)", "kind": "local" },
  { "id": "https://query.wikidata.org/sparql", "label": "Wikidata", "kind": "remote" }
] }
```

Each `id` is sent as `endpointUrl`. Uploaded graphs (process-local ids)
are not listed. No error response. Tests: `EndpointsRoutesTest`,
`OpenApiRoutesTest` (nine operations).

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

### `POST /api/query/count`

FE-028 (filter funnel, merged by DEC-010), additive.
Number of distinct values of one variable under a query, for the filter
funnel. Request:

```json
{
  "endpointUrl": "PokemonGen1",
  "variableName": "?p",
  "where": [
    {"subject": "?p", "predicate": "<http://easyquery.example.org/pokemon#speed>", "object": "90", "filterType": 2},
    {"subject": "?p", "predicate": "<http://easyquery.example.org/pokemon#hasType>", "object": "<http://easyquery.example.org/pokemon#FireType>"}
  ]
}
```

Response: `{"data": {"variableName": "?p", "count": 7}}`. The generated query
is `SELECT (COUNT(DISTINCT ?p) AS ?__countValue) WHERE { ... }` over the
`where` patterns, with no LIMIT and without the rdf:type requirement of
`/api/query`. `variableName` is required (with or without `?`); `where` needs
at least one pattern; variable names starting with `__count` are rejected with
`400`. Maximum/Minimum use the BE-004 extreme subquery, so the count includes
every tied value (not capped by `EASYQUERY_EXTREME_RESULT_LIMIT`, which only
limits returned rows). Other errors as for `/api/query/stage`
(`404` unknown local graph, `502` upstream failure).

## Accounts and sessions (AUTH-001, AUTH-005)

Contract: [[../09 - Decisions/Authentication Contract]]. Accounts live in
PostgreSQL (`V2__accounts.sql`: `app_user`, `user_session`;
`V3__user_roles.sql`: `app_user.role`); without a
configured or reachable database every account route answers
`503 {"error":"Accounts are temporarily unavailable"}` (query routes are
unaffected).

| Route | Body | Success | Errors |
|---|---|---|---|
| `POST /api/auth/register` | `{"username","password"}` | `201 {"data":{"username":"Ada","role":"participant"}}` + session cookie | `400` invalid input, `409` username taken |
| `POST /api/auth/login` | `{"username","password"}` | `200 {"data":{"username":"Ada","role":"participant"}}` + new session cookie | `400` missing fields, `401 {"error":"Invalid username or password"}` (same for an unknown user) |
| `POST /api/auth/logout` | `{}` | `204`, cookie cleared (`Max-Age=0`) | `401` without a session |
| `GET /api/auth/session` | — | `200 {"data":{"username":"Ada","role":"participant"}}` | `401 {"error":"Login required"}` |

- Usernames: 3–32 letters, digits, `.`, `_`, `-`; unique regardless of case;
  the registered spelling is returned. Passwords: 8–128 characters, hashed
  with Argon2id (PHC string, per-password salt; cost from
  `EASYQUERY_ARGON2_*`).
- Session: 32 random bytes (base64url) in `easyquery_session`, `HttpOnly`,
  `SameSite=Lax`, `Path=/`, `Max-Age=604800` (7 days, absolute), `Secure`
  when `EASYQUERY_ENVIRONMENT=production`. Only its SHA-256 digest is stored.
  Login and registration always issue a new id and delete a session sent
  with them; logout deletes the row.
- CSRF: the three POST routes reject an `Origin` that names another host
  (`403 {"error":"Cross-origin request rejected"}`) and a non-JSON body
  (`415`). Requests without `Origin` (non-browser clients) are accepted.
- Brute force: register and login share a fixed one-minute window per client
  address (`EASYQUERY_AUTH_ATTEMPTS_PER_MINUTE`, default 10), then
  `429 {"error":"Too many attempts; try again in a minute"}`. With
  `EASYQUERY_TRUST_PROXY=true` the address is the first `X-Forwarded-For`
  entry (set it only behind the bundled proxy).
- Every path under `/api/study/` requires a session (`401` otherwise); a
  logged-in request to a path no route serves gets `404`.
- Roles (AUTH-005): `role` is `participant` or `admin`. An account is `admin`
  exactly when its username (case-insensitive) is in
  `EASYQUERY_ADMIN_USERNAMES` (comma-separated; a malformed name fails
  startup). Stored roles are brought in line with the list on the first
  account request after startup, so a restart with a changed list promotes
  or demotes existing accounts.
- Every path under `/api/admin/` requires the admin role: `401 {"error":"Login
  required"}` without a session, `403 {"error":"Admin role required"}` for a
  participant; an admin gets `404` on a path no route serves.

## Proposed tasks (admin, STUDY-006)

Tasks live in `study_task` (`V4__study_tasks.sql`) and are managed by admins
(DEC-014 Q3 = B). Every route below needs the admin role; POST/PUT bodies
follow the account routes' CSRF rule (same `Origin`, JSON only: `403`/`415`).
Study and admin bodies ignore unknown fields, so a client-sent `expected`,
`expectedResult` or `correct` is never read. Without a database a request with
a session cookie gets `503 {"error":"Accounts are temporarily unavailable"}`.

| Route | Body | Success | Errors |
|---|---|---|---|
| `GET /api/admin/tasks` | — | `200` summaries (`key`, `title`, `endpoint`, `comparison`, `revision`, `active`, `expectedCount`, `updatedAt`), active and inactive, by key | — |
| `GET /api/admin/tasks/{key}` | — | `200` the task: statement, `startingGraph`, `referenceGraph`, `referenceQuery`, `referenceSparql`, `expected` (typed terms), settings | `404 {"error":"Task not found"}` |
| `POST /api/admin/tasks` | task | `201` the task, revision 1 | `400` invalid field, malformed JSON, failing or truncated reference; `409 {"error":"A task with this key already exists"}` |
| `PUT /api/admin/tasks/{key}` | task (its `key` is ignored) | `200` the task | `400`, `404` |
| `POST /api/admin/tasks/preview` | `{"endpoint","reference","maxResults"}` | `200 {"data":{"sparql","expected":[term…],"distinctCount"}}`, nothing stored | `400` |
| `POST /api/admin/tasks/{key}/deactivate`, `…/reactivate` | `{}` | `200` the summary | `404` |

- Task body: `key` (1–64 of `a-z`, `0-9`, `-`, starting with a letter or
  digit; fixed after creation), `title` (1–200), `statement` (1–10000),
  `endpoint` (a built-in local graph: `CampeonatoBrasileiro2023`,
  `PokemonGen1`; remote endpoints wait for DEC-004), optional `startingGraph`,
  `reference`, `comparison` (`set` default, or `multiset`), `maxResults`
  (1–10000, default 1000).
- A drawn query (`reference`, DEC-014 Q5) is `{"graph": <saved query,
  formatVersion 1>, "query": {"variableName","where","variableFilters"}}`:
  the request the frontend derives from the graph with the Run Query mapping
  (`frontend/src/lib/domain/study.ts`), its `variableName` being the answer
  variable. The server ignores any endpoint or limit in it and runs it through
  `GeneralQueryService` on the task's endpoint with `LIMIT maxResults + 1`.
- Expected result: the typed RDF terms (`RdfTermHttp`) bound to the answer
  variable, one per result row in result order, computed and stored by the
  server; a result with more than `maxResults` rows is rejected (`400`), so a
  stored expected result is never cut. `set` compares the distinct values,
  `multiset` the values with their repetitions (STUDY-004).
- Revision: an update reruns the reference only when its request (compared as
  JSON values), the endpoint or `maxResults` changed; changing those, the
  statement or the comparison increments `revision`. A title, layout-only
  graph or starting-graph change keeps the revision and the expected result.
- Tasks are never deleted; deactivating keeps the row and hides the task from
  participants.

## Participant groups (admin, STUDY-007)

`V5__study_groups.sql`: `study_group` (unique `name`), `study_group_task`
(ordered tasks), `study_group_member` (one row per user, so one group per
participant). The admin assigns participants (no random assignment). Same
role, CSRF and database rules as the task routes; `{id}` is the numeric group
id (a non-number is `404`).

| Route | Body | Success | Errors |
|---|---|---|---|
| `GET /api/admin/participants` | — | `200` `[{"username","groupId","groupName"}]`, participant accounts by username (`null` without a group) | — |
| `GET /api/admin/groups` | — | `200` groups by name: `id`, `name`, `tasks` (`key`, `title`, `active`, in order), `members` (usernames), `updatedAt` | — |
| `POST /api/admin/groups` | `{"name"}` | `201` the group | `400` name not 1–100 characters, `409 {"error":"A group with this name already exists"}` |
| `GET /api/admin/groups/{id}` | — | `200` the group | `404 {"error":"Group not found"}` |
| `PUT /api/admin/groups/{id}` | `{"name"}` | `200` renamed | `400`, `404`, `409` |
| `PUT /api/admin/groups/{id}/tasks` | `{"tasks":[key…]}` | `200` the group with exactly these tasks in this order | `400` unknown (`Unknown tasks: …`) or repeated keys, `404` |
| `POST /api/admin/groups/{id}/members` | `{"username"}` | `200` the group; a participant in another group is moved | `400` unknown username or an admin, `404` |
| `POST /api/admin/groups/{id}/members/remove` | `{"username"}` | `200` the group | `400` not a member, `404` |
| `POST /api/admin/groups/{id}/delete` | `{}` | `204` | `404`, `409` the group has members |

- Inactive tasks stay in a group's list for the admin and are left out for
  participants. The application query `StudyGroupService.activeTasksFor(user)`
  (served to participants by STUDY-003) returns the active tasks of the
  user's group in group order, none without a group.
- Moving a participant keeps their submissions; they then see the new
  group's tasks.

## Proposed tasks (participant, STUDY-003)

Session required (`401 {"error":"Login required"}`); without a database a
request with a session cookie gets `503`. A participant sees only the active
tasks of their group (STUDY-007).

| Route | Success | Errors |
|---|---|---|
| `GET /api/study/tasks` | `200 {"data":[{"key","title","summary"}]}` in group order; `[]` without a group | — |
| `GET /api/study/tasks/{key}` | `200 {"data":{"key","title","statement","endpoint","startingGraph"}}` (`startingGraph` a saved query or `null`) | `404 {"error":"Task not found"}` for an unknown or inactive task or one outside the caller's group |

- `summary` is the statement's first paragraph, whitespace collapsed, cut to
  160 characters with `…`.
- Neither route returns the reference graph, its request or SPARQL, or the
  expected result.
- The first `GET /api/study/tasks/{key}` by a user is recorded in
  `study_task_open` (`V6__study_task_opens.sql`); later opens keep the first
  time. STUDY-004 measures time spent from it.

## Answers and attempts (participant, STUDY-004)

| Route | Body | Success | Errors |
|---|---|---|---|
| `POST /api/study/tasks/{key}/submissions` | a drawn query `{"graph","query"}` (as for task references) | `201` the attempt | `400` malformed body (not stored), `404` task not open to the caller, `403`/`415` CSRF |
| `GET /api/study/submissions?task={key}` | — | `200` the caller's attempts at the task, oldest first | `400` no `task`, `404` unknown key |

- An attempt is `{"attempt","correct","invalid","feedback","matched","missing",
  "extra","expectedCount","taskRevision","timeSpentMs","createdAt"}`;
  `attempt` numbers the caller's attempts at the task from 1. It never holds
  the expected values (DEC-014 Q2 A).
- The server runs `query` on the task's endpoint with the task's cap (any
  client endpoint or limit is ignored), compares the answer variable's terms
  with the stored expected result and stores graph, request, generated
  SPARQL, answer variable, the result terms and counts, the verdict, the task
  revision and the time since the first open (`study_submission`,
  `V7__study_submissions.sql`). Body fields such as `correct` or `expected`
  are ignored. Attempts are unlimited (Q1 A).
- Comparison (Q4): typed terms (IRI; literal by lexical form, datatype and
  language, the tag regardless of case). `set`: distinct values; `multiset`:
  values with repetitions. `matched` + `missing` = `expectedCount`; `extra`
  counts answer values not expected.
- Feedback: `Correct: all N expected results.`, `Incorrect: M of N expected
  results[; X extra].`; an answer with more rows than the cap is incorrect
  (`Incorrect: the query returns more than C results; the expected answer has
  N.`).
- A query that cannot be built or run is stored as an invalid attempt
  (`201`, `invalid: true`, counts `null`, feedback `The query could not run:
  …`), not a server error.
- `timeSpentMs` is measured from the first `GET /api/study/tasks/{key}` (a
  submission without one records the open first, so it counts 0).

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
- `src/main/kotlin/com/example/sparqlqueryeasy/application/query/ResultCountService.kt`
- `src/main/kotlin/com/example/sparqlqueryeasy/application/querygeneration/SparqlQueryGenerationService.kt`
- `src/test/kotlin/com/example/sparqlqueryeasy/http/QueryRoutesTest.kt`
- `src/test/kotlin/com/example/sparqlqueryeasy/http/StageQueryRoutesTest.kt`
- `src/test/kotlin/com/example/sparqlqueryeasy/http/ResultCountRoutesTest.kt`
- `src/test/kotlin/com/example/sparqlqueryeasy/http/LocalDatabaseRoutesTest.kt`
- `src/test/kotlin/com/example/sparqlqueryeasy/http/OpenApiRoutesTest.kt`
- `src/test/kotlin/com/example/sparqlqueryeasy/ApplicationTest.kt`
- `Sparql.QueryEasy/Controllers/QueryController.cs`
- `Sparql.QueryEasy/Controllers/LocalDatabaseController.cs`
