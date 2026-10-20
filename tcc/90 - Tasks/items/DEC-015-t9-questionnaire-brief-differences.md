---
id: DEC-015
title: Decide how the T9 brief changes the questionnaire and consent contract of STUDY-002
status: DONE
priority: P1
type: decision
depends_on: [DEC-014]
human_gate: true
created: 2026-10-20
updated: 2026-10-20
---
# Decide how the T9 brief changes the questionnaire and consent contract of STUDY-002

## Objective

The T9 brief (2026-10-20, two questionnaires and consent) restates STUDY-002
(BACKLOG, nothing implemented) and adds consent, a forms table, an admin CSV
export and per-page progress. Most of it fits. Six points make a different
decision from STUDY-002, D5 or DEC-014 Q6, or leave a behavior open that the
build depends on. The user chooses for each. Nothing is implemented until
then. The slices are STUDY-008 (consent), STUDY-009 (form definitions),
STUDY-010 (responses) and STUDY-011 (export and e2e), all depending on this
card.

## Already decided, not reopened

- Session required for every `/api/study/**` route and the `/study` page;
  anonymous users get 401 or the login redirect (AUTH-000, AUTH-004).
- Roles `participant`/`admin`, `withAdmin` guard and `/admin` route guard
  (AUTH-005, DEC-014 Q3): the export uses them, no new role.
- Superforms + Zod in the frontend with the same rules repeated in Ktor
  (AUTH-003 `auth-form.ts`, STUDY-002).
- Testcontainers `postgres:17-alpine` for backend and stack tests (DEC-012).

## Evidence (2026-10-20)

- Migrations `V1`–`V8` in `src/main/resources/db/migration/`; no form,
  response or consent tables. `V8__study_completion.sql` holds the final
  submission (`study_completion`).
- `http/StudyRoutes.kt`: `/api/study/tasks`, `/api/study/submissions`,
  `/api/study/finish`; `http/AdminRoutes.kt`: `withAdmin`, `/api/admin/{...}`
  answers 404 for admins. No CSV route anywhere in `src/main/kotlin`.
- `frontend/package.json` already has `sveltekit-superforms`, `zod`, `msw`,
  `@axe-core/playwright`. Superforms is used by `features/auth/auth-form.ts`
  and `features/filters/filter-form.ts`.
- `features/study/finish-study.svelte`, `study-finished.svelte`: the place
  where an after-the-study form would appear.
- `route-guard.ts`: `PROTECTED_PREFIXES = ['/study', '/admin']`.
- Authentication Contract and Current Contracts (Study row): "LGPD/consent
  handling is deferred (D5)". STUDY-002 excludes consent and LGPD.

## Conflicts and open questions

