---
id: AUTH-005
title: Give accounts a participant or admin role and guard the admin routes
status: READY
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
- First admin from configuration: a username list (`ADMIN_USERNAMES`, read
  through `application.conf`) is granted `admin` at startup and on
  registration/login of a listed name. Self-registration never grants admin
  otherwise; there is no route to change a role in this card. A name removed
  from the list loses `admin` at the next startup (the list is the source).
- `withAdmin` guard beside `withSession` in `http/AuthRoutes.kt`:
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

- [ ] A listed username registers or logs in as `admin`; any other name is
      `participant` (Testcontainers test).
- [ ] Removing a name from the list and restarting demotes that account.
- [ ] `/api/admin/anything`: 401 anonymous, 403 participant, 404 admin.
- [ ] `GET /api/auth/session` returns `role`; existing auth tests unchanged
      otherwise.
- [ ] A participant visiting `/admin` is sent to `/`; an admin sees the
      placeholder page and the toolbar link.
- [ ] Authentication Contract route matrix gains the admin column.

## Validation

Focused: `AuthRoutesTest` via the focused Kotlin command. Closing gate:
HTTP/fullstack union (Kotlin closing gate, OpenAPI snapshot + `api:types`,
frontend gate, `test:stack`).
