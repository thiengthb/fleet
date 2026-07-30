---
title: Mine the community harness ecosystem from ARTEFACTS, not blogs — adopt few, refuse loudly
kind: system-change
status: active
created: 2026-07-31
updated: 2026-07-31
checkin: 2026-08-07
checkin_every: 7d
checkin_owner: agent
related:
  [
    platform/plans/2026-07-31-harness-reexamination.md,
    platform/standards/token-and-research.md,
    platform/registries/shared-assets.md,
    commons/docs/external-patterns.md,
    platform/registries/skill-candidates.md,
    rulebook/,
  ]
---

<!-- Persisted multi-session plan. Standard: platform/standards/documentation.md §5.5. Keep token-cheap. -->

> **Bằng tiếng Việt, đọc phần này là đủ hiểu:** plan chị em của `2026-07-31-harness-reexamination.md`. Plan kia
> soi fleet bằng **tài liệu Anthropic**; plan này soi fleet bằng **code thật của người ngoài** — đọc `SKILL.md`,
> `hooks.json`, `plugin.json` của họ, chứ không đọc blog viết về họ.
>
> **Vì sao tách ra:** plan kia đã có bảng verdict đang **chờ anh duyệt**. Sửa tiếp vào đúng thứ đang chờ duyệt là
> làm anh phải duyệt một mục tiêu di động. Và việc này có **rủi ro khác hẳn**: đọc repo người khác là đường ngắn
> nhất tới việc nhập tư duy của họ vào — đúng cái anh sợ ("tư duy trì trệ làm hệ thống trì trệ theo").
>
> **Nên plan này BẮT BUỘC phải sinh ra REFUSE.** Không phải để tỏ ra khắt khe: một đợt khai thác mà chỉ toàn
> "nên lấy cái này" là bằng chứng rằng nó đã ngừng suy nghĩ. Trần cứng: **tối đa 3 món được nhập mỗi đợt**.

## The ask, verbatim

> tạm thời, tôi muốn bạn nghiên cứu thêm nữa, có những github repo như là superpower bạn có nhắc tới, tôi cũng
> muốn bạn nghiên cứu liên quan đến những project mà giúp cải thiện sự làm việc của bạn như này song song với
> việc cải thiện theo anthopic, không biết là plan harness reexaminition của bạn đã nghiên cứu phần trên chưa
> hay chỉ mới dùng ở anthopic, bạn hãy giải thích kĩ, phản biện nếu có và nếu chưa làm thì hãy làm kĩ giúp tôi
> rồi nếu nặng cần thành một plan mới thì hãy viết thành plan mới giúp tôi

## Why this plan exists: the sourcing audit that answers his question

