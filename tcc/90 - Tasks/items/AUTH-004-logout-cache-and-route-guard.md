---
id: AUTH-004
title: Clear cached server data on logout and send anonymous users from protected pages to login
status: DONE
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

- [x] After logout (and after an expired-session 401) the query cache is
      empty. Test: the next identical count request reaches the API (MSW
      request count).
- [x] Visiting a protected path without a session lands on
      `/login?next=…`. After login the user returns to that path. A
      `next` pointing to another origin or `//host` is ignored.
- [x] With a session, the protected path loads directly, and still does
      after a page reload (session restore, no flash of the login page).
- [x] Public pages (`/`, `/login`, `/styleguide`) never redirect.
- [x] Login form: component test (validation, wrong password message, submit
      calls the store), or a recorded reason it is not feasible.
- [x] Offline Playwright (`tests/auth.e2e.ts`): redirect, login-and-return,
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
- 2026-10-18: Implemented (T7 goal).
  - Cache: `appQueryClient` in `src/lib/api/queries.ts`, provided by
    `src/routes/+layout.svelte` (`QueryClientProvider`); the editor takes it
    with `useQueryClient()` and puts it on the e2e handle as `queryClient`.
    `AuthSession` takes an `onUserGone` callback, run when the logged-in user
    goes away (logout, refresh or logout finding the session expired, a
    different user logging in; the same user in another case keeps it); the
    app singleton clears the cache there.
  - Guard: `src/lib/features/auth/route-guard.ts` (`PROTECTED_PREFIXES =
    ['/study']`, `guardDecision` show/wait/redirect, `loginPath`, `safeNext`
    rejecting absolute, `//host`, backslash and `/login` targets). The root
    layout refreshes the session on a protected page, shows "Checking your
    session…" meanwhile, and `goto(resolve(loginPath))` with `replaceState`.
    `/login` follows `next` after login. `/study` is an empty placeholder
    (heading "Proposed queries", Back to the editor, Log out) for STUDY-001.
  - Component test: `auth-form.svelte.spec.ts` (3: validation, wrong
    password, submit). It mocks `$app/state`, `$app/navigation`, `$app/forms`
    (an `enhance` that prevents the native submit) and sets
    `globalThis.STORIES` so Superforms applies results without
    `applyAction`. Spreading the original `$app` modules hung Vitest.
  - Tests: `route-guard.spec.ts` (7), `auth-session.spec.ts` +3 (cache
    cleared on logout/expiry, MSW request count; user change);
    `tests/auth.e2e.ts` +4 (redirect and return, reload restore, foreign
    `next`, public pages, logout clears the cache and leaves `/study`);
    `tests-stack/auth.e2e.ts` +1 (redirect, return, reload, logout).
  - Validation: frontend check, lint, `test:coverage` (172), client Vitest
    (7), Playwright (83), `test:stack` (9, no container left).
  - Environment: the host was loaded by unrelated programs (load ~9.5 on 8
    cores); the offline Playwright web server (60 s limit in
    `playwright.config.ts`) timed out during the 46 s e2e build. Playwright
    therefore ran through an uncommitted local config that only raised that
    timeout; the repository config is unchanged.
