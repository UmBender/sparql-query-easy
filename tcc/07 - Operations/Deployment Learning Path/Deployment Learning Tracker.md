# Deployment Learning Tracker

Your logbook for learning and deploying SPARQL EasyQuery. The plan is in
[[00 - Deployment Roadmap]]; each module has a task card (`LEARN-*`) with the
full objectives, lab, CLI self-checks and reading list.

## How to use this page

- Work top to bottom; a module can start when the modules it depends on are done.
- Tick `- [x]` boxes as you go (Obsidian renders them as checkboxes).
- Paste short command outputs that *prove* a step into **Evidence**
  (redact account IDs, IPs you consider private, and never paste secrets).
- Write anything unclear in **Questions** — they become the next session's agenda.
- Status legend: `todo`, `reading`, `lab`, `done`. Confidence: 1 (lost) to 5 (could teach it).
- When every **Done when** box of a module is ticked, tell Claude to close its card.

## Overview

| Module | Card | Status | Started | Finished | Hours | Confidence |
|---|---|---|---|---|---|---|
| L01 - Linux Shell and Networking | [[../../90 - Tasks/items/LEARN-001-linux-shell-networking]] | todo | | | | |
| L02 - Containers with Docker | [[../../90 - Tasks/items/LEARN-002-containers-docker]] | todo | | | | |
| L03 - AWS Account, IAM and Cost Guardrails | [[../../90 - Tasks/items/LEARN-003-aws-account-iam-cost]] | todo | | | | |
| L04 - AWS Networking (VPC and Security Groups) | [[../../90 - Tasks/items/LEARN-004-aws-networking-vpc]] | todo | | | | |
| L05 - EC2 Server by Hand | [[../../90 - Tasks/items/LEARN-005-ec2-server-by-hand]] | todo | | | | |
| L06 - Image Registry with ECR | [[../../90 - Tasks/items/LEARN-006-ecr-image-registry]] | todo | | | | |
| L07 - PostgreSQL and Amazon RDS | [[../../90 - Tasks/items/LEARN-007-postgresql-and-rds]] | todo | | | | |
| L08 - Passwords, Sessions and Login Security | [[../../90 - Tasks/items/LEARN-008-passwords-sessions-auth]] | todo | | | | |
| L09 - Configuration and Secrets | [[../../90 - Tasks/items/LEARN-009-configuration-secrets]] | todo | | | | |
| L10 - Domain and DNS with Route 53 | [[../../90 - Tasks/items/LEARN-010-domain-dns-route53]] | todo | | | | |
| L11 - HTTPS and Reverse Proxy | [[../../90 - Tasks/items/LEARN-011-https-reverse-proxy]] | todo | | | | |
| L12 - CI/CD with GitHub Actions and AWS OIDC | [[../../90 - Tasks/items/LEARN-012-github-actions-cicd]] | todo | | | | |
| L13 - Observability, Backups and Runbooks | [[../../90 - Tasks/items/LEARN-013-observability-backups-runbooks]] | todo | | | | |
| L14 - Go-Live Checklist for User Testing | [[../../90 - Tasks/items/LEARN-014-go-live-user-testing]] | todo | | | | |

## Deployment milestones (the real thing)

Tick these when they exist in your account, not just in a lab.

- [ ] M1 — AWS account secured (root MFA, no root keys, admin via SSO) and budget alert active
- [ ] M2 — Project VPC with public/private subnets and the three security groups
- [ ] M3 — ECR repository with an image pushed for a known commit
- [ ] M4 — EC2 instance running the app from ECR, reachable through Session Manager, survives reboot
- [ ] M5 — RDS PostgreSQL private, TLS-only, backups on, restore drill done
- [ ] M6 — Secrets in Parameter Store, app reads them at start, nothing secret in Git/image/logs
- [ ] M7 — Domain delegated to Route 53, `app.<domain>` resolves to the Elastic IP
- [ ] M8 — HTTPS with a trusted certificate, HTTP redirects, app port private
- [ ] M9 — CI on pull requests; deploy on `main` through OIDC with approval; rollback practised
- [ ] M10 — Logs in CloudWatch, alarms emailing you, runbooks written
- [ ] M11 — Login implemented (AUTH-001) against PostgreSQL and verified over HTTPS
- [ ] M12 — Go-live checklist done (SEC-001 limits, privacy notice, load test, shutdown plan)
- [ ] M13 — First real tester used the app
- [ ] M14 — Test finished: data handled as promised, resources stopped/deleted, final bill checked

