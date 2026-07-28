---
title: MCP platform server — one-way delivery of skills/rules to other machines, with filtered lesson backflow
kind: system-change
status: draft
created: 2026-07-28
---

<!--
  Research-grounded proposal (brainstorm → proposal → /project-plan). Propose-don't-execute:
  this is queued for the supervisor's accept; it never self-enters the build pipeline.
  Contract: platform/09-autonomy-contract.md · CLAUDE.md §"Autonomous agent".
-->

## Problem

Three external facts, all dated today, converge on the same gap:

1. **The platform can no longer assume one machine.** `INVENTORY §0` NUC STATUS is 🔴 down since 2026-07-22, and
   CLAUDE.md was restructured today into a machine-agnostic *agent OS* + a per-target *deployment* layer. The agent OS
   currently reaches another machine only by cloning this whole repo.
2. **The agent OS is now the platform's most valuable artifact, and it is all-or-nothing to share.** 37 skills, 10 hooks,
   `.claude/rules/frontend.md`, the UI standard. Today the only distribution mechanism is "copy the folder", which
   exposes everything to anyone who needs anything.
3. **Nothing flows back.** Every project outside this repo generates real operational experience that dies where it
   happened. `06-knowledge-ledger.md` only ever learns from sessions run *inside* this repo. The queue's own header
   already names the failure: *"every improvement this platform has made was justified by argument, never by
   measurement"* — a backflow channel is the cheapest source of non-argument evidence available.

A fourth fact is the honest counterweight and belongs in the problem statement: **today's T1 harness review missed Agent
Teams**, which shipped in v2.1.178 — inside the reviewed range. The lesson is not "review harder"; it is that this
platform keeps building *beside* the harness instead of *on* it. Any answer here must be a native mechanism, not a
home-grown one.

## Prior art & sources — ≥2 external URLs (research BEFORE designing)

