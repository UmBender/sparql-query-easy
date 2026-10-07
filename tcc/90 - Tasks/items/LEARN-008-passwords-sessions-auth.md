---
id: LEARN-008
title: Learn secure password storage, sessions and login protection
status: READY
priority: P1
type: learning
depends_on: [LEARN-001]
human_gate: true
created: 2026-10-07
updated: 2026-10-07
---
# Learn secure password storage, sessions and login protection

Part of the [[../../07 - Operations/Deployment Learning Path/00 - Deployment Roadmap|Deployment Roadmap]];
progress goes in the [[../../07 - Operations/Deployment Learning Path/Deployment Learning Tracker|Deployment Learning Tracker]].
Prepares: AUTH-000, AUTH-001.

## Why this matters for the deployment

You chose PostgreSQL for login data. Before approving the login contract (AUTH-000) and reviewing its implementation (AUTH-001), you need to know what "storing passwords correctly" and "a secure session" actually mean.

## How this task is executed

1. **Claude writes the lesson** `tcc/07 - Operations/Deployment Learning Path/L08 - Passwords, Sessions and Login Security.md`:
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

- Explain hashing vs encryption and why passwords are hashed with a slow, salted algorithm (Argon2id or bcrypt).
- Choose and justify hash parameters, and know how to upgrade them later.
- Explain session cookies vs tokens, and the cookie flags `HttpOnly`, `Secure`, `SameSite`, `Max-Age`.
- Explain CSRF, session fixation, account enumeration and brute force, and the defense for each.
- Answer the AUTH-000 questions yourself with reasons.

## Concepts to study

- Hash functions vs password hashing functions; salts; peppers (optional); work factors.
- Argon2id/bcrypt recommendations from the OWASP Password Storage Cheat Sheet.
- Constant-time comparison; generic error messages ("invalid email or password").
- Server-side sessions stored in PostgreSQL vs signed cookies; session expiry and logout invalidation; regenerate the session ID at login.
- CSRF: SameSite plus a CSRF token for state-changing requests.
- Rate limiting and lockout; audit logging of logins.
- Ktor Authentication and Sessions plugins (how AUTH-001 would use them).
- Privacy: store only what you need (email, hash, timestamps).

## Hands-on lab

1. Hash the same password twice with Argon2id (e.g. the `argon2` CLI or a small script) and explain why the outputs differ yet both verify.
2. Measure how long one hash takes with your parameters; estimate an attacker's guesses per second.
3. Draft a `users` and a `sessions` table (columns, types, constraints, indexes) in your local PostgreSQL.
4. Once AUTH-001 exists locally: log in with `curl -c cookies.txt`, inspect `Set-Cookie`, call a protected route with and without the cookie, log out and retry.
5. Write your answers to every AUTH-000 question in the tracker.

## Check it yourself (CLI)

Replace `<…>` placeholders with your values.

```sh
openssl rand -base64 32
```
Look for: a strong random secret (for session signing keys, never a password hash)

```sh
echo -n 'correct horse' | argon2 "$(openssl rand -hex 16)" -id -t 2 -m 16 -p 1
```
Look for: an encoded `$argon2id$v=19$m=65536,t=2,p=1$…` hash (argon2 CLI; `-m` is log2 of KiB)

```sh
curl -i -c cookies.txt -H "Content-Type: application/json" -d '{"email":"a@b.c","password":"…"}' http://127.0.0.1:8080/<login-route>
```
Look for: the `Set-Cookie` header and its flags (after AUTH-001)

```sh
curl -i -b cookies.txt http://127.0.0.1:8080/<protected-route>
```
Look for: 200 with the cookie, 401/redirect without it

```sh
psql -c "SELECT email, left(password_hash, 30) FROM users LIMIT 3;"
```
Look for: only `$argon2id$…`/`$2b$…` hashes — never a readable password

## Exercises — break it, then fix it

- Explain why SHA-256(password) is not acceptable even with a salt.
- Explain what happens if the database is leaked under your design and what users must do.
- Explain why "this email does not exist" is a vulnerability on the login form.

## Done when

- You can defend each choice in the AUTH-000 contract with a reason.
- You can verify cookie flags and session invalidation from the command line.

## Reading list

- OWASP Cheat Sheet Series — Password Storage, Authentication, Session Management, Cross-Site Request Forgery Prevention: https://cheatsheetseries.owasp.org/
- Ktor documentation — Authentication, Sessions: https://ktor.io/docs/
- MDN — Using HTTP cookies (cookie attributes)
- `tcc/90 - Tasks/items/AUTH-000-authentication-contract-decision.md` (this project)

## Execution log

- 2026-10-07: Created from the user's request for a hands-on deployment learning
  path (DOC-003).
