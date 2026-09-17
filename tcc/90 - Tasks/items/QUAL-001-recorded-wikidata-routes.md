---
id: QUAL-001
title: Add approved recorded Wikidata success and error route fixtures
status: BLOCKED
priority: P1
type: quality
depends_on: [DOC-001]
human_gate: true
created: 2026-09-16
updated: 2026-09-16
---
# Add approved recorded Wikidata success and error route fixtures

## Objective
Store reviewed raw Wikidata recordings and replay them through full Ktor routes without normal live traffic.

## Evidence and relevant files
`compatibility/wikidata-responses/README.md`; `WikidataEntitySearchHttpClient.kt`; `WikidataHttpClient.kt`.

## Scope
Approved one-time recording, sanitation of operational metadata, local fake transport, route success/error tests.

## Out of scope
Using live Wikidata in normal unit tests.

## Dependencies
Human approval for recordings and fixture provenance.

## Acceptance criteria
Recorded success, malformed response, and non-2xx cases execute offline through Ktor routes.

## Verification commands
Normal Gradle test task only.

## Expected documentation updates
Recording policy, provenance, migration report.

## Risks
External data changes; recordings must retain identifiers/labels and be dated.

## Execution log
- 2026-09-16: Blocked; no approved raw recording exists in the repository.
