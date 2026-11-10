# University Server Checklist — DOC-005

Questions to send to the university IT before go-live (DEC-003: Docker
Compose on the university server). Each answer unblocks a card or chooses a
setting; record the answer and the date in the last column. The stack is
three containers plus a backup container: `web` (Caddy, the only one that
listens on the network), `backend` (Ktor/JVM), `db` (PostgreSQL 17) and
`backup` ([[Docker Compose Stack]]).

## IT answers so far

On 2026-11-10 IT (the department's server administrator) created a VM for the
tests and sent the answers recorded below. The IP address and login are kept
out of this public repository; they are in the administrator's e-mail.
Open points: which port pair is right (N2), whether the ports and SSH can be reached
from outside USP (N1, A3), CPU and RAM (M1), and M2–M4, D1–D3, O1–O2.

## Access

| # | Question | Why the app needs it | Unblocks | Answer (date) |
|---|---|---|---|---|
| A1 | May we run Docker Engine with Docker Compose v2.24 or newer on the server? If not, is Podman with `podman compose` allowed? | The whole deployment is a Compose project | OPS-011, OPS-005 || Yes, Docker is allowed (IT, 2026-11-10). Docker and Compose versions to check at first login. Any program outside Docker must be requested from IT with a list. |
| A2 | Do we get root, or an account in the `docker` group? | Starting containers needs one of them; membership of `docker` is root-equivalent | OPS-011 || Docker access is granted (2026-11-10); whether through the `docker` group or sudo is to be checked with `id` at first login. |
| A3 | How do we log in: SSH from the internet, only through the university VPN, or only on campus? | Install, update and restore are done over a shell | OPS-011, OPS-005 || SSH with a public key, sent to IT through a USP Google Drive file shared only with the administrator, or through GitHub (2026-11-10). Whether VPN is needed is not stated; check at first login. |
| A4 | Can the server reach GitHub (git clone/pull over HTTPS or SSH)? Can GitHub Actions reach the server? | Releases are built on the server from a git tag (DEC-017 Q5); automatic deploys need an inbound path | OPS-011, OPS-005 || Partly: no outbound restrictions (2026-11-10), so `git clone` from GitHub works. Inbound access for GitHub Actions is not covered. |

## Network

| # | Question | Why the app needs it | Unblocks | Answer (date) |
|---|---|---|---|---|
| N1 | Is the server reachable from the public internet, or only inside the university network? | Study participants open the app in their own browser | OPS-002, OPS-008 || Inbound traffic is allowed only to the two reserved ports (2026-11-10). Whether they can be reached from outside the USP network is not stated; test it from outside. |
| N2 | Which inbound ports may be open: 80 and 443, or a single port behind a university reverse proxy? | Chooses the HTTPS mode (`auto` needs 80 and 443; `proxy` needs one internal port) | OPS-008, OPS-002 || Two reserved ports: 8280 (HTTP) and 8281 (HTTPS). Map the web server's 80 → 8280 and 443 → 8281 (2026-11-10). **Conflict:** the same e-mail also names 8081 and 8082 as the reserved inbound ports; ask IT which pair is right. |
| N3 | Is outbound HTTPS allowed to `query.wikidata.org` and `www.wikidata.org`? | The editor queries Wikidata at runtime | OPS-002, SEC-001 || Yes: no outbound restrictions (2026-11-10). |
| N4 | Is outbound HTTPS allowed to Docker Hub, npm (`registry.npmjs.org`), Maven Central and the Gradle plugin portal, or is there a mirror/proxy we must use? | Images are built on the server (DEC-017 Q5) | OPS-011 || Yes: no outbound restrictions (2026-11-10). |
| N5 | Is there an outbound HTTP proxy we must configure? | Builds and Wikidata calls would need it | OPS-011 || No proxy mentioned ("sem restrições de saída", 2026-11-10); confirm at first login. |

## Name and HTTPS

| # | Question | Why the app needs it | Unblocks | Answer (date) |
|---|---|---|---|---|
| H1 | Which DNS name will the app have (for example `easyquery.<dept>.<university>.br`), and who creates the record? | Cookies, HTTPS certificates and links use one origin | OPS-002, OPS-008 || No DNS name: the server is reached by its IP address (2026-11-10). |
| H2 | Does the university already put servers behind a reverse proxy that terminates HTTPS? If yes, what is its address and does it forward `Host`, `X-Forwarded-For` and `X-Forwarded-Proto`? | Mode `proxy`: Caddy trusts only that address | OPS-008 || No university reverse proxy mentioned (2026-11-10). |
| H3 | If there is no such proxy, may the server obtain Let's Encrypt certificates itself (port 80 reachable from the internet for the ACME challenge)? Or does the university issue certificates? | Mode `auto`, or installing a given certificate | OPS-008, OPS-002 || For the TCC tests a self-signed certificate is acceptable (2026-11-10). That is mode `auto` with `EASYQUERY_TLS=internal`; browsers will show a warning. |

## Machine

| # | Question | Why the app needs it | Unblocks | Answer (date) |
|---|---|---|---|---|
| M1 | How many CPUs, how much RAM and how much free disk? | Default limits total about 2.5 GiB of RAM; image builds and backups need several GiB of free disk | OPS-010, OPS-011 || 48 GB of disk (2026-11-10). CPU and RAM: check at first login. |
| M2 | Is the machine shared with other services or users? | Resource limits and file permissions on backups (DEC-017 Q4, Q6) | OPS-010, OPS-009 | |
| M3 | Which operating system and version? Is the clock synchronised (NTP)? | Docker packages; certificate and session expiry use the clock | OPS-011 | |
| M4 | Are there maintenance windows or automatic reboots? | Containers restart with `unless-stopped` only if Docker starts at boot | OPS-011 | |

## Data and backups

| # | Question | Why the app needs it | Unblocks | Answer (date) |
|---|---|---|---|---|
| D1 | Where can backups be stored off this server (a university share, another server over SSH/rsync, object storage)? With what credential? | Daily dumps are kept locally; one off-host copy protects against losing the server | OPS-009, OPS-004 | |
| D2 | Are there university rules for research data (participants' consent and questionnaire answers): retention, location, who may access? | Dumps are encrypted before they leave the server and kept 7 daily + 4 weekly (DEC-017 Q4) | OPS-009 | |
| D3 | Is the server's disk itself backed up or snapshotted by IT? | Decides whether off-host copies are the only protection | OPS-004 | |

## Operations

| # | Question | Why the app needs it | Unblocks | Answer (date) |
|---|---|---|---|---|
| O1 | Who is the contact for incidents, and how is the server monitored (if at all)? | Someone must notice when the app is down during a study session | OPS-004 | |
| O2 | Can the server send e-mail (SMTP relay) or reach an alerting service? | Alerts on failed backups or downtime | OPS-004 | |

## Source files

`compose.yaml`, `deploy/Caddyfile`, [[Docker Compose Stack]],
[[../90 - Tasks/items/DEC-017-t11-deploy-brief-differences]], [[../90 - Tasks/BLOCKERS]].
