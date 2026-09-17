# System Architecture

## Current architecture

```mermaid
flowchart LR
  Browser[Static frontend\nindex2.html] -->|relative /api requests| Ktor[Ktor HTTP module]
  Ktor --> Services[Application services]
  Services --> Context[Endpoint context resolver]
  Context --> Local[Jena local graph execution]
  Context --> Remote[Remote SPARQL HTTP execution]
  Services --> Wiki[Wikidata MediaWiki search client]
  Local --> Cache[In-memory uploaded graph cache]
  Local --> Builtin[Built-in futebol_completo.ttl]
  CSharp[C# ASP.NET Core baseline] --> DotNetRDF[dotNetRDF]
  Compat[Compatibility corpus + harness] --> CSharp
  Compat --> Ktor
```

## Backend boundaries

**Confirmed:** Kotlin domain types own RDF values, graph statements, SELECT rows, bound bindings, and unbound bindings. Jena imports are confined to `rdf/jena`; services operate on application-owned interfaces.

**Confirmed:** Endpoint selection is request-scoped and distinguishes built-in graph, uploaded graph, Wikidata, and generic remote SPARQL endpoints.

**Potential issue:** Generic remote HTTP(S) endpoints are caller-controlled, which remains an SSRF/open-proxy risk until a production endpoint policy is approved.

## Original versus migrated request flow

```mermaid
sequenceDiagram
  participant UI as Browser
  participant API as Ktor route
  participant S as Service
  participant E as Endpoint context
  participant R as Jena/remote executor
  UI->>API: POST /api/query
  API->>S: typed request
  S->>E: resolve endpoint
  E->>R: execute generated SPARQL
  R-->>S: application SELECT result
  S-->>API: PropertyResult list
  API-->>UI: {"data": [...]}
```

## Source files

- `src/main/kotlin/com/example/sparqlqueryeasy/domain/model/DomainModels.kt`
- `src/main/kotlin/com/example/sparqlqueryeasy/application/endpoints/EndpointContextResolver.kt`
- `src/main/kotlin/com/example/sparqlqueryeasy/rdf/jena/JenaRdfInfrastructure.kt`
- `Sparql.QueryEasy/Services/EndpointService.cs`
