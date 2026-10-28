---
id: QUAL-022
title: Prove errors, logs and exports leak nothing and rendered data cannot run script
status: DONE
priority: P1
type: quality
depends_on: []
human_gate: false
created: 2026-10-27
updated: 2026-10-28
---
# Prove errors, logs and exports leak nothing and rendered data cannot run script

## Objective

Security plan threats 9–11 ([[../../08 - Quality/Security Test Plan]]).
Skills: `tcc-test`, `tcc-backend`, `tcc-frontend`.

## Scope and acceptance

- Errors: forced failures (bad JSON, DB down, executor exception, Jena
  parse error) return the contract error body with no stack trace, class
  name, SQL, file path or internal host.
- Logs (`RequestLoggingTest` style): register/login/submit never log the
  password, the session cookie or its digest, or form answers.
- CSV export: cells starting with `=`, `+`, `-`, `@`, tab or CR are
  neutralized (prefix `'`), with a test; record the change in API v1.
- XSS (Playwright, mock API): labels, literals, task titles/statements and
  form texts containing `<img src=x onerror=…>` / `<script>` render as text
  in the canvas labels, result tables, search list, task page, help and
  admin pages; no dialog fires, no element is injected.
- Headers: compose smoke asserts `Set-Cookie` `HttpOnly; Secure;
  SameSite=Lax`, `X-Content-Type-Options`, `Referrer-Policy`, and adds a
  CSP with `frame-ancestors 'none'` (decide `style-src` needs for
  Cytoscape/Tailwind; record) plus `Permissions-Policy`.

## Validation

Kotlin gate, frontend gate, `test:compose` for headers.

## Conclusion

All acceptance points are met; results in [[../../08 - Quality/Security Test Plan#QUAL-022 results (2026-10-28)]].

- Errors: `security/ErrorLeakTest`; malformed-body messages no longer name
  Kotlin classes or serial names; an unhandled failure is a fixed `500
  Internal server error` (logged server-side). Recorded in API v1 and
  Current Contracts.
- Logs: no password, session token or digest, answers or query text at the
  production levels.
- CSV: formula escape tested for `=`, `+`, `-`, `@`, tab and CR.
- XSS: `frontend/tests/xss.e2e.ts`; a `{@html}` mutation fails it.
- Headers/CSP: Caddy headers plus the SvelteKit hash-mode meta CSP;
  `style-src 'unsafe-inline'` stays (Cytoscape, bits-ui, Svelte `style:`),
  scripts only `'self'` plus the boot hash, Zod `jitless`. Browser guards fail
  on any CSP violation; P-17 now expects the CSP `connect-src` report for an
  external fetch (the CSP blocks it before the route).

## Execution log
- 2026-10-28: implemented and validated: Kotlin gate, frontend gate, `test:compose`.

