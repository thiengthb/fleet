---
title: Two-way Discord control plane for the autonomous agent (park → approve-from-phone → release), security-bounded
kind: system-change # feature | system-change — both REQUIRE prior-art before acceptance
status: superseded # draft → accepted → rejected | superseded
created: 2026-06-14
updated: 2026-06-14 # accepted by supervisor — full scope (B4a+B4b); nuc-ops-bot confirmed = gateway bot (no public endpoint)
related:
  [
    platform/plans/2026-06-14-autonomous-agent.md (this is the design for step B4),
    platform/09-autonomy-contract.md,
    .claude/hooks/autonomy-gate.mjs,
    .claude/scripts/auto-pilot-run.sh,
    nuc-ops-bot (repo — gateway bot, buttons + user-id allowlist; NOT on this machine),
    nuc-monitor (repo — outbound Discord webhook; NOT on this machine),
    authentik/docs/auth-apps.md,
    platform/INVENTORY.md,
  ]
---

> **SUPERSEDED 2026-07-28.** The home-grown auto-pilot this plan built (or served) was retired: Claude Code now
> ships scheduled cloud agents (`/schedule`) and remote agent execution natively, which is what this was
> re-implementing. Removed: the `/auto-pilot` + `/auto-pilot-smoke-test` skills, `auto-pilot-run.{sh,ps1}`,
> `auto-pilot-scheduled.ps1`, `register-task.ps1`, and the signed Discord control plane
> (`gate-cli`/`gate-answer`/`gate-verify`/`ask-cli` + the pinned public key). KEPT and simplified:
> `autonomy-gate.mjs`, the T1–T4 safety gate (see `09-autonomy-contract.md` for the open trigger risk).
> This file stays as the record of the reasoning and the ~6 sessions it cost — that is the lesson, not the code.


<!--
  RESEARCH-GROUNDED proposal (research-before-design / anti-bias). Precedes the B4 plan. Propose-don't-execute:
  queued for HUMAN approval; never self-enters the build pipeline. Bot-side build happens on a machine that has
  nuc-ops-bot + nuc-monitor cloned (absent on this machine — only todo/yakudoku/platform are here).
  Contract: platform/09-autonomy-contract.md · CLAUDE.md §"Autonomous agent".
-->

## Problem

The autonomous executor (Layer A + B1–B3) works: a fresh `claude -p` worker advances an approved plan on a branch,
commits locally, and **parks at the first gate**. Today the supervisor can only see the result by opening a session at
the PC. The user — burning out from timing reset windows — chose (AskUserQuestion) a **two-way** control plane: read a
digest **and Approve/Deny a parked gate from their phone via Discord**, so progress is decoupled from physical presence.
The hard constraint is platform invariant + plan risk **R2**: this must NOT widen `nuc-ops-bot`'s existing
Docker-control attack surface, must never become a free-text→command channel, and must never let an unattended run cross
a **T4** boundary (push main / deploy / destroy). Grounding (external, not opinion): the lethal-trifecta and
self-modification incidents in `09-autonomy-contract.md` (CVE-2025-53773 — an agent that could influence its own
approval path escalated to unrestricted shell).

## Prior art & sources — REQUIRED: ≥2 external URLs (researched BEFORE designing; 3 parallel research threads)

