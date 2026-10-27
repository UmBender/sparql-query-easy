---
id: FE-061
title: Link the editor to the study and give the task page an obvious way back to the task list
status: READY
priority: P1
type: frontend
depends_on: []
human_gate: false
created: 2026-10-27
updated: 2026-10-27
---
# Link the editor to the study and give the task page an obvious way back to the task list

## Objective

User request (2026-10-27): the editor has no link to `/study` (participants
must type the address, DOC-009 note §6.1), and going back from a task to the
study is not intuitive. Skills: `tcc-frontend`, `tcc-style`. Contract:
[[../../09 - Decisions/Current Contracts]] row "Study".

## Scope and acceptance

- Editor app bar (`editor-toolbar.svelte`): a **Study** link to `/study`,
  visible to everyone (logged out it goes through the existing login
  redirect and back). Keyboard reachable, accessible name, both themes,
  fits at 360 px (the app bar already wraps).
- Task page (`/study/[key]`, `study-task.svelte`): a clearly placed back
  control at the top of the task panel, e.g. "← Proposed queries" (the
  existing "All tasks" link may be restyled/moved into it), plus after a
  `Correct` verdict a visible "Back to the tasks" (and "Next task" when
  there is a next one in group order) next to the feedback.
- Browser Back keeps working (plain links, no history tricks).
- Not owned here: the task list markers (STUDY-014) and the questionnaires
  (STUDY-015). Avoid restyling the list page beyond what the back control
  needs.

## Validation

- Focused: Playwright e2e for the link and the back paths (mock API).
- Closing: the new frontend gate; `test:screens` refreshed only for this
  change (diffs reviewed); `help:screens` if the toolbar change shows in
  the help images. Update the DOC-009 note §6.1 (link now exists) and the
  help page "Accounts and the study" text if it says to type `/study`.

## Conclusion
