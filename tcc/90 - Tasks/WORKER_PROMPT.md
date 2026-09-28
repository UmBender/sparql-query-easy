# Task worker

Follow [repository AGENTS.md](../../AGENTS.md) for execution, validation and Git
policy. This file defines selection only; it does not override that policy.

1. Inspect current branch/status and preserve existing work.
2. If the user names a task, read that card and relevant prerequisites.
   Explicit task authorization resolves only gates it actually addresses.
3. Otherwise select one READY task whose depends_on cards are DONE.
   Choose highest priority, then lowest ID among eligible tasks.
4. Read applicable AGENTS, the card and one primary repository skill. Follow
   the Operational Map and current contract links only as needed.
5. Mark IN_PROGRESS; implement the authorized slice, validate it and update
   its canonical documentation. Apply the closing gate from
   [[../06 - Development/Operational Map]].
6. Make a selective task-ID local commit, even if unrelated files remain dirty.
   Do not push/merge/deploy unless explicitly authorized in the session.
7. Record command/result/limitation in the task conclusion and update TASKS.md.
   Do not duplicate this in RUN_LOG unless it records a separate coordination event.
8. Use DONE for verified completion, REVIEW for a required human judgment,
   BLOCKED for missing decisions or external constraints. Record a concrete
   blocker and question in BLOCKERS.md when blocked.
9. Stop after the selected task unless the user explicitly requested continuous
   execution. For continuous execution, repeat selection after each completed
   task and commit; stop when none is eligible or safe progress is blocked.

If no task is eligible, report why. Do not promote BACKLOG cards automatically.
The ordered-query feature still requires DEC-008; DEV-001 is process work,
not approval to start the feature.

## Source files

- `AGENTS.md`
- `tcc/90 - Tasks/FORMAT.md`
- `tcc/06 - Development/Operational Map.md`
