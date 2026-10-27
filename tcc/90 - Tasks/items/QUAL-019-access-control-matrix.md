---
id: QUAL-019
title: Prove no route or trick reaches admin or another participant's data
status: BACKLOG
priority: P1
type: quality
depends_on: []
human_gate: false
created: 2026-10-27
updated: 2026-10-27
---
# Prove no route or trick reaches admin or another participant's data

## Objective

Security plan threats 1–4 ([[../../08 - Quality/Security Test Plan]]).
Skills: `tcc-test`, `tcc-backend`.

## Scope and acceptance

- Route access matrix (Kotlin, `testApplication` with the test database
  support used by the study tests): read every operation from the live
  `/openapi.json`, call it as anonymous, participant A, participant B (other
  group) and admin, and compare with a declared table of expected outcomes
  (public, login, participant-own, admin). An operation missing from the
  table fails the test, so a new unguarded admin route cannot ship.
- Admin escalation attempts all fail: registering a listed admin username
  in other case/with whitespace/with Unicode lookalikes (record what the
  rule is), a `role`/`isAdmin` field in register/login bodies, a forged,
  truncated, expired or other user's session cookie, a cookie reused after
  logout, a demoted admin's old session after a restart with a changed list.
- IDOR: participant A cannot read B's submissions, form responses, consent,
  or a task outside A's group (404, not 403, as the contract says); no
  participant response ever contains `expected`, `referenceQuery` or
  `referenceSparql`.
- CSRF: every non-GET route under `/api/auth`, `/api/study`, `/api/admin`
  rejects a foreign `Origin` (403) and a non-JSON body (415), driven by the
  same matrix.
- Frontend: Playwright checks that `/admin` as a participant or anonymous
  shows no admin data (the guard redirects, and no admin API call
  succeeds).

## Validation

Kotlin gate; frontend gate for the Playwright part.

## Conclusion
