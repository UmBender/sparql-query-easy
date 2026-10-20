---
id: STUDY-010
title: Submit a questionnaire once, validated on the server, with progress kept per page
status: READY
priority: P1
type: fullstack
depends_on: [STUDY-008, STUDY-009, STUDY-005]
human_gate: false
created: 2026-10-20
updated: 2026-10-20
---
# Submit a questionnaire once, validated on the server, with progress kept per page

## Objective

T9 slice 3 of 4 (STUDY-002 scope). A participant who gave consent fills in
the profile and usability forms at their place in the study flow and submits
each once; the server validates the answers against the stored definition and
stores them with the form version. Skill: `tcc-fullstack`.

DEC-015 (2026-10-20): profile before the tasks, usability after the final
submission (Q3 A); progress in the browser only (Q4 A); one response per
user per form slug, no edits (Q6 A).

## Scope

- Migration (next free number): `form_response` (id, user_id → `app_user`
  ON DELETE CASCADE, form_id → `form`, form_version, consent_version,
  answers jsonb, submitted_at; unique (user_id, form slug) per Q6 A).
  Answers hold only question id → value; nothing else from the request.
- Routes, session required, JSON and Origin checks:
  `POST /api/study/forms/{slug}/responses` (`{version, answers}`): 403
  `consent_required` without consent (STUDY-008); 400 with per-question errors
  from the STUDY-009 validator; 409 if already answered or the version is not
  current; 201 otherwise, `submitted_at` from the server clock.
  `GET /api/study/forms/{slug}/response`: `{answered, submittedAt}` for the
  caller only, never the answers of others.
- Flow (Q3 A): `/study` shows consent → profile form → tasks; the task routes
  answer 403 `profile_required` until the profile form is answered; after the
  final submission (STUDY-005) `study-finished.svelte` shows the usability
  form, then a thank-you state.
- Per-page progress (Q4 A): answers of completed pages kept in `localStorage`
  under user, slug and version (wrapped in try/catch; the form still works
  without storage), restored on reload, cleared on submit and on logout
  (AUTH-004 cache clearing).
- OpenAPI snapshot and generated types.

Excluded: export (STUDY-011); editing a submitted response; server drafts
(DEC-015 Q4 B).

## Acceptance criteria

- [ ] A valid profile response is stored once with form and consent versions;
      a second submit answers 409 and changes nothing.
- [ ] An invalid answer (a placeholder rule from STUDY-009, e.g.
      `programming_years: 99`) is rejected with 400 and the question's error
      even when the client-side check is bypassed; nothing is stored.
- [ ] Extra fields and unknown question ids are rejected; a client
      `submitted_at` is ignored.
- [ ] Without consent: 403 `consent_required`, nothing stored. Anonymous: 401.
- [ ] Task routes answer 403 `profile_required` before the profile form (Q3 A);
      the usability form appears only after the final submission.
- [ ] Reloading in the middle of the usability form restores page 1; logout
      clears it (component or browser test).

## Validation

Focused: the new response route test (Testcontainers PostgreSQL), then the
HTTP/fullstack closing gate of the Operational Map, including `test:stack`.