## Decision log

Record each decision when you make it; the card in brackets is where it is
formally recorded.

| Date | Decision | Choice | Why | Card |
|---|---|---|---|---|
| | AWS region | | | OPS-003 |
| | Monthly budget limit | | | OPS-003 |
| | Instance type / architecture | | | OPS-003 |
| | Domain name and registrar | | | OPS-002 |
| | Login contract (users, anonymous access, protected routes) | | | AUTH-000 |
| | Password hash algorithm and parameters | | | AUTH-000 |
| | Release approval and rollback method | | | OPS-005 |
| | Log retention, alarms, backup retention (RPO/RTO) | | | OPS-004 |
| | Upload and remote-endpoint limits | | | SEC-001 |
| | Test period and shutdown date | | | — |

## Cost log

| Month | Forecast (USD) | Actual (USD) | Biggest item | Notes |
|---|---|---|---|---|
| | | | | |

## L01 - Linux Shell and Networking

Card: [[../../90 - Tasks/items/LEARN-001-linux-shell-networking|LEARN-001]] — Learn the Linux shell and networking needed to debug a web app. Needs: nothing.

Status: todo · Started: · Finished: · Hours: · Confidence:

**Lesson**

- [ ] Lesson written (Claude)
- [ ] Lesson read
- [ ] Reading list skimmed

**Lab**

- [ ] Build and start the app locally (`./gradlew installDist` then `./build/install/sparql-query-easy-kotlin/bin/sparql-query-easy-kotlin`).
- [ ] In a second terminal find the Java process and its listening port; stop it gracefully with `kill <pid>` and watch the log.
- [ ] Send an HTTP request by hand over a raw TCP connection with `nc` and compare with `curl -v`.
- [ ] Resolve a few public names with `dig`, follow one with `dig +trace`, and draw the chain you saw.
- [ ] Inspect the certificate of a public HTTPS site with `openssl s_client` and identify subject, issuer, validity and SANs.
- [ ] Every command in "Check it yourself" run and understood
- [ ] Exercises done (break it, then fix it)

**Done when**

- [ ] You can explain the request path DNS → TCP → TLS → HTTP without notes.
- [ ] You can find a listening process, read its logs and stop it gracefully.
- [ ] You can diagnose refused vs timeout vs DNS failure with the commands above.

**Evidence**

```text

```

**Notes**

- 

**Questions**

- 

## L02 - Containers with Docker

Card: [[../../90 - Tasks/items/LEARN-002-containers-docker|LEARN-002]] — Learn containers by running and inspecting the app image. Needs: LEARN-001.

Status: todo · Started: · Finished: · Hours: · Confidence:

**Lesson**

- [ ] Lesson written (Claude)
- [ ] Lesson read
- [ ] Reading list skimmed

**Lab**

- [ ] `docker build -t sparql-query-easy:local .` and time it; rebuild after changing only a frontend file and explain which layers were reused.
- [ ] Run it detached on 127.0.0.1:8080, watch the health status go from `starting` to `healthy`.
- [ ] Exec into the container, confirm the user and the files under `/opt/sparql-query-easy`.
- [ ] Run with `--memory 256m` and a too-large `-Xmx`; observe what happens and fix it.
- [ ] Write a local `compose.yaml` (lab only, in your scratch folder) with `app`, `postgres` and `caddy` services on one network; only Caddy publishes ports.
- [ ] Every command in "Check it yourself" run and understood
- [ ] Exercises done (break it, then fix it)

**Done when**

- [ ] You can build, run, inspect and debug the app container without notes.
- [ ] Your local Compose lab starts app + PostgreSQL + Caddy and `curl` reaches the app through Caddy.
- [ ] You can explain why secrets never go into the image.

**Evidence**

