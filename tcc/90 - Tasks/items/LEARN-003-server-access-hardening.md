---
id: LEARN-003
title: Learn to reach the university server safely with SSH keys, least privilege and updates
status: READY
priority: P1
type: learning
depends_on: [LEARN-001]
human_gate: true
created: 2026-10-07
updated: 2026-10-27
---
# Learn to reach the university server safely with SSH keys, least privilege and updates

Part of the [[../../07 - Operations/Deployment Learning Path/00 - Deployment Roadmap|Deployment Roadmap]];
progress goes in the [[../../07 - Operations/Deployment Learning Path/Deployment Learning Tracker|Deployment Learning Tracker]].
Prepares: OPS-011 (checklist A1–A3, M3). Target: the university server (DEC-003); rewritten from the earlier AWS version on 2026-10-27.

## Why this matters for the deployment

The server is shared university infrastructure and holds participants' data. Most incidents on a small server start with a weak login (password SSH, a shared account) or an unpatched package. Setting up access carefully first makes every later step safer.

## How this task is executed

1. **Claude writes the lesson** `tcc/07 - Operations/Deployment Learning Path/L03 - Server Access and Hardening.md`:
   a blog-post-style module that explains every concept below from first
   principles with diagrams, walks through the lab step by step with the
   expected output of each command, lists common errors and how to read
   them, and ends with a short quiz. It cites official documentation, and
   for commands it cannot run in the repository it marks the output as
   expected rather than observed.
2. **You do the lab by hand** in your own terminal and on the university
   server, run every self-check, and record results and questions in the tracker.
3. **Review together:** open questions go back into the lesson. The task
   is DONE when you tick every "Done when" item in the tracker (human gate).

Nothing is installed on the server, pushed or deployed by Claude without
your explicit request in the session; university rules come first.

## Learning objectives — after this you can

- Log in with an SSH key (ed25519) protected by a passphrase, using `~/.ssh/config` and `ssh-agent`.
- Explain why the `docker` group is root-equivalent and decide between root, sudo and the docker group with IT (checklist A2).
- Check the OS version, pending updates, automatic security updates and clock sync (M3).
- Read who can log in and what ran: `last`, `journalctl -u ssh`, `sudo` logs.
- Know the university's rules for the server (VPN, allowed services, contact) before installing anything.

## Concepts to study

- Public-key authentication, host keys and `known_hosts` (the first-connection fingerprint).
- Users, groups, `sudo`, file permissions and umask; service accounts vs your personal account.
- Package updates (`apt`/`dnf`), unattended upgrades, reboot-required flags, maintenance windows (M4).
- NTP/`timedatectl` and why sessions and TLS certificates depend on the clock.
- VPN-only access vs SSH from the internet (A3) and what each means for deploys.

## Hands-on lab

1. Generate an ed25519 key with a passphrase; send only the `.pub` to IT; add a `Host easyquery` block to `~/.ssh/config`.
2. Log in, compare the host key fingerprint with the one IT gives you, and note the OS, CPU, RAM and disk (M1, M3).
3. Check whether you are in `sudo`/`docker` groups and what that allows; write the answer to A2 in the checklist.
4. Check automatic updates and NTP; ask IT about maintenance windows if unclear.

## Check it yourself (CLI)

Replace `<…>` placeholders with your values; `easyquery` is your `~/.ssh/config` host.

```sh
ssh -v easyquery true
```
Look for: `Authenticated … using "publickey"` and no password prompt

```sh
ssh easyquery 'cat /etc/os-release; nproc; free -h; df -h /'
```
Look for: OS name/version, CPUs, RAM, free disk

```sh
ssh easyquery 'id; sudo -l 2>/dev/null | head'
```
Look for: your groups; whether `sudo` is allowed and for what

```sh
ssh easyquery 'timedatectl'
```
Look for: `System clock synchronized: yes`

```sh
ssh easyquery 'last -n 5; sudo journalctl -u ssh --since today | tail'
```
Look for: your own recent logins only

## Exercises — break it, then fix it

- Explain what an attacker who joins the `docker` group can do, with a one-line `docker run` example.
- Your laptop is stolen: list the steps to revoke its key on the server (and who you must tell).

## Done when

- You log in with a passphrase-protected key; no shared password is used.
- Checklist answers A1–A3 and M1–M4 are recorded with dates.
- You can explain the privilege you have on the server and its risks.

## Reading list

- OpenSSH manual pages `ssh(1)`, `ssh_config(5)`, `ssh-keygen(1)`
- Docker docs — Linux post-installation steps (the docker group warning) and rootless mode
- Your distribution's guide to unattended/automatic security updates

## Execution log

- 2026-10-07: Created from the user's request for a hands-on deployment learning
  path (DOC-003), first written for AWS.
- 2026-10-27: Rewritten for the university server (user: "replaneje para o servidor
  da faculdade"); AWS content is in git history.
