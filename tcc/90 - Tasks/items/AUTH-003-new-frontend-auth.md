---
id: AUTH-003
title: Register, log in and log out in the new frontend
status: BACKLOG
priority: P1
type: frontend
depends_on: [AUTH-001, FE-041, FE-050, FE-043]
human_gate: false
created: 2026-10-16
updated: 2026-10-16
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

- [ ] Register, login, wrong password, taken username, logout and session
      restore pass in component tests (MSW) and one e2e test on the real stack.
- [ ] Passwords never appear in URLs, logs or storage.
