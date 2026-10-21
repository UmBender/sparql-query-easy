---
id: BUG-008
title: Edges can be added when the app is opened over plain HTTP on a LAN address
status: DONE
priority: P1
type: bug
depends_on: []
human_gate: false
created: 2026-10-21
updated: 2026-10-21
---
# Edges can be added when the app is opened over plain HTTP on a LAN address

## Objective

User report (2026-10-21, Compose stack with `WEB_BIND=0.0.0.0`): opening
`http://<LAN IP>:8080` on the same notebook, in an incognito window, a
connection still ended without an edge, although BUG-007 was deployed and
`http://localhost:8080` worked. Skill: `tcc-frontend`.

## Evidence

`generatedId` (`frontend/src/lib/domain/graph.ts`) used `crypto.randomUUID`,
which browsers expose only in secure contexts. `localhost` is one; plain HTTP
on any other host is not (Chromium and Firefox: `isSecureContext` false,
`crypto.randomUUID` undefined on the LAN address). `addElements` then threw
for every edge added without an id, after the controller had already cleared
the connection preview.

## Scope and acceptance

- Generated edge ids are random version 4 UUIDs built from
  `crypto.getRandomValues`, available in every context.
- Vitest: "connects nodes without crypto.randomUUID, as over plain HTTP on a
  LAN address (BUG-008)" (fails without the fix with
  `crypto.randomUUID is not a function`).

## Conclusion

- `graph.ts`: `randomUuid()` replaces `crypto.randomUUID()` in `generatedId`;
  no other secure-context-only API is used in `frontend/src`.
- Commands: `npm --prefix frontend run check`, `run lint`, `test`
  (Playwright 116 pass).
- Limitation: other secure-context features (clipboard, service workers)
  remain unavailable over plain HTTP on a LAN address; none is used today.