- [GitHub Actions environments + required reviewers](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments) — the canonical gate: job waits, **allowlisted identities** click Approve/Reject (bounded enum, not free-text), decision is logged. **Reuse:** allowlist + binary-button shape. **Avoid:** GH-only, not standalone.
- [Slack request verification (HMAC signing secret)](https://docs.slack.dev/authentication/verifying-requests-from-slack) — interactive buttons send a **signed** payload; `value` is set by the app at send-time (bounded), `user_id` is in the payload and checked against an allowlist; ≤5-min timestamp window blocks replay. **Reuse:** signed inbound + server-side allowlist + bounded value.
- [Atlantis security](https://www.runatlantis.io/docs/security) — **anti-pattern to avoid:** free-text PR comments as the command channel; authorization delegated entirely to VCS perms, no per-action ACL. Confirms: never parse user text into an action.
- [Discord — Interactions overview (Ed25519 verification + PING handshake)](https://docs.discord.com/developers/interactions/overview) — webhooks are **outbound-only**; to *receive* a button click you need a Gateway bot (websocket) or an HTTP Interactions endpoint, and **every** inbound POST is Ed25519-signed (`X-Signature-Ed25519`/`-Timestamp`); Discord auto-probes with bad signatures and disables endpoints that accept them.
- [Discord — receiving & responding to interactions](https://docs.discord.com/developers/interactions/receiving-and-responding) — a button click delivers `data.custom_id` (verbatim, ≤100 chars) + `member.user.id` + `member.roles[]`; interaction token expires in **15 min**, needs a **3 s** ACK. **Reuse:** encode the gate id in `custom_id` as a closed enum `approve:GATE-<id>` / `deny:GATE-<id>`.
- [Temporal — human-in-the-loop approvals](https://temporal.io/blog/human-in-the-loop-approvals) — paused state is durably persisted; resumed by a **typed-enum signal** (APPROVED/REJECTED), idempotency key = `workflow_id + step_id`. **Reuse:** typed (not free-text) decision + gate-scoped idempotency.
- [Auth0 — token best practices (exp, jti, RS256 vs HS256)](https://auth0.com/docs/secure/tokens/token-best-practices) + [JWT introduction](https://www.jwt.io/introduction) — make the approval a short-lived **signed token** `{gate_id, decision, iat, exp, jti}`; `exp` bounds lifetime, `jti` nonce blocks replay, **RS256** lets the worker hold only the *public* key (cannot forge). **Reuse:** asymmetric-signed, single-use, gate-bound approval.
- [AWS S3 presigned URLs / least privilege](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html) + [Cloudflare KV consistency](https://developers.cloudflare.com/kv/concepts/how-kv-works/) — credential split: writer (bot) vs reader (worker) at the IAM layer; eventual-consistency caveat (~60 s). Informs the "worker pulls, no inbound port" channel.

## Options considered — REQUIRED: ≥2, with tradeoffs

End-to-end the design = **{Discord inbound} × {cross-host state channel} × {does an approval release a gate?}**. The
three viable architectures:

| Option | How it works | Benefit | Drawback / cost |
| --- | --- | --- | --- |
| **A — Reuse `nuc-ops-bot` (gateway) + git state-channel + signed token** *(recommended)* | Bot posts an Approve/Deny button (`custom_id = approve:GATE-<id>`); receives the click over its **existing** gateway websocket (no new public surface); verifies `member.user.id` ∈ allowlist (already does); signs `{gate_id,decision,exp 15m,jti}` with an **RS256 private key held only on the NUC**; writes `gates/<gate_id>.json` to a **dedicated private repo**. Local worker `git pull`s (read-only deploy key) at batch start, verifies with the **public key only**, checks gate_id+exp+jti-unused. Digest out via `nuc-monitor` webhook (unchanged). | Extends what exists (no new service, no new public endpoint); smallest new attack surface; worker holds only a public key + read-only pull (can't forge, can't push prod); decision is tamper-evident, single-use, gate-scoped, expiring; bot gains **one** bounded action (sign+write a gate file) — **no** new Docker/shell path. | Standing RS256 keypair to manage/rotate; a dedicated gates repo + two scoped credentials; ~60 s pull latency. |
| **B — New HTTP Interactions endpoint + gate-state HTTPS API on the NUC** | A new small service exposes a Discord HTTP-Interactions endpoint (Ed25519-verified) **and** a `GET /gate/<id>` the worker polls. | Strong isolation from the ops bot; clean atomic single-use server-side. | **Rebuild not reuse**; a NEW public surface (subdomain) that, per invariant #8, must be **left un-Authentik'd** (machine-called) — easy to mis-protect and silently break; another service + secrets to run. Higher ops + bigger surface for the same outcome. |
| **C — Notify-only (the baseline the user already declined)** | Discord only *notifies*; gate-crossing always happens later in a supervised session. | Zero new inbound/attack surface; nothing to forge. | Does **not** deliver "approve-from-phone → agent proceeds unattended" — the explicit goal. Listed for honesty / as the fallback. |

**Within A, two sub-capabilities at very different risk levels** (this is the core safety call):

- **B4a — decision capture + loop continuation (LOW risk).** The button → allowlisted, signed, bounded approve/deny →
  recorded to the git channel + echoed to Discord. The worker reads it and, on *approve*, un-parks to keep doing
  **safe-zone (T1/T2)** steps it had conservatively parked on. Delivers remote control of the loop **without touching
  the push/PR gate**. Needs **no** change to `autonomy-gate.mjs`.
- **B4b — token-gated T3 release (HIGH risk; a human must commit the hook change).** To make "approve → the agent
  **opens the PR** unattended" real, `autonomy-gate.mjs` itself must deterministically **verify the signed token** and
  allow exactly one bounded T3 action (`gh pr create` / `git push origin auto/<branch>` for a **non-main** branch) when
  a fresh, gate-matched, single-use token is present. **T4 stays hard-blocked unconditionally.** This puts crypto inside
  the sole gate (must be fail-closed) and is an edit to the agent's own governance ⇒ **proposed by the agent, committed
  by the human** (self-modification prohibition).

## Recommendation

**Adopt Option A, staged: ship B4a first, gate B4b behind its own review.**

- Reuse `nuc-ops-bot`'s gateway + allowlist + buttons and `nuc-monitor`'s outbound webhook (platform `/code-reuse` +
  "extend, don't rebuild") — **not** a new service (rules out B). The approval is an RS256-signed, gate-scoped,
  single-use, 15-min token written to a dedicated private gates repo the worker pulls read-only.
- **Why not B:** same outcome, but a new public endpoint that must stay un-Authentik'd (invariant-#8 trap) + a new
  service = more surface and ops for no benefit when the gateway bot already receives interactions.
- **Why not C:** it's the declined baseline; doesn't meet the goal (kept only as the safe fallback).
- **Why staged:** B4a gives remote control with **zero** change to the deterministic gate — most of the value, almost
  none of the risk. B4b (the part that lets the gate honor a token) is the genuinely dangerous bit; it gets its own
  proposal + human-committed hook change after B4a is lived-in. Don't put crypto in the sole gate on day one.

## Pre-mortem — REQUIRED: ≥2 failure modes

- **If `nuc-ops-bot` is an HTTP-Interactions bot (not gateway)** — reuse still holds, but the endpoint must remain
  **un-Authentik'd** (Discord is a machine caller; invariant #8). A future "protect everything" reflex that forward-auths
  it makes Discord unreachable and approvals **silently fail**. Mitigation: record the carve-out in `auth-apps.md`; add a
  liveness check.
- **If the RS256 private key on the NUC leaks** — an attacker could forge an *approval*. Blast radius is bounded **by
  design**: a forged approval can at most release a **T3** step (open a PR on a non-main branch); **T4 stays
  hard-blocked regardless of any token**, so prod/main/deploy are never reachable. Mitigation: key rotation + write-token
  scoped to the one gates repo + the worker never holds the private key.
- **If the worker clock is skewed**, `exp` checks misfire. Mitigation: treat **jti single-use + gate_id binding** as the
  primary controls; `exp` is defense-in-depth, not the only guard.
- **If a stale `gates/<id>.json` lingers**, it could be re-read. Mitigation: delete-after-consume + worker-side consumed-`jti` list + strict `token.gate_id == current_gate_id` assertion.
- **If B4b's token-verification in the hook has a bug**, the SOLE gate is compromised. Mitigation: B4b ships only after a
  dedicated review; the verifier is fail-closed (any parse/verify error ⇒ block) and covered by the same exhaustive
  test-table style as the 28/28 autonomy-gate suite.

## Counter-case

The two-way channel adds a standing signing keypair, a gates repo, three scoped credentials, and (for B4b) crypto inside
the one deterministic gate — real, permanent complexity — to buy a convenience (unattended gate release) that **Option C
delivers ~80% of at zero new attack surface**; if genuinely-unattended windows turn out to be rare, B4a-without-B4b (or
even C) may be the better long-run trade.

## Decision (human) — ACCEPTED 2026-06-14

**accepted, full scope (B4a + B4b).** The supervisor opted for the complete two-way capability up front, not staged.
B4b's edit to `autonomy-gate.mjs` is still **agent-proposes / human-commits** (self-modification prohibition stands —
the agent writes the verifier + test table in a supervised session; the human reviews and commits the hook).

Open questions, resolved / outstanding:

- `nuc-ops-bot` type → **gateway bot (websocket)**. ⇒ **No public Discord endpoint** is involved (no HTTP-Interactions
  URL), so the invariant-#8 un-Authentik'd-endpoint carve-out does **not** apply. The bot receives the button click over
  its existing gateway connection. Simplest shape of Option A.
- Gates repo location → **still to confirm** (default proposed: a new private `thiengthb/nuc-agent-gates`; the worker
  gets a read-only deploy key, the bot a write-scoped token). Non-blocking for the control-plane-side build (use a
  throwaway local test repo + test keypair first).
- Scope → **full (B4a+B4b)**, not staged.

This proposal now drives step **B4** of `2026-06-14-autonomous-agent.md` (split into B4a/B4b there).
