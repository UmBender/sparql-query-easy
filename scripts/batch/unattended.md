# Unattended session rules (appended to the system prompt by scripts/batch/batch.sh)

You are running with nobody at the keyboard, one task, in a non-interactive
session. Nothing can answer a question and every command that is not
pre-approved is refused without a prompt. The repository AGENTS.md still
applies; these rules add to it.

## Fixed flow
- The task, its branch (`batch/<ID>`, already checked out) and the owner's
  answers are in `.batch/plan.md`, section `<ID>`. Read that section and the
  task card (`tcc/90 - Tasks/items/<ID>-*.md`) once. Follow the skill
  `implement-task`. Do not switch branches, merge, push or tag.
- One focused commit for the task, prefixed with the task ID, with the card
  and canonical note updated inside it. Make a progress note in the card's
  conclusion when a milestone is done (uncommitted notes are the state the
  next session resumes from).
- If the session is a continuation, the git log and `git status` say where
  you stopped: continue, never redo. Changes you cannot explain go to
  `git stash` with a message, then note it in the card.

## Never ask
- `AskUserQuestion` is disabled. Use the plan's answers. For an *open choice*
  the plan did not answer, apply the plan's policy: `decide-and-record`
  (pick the recommended option, write `UNATTENDED CHOICE: <what, why>` in the
  card's conclusion) or `block`.

## Save tokens
- Filter command output: `| tail -n 40`, or `| grep -E 'error|FAILED|warning'`;
  rerun without the filter only when a failure is unreadable.
- Read files by range (`offset`/`limit`) or search with `rg`; never read a big
  file whole for one function. Do not reread what you just wrote or edited.
  Read each process note once.
- Stay inside the task's scope and the code it touches. No subagents.
- One simple command per call: compound commands (`&&`, `;`, heredocs, pipes
  to other tools) can be refused whole.
- Do not install anything (no `npm install`, `npm ci`, `pip`, `dnf`): gates
  assume dependencies are present.

## Gates and honesty
- Run the smallest focused check while editing and the closing gate from
  `tcc/06 - Development/Operational Map.md` for the changed area before you
  report `review`. The runner reruns the gate itself; a false "green" only
  turns the task into `blocked`.
- Never edit goldens, snapshots or expectations just to pass; never use
  `--no-verify`.

## When to block instead of guessing
A decision the plan does not cover (and policy is `block`); a command, tool
or file that is refused; a file needed outside the task's scope; gates still
red after reasonable effort; a broken dependency; a check only a human can do
(visual review, an account, hardware, the real server).

To block: commit what the flow allows, add to the card's conclusion
`BLOCKED (batch): <what is missing, what you tried, recommended fix>`, leave
the working tree clean, and write the status file with the exact command,
permission or decision that unlocks it.

## Status file (required, last action)
`.batch/out/<ID>.status`, one write, format:

```
review
<one or two lines: what was done, manual checks the owner must do>
```
or
```
blocked
<the exact command / permission / decision to unlock, one or two lines>
```
Use `review` only when the acceptance criteria are verified, the gate is green
and the work is committed. Never write the status file earlier.
