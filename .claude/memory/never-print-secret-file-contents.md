---
name: never-print-secret-file-contents
description: Never echo/grep a secrets file's VALUES into the transcript; inspect .env/keys by COUNT or length only
metadata:
  type: feedback
---

Reading a secrets file (a NUC `.env`, a private key) in a way that can print its VALUES leaks them into the
transcript — which may be cached/logged, so the secret must then be rotated. This actually happened: a
`grep -oE '^KEY='` over a *malformed* `.env` (a multi-line value had spilled into orphan lines) printed a private
signing key, forcing a key rotation.

**Why:** the transcript is not a safe place for secrets (platform invariant #4: secrets only in `.env`). `grep -o` /
`cat` / `sed` on a secrets file can surface a value, especially when the file is malformed.

**How to apply:** to inspect a secrets file, verify by **count / length only** — `grep -c '^KEY='` (presence), a count
of nonstandard lines, lengths — NEVER `grep -o` / `cat` / print the value. When generating a secret (e.g. a keypair),
route it file→file and never to stdout. An upsert into a `KEY=VALUE` file must also handle multi-line legacy values
(rebuild the file cleanly; don't leave orphan continuation lines). Related: [[sandbox-propose-governance]],
[[verify-end-state-not-upload]].
