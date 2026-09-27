# Development Environment

## Build and run

| Component | Command / configuration |
|---|---|
| Kotlin quality gate | `GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintCheck detekt test --no-daemon` |
| Kotlin application | `./gradlew run` |
| OpenAPI JSON | `http://localhost:8080/openapi.json` |
| Swagger UI | `http://localhost:8080/swagger` |
| C# harness | `dotnet run --project compatibility/Compatibility.Harness/Compatibility.Harness.csproj` |
| C# application | `dotnet run --project Sparql.QueryEasy/Sparql.QueryEasy.csproj --launch-profile https` |

## Configuration

- **Confirmed:** Kotlin uses `application.conf`; default port is `8080`.
- **Confirmed:** C# launch profiles define `http://localhost:5242` and `https://localhost:7070` with `ASPNETCORE_ENVIRONMENT=Development`.
- **Confirmed:** `RUN_WIKIDATA_INTEGRATION=true` enables the opt-in live integration test. Normal tests do not call live Wikidata.
- **Confirmed:** The default runtime owns one shared CIO HTTP client and closes
  it on Ktor `ApplicationStopped`. Do not close individual remote-SPARQL or
  Wikidata wrapper clients created from that shared client.
- **Confirmed:** OpenAPI 3.1 is assembled from Ktor route metadata at runtime.
  It requires no separate generation command or checked-in generated file.
  Both documentation endpoints are intentionally public in every environment
  until `AUTH-000` defines authentication.
- **Unknown:** No documented production Kotlin configuration, secrets model, or environment-variable matrix exists.

## Source files

- `build.gradle.kts`
- `src/main/resources/application.conf`
- `Sparql.QueryEasy/Properties/launchSettings.json`
- `src/integrationTest/kotlin/com/example/sparqlqueryeasy/wikidata/client/WikidataLiveIntegrationTest.kt`
