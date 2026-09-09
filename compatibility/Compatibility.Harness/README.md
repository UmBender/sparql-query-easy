# Compatibility Harness

Run from the repository root:

```sh
dotnet run --project compatibility/Compatibility.Harness/Compatibility.Harness.csproj
```

The harness references the production web project and invokes its upload/query
controllers, `EndpointService`, `SparqlQueryBuilder`, and `LocalQueryExecutor`.
It does not duplicate query construction, result filtering, or RDF formatting.

It writes one structured `case.json` per executed case below
`compatibility/expected/`, plus `index.json`. Each capture contains controller
status/body, generated SPARQL, and raw dotNetRDF query results where applicable.
Raw result rows preserve result-set variable order, all rows, binding presence,
and RDF URI/blank/literal values; literals retain lexical form, datatype, and
language as separate fields. Blank-node internal identifiers are normalized to
first-encounter labels only.

The harness uses an HTTP handler that throws on network use. It executes the
Wikidata *query generation* case but intentionally does not execute live
Wikidata search. It also records malformed JSON as a parser error category and
missing uploads as a controller invocation category; full middleware-produced
error pages remain environment-dependent and require a separate black-box host
capture if they become contractual.

No output is written until the harness is actually run with the .NET 8 SDK.
