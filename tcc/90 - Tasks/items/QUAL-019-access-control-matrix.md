---
id: QUAL-019
title: Prove no route or trick reaches admin or another participant's data
status: DONE
priority: P1
type: quality
depends_on: []
human_gate: false
created: 2026-10-27
updated: 2026-10-28
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

DONE 2026-10-28 (rebased on `main` after STUDY-014, FE-061 and STUDY-015;
the table classifies all 43 operations there).

- Matrix: `src/test/kotlin/com/example/sparqlqueryeasy/http/AccessControlRules.kt`
  is the only table (`PUBLIC`, `LOGIN`, `PARTICIPANT_OWN`, `ADMIN`, keyed
  `"METHOD /path"`). `AccessControlMatrixTest` reads the live `/openapi.json`
  and fails if an operation has no rule (fail closed), if a rule names an
  operation that is gone, or if an `/api/admin` rule is not `ADMIN` or an
  `/api/study` rule is `PUBLIC`. It calls every operation as anonymous, Ada
  (group A), Bob (group B) and the admin, using B's resources as path
  parameters. Each call must get exactly `401 Login required`, `403 Admin
  role required` or no denial, and never a 5xx. Two hand mutations failed it
  as intended: a missing rule, and `GET /api/admin/participants` behind a
  plain session. The same test class also runs CSRF on every auth, study and
  admin write: six foreign `Origin` values give 403, and text/plain,
  form-urlencoded, multipart and `application/jsonp` bodies give 415. Admin
  and participant state stays the same before and after. Routing tricks
  around `/api/admin` (`..`, `%2e%2e`, `%61dmin`, upper case, `;`, `//`,
  `%00`, HEAD/OPTIONS/POST) never answer 2xx or admin data.
- Escalation (`AdminEscalationTest`): case and whitespace variants of the
  admin name (including NBSP) give 409. Lookalikes (Cyrillic, small
  capital, fullwidth, zero-width, combining, NUL, inner space) give 400.
  `role`/`isAdmin`/`admin`/`roles` in the register or login body give 400
  (strict body). A role claim in a study write is ignored. A forged,
  truncated, padded, reversed or 64/65-character token, the stored digest,
  `../`, an empty value, extra cookies, `X-Session` or `Authorization:
  Bearer` give 401, and a participant's cookie gives 403. Expiry, logout
  and login rotation end the old id. A demoted admin's old session is a
  participant after a restart with the changed list.
- IDOR (`ParticipantIsolationTest`): another group's task (and an unknown
  one) answers 404 `Task not found` on every `{key}` and `?task=` study
  operation, and nothing is stored. Each participant sees only their own
  attempts, consent and questionnaire state, and `user`, `userId`,
  `group`... query parameters change nothing. A submission body naming Bob
  or carrying `correct`/`expected` is stored as Ada's own wrong attempt. No
  non-admin GET or submission answer has `expected*`/`reference*`/`sparql`
  keys, the answer IRIs, another group's task, or other users' or group
  names. The admin view does show them, so the check is not vacuous.
- Fixed vulnerability: `GET /api/study/submissions?task=` answered `200
  []` for another group's or an inactive task and 404 only for an unknown
  key, so a participant could list other groups' task keys. Now
  `StudyService.attempts` resolves the key among the caller's active group
  tasks, like `open`, and answers 404. Two existing assertions in
  `StudySubmissionRoutesTest` were updated to match. OpenAPI description,
  snapshot and `schema.d.ts` were regenerated.
- Browser (`frontend/tests/admin-access.e2e.ts`): every admin page opened
  as anonymous lands on `/login?next=<page>`, and as a participant on `/`,
  including a session demoted between loads. No `/api/admin` request is
  made. A canary admin API would have exposed any rendering.
- Recorded rule and open item (API v1, Current Contracts, Security Test
  Plan): see the username/lookalike rule. A listed admin name that nobody has
  registered yet is claimable by the first registrant. That is the AUTH-005
  design, so it is not fixed here: register the admin accounts before
  opening the server. A bootstrap secret would need a new decision.
- Commands (final state): `GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle
  ./gradlew ktlintCheck detekt test --no-daemon` BUILD SUCCESSFUL (308
  tests, 0 failures). `npm run check` 0 errors; `npm run lint` clean. `npm
  test` under the shared lock: Vitest server 263 passed. The Vitest client
  project timed out on unrelated, unchanged component tests twice under
  machine load (load ~9, cold Vite optimizer cache after the rebase). The
  rerun under the lock of `vitest run --project client` passed 25/25 and
  `playwright test` passed 126/126 (the 3 new specs included). `node
  scripts/check-project-docs.mjs` passes.
