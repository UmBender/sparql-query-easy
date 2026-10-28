---
id: FE-061
title: Link the editor to the study and give the task page an obvious way back to the task list
status: DONE
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

Done 2026-10-27.

- App bar (`editor-toolbar.svelte`): ghost **Study** link (`#study-link`,
  clipboard-list icon) to `/study`, right after Help, styled like Help so it
  works in both themes and wraps with the bar. Logged out, the root guard
  sends it to `/login?next=%2Fstudy` and back. It also shows on the task and
  admin pages, which share the app bar.
- Task panel (`study-task.svelte`): the title-row "All tasks" link became a
  **← Proposed queries** link (`#study-back-link`, the `/study` page's
  heading) above the title. After a `Correct` verdict in this visit a
  `nav` "After a correct answer" shows **Back to the tasks** (outline) and,
  when a task follows in the group's order, **Next task →** (primary). The
  order comes from `GET /api/study/tasks` (same query key as `/study`); the
  last task shows only Back to the tasks. All are plain links.
- Not changed: the `/study` list page, and the error-state "All tasks"
  button on `/study/[key]`.
- Docs: help "Accounts and the study", DOC-009 note §6.1 and its gotcha
  list, DOC-009 card observation, Frontend Architecture routes row.
  The contract row "Study" lists APIs and study rules only, so the
  navigation is recorded in the Frontend Architecture routes row instead.
- Tests: two Playwright cases in `tests/study.e2e.ts` (app bar link by
  keyboard and logged out through login; back link with browser Back,
  nothing after Incorrect, Next task, last task without Next, Back to the
  tasks). The real-stack `study-participant.e2e.ts` now clicks
  "Proposed queries" (not run: the stack suite is outside this gate).
- Validation: `npm --prefix frontend run check` 0 errors; `run lint`
  passed; `npm --prefix frontend test` passed (vitest 262 + 25, Playwright
  122); `npm run help:screens` refreshed the 6 help images (Study in the
  app bar); `npm run test:screens -- --update-snapshots` refreshed editor,
  help, study-task and admin-task-new (both themes), each reviewed, then
  22 passed; `node scripts/check-project-docs.mjs` passed.
