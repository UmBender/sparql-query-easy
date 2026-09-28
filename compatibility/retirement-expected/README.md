# C# Retirement Success Captures

These three captures are **additional evidence** for the C# retirement gate.
They are separate from the immutable 34-case corpus in `../expected/`; its
`index.json`, case files, and established normalization rules were not changed.
The source commit, .NET runtime, timestamps, paths, status, normalization, and
observations are recorded in `../cases/capture-status.tsv`.

| Case | Capture boundary | Controlled inputs | Kotlin comparison |
|---|---|---|---|
| `HTTP-HEALTH-001` | Actual ASP.NET host, Production mode, loopback `GET /health` | No upstream request | Status matches; body does **not**: C# `text/plain` `Healthy`, Kotlin JSON `{"status":"ok"}`. DEC-009 approved this intentional difference, not equivalence. |
| `WIKIDATA-SEARCH-CSHARP-001` | Original C# controller and `EndpointService` | Previously recorded public MediaWiki success JSON, injected by a fail-closed handler | Route status and JSON result match Kotlin with the same recorded body. |
| `REMOTE-RELATIONSHIP-CSHARP-001` | Original C# controller, `EndpointService`, and `RemoteQueryExecutor` | Controlled SPARQL JSON response from a fail-closed handler; no external request | Route status/JSON, generated and executed SPARQL, projected variables, row count, binding presence and RDF values match Kotlin. |

Historical capture command (not runnable from the post-removal checkout;
the harness source is recoverable from Git commit `0f20091`):

```sh
dotnet run --project compatibility/Compatibility.Harness/Compatibility.Harness.csproj -- --retirement-success
```

The mode refuses to overwrite these captures if they already exist. Recapture
requires deliberate review of every difference; do not edit expected results
to accommodate Kotlin. The health host uses a temporary loopback port and is
stopped by the harness. The other two cases are in-process controller calls,
not black-box middleware tests. Their `contentType` is null because no
response header was observed; this is intentional because C# middleware
errors were explicitly waived. The injected handlers reject unexpected hosts
or paths, so no live Wikidata or remote SPARQL traffic occurs.

The captured C# health body is a proven compatibility difference. The user
approved retaining Kotlin JSON under DEC-009 as an intentional change; full
health-response parity is not claimed. The frontend only checks success for
its health warmup, but the public body remains observable.

## Source files

- `compatibility/Compatibility.Harness/RetirementCaptureHarness.cs` (historical, Git commit `0f20091`)
- `compatibility/Compatibility.Harness/Program.cs` (historical, Git commit `0f20091`)
- `compatibility/cases/capture-status.tsv`
- `compatibility/requests/wikidata-search-success.json`
- `compatibility/requests/remote-relationship-success.json`
- `compatibility/remote-responses/remote-relationship-success.json`
- `compatibility/wikidata-responses/recorded-WIKIDATA-SEARCH-RECORD-001-body.json`
- `src/test/kotlin/com/example/sparqlqueryeasy/http/RetirementSuccessCompatibilityTest.kt`
