---
name: legible-proposals-plain-language
description: "When proposing/deciding, flag the recommended option explicitly, name the skill/process behind any approve gate, and explain in plain everyday language"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b3e55123-14d7-4f5b-8542-6a81cf4c4eb2
  modified: 2026-07-29T16:36:45.959Z
---

**The principle this all comes from, stated by the user 2026-07-29:** *I am working with a HUMAN, so reporting and
explaining process must be shaped for the easiest possible human understanding.* Not "accurate and complete" — accurate,
complete AND understandable, with understandable as the binding constraint. Everything below is that principle applied;
when a new situation isn't covered by the rules, derive from the principle, don't default to thoroughness.

When I surface a decision to the user, three things are mandatory:

1. **Flag the recommendation explicitly.** On every option list (in chat AND in proposal docs), mark the one I
   recommend with `(khuyến nghị)` / `(recommended)` so the user instantly sees my pick — don't make them infer it
   from prose.
2. **Name the skill and the process behind any approve/accept gate.** When I ask the user to approve/accept
   something, state which skill it belongs to and which step of which workflow it is — e.g. "đây là bước *human-accept*
   của quy trình propose-don't-execute (`/idea` → proposal → `/project-plan`)". The user must know what gate they're
   standing at and what their yes/no does next.
3. **Explain in plain, everyday language.** My chat explanations have been too technical — the user couldn't follow
   the flow. Lead with the plain-language "what this means / what happens next", keep jargon (RICE, MemGPT, T1–T4) as
   a labelled aside, not the main thread.

4. **Default report shape = THREE things, chosen by the user 2026-07-29 after a session he stopped being able to
   follow:** (a) what I did, in plain Vietnamese, (b) what he needs to decide, if anything, (c) what's next. Technical
   detail goes into the files (`decisions.md`, the plan, the ledger) where whoever needs it can read it — **not into
   chat**. Go deep only when he asks. Long, layered reports were costing more attention than they returned.

**Why:** the user is the supervisor/oracle in propose-don't-execute. If they can't tell what I recommend, which gate
they're at, or what the flow is in plain terms, they can't actually supervise — the governance is theatre. Legibility
of the decision surface IS the control surface.

**The tell, and it is quiet (2026-07-29).** He will NOT push back on jargon. He kept approving — 11+ accepts in one
session — and then said *"tôi vẫn chưa hiểu mình đang làm gì lắm"*. Silent, agreeable drift is the failure signal, not
an objection. So the check is on me, per turn: if a report can't be said in three plain sentences, it is too long,
regardless of whether he complained. Rubber-stamped approval is worse than a rejection, because it looks like
supervision and isn't.

**It is now ENFORCED, not remembered (2026-07-29).** `.claude/hooks/legibility-lint.mjs` runs at two moments and the
supervisor installed it himself. Do not treat the rules above as advice to recall — they are checked:

- **A gate question with no `(khuyến nghị)` is BLOCKED** (exit 2, the question never reaches him). One mark exactly;
  opting out needs `(no-recommendation: <reason ≥15 chars>)` in the question.
- **The last message of a turn is scanned** for internal terms used without a plain gloss in the same breath (each term
  is flagged on first use per session), for naming the agent's own filing — the paths where records get written, which he
  never opens — and for naming **more than 4** artefacts in one message.
- **Why a hook and not a better-worded rule:** this file said the right thing since 2026-06-16 and was broken by its own
  author in the session that produced the complaint. The curse-of-knowledge literature is why: experts read their own
  fluency as the topic being simple, and **the bias survives being warned about it**, so no self-check can catch it.
- **The rule the classification produced:** name an artefact only if he must **type it, open it, or decide about it**.
  Of 31 names in one real session, 17 were neither — 10 filing paths and 7 skill names cited only to justify my
  reasoning. Say "đã ghi lại" and let the file hold the detail.
- **Open follow-up:** on 2026-07-29 these checks fired on 25–37% of historical reports. If that has not collapsed by
  ~2026-08-05, the warnings have become wallpaper and the design — not the rate — is what needs revisiting.

**How to apply:** every proposal/option block → `(khuyến nghị)` on my pick + one plain-language sentence on why; every
"bạn duyệt nhé?" → name the skill + the workflow step it gates; explain flow conversationally first, technical terms
second. Relates to [[research-before-design]] (the proposal must be grounded) and [[sandbox-propose-governance]] (human
installs; so the human must understand). See also [[user-profile]] — values honest pushback + system-level clarity.
