# 13 — Model routing, parallel execution & web-research discipline

> Moved out of `CLAUDE.md` on 2026-07-28 to keep the always-loaded file under its 200-line budget. `CLAUDE.md` keeps the
> **decision rules** (the part that must fire without being read on purpose); this file keeps the **reference tables and
> rationale** (the part you look up once, when actually staffing work or planning research).
>
> Honest note on the trade-off: anything moved here is a rule that may not be read. That is acceptable *only* because
> the decision itself is one line in `CLAUDE.md` and this file is the lookup — if you find yourself needing this file to
> know *whether* a rule applies, the split was wrong and the line belongs back in `CLAUDE.md`.

**Targets the *right* amount, never the *minimum*** — never trade away the reasoning depth the task needs; only cut
wasted context + over-powered staffing on mechanical work.

---

## 1. Model routing — staff work by weight

Model choice is **session-level**, not per-task (switching mid-session re-reads full history + drops the prompt cache =
*costs* tokens; the agent can't switch itself anyway — only the user can).

- **`/model` gotcha:** **Enter = persists to global `~/.claude/settings.json`** (new default for ALL sessions); press
  **`s`** to switch THIS session only.
- **Session rubric (set once):** architectural / security / multi-file / ambiguous / UI-craft / a strong-model-shaped
  codebase → **Opus** (lean Opus when unsure — weak-model contamination is asymmetric). A whole session of
  well-specified bulk-mechanical work → Sonnet.
- **The real token lever (no quality tradeoff):** Opus = main loop (orchestrator + reviewer); delegate
  heavy-but-mechanical work (wide reads, fan-out search, bulk transforms, migrations) to **cheaper-model subagents**
  (Agent tool per-agent `model: 'sonnet'|'haiku'`). Their context is isolated (the real saving) and Opus reviews before
  accepting. Don't flip `CLAUDE_CODE_SUBAGENT_MODEL` globally (cross-session side-effect).
- **Announce every downgrade (notify, don't gate):** before spawning a subagent weaker than the main loop, state it up
  front — one line each `label: 2–3-word task → model` (e.g. `Explore: grep auth usages → haiku`). Same-model subagents
  get no line. This is the user's control surface over staffing.
- **Suggest a session switch** only when the WHOLE session is mismatched — once, and tell them to use **`s`**
  (session-only).

### 1.1 When NOT to delegate

A subagent starts cold and re-derives context the main loop already holds. For internal investigation where the main
loop already has the context, work directly (Read/Grep/Bash) — fanning out costs more than it saves. Delegate when the
work is **wide** (many files/URLs), **mechanical** (a known transform), or **context-polluting** (raw pages, huge logs
that must die in an isolated context).

### 1.2 Verified safe to staff cheaply (add to this list as it is proven, not as it is guessed)

| Task | Model used | Outcome |
|---|---|---|
| WebSearch scout — titles + snippets + URLs, **no fetch** (2026-07-28, ~9 queries → 40 results) | haiku | good coverage; the main loop still chose the URLs |
| Fetch one greenlit URL → 3–8-line distilled extract + cite (2026-07-28, 5 URLs) | sonnet | worked; **caveat** — arXiv `/pdf/` often fails to extract and the agent must say the extraction was partial rather than pass abstract-level claims off as full-text |
| Read N similar files and emit one structured line each (2026-07-28: 37 `SKILL.md` → name/purpose/trigger/substrate-glob) | sonnet | good structure, but **the judgement inside it needs review**: one glob was wrong (`api-integration-specialist` scored dead on an inbound-webhook path when the skill is about outbound clients). Delegate the reading; verify the conclusions. |

**The counter-example from the same session:** the 203-row ledger transform was *not* delegated — it went to a
deterministic script instead. When a bulk transform can be expressed exactly, a script beats any model: it is free,
repeatable, reviewable as a diff, and cannot paraphrase the content it is moving.

---

## 2. Web research — the biggest token sink

A WebFetch dumps a whole page (~5–50k tokens) into context; fan-out × pages × Opus-rate × refetch is how "30 min of
research = a whole session". **Default to the cheapest tier; escalate only when a tier proves insufficient, and say so
before escalating.**

### 2.1 The four rules

1. **Search wide, fetch narrow.** WebSearch snippets are cheap and usually answer the question. NEVER WebFetch a page
   unless a snippet is *both* load-bearing for the conclusion *and* insufficient on its own. Most facts come from
   snippets.
2. **Distill at the edge, synthesize at the center.** A fetch subagent's raw page MUST die in its isolated context — it
   returns ONLY `claim + 1–2-sentence extract + URL`, never the page or long quotes. That way page-tokens are paid once,
   at cheap-model rate, and never re-billed into the main Opus thread every subsequent turn.
3. **Model by job.** Mechanical web work → cheap model; judgment → Opus main loop.
4. **Hard caps + dedup.** Main loop owns the fetched-URL set, assigns disjoint sources, never refetches.

### 2.2 Model by job

| Research task | Model |
|---|---|
| Plan questions, assign disjoint sources, set the page budget, synthesize the cited report, resolve contradictions | **Opus (main loop)** |
| Scout: WebSearch only → titles+snippets+URLs, **no fetch** | **Haiku** |
| Fetch one greenlit URL → 3–8-line extract + cite (raw page dies here) | **Sonnet** (Haiku if trivial) |
| Adversarially verify ONE load-bearing claim, 1 pass | **Sonnet** |

### 2.3 The three tiers

| Tier | When | Budget |
|---|---|---|
| **Quick lookup** | DEFAULT for any unqualified "research X" | main loop self-runs 1–2 WebSearch; fetches ≤2 pages only when a snippet is load-bearing **and** insufficient. **No subagent fan-out.** Most "research" is really this. |
| **Standard** | escalate when Quick falls short | 1 Haiku scout → Opus picks ≤5 URLs → Sonnet fetch+distill (disjoint) → Opus synthesize. **≤5 pages, ≤1 verify pass.** |
| **Deep** | ONLY on an explicit "deep/kỹ/thorough" ask | ≤2 scouts, ≤12 pages, dedup URLs, verify only load-bearing claims. The only tier allowed near the old cost — never the silent default. |

### 2.4 Failure modes seen in practice

- **PDF fetches often fail to extract** (arXiv `/pdf/` returns compressed streams). Fall back to the `/abs/` HTML page
  and say the extraction was partial rather than reporting abstract-level claims as if they came from the full text.
- **A scout that fetches** silently converts a Quick lookup into a Deep one. Say "WebSearch ONLY, do not WebFetch" in the
  scout prompt, explicitly.
- **Re-fetching a URL another subagent already read** is pure waste and invisible unless the main loop keeps the set.

---

## 3. Parallel & asynchronous execution — use the harness, do not build one

Added 2026-07-28, the same day the home-grown auto-pilot was retired. **That is not a coincidence and it is the whole
point of this section:** the platform spent ~6 sessions building a scheduler and a control plane that the harness then
shipped natively. Everything below is native. Before writing any orchestration code, re-read that sentence.

### 3.1 The four shapes, and which mechanism each one wants

| Shape | Use | Why not the others |
|---|---|---|
| **Fan-out read** — search/scan many files or URLs, keep the answer, discard the material | subagents (`Agent`), one per disjoint slice, cheap model | Their context is isolated, so the raw material never enters — and never re-enters — the main thread. This is the real saving, not the model price. |
| **Parallel edit** — two or more changes that touch the same tree and must not collide | one agent per **git worktree** (`isolation: "worktree"`) | Same-tree parallel edits corrupt each other silently. A worktree is a real checkout: conflicts surface as merges, not as lost work. |
| **Long-running** — a build, a test suite, a deploy, a watch | run it in the **background** and get called back on exit | Blocking the loop on a 10-minute build wastes the loop. Poll only what the harness cannot notify you about. |
| **Recurring** — nightly triage, a weekly audit | `/schedule` (scheduled cloud agent) or a cron routine | This is exactly what auto-pilot was. It is now one call. |

### 3.2 Rules

1. **Parallel only when the work is genuinely independent.** Two agents on overlapping files is not twice the speed, it
   is a merge conflict plus two half-finished stories. If they must coordinate, they are one task.
2. **One writer per file, always.** Fan-out is for reading. When several agents must produce edits, give each its own
   worktree and merge deliberately — never let two write the same working tree.
3. **The main loop owns the shared state** — the URL set, the task list, the plan file, the decision. Subagents return
   findings; they do not update the roadmap.
4. **Do not poll what the harness will tell you.** For work the harness tracks, you are re-invoked on completion; a
   short polling loop is pure waste. Poll only genuinely external state (a CI run, a remote queue), at a period matched
   to how fast that state actually changes.
5. **Announce every downgrade** before spawning a weaker-model subagent (§1) — parallelism must not become an invisible
   change in who is doing the work.
6. **Unattended parallel work inherits the autonomy contract** (`09-autonomy-contract.md`), including its **open risk**:
   the gate's `CLAUDE_AUTONOMOUS` trigger has no setter since the orchestrator was retired, so a remote/scheduled run
   may be ungated. Verify before running one unsupervised.

### 3.3 Multi-machine

Nothing above is machine-specific: it is the same on the NUC, a PC, a laptop or a cloud runner, because it is the
harness's own machinery rather than a script installed somewhere. The only per-machine setup this platform has is
`.claude/settings.local.json` (the memory wiring — `memory-wiring-check.mjs` shouts if it is missing). That is the test
for anything added here: **if it needs installing per machine, it is probably the wrong mechanism.**