**His suspicion was correct.** `2026-07-31-harness-reexamination.md` claims AC-1 ("outside consensus, not
opinion") on 16 findings. Audited by *kind* of source rather than count:

| Source kind | Findings resting on it | Strength |
| --- | --- | --- |
| Anthropic docs, read directly | 14 / 16 | strong |
| Community blogs *about* Claude Code | 8 / 16 | secondary |
| Context-engineering literature (LangChain, mem0, Sourcegraph…) | 2 / 16 | strong but theoretical |
| **Actual code from a community repo** | **0 / 16** | **absent** |

The specific failure: Superpowers is cited in F8, F10 and F11 of that plan, and **not one of its files had been
read** — all of it came from its README plus a search summary. The plan's own bar says "≥2 independent credible
sources", and it silently counted *a blog summarising a repo* as equal to *the repo*. Those are not equal. So
AC-1 passed on volume while **R1 — "find the harness structures better people have already optimised" — was half
done.**

This plan does the other half, with a method rule: **a finding may only cite a file that was actually fetched.**

## Goal

A verdict on the community harness ecosystem, built from artefacts, that changes fleet in **at most 3 places** and
says *no* in writing to everything else — plus the one thing this pass has already shown fleet needs from outside
its own toolchain: an **external validator**.

## Context — what the first pass got wrong about fleet, in both directions

Reading real artefacts moved two verdicts in the sibling plan, one favourably and one not:

- **A7 (skill evaluations) gets stronger.** It rested on Anthropic alone. Superpowers' `writing-skills` states an
  **"Iron Law: NO SKILL WITHOUT A FAILING TEST FIRST"**, with no exception for "simple additions" or
  "documentation updates". Two independent parties reached evaluation-first. fleet: **0 of 38 skills have one.**
- **F15's "fleet uses ✓" was over-confident.** It was scored against the most permissive number available. There
  is in fact **no consensus on skill length** — see C4. fleet passes one source and fails another by 2–3×.

## Prior art & sources — Batch 0, artefacts fetched 2026-07-31

Every item below was fetched in this session. Findings are prefixed `C` to keep them distinct from the sibling
plan's `F` series.

**C1 — Superpowers' real inventory, read from the tree (not a blog): 14 skills.**
[obra/superpowers/skills](https://github.com/obra/superpowers/tree/main/skills) — `brainstorming` ·
`dispatching-parallel-agents` · `executing-plans` · `finishing-a-development-branch` · `receiving-code-review` ·
`requesting-code-review` · `subagent-driven-development` · `systematic-debugging` · `test-driven-development` ·
`using-git-worktrees` · `using-superpowers` · `verification-before-completion` · `writing-plans` ·
`writing-skills`. fleet already has equivalents of six. **AGREEMENT: n/a (primary artefact).**

**C2 — fleet writes plans and has no skill for executing one. AGREEMENT: 3.**
Superpowers ships `writing-plans` **and** `executing-plans` (C1) · the community catalogue contains
`agent-handoff` ("strict 3-stage handoff: plan → execute → verify") and `agentsatlas` (an eight-command
init→plan→execute→status→sync→triage→review→complete workflow) · `agentic-swe` ("structured software-engineering
pipeline"). fleet has `/project-plan` for authoring and **nothing for the execute half**, so plan execution is
improvised every time — which is precisely where a multi-session plan loses its thread. **Strongest ADOPT
candidate of this pass.**

**C3 — evaluation-first is now a two-party consensus, not a vendor preference. AGREEMENT: 2.**
[Anthropic skill best-practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices.md)
*"Create evaluations BEFORE writing extensive documentation"* ·
[Superpowers `writing-skills`](https://raw.githubusercontent.com/obra/superpowers/main/skills/writing-skills/SKILL.md)
*"NO SKILL WITHOUT A FAILING TEST FIRST"*, explicitly admitting no exceptions.

**C4 — there is NO consensus on skill length; the three published caps are ~10× apart. AGREEMENT: 0 (a real
disagreement, recorded as one).**
Anthropic docs: **<500 lines** ·
[Anthropic's own `skill-development` skill](https://raw.githubusercontent.com/anthropics/claude-code/main/plugins/plugin-dev/skills/skill-development/SKILL.md):
**1,500–2,000 words**, under 5,000 total · Superpowers `writing-skills`: **<500 words**, and **<200 for
frequently-loaded skills**.
**fleet, measured:** body word counts — avg **830**, max **1,650** (`session-wrap`), **0 over 2,000 · 27 between
500 and 2,000 · 11 under 500**; max **199 lines**. So fleet **passes** Anthropic's line rule and Anthropic's own
skill's word rule, and **fails Superpowers' by 2–3× on 27 of 38**. Any single verdict here is a choice of source,
and must be declared as one rather than presented as compliance.

**C5 — `version:` in skill frontmatter. AGREEMENT: 2.**
Anthropic's `skill-development` skill prescribes `version: 0.1.0` in frontmatter; the
[plugins reference](https://code.claude.com/docs/en/plugins) makes version the thing that decides whether users
receive an update at all (omit it and every commit counts as a new version). **fleet: 0 of 38.** Cheap now,
load-bearing the moment `rulebook` is installed by someone else.

**C6 — descriptions must be third person with concrete trigger phrases. AGREEMENT: 2.**
Anthropic's `skill-development`: *"Use the third-person… Include exact phrases users would say that should trigger
this skill"*, and imperative/infinitive prose, never second person · Anthropic skill best-practices says the same.
**fleet: 2 of 38 use second person** (`honest-critique`, `supply-chain-guard`) — small, and worth fixing only
because description text is always-loaded.

**C7 — an EXTERNAL validator for agent configs exists, and fleet has no equivalent. AGREEMENT: 2.**
[agent-sh/agnix](https://github.com/agent-sh/agnix) — *"the missing linter and lsp for AI coding assistants.
Validate CLAUDE.md, AGENTS.md, SKILL.md, hooks, MCP"* — **444 rules** drawn from official specs, academic research
and real breakage patterns, with `--fix`, `--strict`, watch mode, **SARIF** output for GitHub code scanning, a
GitHub Action, and coverage across Claude Code / Codex / OpenCode / Cursor / Copilot. Listed in the community
marketplace catalogue and discussed on
[Hacker News](https://news.ycombinator.com/item?id=46983879).
**Why this is the highest-value find of the pass:** the sibling plan's rulebook-readiness table has a row —
*"passes an external validator, not only fleet's own tools"* — currently **FAIL**, with no candidate. This is the
candidate. It also independently checks the two things fleet cannot check about itself: whether its CLAUDE.md and
skills are well-formed *by someone else's rules*, and whether they hold up for a user on a different agent.
**Caveat to test, not assume:** rule counts quoted across its own pages range 156 → 414 → 444, so the number is
unstable and the tool is young. Evaluate, do not adopt on reputation.

**C8 — the marketplace catalogue is revealed preference, and it confirms fleet's two biggest bets. AGREEMENT: 6+
per cluster.**
[anthropics/claude-plugins-community `marketplace.json`](https://github.com/anthropics/claude-plugins-community/blob/main/.claude-plugin/marketplace.json).
The most-repeated category is **persistent memory + session distillation**: `agent-memory`, `agent-recall`,
`agent-knowledge`, `agent-archive`, `anamnese-core`, `alley-oop` (session distillation + cold-start). The second
is **process-pipeline enforcement**: `agent-handoff`, `agentsatlas`, `agentic-swe`, `agent-protocols`,
`8-habit-ai-dev`, `alfred`. fleet has both — the memory/ledger/decisions tier and the P1–P3 spine — and its
pipeline is deliberately *lighter*. **This is confirmation, not a gap**, and it is stronger evidence than any blog
because these are things people actually shipped and Anthropic actually accepted.

**C9 — the first clear REFUSE, and it is the archetype of the risk in his ask. AGREEMENT: n/a (a conflict, not a
consensus).**
Superpowers `subagent-driven-development` instructs: *"Do not pause to check in with your human partner between
tasks. Execute all tasks from the plan without stopping."* That is **directly opposed** to fleet's design, where
the supervisor is the oracle and `/idea`, `/brainstorming`, plan approval and the autonomy T3 gate all exist to
create pause points. The framework optimises **unattended throughput**; fleet optimises **supervisability**.
Adopting it would silently delete the thing fleet is for. **REFUSE, and record the reasoning** — this is exactly
the "their thinking flattening yours" case.

**C10 — "always specify the model explicitly when dispatching a subagent". AGREEMENT: 2.**
Superpowers `subagent-driven-development` states it as a rule; Anthropic's sub-agents doc provides the `model:`
field. This is independent outside agreement with the sibling plan's **A4**, which was argued from fleet's own
prose alone.

**C11 — a ledger beats todos because context does not survive compaction. AGREEMENT: 2.**
Superpowers `subagent-driven-development`: *"Conversation memory does not survive compaction… Track progress in a
ledger file, not only in todos."* Anthropic's context-engineering post says the same as "structured note-taking".
**fleet already does this** (`platform/ledger/`, `decisions.md`, plan files, `compact-recap`). Confirmation.

**C12 — a loop-breaker with a declared cap, and no early adjudication. AGREEMENT: 2.**
Superpowers: *"Adjudicate only at the cap. Adjudicating earlier to end a loop is pre-judging with a different
name."* fleet's `/systematic-debugging` already carries *"≥3 failed fixes ⇒ question the architecture"*. Two
independent parties converged on a counted brake. Confirmation, with a possible refinement (fleet's cap is a
heuristic in prose; theirs is enforced in the workflow).

**C13 — framework scale, and a marketing claim explicitly NOT adopted as evidence.**
SuperClaude ≈ **23.6k** stars; Claude-Flow / Ruflo quoted at **31.1k** and **61k** by different pages on the same
day. Ruflo is promoted with *"84.8% solve rate on SWE-bench and 75% API cost savings"* —
[source](https://pasqualepillitteri.it/en/news/774/claude-flow-ruflo-multi-agent-orchestration-guide). **That
claim is recorded and not believed**: no methodology, no independent replication, and a vendor-shaped number. Star
counts that disagree by 2× on one day are a reminder that popularity here is measured badly. Neither framework has
been read yet — that is Batch 1.

**C14 — the catalogue was only partially read, and the honest count is unknown.**
The `marketplace.json` fetch returned entries alphabetically and stopped around `ao-`. So "200+ plugins" is a
**floor observed in the A section**, not a count. Stated because a floor quoted as a total is the exact mistake
the sibling plan had to correct twice.

## Approach & tradeoffs

**Chosen: read artefacts in descending order of evidential value, with a hard adoption cap and a mandatory refusal
column.**

Evidential order, best first — this is the method correction that this whole plan exists to make:

1. **What Anthropic itself ships as code** (`anthropics/claude-code/plugins/`, `anthropics/skills`) — the vendor's
   own practice, which can contradict the vendor's own docs (C4 shows it does).
2. **What the community marketplace accepted** — revealed preference, reviewed by someone.
3. **The actual files of the most-used frameworks** — real design, readable.
4. **Blogs about any of the above** — last, and only for a claim no artefact shows.

**Ruled out — adopting anything on star count.** C13 shows the counts disagree by 2× and the headline benchmark
claim has no methodology. Popularity measures reach, not fit.

**Ruled out — importing a framework's workflow wholesale.** C9 is the demonstration: Superpowers' central
execution rule would delete fleet's supervisor gates. `memory: extend-dont-rebuild`, and the sibling plan already
ruled out rebuilding on someone else's scaffold.

**Ruled out — a fourth registry to track all this.** The verdict log already exists:
`commons/docs/external-patterns.md`, per `/code-reuse`. Every REFUSE goes there so the same item is not
re-litigated next quarter.

**Hard cap: 3 adoptions from this plan.** The FOMO brake in `CLAUDE.md` and `commons`' record (27 proven items,
**0 installs**) both say the failure mode here is accumulation, not scarcity. If a fourth item looks compelling,
it displaces one of the three or it waits.

**Pre-committed consequence, written before Batch 1 is read:**

> If Batch 1 (reading the two large frameworks) produces **zero** items that clear the ADOPT bar, the conclusion is
> that **fleet has already absorbed what the community ecosystem has to offer**, this plan closes at Batch 3, and
> the remaining effort goes to `rulebook`. That is a success and must be reported in those words.
>
> Symmetrically: if this plan ends with **fewer than 3 REFUSE rows**, the pass was not critical enough and Batch 1
> is re-read against the question *"what here would quietly overwrite a decision fleet made on purpose?"*

## Acceptance criteria

- **AC-1 — artefacts, not descriptions.** Every `C`-finding cites a file or catalogue that was actually fetched;
  no finding rests only on a blog describing a repo. _Test: every C-row carries a `raw.githubusercontent.com`,
  `github.com/…/tree|blob`, or official-docs URL._
- **AC-2 — the refusal column is real.** ≥3 REFUSE rows, each naming (a) the item, (b) the fleet decision it would
  have overwritten, (c) why that decision stands. _Test: no REFUSE row with an empty (b)._
- **AC-3 — the cap held.** ≤3 items adopted. _Test: count them; if a fourth was added, the displaced one is named._
- **AC-4 — the external validator is evaluated, not admired.** `agnix` is actually run against fleet, its findings
  triaged into real/noise with counts, and a keep-or-drop verdict written. _Test: a findings count from a real run,
  and a verdict either way._
- **AC-5 — every verdict lands in the shared log.** Adoptions AND refusals written to
  `commons/docs/external-patterns.md` per `/code-reuse`. _Test: the row count there rises by the number of verdicts._
- **AC-6 — the sibling plan is reconciled, not duplicated.** Findings that strengthen or weaken its rows (C3, C4,
  C10) are written back into it as amendments. _Test: that plan cites C-numbers._

## Steps

- [x] **Batch 0 — the sourcing audit + first artefacts. DONE 2026-07-31.** Answered whether the sibling plan had
      done this (it had not) and gathered C1–C14 from real files.
      _Files: this plan `## Prior art & sources`._ · _Test: AC-1._
- [ ] **Batch 1 — read the two large frameworks as code.** SuperClaude and Claude-Flow/Ruflo: their config layout,
      what they enforce, and what they assume about the operator. Plus `anthropics/skills` and the rest of the
      community catalogue past the A section (C14).
      _Files: this plan `## Findings`._ · _Test: AC-1, and the pre-committed consequence is evaluated._
- [ ] **Batch 2 — run `agnix` against fleet.** Install, run, triage every finding into real / noise / wrong-for-us
      with counts, and decide keep-or-drop. **This is the only Batch that may run before the sibling plan's gate
      opens, because it is read-only and answers a row that plan already marked FAIL.**
      _Files: this plan `## agnix evaluation`, `commons/docs/external-patterns.md`._ · _Test: AC-4._
- [ ] **Batch 3 — the verdict table: ADOPT (≤3) / REFUSE / CONFIRMS-FLEET.** **Supervisor's gate.**
      _Files: this plan `## Verdict table`._ · _Test: AC-2, AC-3._
- [ ] **Batch 4 — execute the ≤3 adoptions, write every verdict to the shared log, amend the sibling plan.**
      _Files: as the table names, `commons/docs/external-patterns.md`,
      `platform/plans/2026-07-31-harness-reexamination.md`._ · _Test: AC-5, AC-6._

## Out of scope

- Building `rulebook`. Same boundary as the sibling plan.
- Installing any plugin from the community marketplace into fleet's live config. This pass **reads**; anything
  installed goes through the sibling plan's Batch 5 with a human commit (`memory: sandbox-propose-governance`).
- The sibling plan's ADOPT column. C3 and C10 strengthen A7 and A4 but do not re-open them.
- Multi-agent orchestration frameworks as an architecture (Ruflo's swarm model). fleet is one operator; the sibling
  plan already filed agent teams as CORRECTLY ABSENT.

## Open questions

1. **Does `executing-plans` (C2) belong in fleet, or is its absence deliberate?** fleet's plans are read by a
   human who then directs the work — an execute-skill could be the missing half, or it could be automation of the
   one step where the supervisor belongs. The C9 conflict makes this genuinely ambiguous.
2. **Which skill-length source does fleet adopt (C4)?** Declaring "we follow Anthropic's own skill" is defensible;
   silently passing the loosest available cap is not.
3. **Does `agnix` earn a place in the weekly sweep, or is it a one-off audit?** A standing external check is
   valuable and is also a dependency on a young third-party tool with an unstable rule count.
4. **Is there anything in the catalogue past the A section that changes the picture (C14)?** Unknown by
   construction.

## Check-in runbook

On 2026-08-07 (or the next session after), do exactly this:

1. Re-read `## The ask, verbatim` — this plan exists because a sourcing claim was too generous, and that is easy to
   repeat.
2. Count REFUSE rows. Fewer than 3 ⇒ re-run Batch 1 with the hostile question in *Approach*.
3. Count adoptions. More than 3 ⇒ name what was displaced, in writing.
4. `grep -c` the verdict rows in `commons/docs/external-patterns.md` — did AC-5 actually happen, or did the
   verdicts stay only in this file?
5. Roll `checkin:` forward or clear it.

## Decisions to distill

- Whether reading artefacts instead of blogs actually changed any verdict, or only made the citations look better.
  C3 and C4 say it changed two; that should be re-checked at close.
- Whether the hard cap of 3 held, and what it cost. A cap that is never binding is decoration.
- Whether `agnix` found anything fleet's ten own tools did not. If it found nothing, that is a strong statement
  about fleet's tooling; if it found a lot, that is a strong statement about the limits of self-audit.
- Whether the C9 refusal was right, revisited once. Refusing a popular framework's central rule is the kind of
  decision that deserves one honest re-examination rather than becoming dogma.