```text

```

**Notes**

- 

**Questions**

- 

## L03 - AWS Account, IAM and Cost Guardrails

Card: [[../../90 - Tasks/items/LEARN-003-aws-account-iam-cost|LEARN-003]] — Learn to set up an AWS account safely with IAM, MFA, CLI and cost alarms. Needs: LEARN-001.

Status: todo · Started: · Finished: · Hours: · Confidence:

**Lesson**

- [ ] Lesson written (Claude)
- [ ] Lesson read
- [ ] Reading list skimmed

**Lab**

- [ ] Create the account; enable MFA on root; confirm there are no root access keys.
- [ ] Enable IAM Identity Center, create your admin user and permission set, enable MFA; log in through the access portal.
- [ ] Install AWS CLI v2 and configure an SSO profile (`aws configure sso`).
- [ ] Create a monthly cost budget (e.g. a small USD amount) with alerts at 50%, 80% and 100% to your email.
- [ ] Write (on paper first) a policy that only allows reading one S3 bucket, then test it with the IAM policy simulator.
- [ ] Every command in "Check it yourself" run and understood
- [ ] Exercises done (break it, then fix it)

**Done when**

- [ ] Root has MFA and no keys; daily work uses an MFA-protected non-root identity.
- [ ] The CLI works with a named profile and short-lived credentials.
- [ ] A budget alert exists before any paid resource is created.

**Evidence**

```text

```

**Notes**

- 

**Questions**

- 

## L04 - AWS Networking (VPC and Security Groups)

Card: [[../../90 - Tasks/items/LEARN-004-aws-networking-vpc|LEARN-004]] — Learn AWS networking: VPC, subnets, routes and security groups. Needs: LEARN-003.

Status: todo · Started: · Finished: · Hours: · Confidence:

**Lesson**

- [ ] Lesson written (Claude)
- [ ] Lesson read
- [ ] Reading list skimmed

**Lab**

- [ ] Inspect the default VPC first; then create a dedicated VPC for the project with 2 public and 2 private subnets (VPC wizard "VPC and more", no NAT gateway).
- [ ] Create three security groups: `easyquery-web` (80/443 from anywhere), `easyquery-app` (no inbound from internet), `easyquery-db` (5432 only from `easyquery-web` SG).
- [ ] Tag everything with `Project=easyquery`.
- [ ] Every command in "Check it yourself" run and understood
- [ ] Exercises done (break it, then fix it)

**Done when**

- [ ] You can draw the network from memory and explain each route and rule.
- [ ] No security group allows SSH (22) or PostgreSQL (5432) from the internet.

**Evidence**

```text

```

**Notes**

- 

**Questions**

- 

## L05 - EC2 Server by Hand

Card: [[../../90 - Tasks/items/LEARN-005-ec2-server-by-hand|LEARN-005]] — Learn to run the app on an EC2 server by hand. Needs: LEARN-002, LEARN-004.

Status: todo · Started: · Finished: · Hours: · Confidence:

**Lesson**

- [ ] Lesson written (Claude)
- [ ] Lesson read
- [ ] Reading list skimmed

**Lab**

- [ ] Create role `easyquery-ec2` with `AmazonSSMManagedInstanceCore`, ECR read-only and CloudWatch Logs write.
- [ ] Launch a small instance in a public subnet with `easyquery-web` SG, the role, IMDSv2 required, and user data that installs and enables Docker.
- [ ] Connect with `aws ssm start-session`; run the image (from ECR after LEARN-006, or a locally built tag for the first try) with `--restart unless-stopped`, publishing 8080 only on 127.0.0.1 for now.
- [ ] Allocate and associate an Elastic IP; reboot and confirm the app comes back.
- [ ] Every command in "Check it yourself" run and understood
- [ ] Exercises done (break it, then fix it)

**Done when**

- [ ] The app runs on EC2, restarts on reboot, and you never opened port 22.
- [ ] You can explain every permission in the instance role.

**Evidence**

```text

```

**Notes**

- 

**Questions**

- 

## L06 - Image Registry with ECR

