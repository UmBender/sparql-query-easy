# University Server Checklist — DOC-005

Questions to send to the university IT before go-live (DEC-003: Docker
Compose on the university server). Each answer unblocks a card or chooses a
setting; record the answer and the date in the last column. The stack is
three containers plus a backup container: `web` (Caddy, the only one that
listens on the network), `backend` (Ktor/JVM), `db` (PostgreSQL 17) and
`backup` ([[Docker Compose Stack]]).

## Access

| # | Question | Why the app needs it | Unblocks | Answer (date) |
|---|---|---|---|---|
| A1 | May we run Docker Engine with Docker Compose v2.24 or newer on the server? If not, is Podman with `podman compose` allowed? | The whole deployment is a Compose project | OPS-011, OPS-005 | |
| A2 | Do we get root, or an account in the `docker` group? | Starting containers needs one of them; membership of `docker` is root-equivalent | OPS-011 | |
| A3 | How do we log in: SSH from the internet, only through the university VPN, or only on campus? | Install, update and restore are done over a shell | OPS-011, OPS-005 | |
| A4 | Can the server reach GitHub (git clone/pull over HTTPS or SSH)? Can GitHub Actions reach the server? | Releases are built on the server from a git tag (DEC-017 Q5); automatic deploys need an inbound path | OPS-011, OPS-005 | |

## Network

| # | Question | Why the app needs it | Unblocks | Answer (date) |
|---|---|---|---|---|
| N1 | Is the server reachable from the public internet, or only inside the university network? | Study participants open the app in their own browser | OPS-002, OPS-008 | |
| N2 | Which inbound ports may be open: 80 and 443, or a single port behind a university reverse proxy? | Chooses the HTTPS mode (`auto` needs 80 and 443; `proxy` needs one internal port) | OPS-008, OPS-002 | |
| N3 | Is outbound HTTPS allowed to `query.wikidata.org` and `www.wikidata.org`? | The editor queries Wikidata at runtime | OPS-002, SEC-001 | |
| N4 | Is outbound HTTPS allowed to Docker Hub, npm (`registry.npmjs.org`), Maven Central and the Gradle plugin portal, or is there a mirror/proxy we must use? | Images are built on the server (DEC-017 Q5) | OPS-011 | |
| N5 | Is there an outbound HTTP proxy we must configure? | Builds and Wikidata calls would need it | OPS-011 | |

## Name and HTTPS

| # | Question | Why the app needs it | Unblocks | Answer (date) |
|---|---|---|---|---|
| H1 | Which DNS name will the app have (for example `easyquery.<dept>.<university>.br`), and who creates the record? | Cookies, HTTPS certificates and links use one origin | OPS-002, OPS-008 | |
| H2 | Does the university already put servers behind a reverse proxy that terminates HTTPS? If yes, what is its address and does it forward `Host`, `X-Forwarded-For` and `X-Forwarded-Proto`? | Mode `proxy`: Caddy trusts only that address | OPS-008 | |
| H3 | If there is no such proxy, may the server obtain Let's Encrypt certificates itself (port 80 reachable from the internet for the ACME challenge)? Or does the university issue certificates? | Mode `auto`, or installing a given certificate | OPS-008, OPS-002 | |

## Machine

| # | Question | Why the app needs it | Unblocks | Answer (date) |
|---|---|---|---|---|
| M1 | How many CPUs, how much RAM and how much free disk? | Default limits total about 2.5 GiB of RAM; image builds and backups need several GiB of free disk | OPS-010, OPS-011 | |
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