- [Claude Code — MCP reference](https://code.claude.com/docs/en/mcp) — verified mechanisms: remote `type: "http"` servers
  configured in a project-scope `.mcp.json` with `${VAR}` expansion in `headers`; OAuth via `/mcp`; `list_changed`
  notifications let a server change its own tool set live; project-scoped servers require explicit approval and are held
  at `⏸ Pending approval` in an untrusted folder. **Reuse:** the whole transport. **Avoid:** assuming a client auto-trusts
  a committed `.mcp.json` — it does not.
- [Claude Code — plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces) — `.claude-plugin/marketplace.json`
  + consumer-side `extraKnownMarketplaces` / `enabledPlugins`; private repos work via git credential helper or SSH.
  **Reuse:** this is the *only* way to ship hooks, which are local executables. **Avoid:** treating it as confidentiality —
  installed plugins sit readable on the consumer's disk at `~/.claude/plugins/`.
- [Claude Code — agent teams](https://code.claude.com/docs/en/agent-teams) — teammates load *"CLAUDE.md, MCP servers, and
  skills"* the same as a regular session. **Consequence for this design:** an MCP-delivered rule set reaches every
  teammate automatically, whereas the lead's conversation does not. That makes MCP the *better* fit for multi-agent work,
  not merely an equal one.
- [Claude Code — security / prompt injection](https://code.claude.com/docs/en/security) + the MCP page's own warning
  (*"Verify you trust each server before connecting it"*) — **this cuts against us**: our server is the third party from
  the consumer's point of view, and our backflow channel makes *us* the consumer of untrusted input. Design must be
  symmetric about this.
- [Oasis — virtual office for humans and agents](https://joinoasis.com/) — the reference platform the supervisor raised.
  **What we learn:** its actual bet is shared long-lived memory + an approval surface, not orchestration. **What to
  avoid:** its room/chat-centric model — for software work, git is the shared substrate and a transcript is a cache.

**In-repo prior art (binding):** `08-SHARED-ASSETS.md` row 1 flags the MCP self-issued OAuth shim as
*"DUPLICATED — extract candidate (built 2×; extract at 3rd app)"*, and `idea-0013` is deferred with
`revisit_when: any 3rd app adds an MCP server`. **This server is that third app** — the trigger has fired.

## The design idea that makes this worth doing: three tiers of exposure

The naive shape (`get_skill(name)` → returns the skill text) is only "a private repo with extra steps": ~20 calls
enumerate everything. The useful reframe:

> **Don't ship the rulebook, ship the verdict.**

| Tier | Tool shape | Does the rule text leave the server? |
| --- | --- | --- |
| 1 — transmit the rule | `get_convention("react")` → rule text | Yes. Client can read and keep it |
| 2 — transmit the verdict | `review_component(code)` → *"line 12: emoji used as icon; must be lucide"* | **No.** Server evaluates; only violations travel |
| 3 — transmit the result | `generate_component(spec)` → conforming code | No. But we pay the tokens and add latency |

The dividing line, stated as a falsifiable rule:

> **A rule that shapes generation must be transmitted (tier 1). A rule that only verifies output need not be (tier 2).**

Estimated ~60–70% of the current rulebook is verification-shaped — **and that estimate is the single biggest unverified
assumption in this proposal.** See Step 0 and the Pre-mortem.

## Options considered — ≥2, with tradeoffs

| Option | Benefit | Drawback / cost |
| --- | --- | --- |
| **A — Hybrid: MCP for skills/rules (tiered), private plugin for hooks** *(khuyến nghị)* | Core know-how never lands on a client disk; revocable per token; every request logged; server-side `instructions` push updates with zero change to the client repo; teammates inherit it automatically; backflow rides the same channel | Needs a hosted service (new `target`), an availability dependency, and OAuth glue — which forces `idea-0013` first. Offline = no rules |
| B — Private plugin marketplace only | Simplest; works offline; ships hooks natively; no server to run or pay for | Full copy on every consumer disk, permanent and unrevocable — directly contradicts the supervisor's stated requirement. No backflow channel exists at all |
| C — MCP at tier 1 only (`get_rules`) | Much less build work than A; still nothing written to disk; still revocable and logged | Enumerable in ~20 calls, so the confidentiality benefit is largely theatre. Cannot ship hooks |
| D — Status quo (copy CLAUDE.md by hand per project) | Zero build cost | Already failing: drift is unmanaged, nothing flows back, and it exposes more than B does |

## Recommendation

**Option A (khuyến nghị).** In plain language: *the parts of the rulebook that can be checked after the fact stay on my
server and only ever send back a verdict; the parts that must guide Claude while it writes are sent, but only the slice
asked for, only to a key I can revoke, and every request is logged.* Hooks go by plugin because they are executables and
there is no other mechanism.

Why not the others: **B** fails the stated requirement outright (permanent unrevocable copy). **C** keeps the cost of a
server while giving up most of the benefit. **D** is the current state and is measurably drifting.

**Thin-slice first (this is what acceptance would authorize, not the full build):**

- **Step 0 — the kill-switch measurement, before any code.** Classify the existing rulebook into *generation-shaping*
  vs *verification-shaped*. **Pre-committed consequence: if under 40% is verification-shaped, Option A collapses into
  Option C and this proposal should be rejected, not rescoped.** Writing that down now is what stops a null result being
  explained away later (`/behavioural-eval` §1).
- **Step 1 — one tier-2 tool end-to-end**: `review_component(code)` returning real violations from the frontend rules,
  plus a server-supplied `instructions` block, consumed from a scratch project on this machine. Build → run → observe
  before any governance or docs work.
- **Step 2 — backflow, quarantine-only**: `report_lesson()` writing to an inbox nobody reads automatically.
- Steps 3+ (auth hardening, hosting, the rest of the rulebook) are scoped in the plan, not here.

> **Acceptance bar (chosen option):** a second project on this machine, holding only a 6-line `.mcp.json`, receives a
> real frontend-rule violation from the server, with the rule text never appearing on that project's disk or in its
> transcript — and one lesson reported from it lands in quarantine and is *not* readable by any subsequent session until
> a human promotes it.

**Two consequences the supervisor must decide, because they change other files:**

1. **`idea-0013` (extract `@thiengthb/mcp-auth`) becomes a prerequisite,** not a nice-to-have. Its deferral reason was
   *"only 2 stable consumers"*; this is the third. Building a third copy of security-sensitive OAuth glue would violate
   `/code-reuse` on the very change that is supposed to demonstrate reuse.
2. **`INVENTORY §0` needs a fourth `target` value — `cloud`.** The enum is `nuc | local | none`; this service must be
   reachable from other machines while the NUC is down, so it is neither. Invariants B (NUC-only) do not apply to it and
   Invariants C (local) do not either — a `cloud` target needs its own short invariant set.

## Pre-mortem — ≥2 failure modes

- **If the 60–70% verification-shaped estimate is wrong**, the tier-2 layer covers a small minority of the rulebook,
  nearly everything still has to be transmitted, and we have built a server to deliver what a private plugin delivers
  offline and for free. *Mitigated by making Step 0 a kill-switch with a pre-committed threshold rather than a
  formality.*
- **If the backflow inbox is ever read into a skill, rule, or CLAUDE.md**, a remote agent gains write access to the
  instructions of every future session on this platform — persistent prompt injection, and precisely the CVE-2025-53773
  class that `09-autonomy-contract.md` already forbids. *Mitigated only by a hard gate, never by discipline: the
  quarantine path must be in `autonomy-gate.mjs`'s governance list, and the promotion must be a human commit.*
- **If the server is down or the network is unavailable**, every consuming project loses its rules at once — a single
  point of failure the current copy-based model does not have. *Needs an explicit degraded mode decided in the plan
  (fail-open with a warning vs fail-closed), which is a real design decision and not obvious in either direction.*
- **If "confidentiality" is oversold**, the whole premise weakens: anything delivered at tier 1 lands in the consumer's
  transcript at `~/.claude/projects/*.jsonl` and is recoverable. The honest claim is *metered, revocable, logged access* —
  not secrecy. If the supervisor's requirement is genuinely secrecy, only tier 2/3 satisfies it, and Step 0 decides how
  much of the rulebook can live there.

## Counter-case

The strongest argument against: this platform has already spent ~6 sessions building an orchestration layer beside the
harness that the harness then shipped natively — and a bespoke rule-delivery service is the same silhouette, one release
away from being obsoleted by whatever Anthropic ships for plugin-hosted skills. **The RICE base here (1.35) ranks it
below `idea-0015` (5.23), and that is not a scoring artifact to be argued away — it is the model correctly reporting
that this is a large, speculative effort.** The counter-argument is that a plugin marketplace is *already* the native
answer to distribution and Option A only adds a server for the confidentiality requirement, so if the supervisor's real
priority is "reach every machine" rather than "don't expose the core", **Option B is the correct, much cheaper answer**
and this proposal should be rejected in its favour.

## Decision (human) — the human-accept gate

Filled by the supervisor ONLY. **accept ⇒ becomes a `/project-plan` build (starting at Step 0's measurement) ·
reject (reason) · deferred (until …)**. The agent's job ends at present + wait.

- **Decision:**
- **Date / by:**
- **Why:**
