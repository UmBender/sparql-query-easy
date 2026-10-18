---
id: AUTH-004
title: Clear cached server data on logout and send anonymous users from protected pages to login
status: BACKLOG
priority: P1
type: frontend
depends_on: [AUTH-003, FE-043]
human_gate: false
created: 2026-10-18
updated: 2026-10-18
---
# Clear cached server data on logout and send anonymous users from protected pages to login

## Objective

T7 follow-up (EXTENDS AUTH-003, which stays DONE). The T7 brief asks for three
things AUTH-003 did not ship:

- the svelte-query cache is cleared on logout;
- a guard in the root layout sends anonymous users from protected pages to
  login;
- a component test for the login form.

Contract: [[../../09 - Decisions/Authentication Contract]]. Skill:
`tcc-frontend` (`tcc-style` only if the login page markup changes).

## Evidence (2026-10-18)

- `frontend/src/lib/features/auth/auth-session.svelte.ts` `logout()` only sets
  `user = null`. Nothing touches TanStack Query.
- The only `QueryClient` is created inside
  `frontend/src/lib/features/editor/query-editor.svelte` (`createAppQueryClient()`,
  `src/lib/api/queries.ts`). Logout code cannot reach it. Today it caches only
  public data (counts, profiles, search). Study data (STUDY-001/002) will be
  per-user.
- `frontend/src/routes/+layout.svelte` / `+layout.ts` have no session check.
  The routes are `/`, `/login` and `/styleguide`, all public. `/study`
  (STUDY-001) is the first protected page.
- AUTH-003 log: a Vitest browser test of `auth-form.svelte` was dropped
  because Superforms reads `$app/state`. The form is covered by
  `tests/auth.e2e.ts` (mocked API) and `tests-stack/auth.e2e.ts`.

## Scope

- One app-wide `QueryClient`, created and provided in the root layout. The
  editor uses it instead of its own. Cache keys and `staleTime` stay the same.
- `QueryClient.clear()` runs on logout and whenever a request answers 401
  (expired session) and the store drops the user.
- A pure, unit-tested guard decision (`pathname`, session state →
  stay | redirect). It holds a list of protected path prefixes, initially
  `/study`. The root layout waits for the session refresh, then redirects an
  anonymous user to `/login?next=<path>`. After login, `/login` follows `next`
  only when it is a same-app relative path (no open redirect); otherwise it
  goes to `/`.
- Try again for a login-form component test (Vitest browser mode, for
  example with `$app/state` aliased to a test stub). If it still can't work,
  record why and keep the e2e coverage.

## Out of scope

- The `/study` pages themselves (STUDY-001). If the layout guard does not run
  for an unmatched path, this card adds an empty `/study` placeholder page,
  which STUDY-001 then fills.
- Any backend or route change, roles, email identity and the
  `/api/auth/me` name (DEC-013).
- Password recovery (D4).

## Dependencies

AUTH-003 (DONE), FE-043 (DONE). Independent of DEC-013. If DEC-013 picks a
route or identity change, that card adapts this code.

## Acceptance criteria

- [ ] After logout (and after an expired-session 401) the query cache is
      empty. Test: the next identical count request reaches the API (MSW
      request count).
- [ ] Visiting a protected path without a session lands on
      `/login?next=…`. After login the user returns to that path. A
      `next` pointing to another origin or `//host` is ignored.
- [ ] With a session, the protected path loads directly, and still does
      after a page reload (session restore, no flash of the login page).
- [ ] Public pages (`/`, `/login`, `/styleguide`) never redirect.
- [ ] Login form: component test (validation, wrong password message, submit
      calls the store), or a recorded reason it is not feasible.
- [ ] Offline Playwright (`tests/auth.e2e.ts`): redirect, login-and-return,
      logout clears the cache. Real stack (`tests-stack/auth.e2e.ts`): login,
      wrong password, logout, reload restore (exists), plus the redirect.

## Validation

- Focused: `npx vitest run src/lib/features/auth` and
  `npx playwright test auth` in `frontend/`.
- Closing gate (Operational Map, frontend): `npm --prefix frontend run check &&
  npm --prefix frontend run lint && npm --prefix frontend test`, plus
  `npm --prefix frontend run test:stack` (it uses the session API).

## Execution log

- 2026-10-18: Created from the T7 brief. Gaps confirmed in code (see Evidence).
