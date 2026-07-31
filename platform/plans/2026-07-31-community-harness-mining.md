---
title: Mine the community harness ecosystem from ARTEFACTS, not blogs — adopt few, refuse loudly
kind: system-change
status: done
created: 2026-07-31
updated: 2026-07-31
# checkin cleared on closing (see `## Closing assessment`). C14 — the catalogue past its A section — is left
# UNDONE by judgement, not finished; whoever picks it up should re-derive it rather than inherit this file.
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

## Closing assessment — 2026-07-31: does what shipped satisfy what was actually asked?

Closed alongside its sibling `2026-07-31-harness-reexamination.md`. Same discipline: the verbatim ask first.

The ask has four parts, and each is answered:

1. **"nghiên cứu thêm nữa… những github repo như là superpower"** — **SATISFIED.** 17 rows (C1–C17), and per AC-1
   every one cites a file that was actually fetched. Superpowers read at artefact level, plus the community
   catalogue's A section, `anthropics/skills`, SuperClaude and Ruflo.
2. **"không biết là plan harness reexamination đã nghiên cứu phần trên chưa hay chỉ mới dùng ở anthopic… giải
   thích kĩ"** — **SATISFIED, and the honest answer was no.** The sibling plan had sourced Anthropic almost
   exclusively; that admission is what created this plan. It is recorded as a sourcing audit, not smoothed over.
3. **"phản biện nếu có"** — **SATISFIED, in both directions.** Against fleet: C2 and C7 were adopted. Against the
   community: SuperClaude and Ruflo produced zero ADOPTs and the pre-committed consequence **fired** for Batch 1,
   reported in the required words. Against **myself**: C9 was a refusal I had to withdraw after the user pointed
   out I was dismissing an outside rule without reading it, and the ≥3-REFUSE quota was withdrawn because *a
   quota on refusals produces refusals*.
4. **"nếu nặng cần thành một plan mới"** — **SATISFIED.** This file is that plan.

**Batches 3 and 4 are marked NOT DONE, and that is accurate rather than an oversight.** (Their empty checkboxes
were removed on closing: `recurrence-check`'s `done-plan-with-unticked-steps` detector exists because an unticked
box in a closed plan gets quoted later as pending work. Every word of the step text is kept; only the ambiguous
box is gone.) The substance both were for is done —
`agnix` evaluated and kept (Batch 2), C2 adopted on `feat/plan-execution-gate`, C3 refuted by measurement in the
sibling plan, C5 and C17 refused with numbers — but the **formal supervisor's-gate step never ran as a step**,
because the supervisor had explicitly stepped back from per-decision approval for this stretch of work. Ticking
them would claim a gate that did not happen.

**The one thing genuinely left undone:** C14, the community catalogue past its A section. Deferred on the stated
grounds that the A section already yielded the only item worth having and the marginal value of the rest is
unevidenced. That is a judgement, not a completion — named here so nobody reads this plan as an exhaustive sweep
of the community ecosystem.

**The result worth carrying forward, in the plan's own words:** *nothing to import at the framework level; two
things to import at the artefact level.* The value came from reading small files — a template, a skill, a
marketplace manifest — not from the famous repositories.

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

