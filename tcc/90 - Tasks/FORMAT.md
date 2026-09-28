# Task card format

Keep existing YAML/status vocabulary. Use only as much body detail as the
task's risk needs; a one-line documentation correction needs no large plan.

```yaml
---
id: AREA-001
title: Observable result
status: BACKLOG
priority: P1
type: frontend
depends_on: []
human_gate: false
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
```

Statuses: BACKLOG, READY, IN_PROGRESS, BLOCKED, REVIEW, DONE, CANCELLED.
Priority: P0 before P1 before P2. `human_gate` means a specific human judgment,
not another request to execute already-authorized routine work.

## Body template

- Objective/motivation and expected examples.
- Main skill, confirmed entry paths/symbols and relevant contract link.
- Scope/exclusions; dependencies and genuine pending decisions.
- Acceptance criteria stated as observable results.
- Validation: existing focused command, closing gate from the Operational Map,
  and expected oracle for new cases.
- Conclusion/execution log: changes, actual commands/results, limitations and
  local commit. Write “completion commit for this task” inside that commit;
  report its hash in chat rather than creating a self-reference-only commit.

Do not invent commands, implementations or requirement details before inspection.
Keep evidence-backed facts separate from intended behavior.
Index lifecycle changes in TASKS.md. Historical cards need not be mechanically
rewritten to this template; apply it as they are touched.
