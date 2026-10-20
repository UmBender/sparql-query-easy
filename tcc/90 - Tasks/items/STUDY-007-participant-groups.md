---
id: STUDY-007
title: Let an admin put participants in groups and give each group its own tasks
status: DONE
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

- [x] Two groups with different tasks: each member's task query returns only
      their group's active tasks in the set order (Testcontainers test).
- [x] Assigning a user who is already in a group moves them (one group only).
- [x] Inactive tasks are excluded from the participant query but stay listed
      for the admin.
- [x] Participant/anonymous calls: 403/401.
- [x] e2e: the admin creates a group, adds a task and a participant.

## Validation

Focused: `AdminGroupRoutesTest` (proposed). Closing gate: HTTP/fullstack
union including `test:stack`.

## Conclusion

- Migration `V5__study_groups.sql`; `application/study/StudyGroups.kt`
  (`StudyGroupService`, `StudyGroupStore` port, `GroupResult`);
  `persistence/PostgresStudyGroupStore.kt` (assignment is an upsert on the
  member's user id, so assigning moves; participants only; a group with
  members is not deleted). `activeTasksFor(userId)` is the participant query
  STUDY-003 serves.
- HTTP: `AdminGroupRoutes.kt` (`/api/admin/groups/**`,
  `/api/admin/participants`), docs in `StudyGroupOpenApi.kt`; the delete is
  `POST …/delete` and unassigning `POST …/members/remove`, so every change
  goes through the same-origin JSON check. OpenAPI snapshot and types
  regenerated.
- Frontend: client `api.admin.*` group calls, `/admin/groups` (create, list,
  participants without a group) and `/admin/groups/[id]` (rename, ordered
  tasks with up/down/remove/add saved at once, members, move a participant
  from another group, delete when empty).
- Tests: `AdminGroupRoutesTest` (two groups with different ordered tasks
  through `activeTasksFor`, moving, inactive tasks, 401/403, invalid input,
  delete rule), `study.e2e.ts` on the real stack.
- Validation: Kotlin gate, frontend gate, `test:stack` (12) pass.
- "Submissions" in "a group with members or submissions is not deleted":
  submissions belong to a user and a task (STUDY-004), not to a group, so
  the members rule is the one enforced.
