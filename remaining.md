No core application feature remains unported: both C# controllers, SPARQL generation/execution, local graph cache/upload, built-in graph,
  Wikidata search, and all five QueryController routes now exist in Kotlin.
 
  Still missing for full production parity:
 
  - Swagger/OpenAPI UI, CORS, and HTTPS-redirection middleware.
  - C# development port/profile parity (5242/7070 versus Kotlin’s 8080).
  - Replay recorded Wikidata success/error fixtures through the complete Ktor route boundary. No approved raw Wikidata recording is currently stored in `compatibility/wikidata-responses/`.
  - Add browser-level tests for the authoritative `index2.html` search-to-node, upload, relationship, and query flows.
 
  The remaining work is production hardening and end-to-end verification, not another core Kotlin port.
