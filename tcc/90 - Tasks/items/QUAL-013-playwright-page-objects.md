---
id: QUAL-013
title: Drive the editor, task page and questionnaires through Playwright page objects
status: DONE
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

- [x] At least one offline and one real-stack spec per page object use it.
- [x] A spec clicks a node found by id through the position helper and the
  store shows it selected, at any zoom/pan.
- [x] Migrated specs keep their assertions; `npm test` and `test:stack` pass.

## Validation

Focused: `(cd frontend && npx playwright test editor)`. Closing: the new
frontend gate plus `test:stack`.

## Execution log

- 2026-10-20: `tests/support/pages/`: `EditorPage` (open as a returning
  visitor, Auto Layout, viewport, `addGraph`, `graph`, `selection`, node
  canvas/page positions, click node/edge/background, hover, drag, Run Query,
  stage heading, candidates, Assume buttons, order chips, node count, Upload
  Query), `TaskPage` (`/study/<key>`: title, statement, answer variable,
  submit, feedback, attempts), `QuestionnairePage` (choose, check, field,
  fill, rate, next, back, send, page label, slug). `tests/support/editor.ts`
  gained `nodeCanvasPosition` (fails on an unknown id), `nodePagePosition`,
  `hoverNode`, `dragNode`; `clickNode` uses the first.
- Offline: `tests/editor-page.e2e.ts` (click by id selects at zoom 1, 1.8
  and 0.6 with pans; drag moves by the rendered distance; unknown id
  throws) and `tests/study.e2e.ts` (TaskPage on a typed task with the drawn
  Fire query: three nodes, answer variable, submit, feedback, one attempt, the
  sent query; QuestionnairePage on the shipped `profile.v1.json`: field error
  without a request, then the sent answers).
- Stack: `study-participant.e2e.ts` (TaskPage for the answers test,
  QuestionnairePage in the consent and usability tests),
  `study-questionnaires.e2e.ts` (QuestionnairePage; both local `rate`
  copies removed), `ordered-exploration.e2e.ts` (EditorPage open, Auto
  Layout, Run Query, stage heading, candidates, order chips). Assertions
  unchanged; its raw-element `addGraph` stays (other node shapes).
- Observed, not changed: an optional single choice left unanswered is sent
  as `""`; the server stores it as no answer (STUDY-009 rules), so the
  offline oracle expects `role: ''`.
- Validation: check, lint; `npm test` (Vitest, 110 Playwright passed);
  `npm run test:stack` 20 passed.
- Commit: completion commit for this task.
