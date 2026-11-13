---
name: batch-tasks
description: Plan, run and triage unattended overnight batches of task cards (one Claude Code session per task, never concurrent). Use for "/batch-tasks plan <IDs>", "/batch-tasks triage" or when the owner asks to implement several cards without supervision.
---
# batch-tasks

A shell runner, `scripts/batch/batch.sh`, runs **one non-interactive Claude
Code session per task**, in queue order, one at a time. Each session follows
the skill `implement-task` plus `scripts/batch/unattended.md`. Two phases: a
**plan** with the owner present (the only time questions are allowed) and an
unsupervised **run**. State lives in `.batch/` (git-ignored). Tasks are the
existing cards under `tcc/90 - Tasks/items/`; do not create another backlog.

Files: `.batch/{plan.md,queue,settings.json,requires}` (made by the plan),
`.batch/state/<ID>` (`pending|running|review|blocked|failed|skipped`),
`.batch/out/<ID>.status` (`review` or `blocked` + one or two lines),
`.batch/logs/`. `queue` lines: `<ID> <base> <gate>`, base `main` or
`after:<ID>`, gate `kotlin|frontend|fullstack|stack|docs|none` joined with `+`
(for example `kotlin+stack`; the runner reruns it on the task branch).

## Plan: `/batch-tasks plan T1 T2 …`

Do it in this order, interactively, and do not start the run yourself (the
runner must outlive this session, and only one session may run):

1. **Preflight.** `git status` clean on `main`; `.batch/` ignored; if `.batch/`
   exists, move it to `.batch.old-<date>/` (also ignored by pattern or
   deleted by the owner) after asking.
2. **Read** each card: `depends_on`, scope ("Files in scope"), acceptance
   criteria, linked contracts and code. A card whose `depends_on` is neither
   `DONE` nor in the batch: ask the owner to include or drop it. A `human_gate`
   or `BLOCKED` card: ask whether the owner's answers resolve the gate.
3. **Order** topologically by `depends_on`; independent tasks first (a block
   costs less). Base is `main`, or `after:<ID>` when it depends on a batch task.
4. **Ask everything now, in one batch**, recommended option first: every
   decision the spec step would ask (architecture, scope, risky deviations,
   open decisions named in the card), and the policies: merge (default no),
   push (default no), open choices (`decide-and-record` or `block`), stop time
   (`BATCH_STOP_AT`), model/effort (default `sonnet`/`medium`).
5. **Commands.** For each task list the commands beyond the allowlist in
   `scripts/batch/settings.template.json`; verify each with `command -v`.
   Missing tools go to `.batch/requires` and to the plan as an owner
   prerequisite (`sudo` is denied, so give the `dnf install …` line).
6. **Risks.** Mark per task what probably blocks (visual check, real server or
   token, Docker needed, big decision) and decide with the owner: prepare now,
   accept, or drop the task.
7. **Write** from `scripts/batch/plan.template.md`: `plan.md` (policies,
   prerequisites, order, one section per task with decisions, defaults,
   extra commands, block conditions, manual checks), `queue`,
   `settings.json` (template plus **narrow** extra allow rules, never
   `Bash(*)`; allow `git merge/push` only if the policy permits) and
   `requires`.
8. **Show** the owner the plan, the allow additions and the deny list; run
   `scripts/batch/batch.sh check` (offline: tools, clean tree, Docker, Playwright
   Firefox, node_modules, cards) and `scripts/batch/batch.sh probe` (one cheap
   session that tries the gate commands and counts permission refusals); fix
   every `FAIL` and every refusal before handing over.
9. **Hand over** the start command, e.g.
   `tmux new -s batch 'scripts/batch/batch.sh run'`. Remind them: the working
   tree must be clean and Docker running.

## Run

Owner only: `scripts/batch/batch.sh run`. The runner takes a lock, holds a
`systemd-inhibit` on sleep, checks the network before each attempt, waits out
usage limits and resumes the same session, retries a dead attempt once more,
reruns the closing gate itself, records the reason and continues when a task
blocks (its dependents become `skipped`). Rerun the same command after a
crash or reboot: a `running` task resumes. It never merges or pushes.

## Triage: `/batch-tasks triage`

1. `scripts/batch/batch.sh status` and `report` (writes `.batch/report.md`).
2. For each `blocked`/`failed`: read `.batch/out/<ID>.status` and the card's
   `BLOCKED (batch)` line; explain it and propose the fix (allow a command,
   answer a decision, install a tool). Apply the owner's choice, then
   `batch.sh unblock <ID>` (resumes the session) or `batch.sh reset <ID>`
   (new session on the same branch), and rerun.
3. For each `review`: list the manual checks from the status file and the
   `UNATTENDED CHOICE:` lines; confirm or change each; then integrate
   normally (`git merge --no-ff batch/<ID>` in queue order, shared index
   files and TASKS.md by hand). Pushing needs the owner's explicit say-so.

## Notes
- The runner reads only `.batch/out/<ID>.status`; the session must not touch
  runner files (denied in settings).
- Tokens: a fresh session per task, fixed model and effort, decisions made in
  the plan so tasks do not explore alternatives.
