---
id: AUTH-005
title: Give accounts a participant or admin role and guard the admin routes
status: DONE
priority: P1
type: security
depends_on: [DEC-014, AUTH-001, AUTH-004]
human_gate: false
created: 2026-10-19
updated: 2026-10-19
---
# Give accounts a participant or admin role and guard the admin routes

## Objective

DEC-014 Q3 = B (2026-10-19): an admin creates the proposed tasks and decides
which participants get which tasks, so accounts need roles. This reopens
DEC-013 C2 ("roles with T9") with the user's approval. Skill: `tcc-fullstack`.
Contract: [[../../09 - Decisions/Authentication Contract]].

## Scope

- Flyway migration: `app_user.role` (`participant` default, `admin`).
- First admin from configuration: a username list
  (`EASYQUERY_ADMIN_USERNAMES`, read by `AppSettings` like every other
  setting) is granted `admin` on registration and synced into the stored
  roles on the first account request after startup. Self-registration never grants admin
  otherwise; there is no route to change a role in this card. A name removed
  from the list loses `admin` at the next startup (the list is the source).
- `withAdmin` guard beside `withSession` (in `http/AdminRoutes.kt`):
  `/api/admin/**` answers 401 without a session and 403 for a participant.
  Until STUDY-006 adds routes, an admin gets 404 (same stub pattern as
  `/api/study/{...}`).
- `GET /api/auth/session` adds `role`; OpenAPI snapshot and generated types.
- Frontend: the session store exposes the role; `/admin/**` pages redirect a
  participant to `/` and an anonymous user to `/login?next=…` (AUTH-004
  guard); the toolbar shows an "Admin" link only to admins.

Excluded: task, group or export routes (STUDY-006/007, STUDY-002); role
editing through the UI.

## Acceptance criteria

- [x] A listed username registers or logs in as `admin`; any other name is
      `participant` (Testcontainers test).
- [x] Removing a name from the list and restarting demotes that account.
- [x] `/api/admin/anything`: 401 anonymous, 403 participant, 404 admin.
- [x] `GET /api/auth/session` returns `role`; existing auth tests unchanged
      otherwise.
- [x] A participant visiting `/admin` is sent to `/`; an admin sees the
      placeholder page and the toolbar link.
- [x] Authentication Contract route matrix gains the admin column.

## Validation

Focused: `AuthRoutesTest` via the focused Kotlin command. Closing gate:
HTTP/fullstack union (Kotlin closing gate, OpenAPI snapshot + `api:types`,
frontend gate, `test:stack`).

## Conclusion

- Migration `V3__user_roles.sql` (`app_user.role`, check constraint);
  `Role` and `User.role` in `application/auth`; `AccountStore.createUser`
  takes the role and `syncAdminRoles` aligns stored roles with the list.
  `AuthService` syncs once per process on the first account request (and
  retries while the database is unavailable), so the list is the only
  source of the admin role.
- `EASYQUERY_ADMIN_USERNAMES` in `AppSettings` (malformed names fail
  startup), `.env.example` and `compose.yaml`; `stack-admin` is configured in
  `playwright.stack.config.ts`.
- `http/AdminRoutes.kt`: `withAdmin` and the `/api/admin/{...}` stub (401,
  403 `Admin role required`, 404 for an admin). `role` added to the
  register, login and session responses (additive); OpenAPI snapshot and
  `schema.d.ts` regenerated.
- Frontend: `route-guard.ts` `ADMIN_PREFIXES`/`isAdminOnly` (a participant on
  `/admin` goes to `/`), placeholder `/admin` page, Admin link in the account
  menu for admins. Mock and spec user fixtures carry `role`.
- Docs: API v1 (accounts section), Authentication Contract (route matrix),
  Current Contracts, Docker Compose Stack.

Validation (2026-10-19):
- Kotlin closing gate `ktlintCheck detekt test`: ktlint and detekt pass;
  213 of 214 tests pass. The failure is
  `PostgresDatabaseTest` "a ready database lost after startup … ready again
  when it returns": pre-existing and intermittent. It also fails on the
  unchanged commit `ecee735` in a clean worktree, and passed in this task's
  first full run. It does not touch accounts.
- New frontend gate (`check`, `lint`, `npm test`): pass (173 + 7 Vitest,
  84 Playwright).
- `npm --prefix frontend run test:stack`: 10 passed, including the new
  admin/participant case.
- `docker compose config -q` (with a placeholder password): ok.

Limitations: no UI or route to change roles (by design). Noticed, not
changed: tests in `AuthServiceTest` written as `= runBlocking { … }` return
a value, so JUnit skips them (2 of 7 ran before this task). The new role test
uses a block body and runs.
