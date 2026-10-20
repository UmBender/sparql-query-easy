---
id: STUDY-011
title: Let admins export questionnaire responses as CSV and cover the whole T9 flow end to end
status: READY
priority: P1
type: fullstack
depends_on: [STUDY-010, AUTH-005]
human_gate: false
created: 2026-10-20
updated: 2026-10-20
---
# Let admins export questionnaire responses as CSV and cover the whole T9 flow end to end

## Objective

T9 slice 4 of 4 (STUDY-002 scope). An admin downloads each form's responses
as CSV for analysis; participants never can. An e2e test on the real stack
walks consent, both forms, an invalid answer and checks the stored responses
through the export. Skill: `tcc-fullstack`.

DEC-015 (2026-10-20) Q5 A: one CSV per form, internal user id, no username.

## Scope

- `GET /api/admin/forms/{slug}/responses.csv` behind `withAdmin`
  (`text/csv; charset=utf-8`, `Content-Disposition: attachment`): one row per
  response with response id, participant number (internal user id, no
  username), group name, form version, consent version, submitted_at (UTC
  ISO-8601), then one column per question id in definition order (multiple
  choice joined by `;`, unanswered empty). Columns are the union over the
  form's versions. RFC 4180 quoting; cells starting with `=`, `+`, `-`, `@`
  are escaped against spreadsheet formula injection.
- Admin page: a download button per form under `/admin` (existing guard).
- e2e (`tests-stack/`, PokemonGen1, offline): register, accept consent, fill
  the profile form, try an invalid number and see the error, submit, finish
  the tasks, fill the usability form; then as admin download both CSVs and
  find exactly that participant's answers.
- OpenAPI snapshot and generated types; API v1 section.

Excluded: other formats, filters or a response viewer; deletion on request
(LEARN-014).

## Acceptance criteria

- [ ] Admin gets the CSV; a participant gets 403; anonymous 401; unknown slug 404.
- [ ] CSV unit tests: quoting of commas, quotes and newlines; formula
      escaping; multiple choice joining; empty optional answers; two versions.
- [ ] No username, password hash or session data appears in the file.
- [ ] The e2e above passes in `test:stack`, including the rejected invalid
      answer and both responses found in the export.
- [ ] axe check on the admin page with the download buttons.

## Validation

Focused: the new export route and CSV tests, then the HTTP/fullstack closing
gate of the Operational Map, including `test:stack`.