| # | T9 brief | Current record | Affects if changed |
|---|---|---|---|
| Q1 | Consent required before any response is stored; consent records table; consent screen before the first form | D5 (2026-10-16), DEC-014 Q6 A: LGPD deferred; STUDY-002 excludes consent. STUDY-004 already stores task attempts without consent | Whether the gate also covers the proposed tasks (403 on STUDY-003/004 routes without consent), the existing participant e2e, the Authentication Contract and Study row |
| Q2 | `forms` table (slug, version, definition jsonb) | STUDY-002: forms "defined in versioned files" | Where definitions come from, how a new version is made, whether an admin screen is needed |
| Q3 | Silent on where the forms appear | STUDY-002 proposed default: one before the first proposed task, one after the final submission (placement is the user's) | `/study` flow, whether a missing form blocks the tasks, e2e order |
| Q4 | "Progress saved per page if a form is long" | Nothing | Browser storage only, or a server draft table that holds partial research data |
| Q5 | Admin CSV export | STUDY-002: "decide here who may read or export answers" | Who (resolved by the brief: admins), which participant identifier appears in the file, one file per form or one for all |
| Q6 | "Check whether the user already answered"; responses keep the form version | STUDY-002: one submission per form | Whether a new form version asks the same user again; whether an answer can be changed |

## Options and recommendation

- **Q1 consent.** A: one consent per user and consent-text version, shown on
  `/study` before anything else; without it no form response **and** no task
  attempt is stored (the task routes answer 403 `consent_required`); a user
  who declines can still use the anonymous editor at `/`; withdrawal and
  deletion requests stay a go-live item (LEARN-014) handled by hand
  (recommended: task attempts are research data too, and one gate is simpler
  than two). B: the gate covers only the forms, as the brief says; task
  attempts stay under D5 until go-live.
- **Q2 definitions.** A: versioned JSON files in
  `src/main/resources/study/forms/<slug>.v<version>.json`, upserted at startup
  into a `form` table keyed by (slug, version); a stored version is never
  changed (startup fails if a file differs from a stored version that has
  responses); a change means a new version file (recommended: keeps STUDY-002
  and gives the brief its table; the forms are the same for every
  participant). B: admin routes and a screen to create and edit forms
  (larger; only useful if forms differ per group or change during the study).
- **Q3 placement.** A: consent → profile form → proposed tasks → final
  submission → usability form; the tasks open only after the profile form is
  submitted, and the study is complete when the usability form is submitted
  (recommended: STUDY-002 default; the profile is measured before exposure).
  B: both forms are listed on `/study` and can be filled in any order; they
  never block the tasks.
- **Q4 progress.** A: per-page progress in the browser (`localStorage` keyed
  by user, form and version, cleared on submit and logout); the server stores
  nothing until the final submit of the form (recommended: minimal data,
  nothing stored before the participant sends it). B: a server
  `form_response_draft` table saved on each page change (survives a device
  change; stores partial answers).
- **Q5 export.** A: one CSV per form at
  `GET /api/admin/forms/{slug}/responses.csv`, admin only; one row per
  response: response id, participant number (the internal user id, not the
  username), group name, form version, submitted_at (UTC ISO-8601), consent
  version, then one column per question id (multiple choice joined by `;`);
  RFC 4180 quoting and formula-injection escaping (`=`, `+`, `-`, `@`)
  (recommended: minimal identifying data in the file). B: also include the
  username.
- **Q6 versions.** A: one response per user per form slug, whatever version;
  no edits after submit; `GET /api/study/forms/{slug}/response` says
  answered/not answered (recommended). B: one response per version, so a new
  version asks every user again.

## Pending input (not blocking the build)

The real questions of both forms and the consent text are the user's (and
the advisor's or ethics review's, LEARN-014). STUDY-009 ships placeholder
questions clearly marked `PLACEHOLDER`; STUDY-008 ships a placeholder consent
text. Neither may go to participants as is. No question asks for name,
e-mail, document numbers or other identifying data; any free-text question
that does needs the user's approval (brief).

## Acceptance criteria

- [x] The user picks an option for Q1–Q6. Record the choices here, in Open
      Decisions, in Current Contracts (Study row) and, for Q1, in the
      Authentication Contract (D5 note).
- [x] STUDY-008/009/010/011 are updated to the chosen options before any of
      them leaves BACKLOG. A B choice for Q2 or Q4 gets its scope added to
      STUDY-009 or STUDY-010, or its own card if larger.
- [x] STUDY-002's proposed changes (its "Proposed changes" section) are
      accepted or rejected; STUDY-002 itself is not rewritten.

## Decision

- 2026-10-20: The user chose A for all six:
  - Q1 A: one consent per user and consent-text version before anything on
    `/study`; without it no form response and no task attempt is stored
    (403 `consent_required` on the participant task routes too; admins not
    gated). Lifts D5 and DEC-014 Q6 A for the study. Withdrawal and deletion
    stay a go-live item (LEARN-014), handled by hand.
  - Q2 A: versioned JSON files `src/main/resources/study/forms/<slug>.v<version>.json`
    upserted at startup into `form` by (slug, version); a stored version
    with responses is never changed; a change is a new version file.
  - Q3 A: consent → profile form → tasks (403 `profile_required` before the
    profile) → final submission → usability form.
  - Q4 A: per-page progress in `localStorage` only, cleared on submit and
    logout; nothing stored on the server before submit.
  - Q5 A: one admin-only CSV per form with the internal user id, never the
    username.
  - Q6 A: one response per user per form slug, whatever version; no edits.
- STUDY-002's proposed changes are accepted; its `depends_on` gains
  STUDY-008/009/010/011 and it closes when they are DONE.
- Order: STUDY-008 and STUDY-009 → STUDY-010 → STUDY-011 → STUDY-002.
- Still the user's input (not blocking the build): the real questions and
  consent text; the slices ship `PLACEHOLDER` content.

## Validation

Documentation only: `node scripts/check-project-docs.mjs` and `git diff --check`.
