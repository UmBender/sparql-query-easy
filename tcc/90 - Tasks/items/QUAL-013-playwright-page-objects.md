---
id: QUAL-013
title: Drive the editor, task page and questionnaires through Playwright page objects
status: BACKLOG
priority: P2
type: quality
depends_on: [QUAL-007]
human_gate: false
created: 2026-10-20
updated: 2026-10-20
---
# Drive the editor, task page and questionnaires through Playwright page objects

## Objective

T10 e2e gap. Specs repeat selectors and `window.__easyquery` casts. Page
objects make the offline and real-stack suites share one way to drive each
screen. Skill: `tcc-test`. How the real stack is started is DEC-016 Q1, not
this card.

## Confirmed entry points

- `frontend/tests/support/editor.ts`: `handle = window.__easyquery`,
  `openEditor`, `addGraph` (store and `view.cy` through the hook).
- `frontend/tests-stack/support.ts`: `joinStudy`, `seedStudy`.
- Specs: `tests/*.e2e.ts`, `tests-stack/*.e2e.ts` (`study-participant`,
  `study-questionnaires` visit `/study`, `/study/<key>`).

## Scope

- `tests/support/pages/`: `EditorPage` (open, add graph, run query, choose
  a stage value, read badges and funnel), `TaskPage` (`/study/<key>`: open,
  submit, read attempts), `QuestionnairePage` (fill a page, next, submit).
- Cytoscape helpers on the test hook: rendered position of a node or edge
  midpoint in page coordinates, and click/drag/hover on a node by id.
- Use them in both Playwright configs; migrate existing specs where the
  change is mechanical, without changing what they assert.

## Out of scope

- New product behaviour or a new test hook field beyond positions.
- Compose-based e2e (DEC-016 Q1).

## Acceptance criteria

- [ ] At least one offline and one real-stack spec per page object use it.
- [ ] A spec clicks a node found by id through the position helper and the
  store shows it selected, at any zoom/pan.
- [ ] Migrated specs keep their assertions; `npm test` and `test:stack` pass.

## Validation

Focused: `(cd frontend && npx playwright test editor)`. Closing: the new
frontend gate plus `test:stack`.