Card: [[../../90 - Tasks/items/LEARN-006-ecr-image-registry|LEARN-006]] — Learn to publish and pull the app image with Amazon ECR. Needs: LEARN-002, LEARN-003.

Status: todo · Started: · Finished: · Hours: · Confidence:

**Lesson**

- [ ] Lesson written (Claude)
- [ ] Lesson read
- [ ] Reading list skimmed

**Lab**

- [ ] Create repository `sparql-query-easy` (immutable tags, scan on push).
- [ ] Tag the local image as `<account>.dkr.ecr.<region>.amazonaws.com/sparql-query-easy:<git-short-sha>` and push it.
- [ ] On EC2, log in with the instance role, pull by tag and by digest, and run it.
- [ ] Add a lifecycle policy that keeps the last 10 images.
- [ ] Every command in "Check it yourself" run and understood
- [ ] Exercises done (break it, then fix it)

**Done when**

- [ ] You can push and pull images, and you deploy a specific commit by tag or digest.
- [ ] A lifecycle policy keeps the repository small.

**Evidence**

```text

```

**Notes**

- 

**Questions**

- 

## L07 - PostgreSQL and Amazon RDS

Card: [[../../90 - Tasks/items/LEARN-007-postgresql-and-rds|LEARN-007]] — Learn PostgreSQL by hand, then run it on Amazon RDS. Needs: LEARN-002, LEARN-004.

Status: todo · Started: · Finished: · Hours: · Confidence:

**Lesson**

- [ ] Lesson written (Claude)
- [ ] Lesson read
- [ ] Reading list skimmed

**Lab**

- [ ] Local: `docker run --name pg -e POSTGRES_PASSWORD=<local-only> -p 127.0.0.1:5432:5432 -d postgres:17` (or the current major); create role `easyquery_app` and database `easyquery` owned by an owner role; create a `users` table draft.
- [ ] Dump and restore the local database into a second database.
- [ ] AWS: create a DB subnet group (2 private subnets), an RDS PostgreSQL instance (smallest class, not publicly accessible, `easyquery-db` SG, automated backups on, deletion protection on).
- [ ] From the EC2 instance, connect with `psql` over TLS using the RDS CA bundle and create the application role.
- [ ] Take a manual snapshot and do a point-in-time restore into a temporary instance; delete it afterwards.
- [ ] Every command in "Check it yourself" run and understood
- [ ] Exercises done (break it, then fix it)

**Done when**

- [ ] You can create, secure, connect to, back up and restore PostgreSQL locally and on RDS.
- [ ] The RDS instance is private, encrypted in transit, backed up, and has deletion protection.

**Evidence**

```text

```

**Notes**

- 

**Questions**

- 

## L08 - Passwords, Sessions and Login Security

Card: [[../../90 - Tasks/items/LEARN-008-passwords-sessions-auth|LEARN-008]] — Learn secure password storage, sessions and login protection. Needs: LEARN-001.

Status: todo · Started: · Finished: · Hours: · Confidence:

**Lesson**

- [ ] Lesson written (Claude)
- [ ] Lesson read
- [ ] Reading list skimmed

**Lab**

- [ ] Hash the same password twice with Argon2id (e.g. the `argon2` CLI or a small script) and explain why the outputs differ yet both verify.
- [ ] Measure how long one hash takes with your parameters; estimate an attacker's guesses per second.
- [ ] Draft a `users` and a `sessions` table (columns, types, constraints, indexes) in your local PostgreSQL.
- [ ] Once AUTH-001 exists locally: log in with `curl -c cookies.txt`, inspect `Set-Cookie`, call a protected route with and without the cookie, log out and retry.
- [ ] Write your answers to every AUTH-000 question in the tracker.
- [ ] Every command in "Check it yourself" run and understood
- [ ] Exercises done (break it, then fix it)

**Done when**

- [ ] You can defend each choice in the AUTH-000 contract with a reason.
- [ ] You can verify cookie flags and session invalidation from the command line.

**Evidence**

```text

```

**Notes**

- 

**Questions**

- 

## L09 - Configuration and Secrets

Card: [[../../90 - Tasks/items/LEARN-009-configuration-secrets|LEARN-009]] — Learn configuration and secret management for the app on AWS. Needs: LEARN-005, LEARN-007.

