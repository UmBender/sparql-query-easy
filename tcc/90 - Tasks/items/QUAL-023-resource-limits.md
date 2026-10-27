---
id: QUAL-023
title: Prove oversized or slow requests cannot exhaust the server
status: BACKLOG
priority: P2
type: quality
depends_on: []
human_gate: false
created: 2026-10-27
updated: 2026-10-27
---
# Prove oversized or slow requests cannot exhaust the server

## Objective

Security plan threat 12 ([[../../08 - Quality/Security Test Plan]]).
Skills: `tcc-test`, `tcc-backend`.

## Scope and acceptance

- Every route with `limit`/`offset`/`maxResults` caps them (record the caps;
  `400` or clamp per contract); a request body above a fixed size is `413`.
- A query that runs too long on a local graph is cancelled by a timeout
  (fake slow executor) with the contract error, and the server keeps
  serving other requests.
- Login/register flooding hits the existing `429`; study submissions get a
  per-user rate limit if missing (decide value; record).
- Deeply nested or very large `where` arrays are rejected before
  generation.

## Validation

Kotlin gate.

## Conclusion
