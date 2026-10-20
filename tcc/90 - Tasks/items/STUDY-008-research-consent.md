---
id: STUDY-008
title: Ask logged-in users for research consent and store it before any response
status: BACKLOG
priority: P1
type: fullstack
depends_on: [DEC-015, AUTH-005]
human_gate: false
created: 2026-10-20
updated: 2026-10-20
---
# Ask logged-in users for research consent and store it before any response

## Objective

T9 slice 1 of 4 (STUDY-002 scope). A logged-in participant sees a consent
screen on `/study` before the first form; accepting stores who accepted which
consent text version and when. Without a stored consent the server refuses to
store a form response (STUDY-010). Skill: `tcc-fullstack`.

What the gate covers (forms only, or forms and tasks) follows DEC-015 Q1.
Text below states the recommended option A; update it before READY.

## Scope

- Consent text as a versioned resource
  (`src/main/resources/study/consent/v<version>.md`, current version in
  configuration or the newest file). Ships a placeholder text marked
  `PLACEHOLDER — not for participants`.
- Flyway migration (next free number, `V9__study_consent.sql` today):
  `study_consent` (user_id → `app_user` ON DELETE CASCADE, consent_version,
  accepted_at, primary key (user_id, consent_version)). Nothing else is stored
  (no IP, no user agent).
- Routes, session required, JSON and Origin checks as in the Authentication
  Contract: `GET /api/study/consent` (current version, text, whether the
  caller accepted it) and `POST /api/study/consent` (`{version}`; 409 if the
  version is not current; idempotent for the same version).
- A shared check other routes call: no consent for the current version →
  403 `{"error":"consent_required"}`. Q1 A also applies it to the STUDY-003/004
  participant task routes (list, open, submit, history, finish); admins are
  not gated.
- Frontend: consent screen in `features/study/` (text, accept, decline);
  `/study` shows it until accepted; decline leaves the user on a page that
  explains nothing is stored and links to `/`. OpenAPI snapshot and generated
  types.

Excluded: withdrawal and deletion of data (go-live, LEARN-014); a privacy
notice page; real consent text (user/advisor input).

## Acceptance criteria

- [ ] Accepting stores one row with the current version and a server
      timestamp; repeating it changes nothing.
- [ ] Accepting an old or unknown version answers 409 and stores nothing.
- [ ] A new consent version makes the screen appear again for a user who
      accepted only the old one.
- [ ] Without consent the gated routes answer 403 `consent_required`
      (Q1 A: also the participant task routes); with consent they behave as
      before (existing `Study*RoutesTest` stay green after adding consent to
      their setup).
- [ ] Anonymous `GET`/`POST /api/study/consent` answer 401.
- [ ] Component test: accept and decline; axe check on the consent screen.

## Validation

Focused: `GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew test --tests '*Consent*' --no-daemon`
(proposed test class names), then the HTTP/fullstack closing gate of the
Operational Map, including `test:stack` (participant e2e gains the consent step).