Status: todo · Started: · Finished: · Hours: · Confidence:

**Lesson**

- [ ] Lesson written (Claude)
- [ ] Lesson read
- [ ] Reading list skimmed

**Lab**

- [ ] Add (in a lab branch) an optional env override for one setting and run the app with and without it.
- [ ] Create `/easyquery/prod/db/url`, `/easyquery/prod/db/user` (String) and `/easyquery/prod/db/password`, `/easyquery/prod/session/key` (SecureString).
- [ ] Attach a policy to the EC2 role allowing `ssm:GetParametersByPath` on `/easyquery/prod/*` only.
- [ ] On EC2, write a small script that reads the parameters into a root-only env file (`chmod 600`) and starts the container with `--env-file`.
- [ ] Rotate the DB password and restart; confirm the old one no longer works.
- [ ] Every command in "Check it yourself" run and understood
- [ ] Exercises done (break it, then fix it)

**Done when**

- [ ] No secret exists in Git, the image or CI logs; the app gets secrets at start time only.
- [ ] You can rotate a secret and prove the old one stopped working.

**Evidence**

```text

```

**Notes**

- 

**Questions**

- 

## L10 - Domain and DNS with Route 53

Card: [[../../90 - Tasks/items/LEARN-010-domain-dns-route53|LEARN-010]] — Learn domains and DNS by putting the app behind your own name with Route 53. Needs: LEARN-003.

Status: todo · Started: · Finished: · Hours: · Confidence:

**Lesson**

- [ ] Lesson written (Claude)
- [ ] Lesson read
- [ ] Reading list skimmed

**Lab**

- [ ] Choose and buy a domain (decision recorded in OPS-002).
- [ ] Create the hosted zone; copy its four NS servers to the registrar; wait and verify delegation.
- [ ] Create `app.<domain>` A record → the Elastic IP (TTL 300) and a CAA record allowing `letsencrypt.org`.
- [ ] Change the TTL and watch cached answers expire on different public resolvers.
- [ ] Every command in "Check it yourself" run and understood
- [ ] Exercises done (break it, then fix it)

**Done when**

- [ ] `app.<domain>` resolves to the server from any resolver, and you can show the delegation chain.
- [ ] You can predict how long a DNS change takes to be seen.

**Evidence**

```text

```

**Notes**

- 

**Questions**

- 

## L11 - HTTPS and Reverse Proxy

Card: [[../../90 - Tasks/items/LEARN-011-https-reverse-proxy|LEARN-011]] — Learn HTTPS and reverse proxying with Caddy and Let's Encrypt. Needs: LEARN-005, LEARN-010.

Status: todo · Started: · Finished: · Hours: · Confidence:

**Lesson**

- [ ] Lesson written (Claude)
- [ ] Lesson read
- [ ] Reading list skimmed

**Lab**

- [ ] On EC2, create a Docker network; run the app without published ports and Caddy publishing 80 and 443 with a Caddyfile `app.<domain> { reverse_proxy app:8080 }`.
- [ ] First use the Let's Encrypt staging CA, check the (untrusted) certificate, then switch to production.
- [ ] Add HSTS and other headers; check the HTTP→HTTPS redirect.
- [ ] Restart Caddy and confirm it reuses the stored certificate.
- [ ] Every command in "Check it yourself" run and understood
- [ ] Exercises done (break it, then fix it)

**Done when**

- [ ] `https://app.<domain>` works with a trusted certificate, HTTP redirects, the app port is private.
- [ ] You can read a certificate and diagnose TLS errors from the command line.

**Evidence**

```text

```

**Notes**

- 

**Questions**

- 

## L12 - CI/CD with GitHub Actions and AWS OIDC

Card: [[../../90 - Tasks/items/LEARN-012-github-actions-cicd|LEARN-012]] — Learn CI/CD with GitHub Actions deploying to AWS without stored keys. Needs: LEARN-006, LEARN-009, LEARN-011.

Status: todo · Started: · Finished: · Hours: · Confidence:

**Lesson**

