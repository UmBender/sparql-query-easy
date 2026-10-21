---
id: DOC-005
title: Write the checklist of questions for the university IT before go-live
status: BACKLOG
priority: P1
type: documentation
depends_on: [DEC-003]
human_gate: false
created: 2026-10-20
updated: 2026-10-20
---
# Write the checklist of questions for the university IT before go-live

## Objective

T11. OPS-002, OPS-004 and OPS-005 are BLOCKED on server facts; BLOCKERS lists
only four questions. One note the user can send to the university IT, whose
answers unblock those cards and DEC-017 Q1/Q5/Q6. Skill: `tcc-plan-task`
(documentation).

## Scope

- `tcc/07 - Operations/University Server Checklist.md` (proposed name):
  questions grouped as access (Docker and Compose v2.24+ allowed, root or
  `docker` group, SSH/VPN, can GitHub or a registry be reached), network
  (public reachability, open ports 80/443, outbound HTTPS to Wikidata, npm,
  Maven Central, Docker Hub and Let's Encrypt), name and TLS (DNS name, who
  issues certificates, an existing university reverse proxy and its address),
  machine (CPU, RAM, disk, shared or dedicated, OS, time sync), data (backup
  location off the host, retention rules, who may access research data),
  operations (maintenance windows, contact, monitoring/mail available).
- For each question: why the app needs it and which card/decision it
  unblocks (OPS-002, OPS-004, OPS-005, OPS-008 to OPS-011, DEC-017).
- A column for the answer and date; BLOCKERS links to the note instead of
  repeating the list.

## Out of scope

- Contacting the IT, choosing values, or changing any deploy file.

## Acceptance criteria

- [ ] Every T11 checklist topic (Docker allowed, root access, open ports,
  external reachability, HTTPS, backup location) has at least one question.
- [ ] Each question names the card it unblocks; BLOCKERS links to the note.

## Validation

Documentation check: links resolve (Obsidian wikilinks to existing notes),
the Operational Map documentation gate.
