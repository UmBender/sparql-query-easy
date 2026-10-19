---
id: DEC-014
title: Decide how the T8 brief changes the proposed-query contract of STUDY-001
status: BLOCKED
priority: P1
type: decision
depends_on: [STUDY-001, DEC-013]
human_gate: true
created: 2026-10-19
updated: 2026-10-19
---
# Decide how the T8 brief changes the proposed-query contract of STUDY-001

## Objective

The T8 brief (2026-10-19, proposed queries and answer submission) restates
STUDY-001 (BACKLOG, nothing implemented). Most of it fits. Six points make a
different decision from STUDY-001, DEC-013 or the 2026-10-16 decisions (D5,
D6), or leave a behavior open that the build depends on. The user chooses for
each. Nothing is implemented until then. The split into slices is FE-053,
STUDY-003, STUDY-004 and STUDY-005, all depending on this card.

## Already decided, not reopened

- Session required for every `/api/study/**` route and the `/study` page;
  anonymous users get 401 or the login redirect (AUTH-000, AUTH-004).
- No access to the proposed queries after the final submission (D6,
  2026-10-16; STUDY-001). Q1 below only asks how many attempts come before it.
- Testcontainers `postgres:17-alpine` for backend tests (DEC-012, QUAL-011).
- Versioned saved format `formatVersion: 1` for the submitted graph (FE-042).

## Evidence (2026-10-19)

- `src/main/resources/db/migration/` has `V1__baseline.sql`, `V2__accounts.sql`
  (`app_user`, `user_session`). No study tables.
- `http/AuthRoutes.kt`: `route("/api/study/{...}")` answers 401 without a
  session and 404 with one, waiting for STUDY-001.
- `GeneralQueryService` takes a flat `GeneralQueryRequest` (variable, triple
  patterns, `limit` default 20, variable filters). The `QueryGraph` → request
  mapping exists only in TypeScript (`frontend/src/lib/domain/query.ts`
  `nodeQueryRequest`, `stageRequestFor`), covered by `request-parity.spec.ts`.
- `frontend/src/lib/features/editor/query-editor.svelte` creates its own
  `QueryStore` with no arguments; `QueryStore`'s constructor already accepts an
  `endpoint` (and other initial state).
- `frontend/src/routes/study/+page.svelte` is an empty placeholder (AUTH-004).
- `frontend/src/lib/domain/fixtures/fire-speed-at-least-90.query.json` is a
  ready PokemonGen1 query for the brief's example task.

## Conflicts and open questions

| # | T8 brief | Current record | Affects if changed |
|---|---|---|---|
| Q1 | "How many attempts are allowed?" (open question); attempt history; e2e submits a wrong answer and then a right one | STUDY-001 title "submit answers once"; stores attempt count; D6 locks everything after the final submission | Submissions table (one row vs many per task), the submit route's 409 rule, attempt history UI, the e2e shape, the thesis metric "attempts" |
| Q2 | Feedback display; e2e "submit a wrong answer and see feedback"; "does feedback show the correct answer?" (open question) | STUDY-001: "whether the participant sees correctness is undecided: default hidden" | Response body of the submit route, feedback component, e2e oracle; showing correctness after each try changes what "attempts" measures |
| Q3 | Tasks stored in a `tasks` table (migration); "admin routes or a seed file (ask me)" | STUDY-001: tasks in a versioned repository file loaded at startup. DEC-013 C2: no roles until T9, "STUDY-001 loads tasks from a repository file, so it needs no admin" | Admin routes need roles and an admin guard (reopens DEC-013 C2); a table needs a sync rule from the file |
| Q4 | Compare by set equality on the relevant variable; the rule is a per-task setting | STUDY-001: unordered multiset of result rows unless the task needs ORDER BY. AGENTS.md: compare rows as multisets where applicable | Comparison module, task file schema, unit tests |
| Q5 | "Run the submitted graph with the existing graph-to-SPARQL code"; never trust a client correctness flag | Graph → request mapping is TypeScript only; Kotlin turns a request into SPARQL | Either a Kotlin port of the mapping (with parity fixtures) or the client sends the request it derived from the graph |
| Q6 | Shared context: "LGPD applies (minimal data, consent, restricted access)" for submissions | D5 (2026-10-16): LGPD deferred; STUDY-002 excludes consent | A consent gate before the first task, retention/deletion rules, access to exports |

The brief's "which variable is the answer" is also unspecified: a drawn graph
can have several variables with participant-chosen names. It is part of Q4.

## Options and recommendation

- **Q1 attempts.** A: unlimited attempts per task until the participant ends
  the study with a final submission (D6); every attempt is stored and counted
  (recommended: matches "attempts" as a thesis metric and the brief's e2e).
  B: a fixed number N per task (per-task setting), then the task is closed.
  C: one attempt per task (STUDY-001's title).
- **Q2 feedback.** A: show correct/incorrect plus a short feedback text (for
  example "3 of 7 expected results; 2 extra"), never the expected answer
  (recommended: lets the participant retry without giving the answer away).
  B: correct/incorrect only. C: hidden (STUDY-001 default); then the e2e
  checks "submission recorded" instead of feedback. D: also show the expected
  answer (only sensible with C of Q1).
- **Q3 task source.** A: a versioned seed file in the repository
  (`src/main/resources/study/tasks.json`) is the source; at startup it is
  upserted into a `study_task` table keyed by a stable task `key`, so
  submissions have a foreign key; tasks removed from the file become
  `active = false` (recommended: keeps STUDY-001 and DEC-013 C2, gives the
  brief its table). B: admin routes to create and edit tasks; needs roles and
  an admin guard first (reopens DEC-013 C2; a new AUTH card).
- **Q4 comparison.** A: per-task `comparison` setting with two modes:
  `set` (distinct values of the answer variable equal the expected set,
  default) and `multiset` (rows with duplicates); the participant's answer
  variable is the one the task page asks them to mark at submit, preselected
  when the graph has only one variable (recommended). The check runs with a
  limit high enough for the expected set (per-task `maxResults`, default
  1000), never the editor's limit of 20. B: multiset only (STUDY-001).
- **Q5 server check.** A: the client sends the saved `QueryGraph` and the
  request it derives with the same domain code as Run Query; the server runs
  that request through `GeneralQueryService` on the task's endpoint (ignoring
  any endpoint the client sends), computes correctness itself and stores
  graph, request, generated SPARQL and result summary (recommended: reuses the
  tested mapping; correctness never comes from the client). B: port the
  graph → request mapping to Kotlin and ignore the client request, with the
  FE-042 fixtures as a parity oracle (larger; two mappings to keep equal).
- **Q6 LGPD.** A: keep D5 for this build (development and PokemonGen1 only),
  store only user id and query data (no free text, no names), and make the
  consent gate a go-live item with STUDY-002/LEARN-014 (recommended). B: add
  a consent step before the first proposed task now (a new card before
  STUDY-003).

## Acceptance criteria

- [ ] The user picks an option for Q1–Q6. Record the choices here, in Open
      Decisions and in Current Contracts (Study row).
- [ ] FE-053, STUDY-003, STUDY-004 and STUDY-005 are updated to the chosen
      options before any of them leaves BACKLOG. A B choice for Q3 or Q6 gets
      its own card that depends on this one.
- [ ] STUDY-001's proposed changes (its "Proposed changes" section) are
      accepted or rejected; STUDY-001 itself is not rewritten.

## Validation

Documentation only: `node scripts/check-project-docs.mjs` and `git diff --check`.
