# Development Workflow

**Approved through DEV-001 execution request, 2026-09-28.** Use one agent and
one sequential task by default. Authorization includes a selective local
task-ID commit after acceptance/gates, even if unrelated files remain dirty.
Publishing, merging and deployment still require explicit session authority.

## Resolved instruction conflicts

| Before | Current rule |
|---|---|
| Migration-only root policy | Extend Kotlin/frontend; preserve migration invariants where affected |
| Full gates after each edit | Focused check while editing; required area gate on final state |
| Mandatory MIGRATION reading/updating | Read relevant history only; update current canonical contract |
| Repeated task/RUN_LOG/history summaries | Task conclusion + affected canonical note + index lifecycle |
| Worker stops even on explicit continuous request | One task/commit at a time; repeat only when requested |
| Conditional commits skipped for unrelated dirt | Select explicit paths/hunks; overlapping edits are a real blocker |
| DEV-002 waits for a future workflow | DEV-001 supplies the requested workflow; DEC-008 still gates product choices |

No nested AGENTS were found. `DOCUMENT.md`, `FORMAT.md` and WORKER_PROMPT
now defer to root policy. Existing historical cards retain their logs.
Use the current branch for sequential work, or one isolated task branch if
needed. Do not create/merge branches per edit or rewrite previous commits.

## Skill location and routing evidence

Seven instruction-only skills live in `.agents/skills/`, never in a global
catalog. This location is supported by the installed Codex CLI 0.157.1 and
[official Codex skill documentation](https://learn.chatgpt.com/docs/build-skills).
Creation and discovery are validated separately with the scripts listed in
the Operational Map. The local app-server `skills/list` checks discovery
without launching a thread or model session. An initial prompt-input checker
expected absolute paths, but Codex reports aliased paths there; it was replaced
with the direct discovery API rather than treating that mismatch as absence.

Routing examples: a relationship 502 bug → tcc-backend; edge predicate binding
→ tcc-frontend; candidate API plus UI → tcc-fullstack; decomposing an order-menu
request → tcc-plan-task. Load one main skill, then only necessary auxiliaries.

## Documentation ownership

Operational Map owns commands/gates; Current Contracts owns compact current
decisions and links; detailed API/frontend notes own their respective behavior;
task cards own completion evidence; migration files own historical evidence.
Future process tuning uses three real tasks in [[../06 - Development/Development Calibration]].

## Source files

`AGENTS.md`; `tcc/90 - Tasks/items/TASK-DEV-001.md`;
`tcc/90 - Tasks/WORKER_PROMPT.md`; `tcc/90 - Tasks/DOCUMENT.md`;
`.agents/skills/`; `build.gradle.kts`; `package.json`.
