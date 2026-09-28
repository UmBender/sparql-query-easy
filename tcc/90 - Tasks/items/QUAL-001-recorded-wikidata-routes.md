---
id: QUAL-001
title: Replay recorded Wikidata success and controlled error route fixtures
status: DONE
priority: P1
type: quality
depends_on: [DOC-001]
human_gate: true
created: 2026-09-16
updated: 2026-09-16
---
# Replay recorded Wikidata success and controlled error route fixtures

## Objective
Store one provenance-recorded public Wikidata success response and clearly
identified controlled fault responses, then replay all three through full
Ktor routes without ordinary live traffic.

## Evidence and relevant files
`compatibility/wikidata-responses/README.md`; `WikidataEntitySearchHttpClient.kt`; `WikidataHttpClient.kt`.

## Scope
Approved one-time public success recording, sanitation of operational
metadata, controlled non-2xx and malformed bodies, local fake transport, and
route success/error tests.

## Out of scope
Using live Wikidata in normal unit tests.

## Dependencies
Human approval for recordings and fixture provenance.

## Acceptance criteria
- [x] A public success response retains its `Q` IDs, `concepturi`, and labels
      with timestamp, request, status, selected headers, and body hash.
- [x] Controlled malformed and non-2xx cases are labelled as such.
- [x] All three cases execute offline through the complete Ktor search route.
- [x] The Kotlin formatting, lint, static-analysis, and full test gate passes.

## Verification commands
`GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintFormat ktlintCheck detekt test --no-daemon`.

## Expected documentation updates
Recording policy, provenance, migration report.

## Risks
External data changes; recordings must retain identifiers/labels and be dated.

## Execution log
- 2026-09-16: Blocked; no approved raw recording exists in the repository.
- 2026-09-27: User explicitly requested implementation. Treated this as
  approval for one public, one-time Wikidata success capture. Controlled local
  fault fixtures will be labelled separately and will not be represented as
  real Wikidata responses.
- 2026-09-27: Captured a public HTTP 200 MediaWiki response for `Douglas Adams`
  at 18:18:27 UTC; preserved `Q42` and `Q28421831`, labels, descriptions,
  and JSON text. Stored sanitized selected headers, exact request, SHA-256,
  and one documented terminal-file-newline normalization. No cookies or
  operational identifiers were copied. Created separately labelled local
  `429` and malformed-body fixtures.
- 2026-09-27: Added `RecordedWikidataRoutesTest` using `MockEngine` through
  `POST /api/query/search`. Success maps IDs/labels exactly; non-2xx and
  malformed bodies follow Kotlin's approved JSON `502` contract. Initial
  focused run failed on a test-only interface instantiation and line length;
  corrected both. The focused test and full `ktlintFormat ktlintCheck detekt
  test --no-daemon` gate then passed. Normal tests made no live request.
- 2026-09-27: Updated fixture policy, migration report, vault quality and
  migration notes, task index, blockers, and remaining-work documentation.
  The legacy 34-case C# corpus was not changed. C# search-route response
  capture remains a separate MIG-002 retirement gate; this task does not claim
  strict C# response equivalence.
- 2026-09-27: Commands and results: the first public `curl -i --max-time 25`
  failed on sandbox DNS; the approved retry returned HTTP 200 and a 1,015-byte
  JSON body. `dotnet --info` reported SDK 8.0.131 and host 8.0.31 for future
  C# capture planning; no C# capture was performed. Initial focused Gradle
  attempts failed on test-only compilation/formatting and were corrected.
  `./gradlew ktlintFormat test --tests
  'com.example.sparqlqueryeasy.http.RecordedWikidataRoutesTest' --no-daemon`
  passed, followed by `./gradlew ktlintFormat ktlintCheck detekt test
  --no-daemon` with `GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle`.
  `jq -e` validated the success and metadata JSON, the response-body SHA-256
  matched provenance, and `git diff --check` passed.
- 2026-09-27: Changed files: the six body/metadata fixtures in
  `compatibility/wikidata-responses/`, `RecordedWikidataRoutesTest.kt`,
  `compatibility/README.md`, `compatibility/cases/manifest.md`, the recording
  policy, `MIGRATION.md`, `MIGRATION_REPORT.md`, `remaining.md`, migration and
  quality vault notes, `TASKS.md`, `RUN_LOG.md`, and `BLOCKERS.md`.
