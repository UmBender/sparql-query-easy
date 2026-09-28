---
id: DOC-002
title: Reconcile migration and compatibility documentation
status: DONE
priority: P2
type: documentation
depends_on: [BUG-001, MIG-001]
human_gate: false
created: 2026-09-16
updated: 2026-09-21
---
# Reconcile migration and compatibility documentation

## Objective
Remove stale claims and align migration reports, compatibility README, remaining-work list, and vault notes with reviewed evidence.

## Evidence and relevant files
`MIGRATION.md`; `MIGRATION_REPORT.md`; `compatibility/README.md`; `remaining.md`.

## Scope
Documentation consistency after harness repair and comparator completion.

## Out of scope
Changing captures or production code.

## Dependencies
BUG-001 and MIG-001.

## Acceptance criteria

- [x] Current documentation no longer claims the capture corpus is empty or
      current Kotlin routes/use cases are unported.
- [x] Historical phase statements are retained as dated checkpoints and
      explicitly marked superseded where later work changed the state.
- [x] The compatibility guide describes the actual 34-directory `case.json`
      corpus, provenance ledger, comparator coverage, and six exception-only
      non-equivalences.
- [x] The migration report distinguishes approved Kotlin JSON errors from HTTP
      equivalence and lists the remaining compatibility/production gaps.
- [x] `remaining.md`, the vault migration/quality notes, and a root README
      agree with the task index and current source/test evidence.
- [x] Documentation links and whitespace checks pass; no application source,
      capture, or golden result was changed.

## Verification commands

```sh
rg -n '34 reviewed|All identified core C# application features are ported|superseded' \
  MIGRATION.md MIGRATION_REPORT.md compatibility/README.md remaining.md tcc
./gradlew test --tests 'com.example.sparqlqueryeasy.http.CaptureDrivenCompatibilityTest' --no-daemon --console=plain
./gradlew ktlintCheck detekt test --no-daemon --console=plain
npm run test:browser
git diff --check
```

## Expected documentation updates
Migration, compatibility, vault notes, root README.

## Risks
Historical assessment sections should be preserved as dated history, not rewritten as current fact.

## Execution log
- 2026-09-16: Ready after valid capture status is finalized.
- 2026-09-21: Selected after confirming `BUG-001` and `MIG-001` are `DONE`.
  Began a source-backed reconciliation of the migration report, compatibility
  guide, remaining-work list, and vault migration/quality notes. The existing
  unrelated Obsidian workspace-state change is preserved.
- 2026-09-21: Reconciled `MIGRATION.md`, `MIGRATION_REPORT.md`, the corpus
  README/catalogue, `remaining.md`, vault home/migration/quality notes, and a
  new root `README.md` against current routes, tests, 34 expected directories,
  34 provenance rows, Git history, and comparator exclusions. Preserved dated
  phase history while marking superseded state explicitly.
- 2026-09-21: Corrected the corpus structure to `case.json`, removed the stale
  empty-baseline/future-runner/browser-test claims, corrected the uncaptured C#
  health and Wikidata matrix, and documented all six exception captures as
  intentional non-equivalences under the approved Kotlin JSON error contract.
- 2026-09-21: The focused comparator passed. The temporary Gradle cache first
  failed in the sandbox (`Operation not permitted`) and then timed out while
  downloading Gradle; rerunning with the existing user Gradle cache passed in
  42 seconds. The complete `ktlintCheck detekt test` gate then passed.
- 2026-09-21: The first browser-test attempt could not bind `127.0.0.1` in the
  sandbox; the authorized local-server run passed all 8 Playwright tests.
  Link validation passed for all 10 changed Markdown documents, corpus counts
  matched at 34 directories/ledger rows/index entries, stale-claim searches
  passed, and `git diff --check` passed. No Mermaid was changed and no
  dedicated repository Markdown/Mermaid checker exists.
- 2026-09-21: Reviewed the complete task diff and marked `DONE`; only
  documentation/task state changed. The pre-existing
  `tcc/.obsidian/workspace.json` modification remains unrelated and untouched.
