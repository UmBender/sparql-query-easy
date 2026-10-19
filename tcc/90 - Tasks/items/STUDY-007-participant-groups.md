---
id: STUDY-007
title: Let an admin put participants in groups and give each group its own tasks
status: READY
priority: P1
type: fullstack
depends_on: [STUDY-006]
human_gate: false
created: 2026-10-19
updated: 2026-10-19
---
# Let an admin put participants in groups and give each group its own tasks

## Objective

DEC-014 (2026-10-19): the user applies different tasks depending on the
person. The admin creates groups (for example "condition A"), attaches an
ordered list of tasks to each group and puts each participant in exactly one
group. Skill: `tcc-fullstack`.

## Scope

- Flyway migration: `study_group` (id, name unique, timestamps),
  `study_group_task` (group, task, position; unique pair),
  `study_group_member` (user unique → one group, group, assigned_at).
- Admin routes under `/api/admin/groups`: list, create, rename, set the
  ordered task list, list members, assign/unassign participants (by
  username), list participants without a group. A group with members or
  submissions is not deleted.
- Application query used by STUDY-003: "active tasks for user U, in group
  order"; a user without a group has none.
- Frontend `/admin/groups`: groups, their ordered tasks, members, and the
  unassigned participant list.
- OpenAPI snapshot and generated types.

Excluded: random assignment (not chosen); moving submissions between
groups. Moving a participant keeps their submissions; they then see the new
group's tasks.

## Acceptance criteria

- [ ] Two groups with different tasks: each member's task query returns only
      their group's active tasks in the set order (Testcontainers test).
- [ ] Assigning a user who is already in a group moves them (one group only).
- [ ] Inactive tasks are excluded from the participant query but stay listed
      for the admin.
- [ ] Participant/anonymous calls: 403/401.
- [ ] e2e: the admin creates a group, adds a task and a participant.

## Validation

Focused: `AdminGroupRoutesTest` (proposed). Closing gate: HTTP/fullstack
union including `test:stack`.
