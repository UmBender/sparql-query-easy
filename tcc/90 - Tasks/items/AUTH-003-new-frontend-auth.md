---
id: AUTH-003
title: Register, log in and log out in the new frontend
status: DONE
priority: P1
type: frontend
depends_on: [AUTH-001, FE-041, FE-050, FE-043]
human_gate: false
created: 2026-10-16
updated: 2026-10-18
---
# Register, log in and log out in the new frontend

## Objective

T7 frontend; supersedes AUTH-002 (legacy `login.html`). Contract:
[[../../09 - Decisions/Authentication Contract]]. Skill: `tcc-frontend`.

## Scope

Register and login forms (Superforms + Zod), session state from
`GET /api/auth/session`, logout, anonymous mode keeps the query editor. No
password recovery link.

## Acceptance criteria

- [x] Register, login, wrong password, taken username, logout and session
      restore pass in component tests (MSW) and one e2e test on the real stack.
      (MSW drives the session store in Vitest; the form itself is tested in
      the built app with the typed mocks, see the log.)
- [x] Passwords never appear in URLs, logs or storage.

## Execution log

- 2026-10-18: `frontend/src/lib/features/auth/`: `auth-session.svelte.ts`
  (`AuthSession` rune store: refresh from `GET /api/auth/session`, login,
  register, logout; messages for 401/409/429/503/network; app singleton
  `authSession`), `auth-form.ts` (Zod: login requires both fields;
  registration repeats the server rules and a repeated password, since there
  is no recovery), `auth-form.svelte` (Superforms SPA mode, autocomplete
  `current-password`/`new-password`), `account-menu.svelte` (toolbar: Log in
  link, or username + Log out). Route `/login` ("Continue without an
  account"). Client: `session`/`register`/`login`/`logout` and the error
  kinds `unauthorized`, `conflict`, `rate-limited`, `unavailable` (503 was
  `server` before; `client.spec.ts` updated). Typed mocks gained the auth
  routes (anonymous by default) and non-200 answers.
- Found on the real stack: Vite's string proxy shorthand rewrites `Host`
  (`changeOrigin: true`), so AUTH-001's Origin check rejected every login
  through `vite dev`/`vite preview`; the proxy now keeps `Host`. The
  production proxy (OPS-006) must keep it too (Caddy does by default).
- Tests: `auth-session.spec.ts` (MSW: register, taken username, wrong
  password, login, logout, restore, expired logout, 503/429/network; schema
  rules). A Vitest browser component test was tried and dropped: Superforms
  reads SvelteKit's `$app/state`, which only exists inside the app, so the
  form is tested in `tests/auth.e2e.ts` (5, mocked API: validation, wrong
  password, taken username, register, restore, logout, 503) and on the real
  stack in `tests-stack/auth.e2e.ts` (2: register, HttpOnly/SameSite cookie,
  reload restore, logout, wrong password, case-insensitive login, taken
  username) with an embedded PostgreSQL (`StackPostgres`, Gradle
  `writeStackPostgresClasspath`). Every auth e2e asserts the password is in
  neither the URL nor browser storage.
- Validation: frontend check, lint, `npm test` (162 Vitest server, 4
  component, 78 Playwright), `test:stack` (8, no PostgreSQL left running),
  Kotlin `ktlintCheck detekt test` (206), docs check.
