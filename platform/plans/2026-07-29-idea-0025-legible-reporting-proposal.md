---
title: Proposal — make the agent's reporting legible by construction, after the research refuted the way this idea proposed to do it
kind: system-change # edits .claude/hooks/** + CLAUDE.md → propose-only, a human installs
status: draft # draft → accepted → rejected | superseded
created: 2026-07-29
related:
  [
    platform/registries/idea-queue.md (idea-0025 — top-1 active, rank 3.53, raised by the supervisor himself),
    .claude/memory/legible-proposals-plain-language.md (the rule that already existed and was violated),
    .claude/memory/enforce-rules-with-gates.md (the escalation order this follows),
    .claude/hooks/suggest-session-wrap.mjs (the Stop hook this would sit beside — precedent for transcript reading),
    platform/ledger/2026-07.md#2026-07-29-test-for-understanding-not-for-approval (the lesson that produced this idea),
  ]
---

## In one paragraph, before any of the detail

On 2026-07-29 the supervisor approved eleven-plus recommendations in a row and then said he did not really understand
what he had been agreeing to. The rule against that already existed, in two places, and was broken repeatedly in the
very session that produced it. This proposal is about what to do when a written rule has already failed — and the
research says something uncomfortable and specific: **I cannot fix this by trying harder, because the bias in play
survives being warned about it.** So the fix has to be structural. The recommendation is a small deterministic check on
two moments — the question I ask at a gate, and the last message of a turn — that flags one enumerable defect only:
an internal term used without a plain-language gloss. It does **not** try to score my writing for clarity, because the
plain-language field abandoned that approach forty years ago and the evidence says it does not measure comprehension.

## Problem

The failure is documented and dated, not inferred. `platform/ledger/2026-07.md` (2026-07-29): eleven-plus accepts in one
session, followed by *"tôi vẫn chưa hiểu mình đang làm gì lắm"*. The supervisor is the oracle in propose-don't-execute —
every governance control on this platform assumes he can actually judge what he is approving. An approval he cannot
explain back is not supervision; it is a signature.

**What makes this a design problem rather than a knowledge problem:** the rule was already written. `CLAUDE.md`
§"Legible decision surface" mandates plain language first and a flagged recommendation; the memory file
`legible-proposals-plain-language.md` has said the same since 2026-06-16. Both were violated *by the author of both*,
in the session that produced the complaint. The platform's own escalation order for exactly this case
(`enforce-rules-with-gates`) is: **restructure so compliance is easiest → measure → gate only if prose lost.** Prose lost.

**And the failure signal is silence.** He does not object to jargon; he agrees and quietly stops following. So there is
no natural feedback loop — which is precisely the condition under which an unmeasured convention decays without anyone
noticing.

## Prior art & sources — and the first one refutes this idea's own plan

