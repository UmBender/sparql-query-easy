---
id: DOC-008
title: Rewrite the README around the application and its features
status: DONE
priority: P2
type: documentation
depends_on: []
human_gate: false
created: 2026-10-21
updated: 2026-10-21
---
# Rewrite the README around the application and its features

## Objective

User request (2026-10-21): the README read as a record of the C# to Kotlin
port. It should present the application itself and the features added since:
the editor, staged exploration, filters and funnel, accounts and the study,
the architecture, testing, operations and how the project is developed.

## Scope and acceptance

- Opens with what the app does and the `/help` worked example, with two
  existing help screenshots (`frontend/static/help-images/`).
- Sections: features, architecture (stack and diagram), quality and
  automation, development workflow (task cards, `AGENTS.md`, skills), run
  locally, verification, status, a short history of the port, documentation
  and source landmarks.
- Every claim matches the repository (help guide, OpenAPI routes, task cards,
  CI jobs, build files); no product behavior changes.

## Conclusion

- `node scripts/check-project-docs.mjs` (links of the changed Markdown) and
  `git diff --check` pass.
