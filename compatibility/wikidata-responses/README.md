# Wikidata Recording Policy

The success body in this directory was captured once from the public Wikidata
MediaWiki API. It retains the original `Q` identifiers, `concepturi` values,
labels, descriptions, field order, and JSON escapes. Its metadata records the
UTC timestamp, request URL/User-Agent, status, selected response headers, and
the SHA-256 of the 1,015 response-body bytes. The fixture file adds one final
newline. Cookies, client IP, server/cache IDs, and telemetry headers were not
copied.

| Case | Provenance | Status | Body |
|---|---|---:|---|
| `WIKIDATA-SEARCH-RECORD-001` | Public Wikidata, 2026-09-27 18:18:27 UTC | 200 | `recorded-WIKIDATA-SEARCH-RECORD-001-body.json` |
| `WIKIDATA-SEARCH-ERROR-001` | Controlled local response, **not Wikidata traffic** | 429 | `controlled-WIKIDATA-SEARCH-ERROR-001-body.txt` |
| `WIKIDATA-SEARCH-MALFORMED-001` | Controlled local response, **not Wikidata traffic** | 200 | `controlled-WIKIDATA-SEARCH-MALFORMED-001-body.json` |

`RecordedWikidataRoutesTest` replays all three bodies through the real Ktor
`POST /api/query/search` route with an injected Ktor `MockEngine`. It asserts
the success identifiers and labels exactly, the request parameters, the
approved JSON `502` response for upstream `429`, and the malformed-body `502`
path. Normal tests never call Wikidata.

The original 34-case C# corpus still does not contain this route. The
separate `../retirement-expected/WIKIDATA-SEARCH-CSHARP-001/case.json`
captures the production C# controller/service with this recorded public
success body injected by a fail-closed handler. Kotlin's status and JSON
result match that new C# capture offline. Source review shows that C# returns
`200` with empty `data` on a non-2xx MediaWiki response, while Kotlin
deliberately returns `502` JSON; error equivalence was waived, not asserted.

Future live recordings require explicit approval and the same provenance
fields. Record any further C# API response separately from the immutable
`../expected/` corpus, with its own commit/runtime metadata. Sanitize operational metadata only;
never change RDF/Wikidata identifiers or labels. Do not contact live Wikidata
in ordinary tests.

Kotlin tests must replay the recorded response through a local fake HTTP server
or injected client and must never require network access to Wikidata.