- [ ] Lesson written (Claude)
- [ ] Lesson read
- [ ] Reading list skimmed

**Lab**

- [ ] Workflow 1 `ci.yml` on pull requests: Java 21 setup, `./gradlew ktlintCheck detekt test`, Node + Playwright browser suite.
- [ ] In AWS: add the GitHub OIDC identity provider; create role `easyquery-github-deploy` trusted only for `repo:<owner>/sparql-query-easy:environment:production`, allowed to push to the ECR repo and send SSM commands to instances tagged `Project=easyquery`.
- [ ] Workflow 2 `deploy.yml` on push to `main` (environment `production`): assume the role, build and push `:<sha>`, `aws ssm send-command` a script that pulls, restarts and checks `/health`, then `curl` the public URL.
- [ ] Add a `workflow_dispatch` input to redeploy a previous SHA (rollback) and practise it.
- [ ] Require the CI check before merging to `main`.
- [ ] Every command in "Check it yourself" run and understood
- [ ] Exercises done (break it, then fix it)

**Done when**

- [ ] Every merge to `main` deploys automatically after approval, with no AWS keys stored in GitHub.
- [ ] You have rolled back at least once and know how long it takes.

**Evidence**

```text

```

**Notes**

- 

**Questions**

- 

## L13 - Observability, Backups and Runbooks

Card: [[../../90 - Tasks/items/LEARN-013-observability-backups-runbooks|LEARN-013]] — Learn monitoring, logs, backups and incident runbooks for the running app. Needs: LEARN-007, LEARN-012.

Status: todo · Started: · Finished: · Hours: · Confidence:

**Lesson**

- [ ] Lesson written (Claude)
- [ ] Lesson read
- [ ] Reading list skimmed

**Lab**

- [ ] Run the app container with `--log-driver awslogs` to log group `/easyquery/app` (14-day retention).
- [ ] Create an SNS topic with your email; a Route 53 health check on `https://app.<domain>/health` with an alarm; an EC2 status-check alarm; a disk-usage alarm via the CloudWatch agent.
- [ ] Do a full restore drill of RDS into a temporary instance, connect, count users, delete it; write the time it took.
- [ ] Write runbooks: "site down", "deploy broke", "database unreachable", "disk full", "certificate problem".
- [ ] Every command in "Check it yourself" run and understood
- [ ] Exercises done (break it, then fix it)

**Done when**

- [ ] You get an email within minutes when the site is down, and you know your measured RTO for the database.
- [ ] Runbooks exist and you have practised at least two.

**Evidence**

```text

```

**Notes**

- 

**Questions**

- 

## L14 - Go-Live Checklist for User Testing

Card: [[../../90 - Tasks/items/LEARN-014-go-live-user-testing|LEARN-014]] — Learn the go-live checklist for a safe, legal and affordable user test. Needs: LEARN-008, LEARN-013.

Status: todo · Started: · Finished: · Hours: · Confidence:

**Lesson**

- [ ] Lesson written (Claude)
- [ ] Lesson read
- [ ] Reading list skimmed

**Lab**

- [ ] Walk through every route in Swagger (`/swagger`) as an attacker and list what a malicious user could do; turn the list into SEC-001 decisions.
- [ ] Try a SPARQL endpoint URL pointing at `http://169.254.169.254/` or `http://127.0.0.1:8080/` against your own deployment and record what happens; then verify the mitigation.
- [ ] Write the privacy notice and the test-account procedure.
- [ ] Load test `/health` and one query with a small tool (e.g. `hey` or `ab`) and watch `docker stats`.
- [ ] Write the shutdown checklist and put a calendar reminder for the end of the test.
- [ ] Every command in "Check it yourself" run and understood
- [ ] Exercises done (break it, then fix it)

**Done when**

- [ ] SEC-001 decisions are made and implemented before inviting testers.
- [ ] Participants get a clear privacy notice; you know how to delete their data.
- [ ] A dated shutdown plan exists.

**Evidence**

```text

```

**Notes**

- 

**Questions**

- 

## Source files

- `tcc/90 - Tasks/items/LEARN-*.md`
- [[00 - Deployment Roadmap]]
