# Wikidata Recording Policy

This directory intentionally contains no invented Wikidata response. The C#
service hard-codes `https://www.wikidata.org/w/api.php` and has no test seam to
redirect its HTTP client. Do not contact live Wikidata in ordinary tests.

For a manually approved one-time recording, save the request URL, raw status,
selected headers, and raw body as `recorded-<case-id>.*`; save the C# API
response under `../expected/<case-id>/`; and record timestamp and identifiers.
Sanitize operational metadata only, never RDF/Wikidata identifiers or labels.

Kotlin tests must replay the recorded response through a local fake HTTP server
or injected client and must never require network access to Wikidata.