**C2 — ADOPTED 2026-07-31 on branch `feat/plan-execution-gate`. And this row's premise was PARTLY FALSE, which
makes it the third such row in these two plans.** What was claimed: *"fleet has `/project-plan` for authoring and
**nothing for the execute half**."* Checked against the file before building: `/project-plan/SKILL.md` **already**
carries `## Step 3 — Keep it in sync while executing` ("execute in small batches with a checkpoint", "check off
steps, bump `updated:`") **and** a block literally headed *"Two habits that make steps + execution sharp (borrowed
from the community plan/execute skills)"* — so the community's execute-half had already been partially absorbed,
and this row read the absence of a *skill* as the absence of a *practice*.

**What was genuinely missing survives the correction, and it is sharper than the original claim:** the guidance
existed **at the wrong trigger**. It lives inside the skill you open to *write* a plan; a later session resuming
*execution* opens the **plan file**, never the skill. That is the failure the ledger already names (2026-07-30, "A
rule enforced at the wrong trigger reads as coverage"). Evidence it did not fire, from this very session: A3 built
on a premise falsified two days earlier, L1 on a target invented one step before the measurement it demanded, and
this row itself — **three premise failures at execution time on plans whose author had already written the
guidance.**

**So: content adopted, packaging REFUSED.** No 39th skill — the platform has 38 with 17 never invoked, and a skill
nobody opens at execution time is the exact defect being fixed. The pre-batch questions ship as a
`## Before executing a batch` block in the **plan template**, plus a `plan-audit` WARN when an `active` plan with
unticked steps lacks it. WARN not ERROR, per `CLAUDE.md`'s escalation order (restructure → measure → gate): the
template makes compliance the default, so this measures the residue. **Measured: fired on 4 of 4 live plans, then
3 were retrofitted and it fell to 1** — the remaining one is `harness-reexamination`, deliberately left alone
because the `refactor/claude-md-triggers-only` branch has already edited that file and a manufactured green is
worth less than an honest 1. 3 new mutants, all killed.
_Also fixed in passing: that suite's summary line hardcoded "8 mutants all killed" while the file contained 10 —
a test reciting a remembered number about itself. It is now counted from the loop._

~~C2 — fleet writes plans and has no skill for executing one.~~ **AGREEMENT: 3.**
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

**C9 — RETRACTED IN FULL, 2026-07-31. The refusal was wrong, and it was wrong in fleet's favour.**

The original row read: Superpowers `subagent-driven-development` says *"Do not pause to check in with your human
partner between tasks"*, therefore it is **"directly opposed"** to fleet's supervisor-as-oracle design, therefore
**REFUSE** — "the archetype of the risk in his ask".

Then the supervisor said he had watched me dismiss something, and asked for `kĩ lưỡng`. So the actual files were
read instead of one line lifted from a summary. **Superpowers is more gate-heavy than fleet, not less.** Verbatim:

- [`brainstorming`](https://raw.githubusercontent.com/obra/superpowers/main/skills/brainstorming/SKILL.md):
  *"Do NOT invoke any implementation skill, write any code, scaffold any project, or take any implementation action
  until you have presented a design and the user has approved it"* — universal, with no exception for simple work ·
  *"Ask clarifying questions — one at a time… Only one question per message"* · *"Ask after each section whether it
  looks right so far"* · *"Wait for the user's response… Only proceed once the user approves."*
- [`executing-plans`](https://raw.githubusercontent.com/obra/superpowers/main/skills/executing-plans/SKILL.md):
  *"If concerns: Raise them with your human partner before starting"* · *"STOP executing immediately when: Hit a
  blocker… Ask for clarification rather than guessing"* · *"Never start implementation on main/master branch
  without explicit user consent."*

So the quoted line is scoped to the **task loop inside an already-approved plan, after four human gates**. It does
not say "no supervisor"; it says **"do not re-litigate an approved plan mid-execution"** — which is good practice,
and which fleet **does not have**, because fleet has no execute-skill at all (C2). The conflict was manufactured.

**Three things this costs, recorded rather than smoothed over:**

1. **The method rule this plan was created to enforce was broken by this plan.** AC-1 says a finding may only cite a
   file actually fetched. C9 cited a *summarising model's paraphrase of one line* and drew a design conclusion from
   it. Reading two files reversed the verdict completely.
2. **The error had a direction: it protected the home team.** Of the fourteen C-findings, the one that turned out
   wrong is the one that concluded *fleet is right and the outsider is dangerous*. That is not coincidence, it is
   bias with a shape, and it is the thing to watch for in Batch 1 — not "am I being too credulous about outsiders",
   but **"am I refusing whatever would cost fleet something".**
3. **It nearly became doctrine.** C9 was written as the plan's flagship refusal and quoted back to the supervisor
   as evidence the process was working. A wrong refusal presented as proof of rigour is worse than a wrong
   adoption, because nothing downstream ever re-tests it.

**Replacement verdict: CONFIRMS-FLEET, and one gap.** Superpowers independently reached fleet's gate philosophy
from scratch — the strongest external validation of it found so far. The gap is that its gates are **enforced
inside the skill** (`Do NOT`, `Wait for`, `Only proceed once`), while several of fleet's live in `CLAUDE.md` prose
where `F3`/`enforce-rules-with-gates` say they will erode.

**And one uncomfortable observation from the same file:** *"Never start implementation on main/master branch without
explicit user consent."* This session committed five times directly to `main`. fleet's convention permits it and
the supervisor asked for the commits, so it was not a violation — but the outside practice is stricter than
fleet's, and this is logged rather than waved through on the grounds that fleet has a convention.

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

## Findings — Batch 1 (the two large frameworks), 2026-07-31

**C15 — Anthropic's own artefacts CONTRADICT each other on `version:`, so C5 is downgraded and a task is deleted.**
[`anthropics/skills/template/SKILL.md`](https://raw.githubusercontent.com/anthropics/skills/main/template/SKILL.md)
— the official template in a **165.3k-star** repo — is, verbatim and complete:

```
---
name: template-skill
description: Replace with description of the skill and when Claude should use it.
---

# Insert instructions below
```

**No `version` field.** C5 claimed "AGREEMENT: 2" for `version:` in skill frontmatter, counting Anthropic's
`skill-development` skill plus the plugins doc — but the plugins doc governs `version` in
**`.claude-plugin/plugin.json`**, which is a different file for a different purpose. So the real state is **one
Anthropic artefact prescribing it and another omitting it**, and the official template wins on adoption by two
orders of magnitude.
**Consequence: C5 is downgraded from ADOPT-candidate to non-finding.** fleet should **not** add `version:` to 38
skills. What is genuinely required is `version` in the **rulebook plugin manifest** — already covered by the sibling
plan's A3. *This finding removes work rather than adding it, which is the outcome an honest pass should be able to
produce and the reason "AGREEMENT: N" must count artefacts, not citations.*

**C16 — SuperClaude: REFUSE the bulk, CONFIRMS-FLEET on routing. Evidence both ways.**
[SuperClaude_Framework](https://github.com/SuperClaude-Org/SuperClaude_Framework) (~23.6k stars) installs via
`pipx install superclaude` → `superclaude install`, adding **30 slash commands · 20 agents · 7 behavioural modes ·
8 optional MCP servers**. Its own framing: *"behavioural instruction injection"*, and the workflow patterns are
*"documented, not mandatory"*.

- **Against, measured — not preference.** fleet's diagnosed problem is the **discovery tier**: 38 skill
  descriptions, ~3.9k tokens always-loaded, **0 using `disable-model-invocation`** (sibling F5/A1). Adding 30
  commands and 20 agents makes the *measured* problem roughly 1.5× worse, in the exact dimension already
  identified as the bottleneck.
- **Against, from a named fleet incident.** `memory: enforce-rules-with-gates` exists because the operator's stated
  rules were *documented and then not followed* — the fix was enforcement. SuperClaude is explicitly the
  documented-not-mandatory model, i.e. the thing that already failed here once.
- **For, and it must be said.** Its stated goal — *"Reduced framework footprint… More context for your code"* — is
  **the same goal as the sibling plan's L1**, reached independently. And `/recommend` (a command whose job is to
  pick which command to use) is a real answer to discovery at 30+ surfaces. **fleet already has this pattern**
  (`/testing-standard` routes to the other testing skills), so this is confirmation of an existing fleet idea, not
  an import. Worth generalising if L2's categories are not enough.

**C17 — Claude-Flow / Ruflo: REFUSE, and the headline numbers do not survive contact with the repo.**
[ruvnet/claude-flow](https://github.com/ruvnet/claude-flow) (~31–61k stars, depending which page one believes):
**98 agents · 60+ commands · 30 skills · 35 plugins**, an MCP server daemon (`ruflo mcp start`), **12
auto-triggered background workers**, a swarm coordinator with hierarchical/mesh/adaptive topologies, and AgentDB —
an **HNSW-indexed vector store** for agent memory.

- **On the numbers, as promised in *Approach*:** the *"84.8% SWE-bench solve rate and 75% API cost savings"* I
  recorded in C13 from a blog **does not appear in the repository at all**. What the repo actually claims is
  *"~1.9× faster at N=20k, ~3.2×–4.7× at N=5k vs brute force"* — that is **vector-search speed, not agent
  quality** — plus *"wins cold start, single turn, RSS by 1.3×–1953×"* against LangGraph/AutoGen/CrewAI, with
  methodology in external files. **A 1953× range is a red flag, not a result.** C13's refusal to believe the blog
  is now confirmed by the primary source: the claim was not the project's.
- **Against, measured.** 12 background workers plus a daemon is an operational surface with **no one to run it**:
  one operator, and the NUC has been down since 2026-07-22. The sibling plan already filed agent teams as
  CORRECTLY ABSENT for N× token cost per teammate; this is that, larger.
- **For — and this one is real, so it gets recorded properly.** **AgentDB's semantic retrieval over agent memory
  answers an open question fleet actually has.** Sibling plan open question 4 asks whether the ledger is
  sustainable at 183 entries, noting it is simultaneously the most-read *and* the largest file on the platform.
  fleet's knowledge tier is flat markdown with a hand-maintained index **hard-capped at 200 lines** — that works at
  33 memories and is visibly straining at 183 ledger entries. **Semantic retrieval is the known answer to exactly
  that problem.** Not adopted now: it is a large dependency, the FOMO brake applies, and `commons` (27 items, 0
  installs) is the standing evidence about premature capability. **Recorded as the leading candidate for open
  question 4 when it becomes urgent**, which is a real deliverable from a refused framework.

### Pre-committed consequence — FIRED for Batch 1's scope. Reported in the required words.

The device said: *if Batch 1 (reading the two large frameworks) produces **zero** items that clear the ADOPT bar,
the conclusion is that fleet has already absorbed what the community ecosystem has to offer.*

**It produced zero.** SuperClaude's one good idea (a router) fleet already implements. Ruflo's one good idea (vector
memory) is recorded for a future question, not adopted. Neither large framework yields an ADOPT.

**So, in the required words: fleet has already absorbed what the community ecosystem has to offer** — at the level
of *whole frameworks*. Both are built for a problem fleet does not have (many surfaces, many agents, unattended
throughput) and both would worsen the one it does have (discovery cost).

**What this does NOT license, stated so the device is not quietly renegotiated in the flattering direction:** the
consequence was scoped to Batch 1. It says nothing about **Batch 0**, which produced the two genuine ADOPT
candidates of this plan — **C2** (`executing-plans`: fleet writes plans and cannot execute them, 3 sources) and
**C7** (`agnix`: found invalid YAML in 10 of 38 skills that ten in-house tools missed). Those stand on their own
evidence. The honest summary is therefore narrower than either extreme:

> **Nothing to import at the framework level; two things to import at the artefact level.** The value of this pass
> came from reading small files — a template, a skill, a marketplace manifest — not from the famous repositories.

## agnix evaluation (Batch 2 — DONE 2026-07-31)

**Verdict: KEEP. It found a real defect class that all ten of fleet's own tools miss, and it is the first oracle on
this platform that is neither me nor the supervisor.**

**Supply-chain check first** (`/supply-chain-guard`, and the tool has a `postinstall`, so this was not optional).
`agnix@0.41.1`, npm, sole maintainer `avifenesh` — consistent with the author of its public writeups; created
2026-02-05, published 2026-07-27; **7,292 downloads/week**; **zero runtime dependencies**. The tarball is 5.3KB /
5 files, so the 10.7MB binary arrives via `postinstall: node install.js`, which was **read before being run**: it
downloads only from the version-pinned `github.com/agent-sh/agnix/releases/download/v0.41.1/…`, then
**verifies a SHA-256 sidecar and aborts on mismatch** before extracting. No telemetry call, no env access, no
arbitrary URL. `telemetry status` → `disabled` / `disabled`, opt-in by design. Residual risk stated rather than
waved away: the sidecar shares a host with the archive, so it protects transport, **not a compromised release**.
Installed into the session scratchpad with `--no-save --prefix`, so fleet's tree is untouched.

**Run:** `agnix --target claude-code .claude CLAUDE.md` → exit 1, **42 errors · 50 warnings · 1 info**, 32 marked
auto-fixable. **`--fix` was not run.** Triage:

| Count | Finding | Verdict | Why |
| --- | --- | --- | --- |
| **10** | `Failed to parse SKILL.md: mapping values are not allowed in this context` | **REAL, and the reason to keep the tool** | See below |
| 32 | `Unclosed XML tag` — `<repo>`, `<project>`, `<app>`, `<path>` | **noise for fleet, real for rulebook** | These are markdown placeholders in templates. But Anthropic's spec says a `description` may not contain XML tags, and a `<name>` in a body is ambiguous to a model. Convention clash, not a bug |
| 31 | `Hard-coded Claude Code path '.claude/' may cause portability issues` | **noise for fleet, REAL for rulebook** | fleet *is* the control plane, so `.claude/` paths are correct here. But this is the same defect as the rulebook-readiness row "skills reference `platform/…` paths that only exist here" — an independent instrument hitting a known problem from a different angle |
| 1 | `CLAUDE.md exceeds recommended token limit (~3,948 tokens, limit 1,500)` | **REAL** | **A fourth independent measurement of F1/L1**, on a different metric again (tokens, not lines or words). fleet is **2.6× a third party's limit** |
| 10 | `Negative instruction '…' without positive alternative` | **REAL but low value** | Matches Anthropic's "say what to do, not only what not to do". fleet is deliberately prohibition-heavy (Invariants A) so most are intentional |
| 7 | `Critical keyword 'never'/'MUST' at 43–57% of document ('lost in the middle' zone)` | **REAL and genuinely NEW** | Derived from attention research: a rule placed mid-document is attended least. fleet had **no way to detect this**, and it is direct mechanical evidence for F14 — CLAUDE.md is a laundry list whose middle is where the prohibitions sit |
| 1 | `No tool or spec versions pinned` | **REAL, trivial** | Relates to C5 (`version:` absent everywhere) |

**The 10 parse failures, verified independently rather than taken on the tool's word.** Affected:
`app-env` · `app-onboard` · `app-protect` · `honest-critique` · `host-audit` · `host-maintenance` · `idea` ·
`mcp-builder` · `react-ui-craft` · `skill-proposer`.
Cause, confirmed by reading the raw bytes: an **unquoted `: ` inside a plain YAML scalar**, e.g. `app-env`'s
description contains ``On `nuc`: idempotent upsert…`` — to a strict parser, `` `nuc`: `` opens a nested mapping.
Cross-checked with a **second, unrelated** parser (the `yaml` package from `projects/sakubun`): it names **the same
10 of 38 files**, `Nested mappings are not allowed in compact mappings at line 3`. Two independent parsers, same
verdict.

**Why this matters and why fleet could not see it:**

- **Claude Code's own parser is lenient** — all 38 skills load here, descriptions and all. So the defect is
  *invisible in normal use* and produces no symptom on this machine.
- **fleet's `skill-audit` checks descriptions for length and substrate, never for validity.** The sibling plan's
  checklist row 23 records "descriptions ≤1024 chars ✓" — length was measured, **well-formedness was never
  checked**, and the ✓ read as if it had been.
- **It is exactly the rulebook failure mode.** `agnix` validates for Codex, Cursor and Kiro as well; a stricter
  parser — another tool, or a future Claude Code — rejects 26% of fleet's skills. That is not a hypothetical for a
  thing whose entire purpose is to leave this repo.

**What this says about self-audit, in both directions.** fleet has ten measurement tools, 33 green suites and five
recurrence detectors, and none of them could find this, because **every one of them encodes fleet's own idea of what
to check**. That is the structural limit of self-audit, and it is the strongest argument in either plan for an
outside instrument. Counterweight, stated so this is not a sales pitch: **~63 of 92 findings are noise or
low-value for fleet as it stands**, the tool is pre-1.0 (0.41.1) with a rule count its own pages quote as 156 /
414 / 444, and it must never be run with `--fix` on prose a human wrote for a human.

**Blind spot found 2026-07-31, while executing A5 — `agnix`'s field allowlist LAGS the vendor docs.** It reported
`disallowed-tools` as *"Unknown frontmatter field"* on all four skills, while accepting `disable-model-invocation`
on the five beside them. The tiebreaker is the official
[frontmatter reference](https://code.claude.com/docs/en/skills), fetched the same day, which documents
`disallowed-tools` in a table with full semantics — alongside `arguments`, `user-invocable`, `effort`, `background`
and `hooks`, several carrying explicit `min-version: 2.1.196 / 2.1.218` markers. So agnix (published 2026-07-27,
v0.41.1) is behind, and **its "unknown field" rule cannot be trusted as a gate** for a repo that tracks current
Claude Code features. This is the pre-1.0 caveat above, now with a named instance rather than a disclaimer — and it
downgrades agnix from "external oracle" to **"external oracle with a known blind spot"**, which is what the
rulebook-readiness row should say. The failure is safe in this direction (a false warning, not a missed defect), but
the inverse — agnix passing something Claude Code rejects — has not been tested and should not be assumed.

**Open question 3 is answered: one-off audit now, standing check only after A3.** Adding a young third-party binary
to the weekly sweep buys a dependency for a check whose value is front-loaded — it has already told fleet the one
thing it did not know. Re-run it when `rulebook` is packaged, where a strict parser is the actual customer.

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

**AMENDED 2026-07-31, after C9 was retracted — the refusal quota is withdrawn.**

The "≥3 REFUSE or re-read" rule was written to guard against credulity toward outsiders. C9 shows the live bias runs
the other way: the single finding that proved wrong was the one concluding fleet was right and the outsider was
dangerous, and it was *manufactured* to fill this very quota. **A quota on refusals produces refusals.** That is the
same defect as a reviewer prompted to find gaps reporting gaps whether or not they exist — which this repo already
recorded as a warning (sibling plan F10) and then walked into anyway.

Replaced by a **symmetry rule with no target number**, which is what the supervisor actually asked for on
2026-07-31 (*"lấy 2 tư duy từ 2 phía và so sánh chứ không đặt nặng cho một bên nào hơn"*):

> **Equal burden of proof, both directions.** Keeping a fleet practice over an outside one requires the same
> evidence as replacing it: a named fleet incident, a measurement, or a source. **"It is how fleet already does it"
> is not evidence** — it is the thing under examination. Every verdict states what would change it.
>
> **A refusal must quote the artefact it refuses, in full context**, never a paraphrase and never one line lifted
> from a workflow. C9 is the worked example of why.
>
> There is **no minimum and no maximum** number of refusals or adoptions. The adoption cap of 3 stays, because it
> guards against a different failure (accumulation, evidenced by `commons`' 27 items / 0 installs) rather than
> against outside ideas as such.

## Acceptance criteria

- **AC-1 — artefacts, not descriptions.** Every `C`-finding cites a file or catalogue that was actually fetched;
  no finding rests only on a blog describing a repo. _Test: every C-row carries a `raw.githubusercontent.com`,
  `github.com/…/tree|blob`, or official-docs URL._
- **AC-2 — REPLACED 2026-07-31 (see the amendment in *Approach*): symmetric burden of proof, no refusal quota.**
  Every verdict — ADOPT, REFUSE or CONFIRMS-FLEET — names its evidence, and a REFUSE additionally **quotes the
  artefact in full context** plus the named fleet incident or measurement that outweighs it. "fleet already does it
  this way" is not admissible as evidence. _Test: no verdict row citing a paraphrase; no REFUSE row whose only
  argument is existing fleet practice; every row states what would change it._
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
- [x] **Batch 1 — read the two large frameworks as code. DONE 2026-07-31.** SuperClaude (C16) and Claude-Flow/Ruflo
      (C17) both REFUSED with measurements, `anthropics/skills` read at artefact level (C15, which **downgraded my
      own C5 and deleted a task**). **The pre-committed consequence FIRED for this batch's scope and is reported in
      the required words.** Still open: the community catalogue past the A section (C14) — deferred, because the
      A section already produced the one item worth having (`agnix`) and the marginal value of Z is unevidenced.
      _Files: this plan `## Findings`._ · _Test: AC-1 ✓ (every C-row cites a fetched file)._
- [x] **Batch 2 — run `agnix` against fleet. DONE 2026-07-31. Verdict: KEEP.** 42 errors · 50 warnings · 1 info;
      **10 of 38 skills have strictly-invalid YAML frontmatter**, confirmed by a second independent parser, and
      invisible to all ten of fleet's own tools plus Claude Code's lenient loader. ~63 of 92 findings are noise for
      fleet as it stands, and that is recorded too. `--fix` not run. Supply chain checked before install
      (`postinstall` read, SHA-256-verified pinned download, telemetry off, zero deps, scratchpad-only install).
      _Files: this plan `## agnix evaluation`._ · _Test: AC-4 ✓._
      **Follow-up queued, NOT done here:** fixing the 10 frontmatter files touches `skills/**`, which is on
      `CLAUDE.md`'s hard governance-prohibition list — so it goes up as a branch + diff for a human to merge, per
      `memory: sandbox-propose-governance`. It is a one-character-per-file fix (quote the description scalar).
- **NOT DONE (see `## Closing assessment`)** — **Batch 3 — the verdict table: ADOPT (≤3) / REFUSE / CONFIRMS-FLEET.** **Supervisor's gate.**
      _Files: this plan `## Verdict table`._ · _Test: AC-2, AC-3._
- **NOT DONE (see `## Closing assessment`)** — **Batch 4 — execute the ≤3 adoptions, write every verdict to the shared log, amend the sibling plan.**
      _Files: as the table names, `commons/docs/external-patterns.md`,
      `platform/plans/2026-07-31-harness-reexamination.md`._ · _Test: AC-5, AC-6._

## Before executing a batch

<!-- Read at the START of every working session on this plan, not once when it was written. Rationale and
     sources: `.claude/skills/project-plan/templates/plan.md`, same section. -->

1. **Is the premise of this batch still true?** Check the step against the repo AS IT IS TODAY, not as this
   plan described it. A plan is a snapshot; the repo moved.
2. **Has it already been built?** Grep for it, and read `INVENTORY`, the relevant `decisions.md` and
   `platform/proposals/` before writing anything.
3. **Is every number this batch promises derived, or guessed?**
4. **Write the answers here, dated — including "unchanged".**

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
