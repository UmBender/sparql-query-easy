---
id: LEARN-014
title: Learn the go-live checklist for a safe, legal and affordable user test
status: READY
priority: P1
type: learning
depends_on: [LEARN-008, LEARN-013]
human_gate: true
created: 2026-10-07
updated: 2026-10-07
---
# Learn the go-live checklist for a safe, legal and affordable user test

Part of the [[../../07 - Operations/Deployment Learning Path/00 - Deployment Roadmap|Deployment Roadmap]];
progress goes in the [[../../07 - Operations/Deployment Learning Path/Deployment Learning Tracker|Deployment Learning Tracker]].
Prepares: SEC-001, AUTH-000.

## Why this matters for the deployment

Opening the app to real people adds risks that do not exist locally: abuse of the upload and remote-endpoint features, personal data of participants, and a bill that keeps running after the test ends.

## How this task is executed

1. **Claude writes the lesson** `tcc/07 - Operations/Deployment Learning Path/L14 - Go-Live Checklist for User Testing.md`:
   a blog-post-style module that explains every concept below from first
   principles with diagrams, walks through the lab step by step with the
   expected output of each command, lists common errors and how to read
   them, and ends with a short quiz. It cites official documentation, and
   for commands it cannot run in the repository it marks the output as
   expected rather than observed.
2. **You do the lab by hand** in your own terminal/AWS account, run every
   self-check, and record results and questions in the tracker.
3. **Review together:** open questions go back into the lesson. The task
   is DONE when you tick every "Done when" item in the tracker (human gate).

No AWS resource is created, and nothing is pushed or deployed, by Claude
without your explicit request in the session.

## Learning objectives — after this you can

- Review the public attack surface of this app and decide the SEC-001 limits (upload size, remote endpoint policy, timeouts, rate limits).
- Understand server-side request forgery (SSRF) — the app fetches user-supplied SPARQL endpoint URLs — and the mitigations (allow-list, blocking private ranges, IMDSv2 hop limit).
- Prepare participant data handling: what you collect, privacy notice, consent, retention and deletion (LGPD if participants are in Brazil; check with your advisor whether a research ethics review applies).
- Run a small load test and know the server's limits.
- Plan the shutdown: what to stop, snapshot and delete after the test, and what it costs if forgotten.

## Concepts to study

- OWASP Top 10 categories relevant here: broken access control, SSRF, security misconfiguration, identification and authentication failures.
- Wikidata/external endpoint usage etiquette (identify the client with a User-Agent, respect limits).
- Personal data minimization and retention.
- Capacity: JVM memory, concurrent users, timeouts.
- Cost review: EC2, RDS, public IPv4, Route 53, CloudWatch; stopping RDS only pauses it for a limited time (it restarts automatically after 7 days).

## Hands-on lab

1. Walk through every route in Swagger (`/swagger`) as an attacker and list what a malicious user could do; turn the list into SEC-001 decisions.
2. Try a SPARQL endpoint URL pointing at `http://169.254.169.254/` or `http://127.0.0.1:8080/` against your own deployment and record what happens; then verify the mitigation.
3. Write the privacy notice and the test-account procedure.
4. Load test `/health` and one query with a small tool (e.g. `hey` or `ab`) and watch `docker stats`.
5. Write the shutdown checklist and put a calendar reminder for the end of the test.

## Check it yourself (CLI)

Replace `<…>` placeholders with your values.

```sh
hey -n 300 -c 10 https://app.<domain>/health
```
Look for: latency percentiles and no errors (install `hey` or use `ab`)

```sh
docker stats --no-stream
```
Look for: memory headroom during the load test (on the server)

```sh
aws ec2 describe-instances --query "Reservations[].Instances[].MetadataOptions.{tokens:HttpTokens,hops:HttpPutResponseHopLimit}"
```
Look for: `required` and hop limit `1`

```sh
aws resourcegroupstaggingapi get-resources --tag-filters Key=Project,Values=easyquery --query "ResourceTagMappingList[].ResourceARN"
```
Look for: everything that belongs to the project — your shutdown list

```sh
aws rds describe-db-instances --query "DBInstances[].DeletionProtection"
```
Look for: `true` during the test; you will turn it off only to delete

## Exercises — break it, then fix it

- Explain to your advisor, in two minutes, what data participants generate and where it is stored.
- Estimate the monthly cost of the running setup from the pricing pages and compare with the budget alert.

## Done when

- SEC-001 decisions are made and implemented before inviting testers.
- Participants get a clear privacy notice; you know how to delete their data.
- A dated shutdown plan exists.

## Reading list

- OWASP Top 10 and the Server-Side Request Forgery Prevention Cheat Sheet: https://owasp.org/ , https://cheatsheetseries.owasp.org/
- ANPD (Autoridade Nacional de Proteção de Dados) — LGPD guidance: https://www.gov.br/anpd/
- Wikidata — Query service user manual / usage policy (User-Agent and limits)
- AWS Pricing Calculator: https://calculator.aws/

## Execution log

- 2026-10-07: Created from the user's request for a hands-on deployment learning
  path (DOC-003).
