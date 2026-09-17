# Project Blockers

## BUG-001 — C# local-search capture evidence

`SEARCH-LOCAL-001` and `BUILTIN-GRAPH-001` were captured through a harness
wrapper that changes the C# runtime-type branch used by local search. A reviewed
harness repair and .NET 8 recapture are required before either can be called
equivalent. The committed C# expected results must remain unchanged until that
review.

## QUAL-001 — Recorded Wikidata fixtures

No approved, provenance-recorded Wikidata success/error responses exist. Human
approval is required before one-time collection and sanitization; normal tests
must continue to avoid live Wikidata.

## Production operations tasks

Production domain, container/runtime, hosting, and security decisions are not
yet selected. They block the dependent DNS/TLS/CORS, AWS, monitoring, and
backup tasks; no deployment or infrastructure mutation is authorized.
