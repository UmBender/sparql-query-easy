---
id: AUTH-002
title: Integrate the login and logout frontend flow
status: READY
priority: P0
type: frontend
depends_on: [AUTH-001]
human_gate: false
created: 2026-09-21
updated: 2026-09-21
---
# Integrate the login and logout frontend flow

## Objective

Replace the non-functional `login.html` prototype with the approved Ktor auth
flow and integrate authenticated/anonymous navigation with `index2.html`.

## Evidence and relevant files

`sparql/login.html`; `sparql/index2.html`; `build.gradle.kts`;
`frontend-tests/index2.spec.mjs`; `StaticFrontendRoutesTest.kt`.

## Exact scope

- Submit credentials to the approved same-origin login route rather than the
  removed `index.html`.
- Implement accessible loading, invalid-credential, network-error, and success
  states without logging password values.
- Add logout and current-session UI behavior required by `AUTH-000`.
- Redirect/retain the original destination according to the approved contract.
- Remove or disable placeholder registration, forgotten-password, and
  anonymous links when they are outside the approved first release.
- Ensure all API requests use the approved session/CSRF mechanism.
- Extend local Playwright/CDN stubs and Ktor static-resource tests; no live
  identity provider or external backend is allowed in normal tests.

## Explicitly out of scope

- Backend authentication implementation (`AUTH-001`).
- Inventing registration/password-recovery behavior.
- UI redesign unrelated to login/session state.

## Dependencies

- `AUTH-001` supplies the verified backend contract.

## Acceptance criteria

- [ ] The form never posts to `index.html` and all links target real approved
      behavior.
- [ ] Successful and failed login, session restoration, logout, unauthorized
      redirect/response, and CSRF behavior have deterministic browser tests.
- [ ] Passwords are never placed in URLs, logs, DOM error messages, or storage.
- [ ] Existing graph workflows continue to pass after login.
- [ ] Frontend and request-flow documentation matches the shipped behavior.

## Verification commands

```sh
npm run test:browser
GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintCheck detekt test --no-daemon
git diff --check
```

## Expected documentation updates

`tcc/04 - Frontend/Frontend Architecture.md`;
`tcc/04 - Frontend/Request Flows.md`;
`tcc/08 - Quality/Quality and Compatibility.md`; `MIGRATION.md`.

## Risks

The current page depends on third-party CDN assets and contains dead links.
Frontend-only gating must not be mistaken for backend authorization.

## Execution log

- 2026-09-21: Created after tracing the static form, packaged resources,
  current same-origin API client, and browser/static-route test boundaries.
