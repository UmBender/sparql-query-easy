# Repository, Login, and OpenAPI Scope

**Status:** High-level scope approved; implementation contracts remain where
explicitly identified below.

## Repository boundary — approved

The Markdown Obsidian vault is the persistent project knowledge/task system and
remains versioned. PDF binaries under `tcc/PDF/` do not belong in Git.
`REPO-001` removed the three PDFs (about 7.7 MB, introduced in commit
`f1bcf5a`) from tracking, kept the local copies, and added the `.gitignore`
rule `tcc/PDF/*.[Pp][Dd][Ff]`. A clean checkout therefore contains no PDFs;
contributors obtain reference copies from the thesis author or the original
publishers and place them under `tcc/PDF/`. No Markdown note links to them.
Published history was not rewritten; that still requires separate explicit
approval.

## Login — implementation approved, contract decision pending

Authentication will be implemented. Current `sparql/login.html` is not an auth
client: it posts credentials to removed `index.html`, has placeholder account
creation/password recovery links, and has no backend route. Kotlin has no auth
or session dependencies, credential source, logout, session endpoint, route
guard, CSRF policy, or test coverage. C# also provides no reusable auth
contract despite calling `UseAuthorization()`.

`AUTH-000` must first approve identity source, session/token mechanism,
anonymous access, protected routes, auth response/redirect behavior, session
and cookie policy, CSRF/rate-limit controls, and registration/recovery scope.
`AUTH-001` and `AUTH-002` then implement backend and frontend slices.

## Swagger/OpenAPI — implementation approved, publication decision pending

Kotlin will expose Swagger-backed OpenAPI documentation. C# uses default
Swashbuckle routes, while Kotlin currently has no Swagger/OpenAPI artifact or
route. `OAPI-000` must select the source of truth, OpenAPI version, paths,
environment exposure, authentication, included routes, and drift check.
`OAPI-001` then implements the selected contract.

The recommended starting point is a reviewed static OpenAPI 3.1 document
served by Ktor's `ktor-server-swagger` at `/swagger`, with a separately
testable raw specification endpoint. Runtime compiler inference remains an
alternative but adds experimental/compiler coupling and cannot replace review
of defaults, multipart, errors, and security requirements.

## Source files

- `sparql/login.html`
- `build.gradle.kts`
- `src/main/kotlin/com/example/sparqlqueryeasy/Application.kt`
- `src/main/kotlin/com/example/sparqlqueryeasy/http/HttpModule.kt`
- `Sparql.QueryEasy/Program.cs`
- `Sparql.QueryEasy/Properties/launchSettings.json`
- `tcc/03 - Backend/API v1.md`
- `tcc/90 - Tasks/items/AUTH-000-authentication-contract-decision.md`
- `tcc/90 - Tasks/items/OAPI-000-swagger-contract-decision.md`
- [Ktor session authentication](https://ktor.io/docs/server-session-auth.html)
- [Ktor Swagger UI](https://ktor.io/docs/server-swagger-ui.html)
