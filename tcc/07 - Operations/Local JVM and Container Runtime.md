# Local JVM and Container Runtime — OPS-001

## Approved local scope

**Confirmed:** The supported Kotlin artifact is the Gradle Application plugin's
`installDist` distribution. It contains the launcher, dependency JARs,
`application.conf`, the static frontend copied from `sparql/`, and the
byte-identical built-in Turtle resource. Java 21 is required. Ktor's
`EngineMain` reads `application.conf` and listens on HTTP port `8080`.
`GET /health` returns `200 {"status":"ok"}`; it is a process check, not a
readiness claim about external SPARQL endpoints or Wikidata.
The captured original ASP.NET host returns `200 text/plain Healthy` instead;
the user approved retaining Kotlin `application/json` as an intentional
difference under [[../90 - Tasks/items/DEC-009-health-response-contract]].
The container probe checks HTTP success only; it does not inspect the JSON
body or prove external-service readiness.

**Confirmed:** The local Dockerfile builds that distribution from Kotlin
sources, then runs it on a Java 21 JRE as numeric non-root user `10001`.
The image exposes port `8080` and probes `/health`. Its build context excludes
the C# tree, captures, vault, tests, and reference PDFs. The C# project is
therefore not needed to build the Kotlin image. No container image is pushed
or deployed by this task.

## Local build and smoke test

From the repository root, with JDK 21:

```sh
GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintCheck detekt test installDist --no-daemon
sha256sum src/main/resources/futebol_completo.ttl build/resources/main/futebol_completo.ttl
./build/install/sparql-query-easy-kotlin/bin/sparql-query-easy-kotlin
```

In another terminal:

```sh
curl --fail http://127.0.0.1:8080/health
curl --fail http://127.0.0.1:8080/index2.html
curl --fail http://127.0.0.1:8080/openapi.json
```

Optional local container build (requires a working Docker daemon and image
registry access):

```sh
docker build -t sparql-query-easy:local .
docker run --rm --name sparql-query-easy-local -p 127.0.0.1:8080:8080 sparql-query-easy:local
docker inspect --format '{{.State.Health.Status}}' sparql-query-easy-local
```

The root page redirects to `/index2.html`; the frontend calls the same Ktor
origin. `GET /swagger` and `GET /openapi.json` are intentionally public under
the current approved contract. Uploaded graph handles and cache contents are
process-local and do not survive restart; no volume or durable data contract
is defined.

## Non-secret runtime configuration and limits

- `application.conf` currently fixes the Ktor port at `8080`; the local image
  does not promise a configurable internal port. Map a different **host** port
  with Docker `-p` if needed. Do not infer production proxy/TLS settings.
- The Gradle launcher accepts `JAVA_OPTS` for JVM tuning. No default memory
  limit or production sizing has been approved. Avoid treating that as an
  application configuration or secret channel.
- No environment variable for credentials, allowed origins, endpoint policy,
  upload size, or persistent storage is defined here. `SEC-001` and
  `AUTH-000` must define those contracts before user testing or deployment.
- `/health` verifies only that the process can answer HTTP. `OPS-004` must
  decide readiness, metrics, backup and recovery for the selected architecture.
- The base image uses the Java 21 `eclipse-temurin` Jammy tags; those tags are
  mutable. Pin digests and add image scanning/rebuild policy before deployment.
  Image build requires dependency repositories and Ubuntu package access;
  ordinary tests remain offline.

## Deferred production work

**Decision required:** `OPS-002` must choose domain, TLS termination,
forwarded-header trust, redirects and restrictive CORS origins. `OPS-003` must
choose hosting/IAM, image registry, deployment workflow, rollback and cost
assumptions. `OPS-004` must define telemetry, backups and recovery objectives.
`SEC-001` must approve remote endpoints, uploads and cache boundaries. None
of these decisions is implied by a working local container.

**Confirmed retirement boundary:** The approved C# solution, project, and
harness source files have been removed locally under MIG-002. Kotlin's Gradle
distribution and container remain independent of them. The old .NET workflow
is preserved under `.github/archived-workflows/` in the integrated `main`
tree, not under `.github/workflows/`. The user reports no enabled Actions
workflow on the fork. Keeping OPS-002–OPS-004 for a future production
launch does not require deploying before repository-level C# retirement. See
[[Archived .NET Deployment Workflow]] and
[[../05 - Migration/CSharp Removal Review]].

## Source files

- `Dockerfile`
- `.dockerignore`
- `build.gradle.kts`
- `src/main/resources/application.conf`
- `src/main/resources/futebol_completo.ttl`
- `src/main/kotlin/com/example/sparqlqueryeasy/Application.kt`
- `src/main/kotlin/com/example/sparqlqueryeasy/http/HttpModule.kt`
- `src/main/kotlin/com/example/sparqlqueryeasy/application/endpoints/EndpointContextResolver.kt`
- `src/test/kotlin/com/example/sparqlqueryeasy/application/endpoints/EndpointContextResolverTest.kt`
- `.github/archived-workflows/master_sparql-query-easy.yml`
- `compatibility/Compatibility.Harness/Compatibility.Harness.csproj` (historical, Git commit `0f20091`)
