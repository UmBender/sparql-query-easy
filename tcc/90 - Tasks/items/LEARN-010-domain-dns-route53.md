---
id: LEARN-010
title: Learn domains and DNS by putting the app behind your own name with Route 53
status: READY
priority: P1
type: learning
depends_on: [LEARN-003]
human_gate: true
created: 2026-10-07
updated: 2026-10-07
---
# Learn domains and DNS by putting the app behind your own name with Route 53

Part of the [[../../07 - Operations/Deployment Learning Path/00 - Deployment Roadmap|Deployment Roadmap]];
progress goes in the [[../../07 - Operations/Deployment Learning Path/Deployment Learning Tracker|Deployment Learning Tracker]].
Prepares: OPS-002.

## Why this matters for the deployment

People will reach the app by name, Let's Encrypt will check that name, and DNS mistakes are slow to fix because of caching. Learning DNS properly makes the HTTPS step easy.

## How this task is executed

1. **Claude writes the lesson** `tcc/07 - Operations/Deployment Learning Path/L10 - Domain and DNS with Route 53.md`:
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

- Explain registrar vs DNS hosting vs hosted zone, and delegation through NS records.
- Create a Route 53 public hosted zone and delegate your domain to it (e.g. from Registro.br for a `.br` domain).
- Create A/AAAA, CNAME, alias and CAA records; explain TTL and negative caching.
- Verify every step with `dig` against public resolvers and the authoritative servers.

## Concepts to study

- Domain lifecycle (registration, renewal, WHOIS/RDAP).
- Record types: A, AAAA, CNAME, ALIAS (Route 53 alias), NS, SOA, TXT, CAA, MX (not needed here).
- TTL strategy: lower it before a change, raise it after.
- Recursive vs authoritative answers; propagation is really cache expiry.
- Route 53 costs (hosted zone per month, queries) and health checks (used in LEARN-013).

## Hands-on lab

1. Choose and buy a domain (decision recorded in OPS-002).
2. Create the hosted zone; copy its four NS servers to the registrar; wait and verify delegation.
3. Create `app.<domain>` A record → the Elastic IP (TTL 300) and a CAA record allowing `letsencrypt.org`.
4. Change the TTL and watch cached answers expire on different public resolvers.

## Check it yourself (CLI)

Replace `<…>` placeholders with your values.

```sh
aws route53 list-hosted-zones --query "HostedZones[].{id:Id,name:Name,records:ResourceRecordSetCount}"
```
Look for: your zone

```sh
aws route53 list-resource-record-sets --hosted-zone-id <zone-id> --query "ResourceRecordSets[].{name:Name,type:Type,ttl:TTL,values:ResourceRecords[].Value}" --output table
```
Look for: NS, SOA and your records

```sh
aws route53 change-resource-record-sets --hosted-zone-id <zone-id> --change-batch file://app-a-record.json ; aws route53 get-change --id <change-id>
```
Look for: `PENDING` then `INSYNC`

```sh
dig NS <domain> +short
```
Look for: the four `awsdns` servers once delegation works

```sh
dig +trace app.<domain>
```
Look for: root → TLD → Route 53 → your A record

```sh
dig @<one-awsdns-server> app.<domain> A +noall +answer
```
Look for: the authoritative answer with the full TTL

```sh
dig @1.1.1.1 app.<domain> A +noall +answer ; dig @8.8.8.8 app.<domain> A +noall +answer
```
Look for: cached answers with decreasing TTLs

```sh
dig <domain> CAA +short
```
Look for: `0 issue "letsencrypt.org"`

```sh
whois <domain> | grep -i -E "nserver|name server|expires|expiration"
```
Look for: delegation and expiry at the registry

## Exercises — break it, then fix it

- Point the record to a wrong IP, then fix it, and measure how long the wrong answer stays cached.
- Explain why you cannot put a CNAME at the zone apex and what Route 53 alias records solve.
- Query a name that does not exist and find the negative-caching TTL in the SOA.

## Done when

- `app.<domain>` resolves to the server from any resolver, and you can show the delegation chain.
- You can predict how long a DNS change takes to be seen.

## Reading list

- Amazon Route 53 Developer Guide — Making Route 53 the DNS service for an existing domain, Working with records, Choosing between alias and non-alias records: https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/
- How DNS Works (illustrated): https://howdns.works/
- Julia Evans — "How DNS works" zine and DNS blog posts (https://wizardzines.com/, https://jvns.ca/)
- Registro.br — documentation for configuring DNS servers of a `.br` domain (if you use a `.br` domain)

## Execution log

- 2026-10-07: Created from the user's request for a hands-on deployment learning
  path (DOC-003).