- [Curse of knowledge / expert blind spot](https://learnnovators.com/blog/the-curse-of-knowledge-why-experts-struggle-to-teach/)
  (term coined by Camerer, Loewenstein & Weber, 1989) — an expert's fluency with a topic is misread by their own brain as
  evidence the topic is simple ("fluency illusion"), and experts **consistently overestimate how well novices understood
  them**. The decisive detail: *even when explicitly warned about the bias, they still cannot gauge it.* **What we learn:**
  every control of the form "remember to be clearer" or "check yourself before sending" is structurally guaranteed to
  fail here, including the two that already exist. **What to avoid:** treating another, better-worded memory line as a fix.

- [AHRQ — Use the Teach-Back Method (Tool 5)](https://www.ahrq.gov/health-literacy/improve/precautions/tool5.html) ·
  [IHS Health Literacy — Teach Back](https://www.ihs.gov/healthcommunications/health-literacy/teach-back/) — asking *"do
  you understand?"* reliably produces false yeses, because people say yes when they only think they understand or are
  embarrassed to say otherwise. The only dependable check is asking them to **restate it in their own words**, and it is
  framed explicitly as *a check on how the explainer explained*, not a test of the listener. **What we learn:** the
  supervisor's eleven silent accepts are the textbook presentation, not a personal failing, and the countermeasure is a
  restatement moment — not more explanation. **What to avoid:** turning it into a quiz; the framing must stay "did I
  explain this well".

- [Readability formulas: limitations](https://www.researchgate.net/publication/220517614_Readability_formulas_have_even_more_limitations_than_Klare_discusses)
  — Flesch-Kincaid and its relatives were built for children's schoolbooks, ignore reader background, and **emphasise
  countable features at the expense of what actually drives comprehension**. The American plain-language movement
  abandoned formula-scoring in the late 1970s in favour of usability testing. **What we learn — and this contradicts
  idea-0025's own scope-guess (a):** a hook that scores my messages for length or reading level would measure something
  real and irrelevant. **What to avoid:** exactly the thing this idea proposed, which is why it is written here.

- [NN/g — Progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/) (Nielsen, 1995) — show the
  few most important options first; defer the rest to a place the user can ask for. **What we learn:** the
  three-sentences-in-chat / detail-in-files shape adopted as a stopgap on 2026-07-29 is not an improvisation — it is this
  pattern, and it has a defensible design rule behind it. **What to avoid:** deferring so much that the detail becomes
  undiscoverable; progressive disclosure requires the second layer to be *findable*, which here means naming the file.

- [Microsoft — Guidelines for Human-AI Interaction (HAX Toolkit)](https://www.microsoft.com/en-us/haxtoolkit/ai-guidelines/)
  — 18 guidelines, grouped by **when** they apply: initially, during interaction, when the system is wrong, over time.
  **What we learn:** legibility is not one global setting. The control at an irreversible gate should differ from the
  control on an ordinary status line. **What to avoid:** a single blanket rule applied to every message, which is how a
  control becomes noise and gets switched off.

## What the research changes about this idea

| The idea's guess (2026-07-29) | After research |
| --- | --- |
| (a) A Stop-hook flagging a report over N lines or containing jargon | **Half dead.** Length/reading-level scoring is refuted. A **closed-vocabulary jargon check** survives — that is a lint for an enumerable defect, not a readability score |
| (b) A glossary the agent links on first use per session | **Survives, as the fix rather than the check.** This is the *restructure* step: a gloss is what makes the jargon check trivially satisfiable |
| (c) Maybe the real fix is cutting process surface | **Still live, still the strongest counter-case.** Kept as Option D and in §Counter-case — not folded away |
| (implicit) Better self-discipline | **Refuted outright.** The bias survives being warned about |

## Options considered

| | Option | Benefit | Cost / drawback |
| --- | --- | --- | --- |
| **A** | **One jargon lint at two moments: the `AskUserQuestion` call (a gate) and the last message of a turn (a report)** *(khuyến nghị)* | Deterministic, cheap, and checks a defect that genuinely can be checked. Hits the two moments the research says matter most (a decision point, and the summary he actually reads). Also finally **enforces the `(khuyến nghị)` rule `CLAUDE.md` already mandates and I violated**. Rides an existing hook shape — `suggest-session-wrap.mjs` already reads the transcript at `Stop` | Catches un-glossed terms, **not confusion**. A perfectly jargon-free report can still be incomprehensible. The term list is reactive: a word gets on it after it has already confused someone once |
| B | A readability score on every reply (length, grade level, sentence complexity) | Fully automatic, no list to maintain | **Refuted by the sources.** Measures countable features that do not track comprehension; fires every turn, so it becomes noise and gets disabled — the platform's own stated failure mode for gates |
| C | A teach-back ritual: at each wrap, ask him to restate in his own words what changed | Strongest evidence base of anything here; directly targets the false-yes | It is a **convention**, and a convention is exactly what just failed. Also spends his attention every session, on the person who already said the process costs too much attention |
| D | Cut process surface instead of explaining it better — audit how many distinct artifacts/registries/gates one session asks him to hold, and delete the weakest | Attacks the root cause. Consistent with `/idea`'s own scope-discipline clause and with `practice-first-lean-ceremony` | Large, vague, and the machinery in question is what produced today's wins (the release gate, the ledger). Cutting on a hunch risks deleting the good half. **Deserves its own idea, not a fold into this one** |

## Recommendation

**Option A (khuyến nghị).** In plain language: **when I use one of my own internal words without explaining it, something
should notice — instead of relying on me to notice, which the research says I cannot do.**

It is two small checks sharing one word list:

1. **At a gate** (`PreToolUse` on `AskUserQuestion`) — the question and options must carry exactly one `(khuyến nghị)`
   mark, every option must have a non-empty description, and no internal term may appear un-glossed. This is the moment
   his yes/no has consequences, and it is currently the least protected.
2. **At the end of a turn** (`Stop`, beside the existing wrap nudge) — the final assistant message is scanned for the
   same terms. Warn only; never block, never rewrite.

Both are **advisory except the `(khuyến nghị)` rule**, which is already mandatory in `CLAUDE.md` and simply has no
enforcement today.

The seed word list comes from the actual failure — the terms used on him on 2026-07-29 without explanation: `RICE`,
`WIP cap`, `exploration floor`, `wildcard`, `T1`–`T4`, `P1`–`P3`, `propose-don't-execute`, `tier-2`, `MoSCoW`, `oracle`,
`Reflexion`, `pre-mortem`, `mutation testing`, `thin slice`, `backflow`, `quarantine`, `shingle`. A term counts as
glossed if a plain-language phrase appears within the same sentence, or the message links the glossary.

**Why not the others, in one line each:** B measures the wrong thing and the sources say so; C repeats the mechanism
that just failed; D is probably right about the root cause but is a different, larger question — it should be raised as
its own idea rather than smuggled in here.

> **Acceptance bar:** a gate question containing an un-glossed seed term produces a visible warning, a compliant one is
> silent, and the check is demonstrated able to fail before it is trusted. Full Given/When/Then criteria belong in the
> resulting `/project-plan`, not here.

## Pre-mortem

- **It becomes noise and I switch it off.** The platform's own autonomy contract names this: *"a gate that obstructs gets
  switched off"*. *Mitigation:* warn-only, one line, and the seed list is deliberately small and specific rather than
  every technical word. If it fires more than about once a session, the list is wrong and should shrink, not the rule.
- **Whack-a-mole: the next confusing word is not on the list.** Genuinely unsolved. *Mitigation:* the list grows from
  real events only — when he says he does not follow something, that term is added in the same turn. This makes the
  control reactive by design, and that limit is stated rather than hidden.
- **It creates the appearance of legibility without the substance.** A report can pass the lint and still be
  incomprehensible; worse, passing might make me stop asking whether it was clear. *Mitigation:* keep exactly one
  teach-back moment from Option C — at an **irreversible** gate only, phrased as a check on my explanation. Not every
  session; not every gate.
- **The `Stop` hook slows every turn.** *Mitigation:* a regex pass over one message. If it is not sub-10ms, it does not ship.

## Counter-case

**The strongest argument against all of this: the thing that actually worked on 2026-07-29 was not a hook — it was
deleting words.** He asked for three-sentence reports, got them, and immediately said it was better. That fix cost
nothing, needed no code, and is already in force. Building a lint on top of it may be adding a fourth mechanism to a
platform whose diagnosed disease is *"too much machinery per unit of shipped value"* — and the person it is meant to
serve is the same person who said the process already costs too much attention.

The honest reply is that the three-sentence shape is a convention, and this document's whole premise is that conventions
here decay silently. But if you judge that this one will hold because *you* chose it and *you* will notice its absence —
that is a defensible reason to reject this proposal, and it is cheaper than accepting it. **Rejecting on those grounds
is a real option, not a polite one.**

## Decision (human) — the human-accept gate

**This is the human-accept step of `/idea` → proposal → `/project-plan`.** In plain terms: saying yes means I turn this
into a build plan and write the check; saying no means idea-0025 is closed with your reason recorded, and the reason
biases my future proposals away from this shape. Silence is not a yes.

- **Accept** ⇒ becomes a `/project-plan` build. The hook is written, tested, and left as a `.proposed` file — installing
  anything under `.claude/hooks/` is your commit, not mine.
- **Accept, narrowed** ⇒ e.g. gate-only (drop the `Stop` half), which is the smaller and safer half.
- **Reject** ⇒ recorded with the reason; the three-sentence convention stands on its own.
- **Also worth your call, separately:** should Option D — *cut process surface rather than explain it better* — be raised
  as its own idea? I think yes, and I think it may matter more than this one.

- **Decision:**
- **Date / by:**
- **Why:**
