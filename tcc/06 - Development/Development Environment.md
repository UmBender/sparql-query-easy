# Development Environment

## Build and run

| Component | Command / configuration |
|---|---|
| Kotlin quality gate | `GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintCheck detekt test --no-daemon` |
| Kotlin application | `./gradlew run` |
| C# harness | `dotnet run --project compatibility/Compatibility.Harness/Compatibility.Harness.csproj` |
| C# application | `dotnet run --project Sparql.QueryEasy/Sparql.QueryEasy.csproj --launch-profile https` |

## Configuration

- **Confirmed:** Kotlin uses `application.conf`; default port is `8080`.
- **Confirmed:** C# launch profiles define `http://localhost:5242` and `https://localhost:7070` with `ASPNETCORE_ENVIRONMENT=Development`.
- **Confirmed:** `RUN_WIKIDATA_INTEGRATION=true` enables the opt-in live integration test. Normal tests do not call live Wikidata.
- **Unknown:** No documented production Kotlin configuration, secrets model, or environment-variable matrix exists.

## Source files

- `build.gradle.kts`
- `src/main/resources/application.conf`
- `Sparql.QueryEasy/Properties/launchSettings.json`
- `src/integrationTest/kotlin/com/example/sparqlqueryeasy/wikidata/client/WikidataLiveIntegrationTest.kt`
