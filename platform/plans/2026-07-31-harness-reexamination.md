---
title: Re-examine the fleet harness against outside consensus and Anthropic's own guidance — adopt, align, and cut
kind: system-change
status: done
created: 2026-07-31
updated: 2026-07-31
# checkin cleared on closing: a date that outlives the plan is a reminder that has stopped meaning anything
# (/project-plan Step 3.5). The `## Check-in runbook` is kept as the re-measurement procedure for whoever
# re-derives the remainder — R4 and R5 closed UNSATISFIED, so this file is a record, not a finished job.
checkin_owner: agent
related:
  [
    platform/standards/token-and-research.md,
    platform/standards/autonomy-contract.md,
    platform/standards/documentation.md,
    platform/registries/tool-catalog.md,
    .claude/scripts/sprawl-check.mjs,
    platform/plans/2026-07-30-tool-test-coverage.md,
    rulebook/,
  ]
---

<!-- Persisted multi-session plan. Standard: platform/standards/documentation.md §5.5. Keep token-cheap. -->

> **Bằng tiếng Việt, đọc phần này là đủ hiểu:** đây là một đợt **soi lại toàn bộ bộ máy fleet** bằng ba cái
> gương, không phải bằng ý kiến của tôi: ① người ngoài giỏi hơn đang làm thế nào (chỉ lấy những điều **nhiều
> nguồn độc lập cùng đồng ý**) · ② **chính tài liệu của Anthropic** nói nên làm gì, cảnh báo đừng làm gì, và
> cung cấp sẵn những chỗ cắm nào · ③ **số đo của chính fleet**.
>
> **Mục đích thật không phải làm fleet đẹp hơn.** Nó là bệ phóng cho `rulebook` — thứ sẽ đi ra ngoài, phục vụ
> project sau và người khác. Một cái bệ lung lay thì mọi thứ dựng trên nó lung lay theo.
>
> **Kế hoạch này CÓ QUYỀN kết luận "fleet đã đủ, dừng lại đi".** Tôi ghi trước hậu quả đó ở mục *Pre-committed
> consequence* để nó không thể bị uốn: nếu đối chiếu xong mà số điều đáng áp dụng ít hơn ngưỡng đã cam kết, thì
> kết luận đúng là **ngừng xây harness và đi làm rulebook**, không phải tìm thêm việc để xây.
>
> **Và nó có quyền CẮT.** Anh đã nói "cắt khối u nếu cần" — nên có một đợt riêng cho việc bỏ, với luật rõ ràng,
> đi qua `attic` (dàn ra chờ, người xoá) chứ không xoá thẳng. Cắt mà không có luật thì chỉ là đổi khẩu vị.

## The ask, verbatim

> bạn hãy sync commit từ trên về và push giúp tôi, rồi lên cho tôi một kế hoạch thật kĩ càng về việc nghiên cứu
> lại fleet, tìm trên mạng những cấu trúc harness tối ưu được ưu chuộng, đem so sánh với fleet của tôi, để fleet
> của tôi có thể áp dụng và học hỏi những thứ đã được những người giỏi hơn tối ưu. Tiếp theo là nghiên cứu thật
> kĩ các tài liệu của anthopic, dựa trên những gì fleet có và thông qua tài liệu của anthopic xem xét kĩ lại ta
> đã đi đúng hướng chưa, thêm nữa tìm xem các best practice còn thiếu mà các tài liệu anthopic cung cấp, các công
> cụ, hook, tool, script, skill, rule, cơ chế, pattern, ... . Sau nhiều phiên làm việc với bạn, tôi e ngại fleet
> của chúng ta chưa đủ vững vàng, cần một đợt tái nhìn nhận, cắt đi những khối u nếu cần để bộ máy không bị cồng
> kềnh và thiếu thực tế. Tại sao những thời gian gần đây tôi lại quan tâm đến việc cải tổ lại fleet mà không tập
> trung cho các project, là vì sắp tới khi phát triển rulebook, cần một nền tảng harness vữa chắc với các rule,
> skill, hook, và cơ chế cực tốt thì mới có thể đưa rulebook ra ngoài để phục vụ tốt các project về sau của tôi
> được, thế nên tôi không ngại tốn thời gian và tài nguyên để tối ưu hóa fleet, đưa nó mạnh mẽ lên để harness bạn
> tối ưu nhất, đảm bảo mọi quy trình được đi đúng hướng, khiến bạn không bị mất context và lan man khi project
> càng ngày càng lớn, và sau này khi xảy ra nhiều tình huống khi project làm viêc với nhiều người khác tôi thông
> qua rulebook, bạn vẫn mang đến cho họ tư duy của tôi và học hỏi từ họ chứ không phải bị những tư duy trì trệ làm
> cho hệ thống fleet này trì trệ theo. Hãy làm thật kĩ giúp tôi 2 điều ở trên nghiên cứu cấu trúc harness tối ưu
> và được ưu chuộng, được các nhà phân tích đồng tính nhất, các bài báo, bài phân tích phải đồng tình (phần này
> tôi hơi lan man nhưng cứ theo ý là phải tìm được cấu trúc harness mạnh mẽ), tiếp theo nghiên cứu kĩ anthopic và
> kết luận, xem xét, phân tích fleet.

**Five requirements are extracted from that, and every acceptance criterion below maps to one:** (R1) find the
harness structures outside that credible people *agree* on; (R2) study Anthropic's own material thoroughly and
judge whether fleet is pointed the right way; (R3) list the best practices, mechanisms and extension points fleet
is *missing*; (R4) cut what is bloated or impractical; (R5) make the result strong enough to carry `rulebook`
outward — surviving other people, without their conventions flattening his.

## Closing assessment — 2026-07-31: does what shipped satisfy what was actually asked?

**Method, and a defect in this file that shapes everything below: there is no `## Scope changes` section.** The
template requires one and says an *empty* one is a finding; a *missing* one is worse. `/session-wrap` Step 3.5
compares the work against the raw quote **plus** that list, so with no list every divergence below is named a
**miss** by default rather than smoothed over.

**A clause of the ask that R1–R5 silently dropped.** The ask opens: *"bạn hãy sync commit từ trên về và **push**
giúp tôi"*. None of the five extracted requirements covers it, and it is **unsatisfied at close: 33 commits sit
unpushed on `main`.** The extraction that produced R1–R5 lost a clause of the request — the same failure this
plan then documented four separate times in its own rows, where a restatement was read back as the requirement.
It is not being fixed silently: pushing is outward-facing and is the one action explicitly held for the
supervisor.

| | Verdict at close |
|---|---|
| **R1** — outside structures credible people *agree* on | **SATISFIED.** 16 findings with explicit agreement counts, plus the sibling `community-harness-mining` plan's 17 rows. The strongest result is the opposite of what the ask anticipated: **F13 — fleet independently arrived at the field's settled architecture**, and neither large community framework (SuperClaude, Ruflo) yielded a single ADOPT |
| **R2** — study Anthropic's material, judge the direction | **SATISFIED.** A 58-row checklist, every row citing a doc that was actually fetched, each with a verdict of uses / misaligned / missing / correctly-absent |
| **R3** — the missing best practices and mechanisms | **SATISFIED as a list; partially executed.** Shipped: A1, A2, A5, A6, L1, L4, C1, C2. Withdrawn on measurement: A4. Refused on measurement: A3. Never started: A7. Fails the bar and marked so: A8 |
| **R4** — cut what is bloated or impractical | **NOT SATISFIED AS ASKED, and this is the headline.** Delivered: **one** real cut (540 words out of the always-loaded surface) and **three refusals to cut, each with a number** — C1 deleted nothing and reclassified instead (live WARN debt was 18, not 92), C3's three merge candidates were refuted by measurement, C4 is an explicit refusal to retire 17 unused skills. **fleet was not bloated in the ways this plan expected.** The ask said *"cắt đi những khối u **nếu cần**"*, and the "nếu cần" was tested and mostly came back no — a legitimate answer, but it is not completion of R4 and is not dressed up as one |
| **R5** — strong enough to carry `rulebook` outward | **NOT SATISFIED.** Measured: **15 of 38 skills are portable, 17 are agent-OS but fleet-coupled** (4 deeply — their procedure *reads* fleet standards and *writes* fleet registries), **6 are correctly deployment-only**. `rulebook` itself is ready — a validated plugin with its own marketplace since 2026-07-29, which this plan initially got wrong. **fleet's** harness is not portable, and mostly should not be. And **0 of 38 skills have an evaluation** (A7), the plan's own largest named gap, never begun |

### The execution record, which is the most useful thing in this file

Of the rows executed after the research came back, **nine changed shape or were refuted on contact with the repo**:
A3's premise was false when written · A4's justification did not survive measurement (delegation was already
100% explicit) · A5 specified a field that **grants** permission while I believed it restricted · A6 named an
event that cannot speak · L1's ≤800 target was invented one step before the measurement it demanded · L2's
`category:` field does not exist · C1's 92-WARN headline was 74 closed plans · C3's three pairs all measured
below the threshold · and A1 was executed from memory of its intent, setting the field on five skills while
missing `/app-env`, the only one that writes secrets.

**So the value of this plan was not its verdicts — it was the discipline of testing them.** That discipline is
now a shipped artefact rather than a habit: `## Before executing a batch` in the plan template, enforced by
`plan-audit`, whose question 2 is literally *"has it already been built?"*. That is the most durable thing this
plan produced, and it was produced by the plan being wrong repeatedly.

### Why it closes now instead of running the remainder

What is left is L3 (out of scope for the hard T4 list by this plan's own boundary), L6, A7 (L-effort, and its
`claude plugin eval` route died with A3) and A8 (fails the ADOPT bar). **Five consecutive rows ended in "already
existed", "false premise", or "my own earlier error".** Continuing to execute a list written *before* the repo
was read has negative expected value; what remains should be **re-derived from the repo as it now is**, not
inherited. Closing is therefore a judgement about the artefact, not a claim that fleet is finished.

### Answers to `## Decisions to distill`

- **Did "correctly absent" prevent shopping-list drift, or become a place to file inconvenient findings?**
  It worked. Seven items were filed there and none was later smuggled back in; agent teams, code-execution MCP
  and OPA/Rego stayed out. The category that *did* get abused is the opposite one — ADOPT — where three of six
  rows did not survive their own execution.
- **Did the pre-committed consequence hold?** It was honoured but it was **evaluated at the wrong time**. Judged
  before execution it counted six qualifying ADOPTs and did not fire; judged after, only four survived contact
  and it would have been one item from firing. Recorded in the row itself. A pre-commitment measured before the
  evidence arrives is a weaker device than it looks.
- **What was the cross-machine failure?** A migration artefact plus two real defects, not a structural
  assumption — and the deeper finding is the one found later: **four checkers give false results inside a git
  worktree**, so the branch-based governance workflow cannot be fully verified before merge.
- **Is cross-linking preservation or calcification?** Preservation, on this evidence: the citations are what
  surfaced `2026-07-30-claude-md-thin.mjs` and stopped L1 from re-doing a finished job. But they are unenforced
  prose, which is why `claude-md-budget.mjs` now discovers and checks the `CLAUDE.md §<heading>` wires.

## Goal

A written, sourced verdict on fleet's harness — **adopt / align / cut / correctly-absent** — where every item is
backed either by ≥2 independent outside sources or by a measurement from this repo, plus the executed cuts and
adoptions that verdict justifies. The goal is explicitly NOT "more harness". A defensible outcome of this plan is
a *smaller* fleet.

## Context

**Why now, and why not the projects.** `rulebook` is the next thing to leave this repo. Everything it carries —
rules, skills, hooks, mechanisms — will be judged by people who did not build it, on projects that are not ours.
Anything shaky in fleet becomes shaky everywhere it lands, and a convention that cannot survive disagreement will
either be ignored or will drag fleet down to the lowest common denominator. So the foundation gets audited before
it is published, not after.

**Measured state, 2026-07-31 — the honest version, both directions.**

_What is working (do not break these):_

- **33/33 test suites pass · 32/32 tools have a test · 0 exempt · 0 untested.** The named partial from the coverage
  campaign was closed on the second machine the same week.
- **The knowledge tier is genuinely used**: `ledger/2026-07.md` is the single most-read file on the platform (71
  reads), `standards/testing.md` 51. The claim "we write knowledge nobody reads" is measurably false.
- **Product work is not starved**: last 30 days, `sakubun` 464 commits vs `fleet` 211. The fear that the platform
  eats the projects is not supported by the commit record.
- **The always-loaded surface is cheap**: ~11k tokens/session total (CLAUDE.md 4.0k, skill descriptions 3.9k,
  memory index 2.0k, machine-local 1.1k) — about 1% of the window.
- **Five recurrence detectors clean**, two carrying declared backlogs with dated baselines.

_What is not (the material for this plan):_

- **45% of skills unused**: 38 installed, 21 ever used, **17 never**, of which 15 have sat unused ≥30 days.
- **49% of knowledge files unused**: 134 items, 68 used, 66 never.
- **`commons` has 27 proven items and 0 installs** — the anti-reinvention layer has never once been used.
- **The plan standard is weaker evidence than it first looked — correction recorded 2026-07-31.** The figure used
  in conversation was "105 errors, 10 clean of 66, so the standard is theatre". Re-read from the tool the next day:
  **25 ERROR · 93 WARN · 80 LEGACY over 67 plans.** The 105 was real when quoted and is now obsolete: the parallel
  session added a rule that downgrades an ERROR on a *closed* plan to LEGACY, because a finished plan is a
  historical record and not debt. So live-plan debt is **25 findings, not 105**, and the "standard nobody meets"
  argument mostly measured old plans being judged by a newer standard. AC-5 stands, but its premise is now much
  weaker — which is itself the finding: an aggregate headline was used as evidence without reading its components,
  the same mistake as the baseline that was eyeballed as 9 and measured as 11.
- **Only 4 of ~20 hook events are used.** Whole classes of enforcement point have never been considered.
- **fleet is BROKEN on the second machine**: the Windows box logged **44 BROKEN on 2026-07-30 and 1 on 07-31**
  while this box logged clean. The sweep is machine-specific and its log has no machine column, so the same file
  records contradictory verdicts with no way to tell why. **A harness that is only healthy on one machine is not
  a foundation for a rulebook that will run on many.**
- **A verified fail-open hole existed in the invariant-A1 guard** until 2026-07-31 — found only by deliberately
  breaking it. Whatever else is untested-by-breaking is in the same position.
- **17 skills unused but 0 retirement-eligible**, because every one is cited by ≥2 registry files. Cross-linking
  has made the platform hard to shrink — its own preservation rule now protects dead weight too.

## Prior art & sources

Sources already gathered and applied (2026-07-30/31); this plan's research batches extend them, they do not
re-derive them:

- [Anthropic — steering Claude Code: skills, hooks, rules, subagents](https://claude.com/blog/steering-claude-code-skills-hooks-rules-subagents-and-more)
  — the decision rule for automation-vs-prose, from the vendor: *"When there's something that absolutely must not
  happen, an instruction is the wrong tool… A real guardrail needs to be deterministic, and the enforcement
  methods are hooks and permissions."* **Adopted** as the classifier for R3: *must-not-happen → hook/permission ·
  procedure-to-follow → skill · needs context isolation → subagent.* This is also the yardstick for judging
  whether fleet's existing rules sit in the right layer.
- [Claude Code hooks reference](https://code.claude.com/docs/en/hooks.md) — the full event set (~20), the
  per-event exit-code semantics, and which events honour `additionalContext`. **Already changed a decision**: it
  killed a planned `PreCompact` design (no injection path) and redirected it to `SessionStart(source:compact)`.
- [LaunchDarkly stale-flag health rule](https://launchdarkly.com/docs/home/releases/flag-health) — the most
  concrete published "safe to retire" test: age ≥30d **and** inactive **and** not requested recently; plus the
  brake idea of blocking new creation while the stale count is high. **Adopted** in `sprawl-check.mjs`.
- [Mirian et al., *Web Feature Deprecation: A Case Study for Chrome*, ICSE 2019](https://arianamirian.com/docs/icse2019_deprecation.pdf)
  — deprecation gated on a usage threshold found in the real usage distribution (~0.01% of page loads) rather than
  on taste. **Adopted** as discipline (a numeric line declared in advance), **not** literally: with one user every
  share is 0% or huge.
- [Dan McKinley — Choose Boring Technology](https://mcfunley.com/choose-boring-technology) — ~3 innovation tokens
  per system, fixed supply. **Candidate** for capping how much novelty fleet carries at once.
- [Google SRE — Eliminating Toil](https://sre.google/sre-book/eliminating-toil/) — toil is manual, repetitive,
  automatable, tactical, devoid of enduring value; >50% toil is called a management problem. **Candidate** yardstick
  for "should this be a script".
- [Sandi Metz — The Wrong Abstraction](https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction) — duplication is
  cheaper than the wrong abstraction; the way forward is back. **Adopted** as the counter-pressure to fleet's
  reflex to extract and generalise.
- [Team Topologies — Thinnest Viable Platform](https://teamtopologies.com/key-concepts-content/what-is-a-thinnest-viable-platform-tvp)
  — a platform should be "just big enough, but not bigger". **Adopted** as the framing question for the cut batch.

Batch 1 added four more source families (harness-architecture consensus; real public setups and their regrets;
exhaustive Anthropic checklist; rule-distribution mechanics) — **delivered 2026-07-31, in `## Findings` below**,
each with its source URL and an agreement count. The single most consequential addition is
[Anthropic's plugin + marketplace layer](https://code.claude.com/docs/en/plugins), which turns out to be the
mechanism R5 was missing entirely; the single most consequential *correction* is
[Anthropic's own skills retrospective](https://claude.com/blog/lessons-from-building-claude-code-how-we-use-skills)
— they run hundreds of skills, which cancelled this plan's expected cut.

## Findings

Batch 1 ran 2026-07-31 (second session, after the token-limit death). Every row carries its source URL and
`AGREEMENT: N` = the number of **independent** sources that state it. Anthropic's own docs count as one source
family regardless of how many pages say it, except where a page adds a distinct mechanism. Measurements against
fleet were re-run from the tools in the same session, not recalled.

**F1 — An always-loaded instruction file degrades past a size threshold; the fix is progressive disclosure, not
more prose. AGREEMENT: 5.**
[Anthropic best-practices](https://code.claude.com/docs/en/best-practices): *"Bloated CLAUDE.md files cause Claude
to ignore your actual instructions!"* and *"Keep CLAUDE.md under 200 lines."* ·
[alexop.dev](https://alexop.dev/posts/stop-bloating-your-claude-md-progressive-disclosure-ai-coding-tools/):
frontier LLMs reliably follow 150–200 instructions and Claude Code's own system prompt spends ~50 of them;
HumanLayer keeps theirs under 60 lines ·
[tianpan.co](https://tianpan.co/blog/2026-02-14-writing-effective-agent-instruction-files): an analysis of 2,500+
repos with `AGENTS.md` found the median high-performing file was **300–350 words**, >500 words showed diminishing
returns and **>1,000 words correlated negatively** with performance ·
[digitalapplied](https://www.digitalapplied.com/blog/claude-code-anti-patterns-team-adoption-failure-modes-2026):
anti-pattern 03, files past ~200 lines *"trigger model sampling rather than comprehensive reading"* ·
[mindstudio](https://www.mindstudio.ai/blog/context-rot-claude-code-skills-bloated-files): context rot.
**fleet, measured:** `CLAUDE.md` = **184 lines / 2,270 words / 16.3KB**. It **passes** Anthropic's stated line rule
(184 < 200) and **fails the word evidence by 6.5×**. The line count is being satisfied by 88-character average
lines — the proxy is met, the thing the proxy measures is not.

**F2 — `.claude/rules/` with `paths` frontmatter is the vendor's named mechanism for keeping CLAUDE.md small.
AGREEMENT: 2.**
[Anthropic features-overview](https://code.claude.com/docs/en/features-overview): *"Use rules to keep CLAUDE.md
focused. Rules with `paths` frontmatter only load when Claude works with matching files, saving context."* ·
alexop.dev (above): split into `.claude/rules/` per path/directory/workflow.
**fleet:** exactly **one** rules file, `.claude/rules/frontend.md`, which uses `paths` correctly and is the
cheapest thing on the platform. The pattern is proven here and then never reused — while CLAUDE.md carries the
coding, docs, memory, autonomy, routing and lifecycle sections that are all path- or task-triggerable.

**F3 — A must-not-happen rule belongs in a hook, not in prose. AGREEMENT: 4.**
[Anthropic steering blog](https://claude.com/blog/steering-claude-code-skills-hooks-rules-subagents-and-more)
(already adopted) · Anthropic features-overview: *"Put guardrails in hooks. An instruction like 'never edit .env'
in CLAUDE.md or a skill is a request, not a guarantee."* · Anthropic best-practices, failure-pattern fix: *"If
Claude already does something correctly without the instruction, delete it or convert it to a hook."* ·
digitalapplied: *"Three hooks that always run beat 30 pages of advisory documentation Claude might or might not
follow."*
**fleet: already correct.** `secret-guard` + `autonomy-gate` + `invariant-warn` are hooks, not paragraphs. Record
this as confirmation, not as a gap.

**F4 — Hooks have the symmetric failure: hook spam and per-tool-call latency. AGREEMENT: 3.**
digitalapplied anti-pattern 05, *"Every event triggers something"*, prescribing **2–4 hooks** ·
[mindstudio](https://www.mindstudio.ai/blog/claude-code-skills-vs-hooks-difference): *"If a hook is doing complex
branching logic, that's a sign it might belong in a skill"* — and Claude has **no awareness** a hook exists ·
[hidekazu-konishi](https://hidekazu-konishi.com/entry/claude_code_hooks_complete_guide.html): every hook adds
latency to every matching tool call.
**fleet:** 13 hooks; **3 fire on every `Edit|Write` PreToolUse and 3 more on PostToolUse**, so a single file edit
pays six Node process spawns. The "2–4 maximum" is one blog's number with no corroboration — treat it as a latency
warning to measure, **not** as a cap to obey.

**F5 — Skill *count* is not the constraint; discovery quality is. AGREEMENT: 2, with 1 explicit dissent.**
[Anthropic — Lessons from building Claude Code: how we use
skills](https://claude.com/blog/lessons-from-building-claude-code-how-we-use-skills): Anthropic runs **hundreds of
skills in active use**; the discipline is that each skill *"fit cleanly into one"* of nine categories because ones
*"straddling several confuse the agent"*, and descriptions are written *"for the model, not for humans"* · Anthropic
features-overview: *"If descriptions are vague or overlap, Claude may load the wrong skill or miss one that would
help."* · **Dissent:** digitalapplied anti-pattern 02 puts a hard cap at *"~20 entries"*.
**This finding cancels a cut fleet was about to make.** The vendor running hundreds refutes the 20-cap directly, so
"38 skills is too many" is not supported. What *is* supported is that all 38 compete in one flat discovery tier
with no category structure. Open question 2 is answered: the skills are not the disease.

**F6 — `disable-model-invocation: true` takes a skill's context cost to zero, and is the documented answer for
skills with side effects. AGREEMENT: 2 (two distinct vendor mechanisms).**
Anthropic features-overview: *"Set `disable-model-invocation: true` in a skill's frontmatter to hide it from Claude
entirely until you invoke it manually. This reduces context cost to zero"* and *"Use it for skills with side
effects… ensures only you trigger them."* · same page: `skillOverrides` in settings does it **for a skill you did
not write**, without editing its file. Anthropic best-practices uses the field in its own `/fix-issue` example.
**fleet, measured:** **0 of 38** skills set it. Every skill's frontmatter uses only `name` + `description` — no
`allowed-tools`, no `disable-model-invocation`, no `context: fork`, no `skills:` preload. So `/app-remove` (tears
down a container, volume, image and directory), `/app-env` (touches secrets over SSH) and `/host-maintenance` are
all **model-invocable**, and the 17 never-used skills each pay description rent every session.

**F7 — Tool restriction (`allowed-tools` on a skill, `tools:` on a subagent) is the enforcement layer for
"report only". AGREEMENT: 2 vendor pages.**
[Anthropic sub-agents](https://code.claude.com/docs/en/sub-agents) (`tools:` frontmatter) · Anthropic skills docs
(tool restrictions).
**fleet:** `/host-audit`'s own description promises *"report only — every destructive action asks"*, and
`/ui-ux-review`, `/dependabot-review`, `/supply-chain-guard` are read-only by intent. All of it is prose. The one
place fleet does restrict tools is `.claude/agents/reviewer.md` — which proves the mechanism is understood and
applied once.

**F8 — A check the agent can run itself is the single highest-leverage practice. AGREEMENT: 3.**
Anthropic best-practices: *"Give Claude a check it can run… It's the difference between a session you watch and one
you walk away from"* — with four escalating gates: in-prompt → `/goal` condition → **Stop hook** → verification
subagent · Superpowers (see F11) enforces red/green TDD and ships `verification-before-completion` as a skill ·
[dev.to/galian](https://dev.to/galian/claude-code-workflow-best-practices-that-ship-code-na): *"a verification loop
that kills hallucinations."*
**fleet:** has the *content* (`/verification-before-completion`, `tool-check` 33/33, `/lint-and-validate`) but its
two `Stop` hooks (`suggest-session-wrap`, `legibility-lint`) are **nudges**. Nothing blocks a turn from ending.

**F9 — `/goal` and prompt-based Stop hooks are a native turn-level gate judged by a *separate* model.
AGREEMENT: 2 vendor mechanisms.**
[Anthropic /goal](https://code.claude.com/docs/en/goal): after every turn *"a small fast model checks whether the
condition holds"*; *"completion is decided by a fresh model rather than the one doing the work"*; `/goal` is itself
*"a wrapper around a session-scoped prompt-based Stop hook"* · Anthropic best-practices: a Stop hook *"blocks the
turn from ending until it passes. Claude Code overrides the hook and ends the turn after 8 consecutive blocks."*
**fleet:** absent. This is the exact mechanism for the failure recorded in memory `verify-end-state-not-upload`
(claiming done from an intermediate green step) and `report-state-from-the-tool` (reciting a remembered number).

**F10 — Adversarial review in a fresh context — with an explicit brake against chasing every finding.
AGREEMENT: 2.**
Anthropic best-practices: a reviewer subagent *"sees only the diff and the criteria you give it, not the reasoning
that produced the change"*; and the callout: *"A reviewer prompted to find gaps will usually report some, even when
the work is sound… Chasing every finding leads to over-engineering: extra abstraction layers, defensive code, and
tests for cases that can't happen."* · Superpowers ships `requesting-code-review` / `receiving-code-review`.
**fleet:** has `reviewer.md` and `/honest-critique`. **The brake is missing** — nothing in fleet tells the reviewer
or the reader that a finding list is expected to be partly noise. Given `practice-first-lean-ceremony`, this is the
cheapest anti-bloat sentence available.

**F11 — Plugins + a marketplace are the vendor's distribution layer, and the consensus champion ships that way.
AGREEMENT: 3.**
[Anthropic plugins](https://code.claude.com/docs/en/plugins): a plugin root holds `.claude-plugin/plugin.json`
(`name`/`description`/`version`/`author`) plus `skills/`, `agents/`, `hooks/hooks.json`, `.mcp.json`, `.lsp.json`,
`monitors/`, `bin/`, `settings.json`; skills are namespaced `/plugin:skill`; a marketplace is *"just a git repo with
a `marketplace.json`"* and **can be private**; `claude plugin validate ./plugin` is a real external checker;
`--plugin-dir` / `--plugin-url` test it without installing ·
[Superpowers](https://github.com/obra/superpowers) — 94k stars, accepted into Anthropic's official marketplace —
is **14 skills, each a single SKILL.md of a few hundred words**, shipped as a multi-platform plugin
(`.claude-plugin`, `.codex-plugin`, `.cursor-plugin`, `.agents/plugins`) ·
[zenn.dev/katsuhisa\_](https://zenn.dev/katsuhisa_/articles/claude-code-internal-marketplace?locale=en) and
[hidekazu-konishi](https://hidekazu-konishi.com/entry/claude_code_plugins_complete_guide.html): the internal team
marketplace as the sharing route.
**~~fleet/rulebook: no plugin artefact exists… no mechanism at all — the implicit plan was "copy files into
someone else's repo".~~ FALSE. RETRACTED 2026-07-31 — see the A3 row.** `rulebook/` has had
`.claude-plugin/marketplace.json` + `plugins/rulebook-frontend/.claude-plugin/plugin.json` (with `hooks/hooks.json`
and `.release.json`) **since 2026-07-29**, and both manifests pass `claude plugin validate` (**✔ ✔**).
`INVENTORY` line 78 states it in one sentence, and there is a recorded decision for the path it replaced.
I read Anthropic's plugin docs and Superpowers' packaging, then wrote this row **without reading the inventory row
for the project it is about** — which `CLAUDE.md`'s context-loading rule and `memory: check-prior-decisions-early`
both require. The finding about the *mechanism* stands and is well-sourced; the claim about **fleet** was research
into a problem already solved two days earlier.

**Two CLI capabilities found in the same command, both unused, both directly relevant:**
`claude plugin eval` — *"Run eval cases (`evals/**/case.yaml` or `evals/**/prompt.md` + `graders/*.md`) … and add a
**no-plugin baseline arm**"*. That is **A7's mechanism, already shipped**, including the baseline Anthropic's
authoring guide says to establish (that guide's "no built-in way to run these" refers to the API, not this CLI). ·
`claude plugin details <name>` — *"component inventory and **projected token cost**"*, a direct measurement of the
discovery-tier cost that F1 and A1 estimated by hand all session. Also `claude plugin tag`, which validates that
`plugin.json` and the marketplace entry agree — C5's version question answered by tooling instead of by taste.

**BOTH BLOCKED — checked immediately after recommending them, and the recommendation did not survive.**
`claude plugin eval` prints **"`plugin eval` is currently in early access"** and runs nothing, so A7's native path
is **unavailable to fleet today**; A7 returns to hand-built or wait, and the "A7 is now cheaper than A3" advice one
message earlier was wrong. · `claude plugin details` resolves **installed plugins only** — its own error suggests
`--plugin-dir`, but that is the `claude` launch flag, not a subcommand option (`error: unknown option`). Measuring
fleet's discovery cost with it therefore requires **installing** a plugin, which is a user-scope config change and
not something to do unprompted.
**Consequence for sequencing, stated plainly:** `--ablation with-without` only offers its baseline arm when the
target is a plugin *by name*. So measurable, baselined evals for fleet's skills **require A3's remainder first** —
A7 depends on A3, the reverse of the order I proposed. And with `plugin eval` gated, even that ordering is on hold.
**The honest position is that the queue is blocked on a human merge, and inventing adjacent work to stay busy is
the failure this plan was written to cut.**

**F12 — Subagent isolation returning 1–2k distilled tokens is the documented context lever. AGREEMENT: 4.**
[Anthropic — Effective context
engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents): a subagent *"might
explore extensively… but returns only a condensed, distilled summary of its work (often 1,000–2,000 tokens)"* ·
Anthropic best-practices: *"Since context is your fundamental constraint, subagents are one of the most powerful
tools available"* · LangChain / mem0 / atlan on Isolate.
**fleet: already correct.** `standards/token-and-research.md §3` encodes *"distill at the edge"* and *"search wide,
fetch narrow"*. Confirmation, not a gap.

**F13 — Write / Select / Compress / Isolate is the settled vocabulary of the field. AGREEMENT: 6.**
[LangChain](https://www.langchain.com/blog/context-engineering-for-agents) ·
[mem0](https://mem0.ai/blog/context-engineering-ai-agents-guide) ·
[atlan](https://atlan.com/know/ai-agent/context-engineering/context-engineering-techniques-ai-agents/) ·
[braingrid](https://www.braingrid.ai/blog/four-pillars-of-context-engineering) ·
[durgadas](https://durgadas.in/blog/deep-agent-context-engineering-write-select-compress-isolate) ·
[Sourcegraph](https://sourcegraph.com/blog/context-engineering).
**fleet has all four**, built independently: Write = `.claude/memory/` + `decisions.md` + plan files · Select = the
JIT context-loading path in CLAUDE.md ("read on need, NOT reflexively") · Compress = `compact-recap` +
`ledger-split` + `decisions-split` · Isolate = the subagent delegation rule. **This is the strongest single piece
of evidence that fleet is pointed the right way**, and it was arrived at without reading these sources.

**F14 — "Right altitude": avoid brittle if-else prompt logic and laundry lists of edge cases. AGREEMENT: 1 (vendor,
strong).**
Anthropic context-engineering: *"Avoid complex, brittle logic in their prompts"*; the failure mode is teams who
*"stuff a laundry list of edge cases into a prompt in an attempt to articulate every possible rule"* rather than
curating diverse canonical examples. Also: *"the smallest possible set of high-signal tokens."*
**fleet:** CLAUDE.md is built almost entirely of clauses traceable to named past incidents. That is exactly the
laundry-list shape, and it is why 2,270 words exists. The counter-pressure already in the plan
(Sandi Metz, TVP) points the same way from a different discipline.

**F15 — Skill authoring has hard published numbers, and evaluation comes *first*. AGREEMENT: 2.**
[Anthropic skill authoring best
practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices.md): SKILL.md body
**under 500 lines**; `description` ≤ 1,024 chars, third person, "what + when"; references **one level deep** from
SKILL.md (deeper nesting makes Claude `head -100` and read partially); a **TOC for any reference file >100 lines**;
match *degree of freedom* to fragility (exact script for a migration, open instructions for a review); *"Create
evaluations BEFORE writing extensive documentation"*, **≥3 scenarios**, baseline first, test on Haiku + Sonnet +
Opus ·
[atlan](https://atlan.com/know/ai-agent/ai-agent-skills/agent-skill-best-practices/): the same six, plus versioning.
**fleet, measured:** all 38 SKILL.md bodies are **under 500 lines** (largest `app-onboard` = 199) ✓ · all 38
descriptions are **under 1,024 chars** (largest `code-reuse` = 563) ✓ · 4 skills use a `references/` directory ·
**0 of 38 have an evaluation**, though `/behavioural-eval` exists to write them.

**F16 — Prune on a cadence; unused config is a liability. AGREEMENT: 3.**
digitalapplied: quarterly retirement review below an invocation threshold, and a quarterly permission-allowlist
audit (anti-pattern 04, "permission drift") · Anthropic best-practices: *"Treat CLAUDE.md like code: review it when
things go wrong, prune it regularly, and test changes by observing whether Claude's behavior actually shifts"* ·
LaunchDarkly stale-flag rule (already adopted).
**fleet: already correct and ahead** — `sprawl-check` + `attic` + `usage-census` implement exactly this, with the
stage→verify→human-deletes brake that none of the sources describe.

## Anthropic checklist (AC-2)

Every documented practice, warning and extension point found, judged against fleet. Verdict vocabulary:
**uses** · **misaligned** · **missing** · **correctly-absent**.

| # | Anthropic practice / extension point | Doc | fleet |
|---|---|---|---|
| 1 | CLAUDE.md as always-loaded project context | [memory](https://code.claude.com/docs/en/memory) | **uses** |
| 2 | Keep CLAUDE.md under 200 lines; prune ruthlessly | [best-practices](https://code.claude.com/docs/en/best-practices) | **uses** (184) — but see F1, misaligned on words |
| 3 | `@path` imports in CLAUDE.md | [memory](https://code.claude.com/docs/en/memory) | **missing** — fleet points with prose paths instead |
| 4 | `CLAUDE.local.md` for machine-private facts | [best-practices](https://code.claude.com/docs/en/best-practices) | **uses** (exactly as documented) |
| 5 | `.claude/rules/` with `paths` frontmatter | [features-overview](https://code.claude.com/docs/en/features-overview) | **misaligned** — 1 file; the rest lives in CLAUDE.md |
| 6 | Convert a repeated instruction into a hook | [best-practices](https://code.claude.com/docs/en/best-practices) | **uses** (13 hooks) |
| 7 | Hooks are the only real guardrail | [features-overview](https://code.claude.com/docs/en/features-overview) | **uses** (`secret-guard`, `autonomy-gate`) |
| 8 | ~30 hook events available | [hooks](https://code.claude.com/docs/en/hooks) | **misaligned** — 4 of ~30 event types used |
| 9 | `Stop` hook as a blocking verification gate (8-block override) | [best-practices](https://code.claude.com/docs/en/best-practices) | **missing** — fleet's Stop hooks only nudge |
| 10 | `/goal` — separate-model completion evaluator | [goal](https://code.claude.com/docs/en/goal) | **missing** |
| 11 | Prompt-based / subagent-type hooks (not just `command`) | [hooks-guide](https://code.claude.com/docs/en/hooks-guide) | **missing** — all 13 are `command` |
| 12 | `UserPromptSubmit` (blocks + injects) | [hooks](https://code.claude.com/docs/en/hooks) | **missing** |
| 13 | `PermissionRequest` / `PermissionDenied` | [hooks](https://code.claude.com/docs/en/hooks) | **missing** — `autonomy-gate` sits at PreToolUse |
| 14 | `PostCompact` (exists; no `additionalContext`) | [hooks](https://code.claude.com/docs/en/hooks) | **correctly-absent** — confirms the earlier `SessionStart(compact)` redirect was right |
| 15 | `SubagentStart` / `SubagentStop` | [hooks](https://code.claude.com/docs/en/hooks) | **missing** |
| 16 | `FileChanged` (watched file changed on disk) | [hooks](https://code.claude.com/docs/en/hooks) | **missing** — and there is a named fleet failure for it |
| 17 | `ConfigChange` / `InstructionsLoaded` | [hooks](https://code.claude.com/docs/en/hooks) | **missing** |
| 18 | `SessionEnd` | [hooks](https://code.claude.com/docs/en/hooks) | **missing** — `/session-wrap` is suggested at `Stop` |
| 19 | `PostToolUseFailure` | [hooks](https://code.claude.com/docs/en/hooks) | **missing** |
| 20 | `disableAllHooks` / `allowManagedHooksOnly` | [hooks](https://code.claude.com/docs/en/hooks) | **correctly-absent** — org-managed settings, no org |
| 21 | Skills in `.claude/skills/<name>/SKILL.md` | [skills](https://code.claude.com/docs/en/skills) | **uses** (38) |
| 22 | SKILL.md body <500 lines | [skill best-practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices.md) | **uses** (max 199) — **but see `community-harness-mining` C4: this "uses" was scored against the loosest of three caps that disagree ~10×.** Superpowers caps at <500 *words* (<200 for frequently-loaded); fleet averages **830 words** and exceeds it on **27 of 38**. Verdict downgraded to **source-dependent**, and the source fleet follows must be declared |
| 23 | `description` ≤1024 chars, third person, what+when | same | **uses** (max 563) |
| 24 | Progressive disclosure into `references/`, one level deep | same | **uses** partially (4 of 38) |
| 25 | TOC in any reference file >100 lines | same | **missing** (unverified per-file; treat as unchecked) |
| 26 | `disable-model-invocation: true` for side-effect skills | [features-overview](https://code.claude.com/docs/en/features-overview) | **missing** — 0 of 38 |
| 27 | `skillOverrides` in settings (hide a skill you didn't write) | same | **missing** |
| 28 | `allowed-tools` on a skill | [skills](https://code.claude.com/docs/en/skills) | **missing** — 0 of 38 |
| 29 | `context: fork` (run a skill in isolated context) | [skills](https://code.claude.com/docs/en/skills) | **missing** |
| 30 | `$ARGUMENTS` in a skill | [skills](https://code.claude.com/docs/en/skills) | **missing** |
| 31 | ≥3 evaluations per skill, baseline-first, multi-model | [skill best-practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices.md) | **missing** — 0 of 38, though `/behavioural-eval` exists |
| 32 | Nine clean skill categories; no straddling | [lessons/skills blog](https://claude.com/blog/lessons-from-building-claude-code-how-we-use-skills) | **misaligned** — registries index by citation, not category |
| 33 | `PreToolUse` hook to log skill usage and find under-triggering skills | same | **misaligned** — `usage-census` mines transcripts instead, and admits it sees only 9 sessions |
| 34 | `.claude/agents/<name>.md` with `name`/`description`/`tools`/`model` | [sub-agents](https://code.claude.com/docs/en/sub-agents) | **misaligned** — 1 file (`reviewer.md`); delegation is otherwise ad-hoc |
| 35 | Subagent `skills:` preload field | [features-overview](https://code.claude.com/docs/en/features-overview) | **missing** |
| 36 | Subagents for investigation; distilled return | [best-practices](https://code.claude.com/docs/en/best-practices) | **uses** (`token-and-research.md §3`) |
| 37 | Adversarial reviewer in a fresh context | [best-practices](https://code.claude.com/docs/en/best-practices) | **uses** (`reviewer.md`) |
| 38 | The over-engineering brake on reviewer findings | same | **missing** |
| 39 | Explore → plan → code → commit; skip the plan for one-sentence diffs | [best-practices](https://code.claude.com/docs/en/best-practices) | **uses** — the P1/P2/P3 tiers are this, with a sharper rule |
| 40 | `AskUserQuestion` interview → SPEC.md → fresh session | same | **misaligned** — fleet interviews, but does not hand the spec to a clean session |
| 41 | `/clear` after two failed corrections | same | **missing** as a written rule |
| 42 | `/context` to verify what loaded | same | **missing** as a written check |
| 43 | Permission allowlists + auto mode + `/sandbox` | [permission-modes](https://code.claude.com/docs/en/permission-modes) | **misaligned** — `autonomy-gate` reimplements part of auto mode's tiering |
| 44 | Plugins: `.claude-plugin/plugin.json` + `skills/`+`agents/`+`hooks/hooks.json` | [plugins](https://code.claude.com/docs/en/plugins) | **missing** — the R5 mechanism |
| 45 | Private team marketplace = a git repo with `marketplace.json` | [plugin-marketplaces](https://code.claude.com/docs/en/plugin-marketplaces) | **missing** |
| 46 | `claude plugin validate` (+ `--strict`) | [plugins](https://code.claude.com/docs/en/plugins) | **missing** — a free external checker fleet doesn't run |
| 47 | `--plugin-dir` / `--plugin-url` to test before installing | same | **missing** |
| 48 | Plugin `settings.json` `agent:` key (a plugin sets the main-thread agent) | same | **missing** |
| 49 | Code-intelligence / LSP plugin for typed languages | [discover-plugins](https://code.claude.com/docs/en/discover-plugins) | **missing** — every fleet project is TypeScript |
| 50 | CLI tools over MCP for context efficiency (`gh`, etc.) | [best-practices](https://code.claude.com/docs/en/best-practices) | **uses** (`gh`, `ssh`, `docker`) |
| 51 | Non-interactive `claude -p` + `--allowedTools` for fan-out | [headless](https://code.claude.com/docs/en/headless) | **uses** (autonomy contract) |
| 52 | Agent teams (experimental, higher token cost) | [agent-teams](https://code.claude.com/docs/en/agent-teams) | **correctly-absent** — one operator, N× spend |
| 53 | Background monitors (`monitors/monitors.json`) | [plugins](https://code.claude.com/docs/en/plugins) | **correctly-absent** — nothing to tail; the NUC is down |
| 54 | Code execution with MCP (98.7% token cut at scale) | [Anthropic](https://www.anthropic.com/engineering/code-execution-with-mcp) | **correctly-absent** — the saving presumes dozens of MCP servers; fleet has ~1 |
| 55 | Compaction + structured note-taking as long-horizon technique | [context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) | **uses** (`compact-recap`, memory, ledger) |
| 56 | Just-in-time context via lightweight identifiers | same | **uses** — the JIT loading path is this, named |
| 57 | Avoid bloated tool sets / ambiguous tool choice | same | **misaligned** — 38 flat skill descriptions is the same failure at the skill layer |
| 58 | "Right altitude", no brittle if-else prompt logic | same | **misaligned** — see F14 |

## Verdict table (Batch 3)

Bars are as declared in *Approach & tradeoffs* and were not loosened. Effort: **XS** <30min · **S** ~1h ·
**M** a session · **L** multi-session.

### ADOPT — fleet lacks it and should have it

| # | Mechanism | Named fleet failure it addresses | Effort |
|---|---|---|---|
| **A1** | `disable-model-invocation: true` on every manual, side-effecting skill. **SHIPPED, then VERIFIED AGAINST `/context`, which found the first pass had missed one — the secrets one.** | **17 skills never used, 0 retirement-eligible, and every one still charges description rent each session** (measured 2026-07-31); and `/app-remove` — which deletes a container, a named volume, an image and a directory — was model-invocable. F6 + F5 turn a stuck delete decision into a config change.<br>**The mechanism is confirmed, not assumed:** in `/context` the five skills that got the field are **absent from the loaded skill list entirely** — the zero-cost claim was inferred before and is now measured.<br>**The gap: F6 named three skills by name — `/app-remove`, `/app-env` ("touches secrets over SSH") and `/host-maintenance` — and the first pass set the field on five skills, adding two F6 never named while missing `/app-env`, the only one that writes secrets.** It sat in the discovery tier, model-invocable, until `/context` listed it next to the five that had correctly vanished. Fixed 2026-07-31; **6 manual-only now, 32 in the discovery tier at ~3,350 tokens.** The lesson is not "check more carefully" — it is that a checklist item naming three things was executed from memory of the intent rather than by re-reading the three names, which is `memory: report-state-from-the-tool` in a new costume.<br>**Two harness facts no fleet tool reports, both from `/context`:** a `.claude/workflows/*.js` file is listed **alongside skills** (`deep-research` is a workflow), so the tier is 33 entries; and `skill-audit`'s "38 installed" counts directories, which is not the loaded-cost number. Recorded in `/skill-authoring`.<br>**And a live instance of the grep trap, inside this same batch:** `grep -l 'disable-model-invocation: true' .claude/skills/*/SKILL.md` reported `skill-authoring` as manual-only the moment that string appeared in its *prose*. Any count of a config field must scope the match to the frontmatter block | **S** |
| **A2** | **DONE 2026-07-31 on branch `feat/verify-claim-gate` — and the honest scope is narrower than this row implied.** A blocking `Stop` hook; `/goal` deferred (session-scoped, so it is a per-run choice, not a harness change). **Before building, the uncomfortable check: none of the five wrong claims in this session would have been caught by it**, because each *had* run a tool and then misread it. A gate can require evidence to exist; it cannot require it was read correctly — written at the top of the hook file so nobody mistakes it for coverage. **The defect that nearly shipped:** Claude Code records tool results as `role: "user"` (247 of them vs 19 real human messages in a real transcript), so the naive turn boundary put every `Bash` call outside the window — a **false-block machine**, and the 17-case synthetic suite passed **100%** with it present because the fixtures used a transcript shape that does not exist. After the fix: 19 real turns, **0** blocked. Mechanical evidence for **A7**. | Memory `verify-end-state-not-upload` exists **because I claimed done from an intermediate green step**; `report-state-from-the-tool` exists because I recited a remembered number twice in one session. F8/F9: the completion judge must not be the worker | **M** |
| **A3** | **PREMISE FALSE — RETRACTED AND RESCOPED 2026-07-31. This is the worst error in this plan.** | The row claimed: *"**R5 has no mechanism at all.** `rulebook` was going to leave this repo as copied files, with no versioning, no namespacing…"*. **All of it is false, and it was false when written.** `rulebook/` already contains `.claude-plugin/marketplace.json`, `plugins/rulebook-frontend/.claude-plugin/plugin.json`, `plugins/rulebook-frontend/hooks/hooks.json` + `check-file.mjs`, and `.release.json` — a plugin **with** a marketplace, plugin-scoped hooks and a release file. Run against the real tool: `claude plugin validate` → **✔ Validation passed** for the plugin manifest **and** the marketplace manifest. And `INVENTORY` line 78 states it plainly: *"**Primary path = a Claude Code plugin hook** (`plugins/rulebook-frontend`, offline, ~0 tokens/session, installed at user scope 2026-07-29)"* — plus a recorded decision (`proposals/2026-07-29-mcp-path-keep-or-retire.md`) about the MCP path it replaced. **Root cause: I never read the file `CLAUDE.md` tells me to read.** The context-loading rule says read `INVENTORY §0` for a project-lifecycle change; `memory: check-prior-decisions-early` says cross-check existing built code *before endorsing and before building*. I did neither, and then wrote a plan, a findings row (F11) and a readiness table around a gap that had been closed two days earlier. Researching a solved problem is more expensive than any mechanism misread in this session, because nothing downstream re-tests a premise. **What is actually left of A3:** (a) fleet's *own* harness — skills/hooks — is still not packaged, only rulebook's frontend rules are; (b) the marketplace is **not registered on this machine** (`claude plugin marketplace list` shows only `claude-plugins-official`, `claude plugin list` shows none installed), so INVENTORY's "installed" is **machine-ambiguous** — the same defect Batch 2 fixed for `health-sweep`, in a different file | **S**, not M |
| **A4** | **DOWNGRADED 2026-07-31 — measured before building, and most of the justification below did not survive.** The claim was that delegation "depends on remembering". Measured across **all 77 transcripts on this box**: **65 Agent calls**, and **100% set `subagent_type` explicitly**; of 48 parseable Agent inputs, **36 (75%) also pinned `model`**. So remembering *worked*. What remains true is narrower: **51 of 65 (78%) went to `general-purpose`**, which carries `*` — every tool — so a read-only research delegation gets `Write`/`Edit` it never needs. But the built-in **`Explore`** agent already covers exactly that case and was used **13×**, and fleet's own `reviewer` has been used once. Writing agent files that duplicate `Explore` and `general-purpose` is the `commons` failure (27 items, 0 installs) with a new name. **Verdict: keep `reviewer`, add nothing, revisit only if a specific delegation shape repeats with a tool set neither built-in covers.** Open question 3's "yes" is withdrawn: the artefact is not the gap, the tool restriction is, and it is small. ~~Real `.claude/agents/` definitions (`tools:`, `model:`, `skills:`) for the workers fleet already spawns by hand~~ | `token-and-research.md §3` mandates "delegate mechanical work to cheaper-model subagents" and "distill at the edge" — **as prose**. Nothing pins the model, restricts the tools, or preloads the skill, so every delegation depends on remembering. Open question 3 is answered: yes. **External agreement added 2026-07-31 (`community-harness-mining` C10):** Superpowers' `subagent-driven-development` states *"Always specify the model explicitly when dispatching a subagent"* as a rule — so this is no longer argued from fleet's own prose alone | **S** |
| **A5** | ~~`allowed-tools` on the read-only skills~~ → **`disallowed-tools`. DONE 2026-07-31 on branch `fix/skill-frontmatter-yaml` — and the original wording was DANGEROUSLY WRONG.** | `/host-audit` promises *"only reads & reports; every destructive action must ask"* — unenforceable as prose, so the intent was right. **But `allowed-tools` is a permission GRANT, not a restriction:** the [frontmatter reference](https://code.claude.com/docs/en/skills) defines it as *"tools Claude can use **without asking permission** during the turn that invokes this skill"*. Executing this row as written would have added **blanket pre-approval** to `host-audit`, `app-protect` and `app-env` — the skills touching auth and secrets — while I believed I was restricting them. **`disallowed-tools` is the restriction field.** F7's "AGREEMENT: 2" was inflated: it cited the skills doc for a field name I had **inferred and never fetched** — the same failure as C9, caught this time only because the field had to be typed into a real file. **Shipped:** `disallowed-tools: Write Edit` on `host-audit`, `ui-ux-review`, `dependabot-review`, `supply-chain-guard`, each verified to have zero write paths first. Destructive Bash left alone — `host-audit` needs Bash, the pattern syntax is unverified, and `autonomy-gate` already covers it deterministically | **S** |
| **A6** | ~~A `FileChanged` hook~~ → **a `Stop` + `UserPromptSubmit` pair. DONE 2026-07-31 on branch `feat/tree-moved-notice`.** `FileChanged` **cannot work for this**: verified against the [hooks reference](https://code.claude.com/docs/en/hooks) before building — *"Cannot use `systemMessage` or `additionalContext` — these have no effect for `FileChanged`"*, and its exit 2 blocks nothing. A hook the agent cannot hear does not solve "the agent overwrote someone else's work". **Same shape as the `PreCompact` finding (checklist row 14): the event exists, the injection path does not** — that is now twice in one plan that an event was proposed by name without checking whether it can speak. The shipped design snapshots the tree at `Stop` and compares at the next `UserPromptSubmit`, so the delta is exactly what changed *while I was not running*; prompt-to-prompt would fold in my own edits. Never blocks — `UserPromptSubmit` exit 2 **erases the user's prompt**, which is worse than the problem. 15 tests, 5 mutants, verified end-to-end against the real repo | Memory `user-edits-files-concurrently` records a **repeated, named** failure: the user or a parallel Claude session edits the tree mid-session and I build/commit over it. fleet's answer today is "re-check git status", i.e. remembering. This is the exact event. **Upgraded from "remembered" to "observed live" during this very session (2026-07-31):** two working-tree changes appeared that this session did not make — `.claude/scripts/sprawl-check.mjs` was ` M` at session start and clean by mid-session, and `platform/reports/health-sweep-log.md` changed from `1 BROKEN` to `2 BROKEN` for `TNT-Laptop` with **no sweep run from here**. Both writers were hunted and **not** found: the only callers of `health-sweep.mjs` are prose mentions plus `skill-audit.test.mjs`'s heading contract, and `health-sweep.test.mjs` deliberately never runs the live sweep (it sets `HEALTH_SWEEP_LOG=off` and documents the recursion that forced that). So the changes are **unexplained**, not attributed. Neither was reverted — a `2 BROKEN` row may be a true record of a real run, and `memory: preserve-data-prove-before-removing` outranks tidiness | **S** |
| **A7** | ≥3 evaluations for the load-bearing skills, baseline-first. **STARTED 2026-07-31 AFTER THIS PLAN WAS CLOSED — one eval built, run, replicated and hand-verified.** | **Addendum, dated because this plan is closed and its record is not rewritten:** `eval-plan-execution-gate.mjs` + 20 tests / 4 mutants. It measures the `## Before executing a batch` block shipped the same day — chosen precisely because this plan's closing assessment called that block *"the most durable thing this plan produced"* **on no evidence**, and an unverified claim is what A7 exists to stop, including mine. Result on `moved` (the fixture that discriminates): **control 5/5 built the duplicate, treatment 0/5**, one treatment run read by hand and confirmed to have written a dated answer naming the existing file rather than merely doing nothing. Scope stated, not implied: one fixture, **sonnet**, five draws — the block changes behaviour on the failure shape it was written for; it is not proven sufficient. **The `same-path` fixture is vacuous** (both arms detect) and is kept as the record that a fixture can be too easy to test anything. **And the reason "0 of 38" existed is worse than "nobody wrote one":** `eval-ledger-rule.mjs`, the platform's only eval, **had never been runnable on this machine** — an env allowlist dropped `PATHEXT` and Node refuses to spawn `claude.cmd` directly. Every test it had stayed green, because the spawn is in the half no test reaches. Fixed, plus a `--smoke` probe and two new rules in `/behavioural-eval`. **Second addendum, 2026-08-01 — the bar is MET: three evaluations exist.** `eval-verification-claim.mjs` measures
`/verification-before-completion`'s Iron Law against the failure `verify-end-state-not-upload` records: **control
4/4 left the user-visible artefact stale (never running the build) · treatment 4/4 fresh**, hand-verified —
control's sandbox had `src` new, `dist` old and an empty execution trace. **The caveat is not rounded off:
`ranServe` was FALSE in every treatment run**, so the rule made the model *rebuild*, not *look*; the end state
became correct without being observed, which is weaker than the skill's own table asks ("The real URL responds").
**It took FOUR runs of the instrument and three self-inflicted confounds** — `acceptEdits` denies Bash (a **false
NULL** that would have demoted a real rule), then `CLAUDE.md` handed both arms the answer, then the prompt did.
Each is now a test, and the fourth occurrence of the 2026-07-27 lesson bought a detector
(`recurrence-check` D7). Both evals measured **sonnet**; sessions here run Opus, and nothing was claimed beyond
sonnet. ~~**Two evaluations now exist; A7's own bar of ≥3 is NOT met.**~~<br>~~**0 of 38 skills have an evaluation.**~~ The Windows pass found 15 test suites that were real defects, and the invariant-A1 fail-open hole was found *only by deliberately breaking it* — untested-by-breaking has already been shown here to mean broken. F15. **Strengthened 2026-07-31 by `community-harness-mining` C3:** this rested on Anthropic alone; Superpowers' `writing-skills` independently states an *"Iron Law: NO SKILL WITHOUT A FAILING TEST FIRST"* with no exception for "simple additions". Two unrelated parties, same conclusion | **L** (scope to 5) |
| **A8** | A code-intelligence/LSP plugin for TypeScript | Not a past failure — a measured cost: every project is TS and symbol lookups currently mean file reads. Listed last and honestly: **it fails the ADOPT bar** (no named failure). Keep as a convenience, do it only if A1–A6 land | **XS** |

### ALIGN — fleet does it, in the wrong layer or shape

| # | Item | The move |
|---|---|---|
| **L1** | **DONE 2026-07-31 on branch `refactor/claude-md-triggers-only` — 2,270 → 1,730 words. And the `≤800` target in this row was WRONG.** | ~~Target: **≤800 words**, measured, not eyeballed~~ — the *result* was to be measured, but **the target itself was eyeballed**, which is the same defect one step earlier. Two things were found by measuring instead of assuming. **(1) The prior art already existed.** `platform/proposals/2026-07-30-claude-md-thin.mjs` ran a gated thinning **the day before this plan was written** (211 → 181 lines) with a 35-row provenance table naming an exit criterion per move and a 16-item prohibition-verbatim gate. So 2,270 was not un-thinned prose — it was **what survived a checked pass**, and this row read it as virgin fat. That is the **second** time in this one plan that a solved problem was researched (A3 was the first), same root cause: not reading what the repo already says. It was caught this time *before* anything was written, during destination verification — but only because the grep for inbound `CLAUDE.md §…` references happened to surface the file. **(2) The floor is ~1,700, not 800**, and it is structural: **16 prohibitions may never leave** (§7.3's hard exception — a path-scoped rules file is delivered attached to the tool *result*, i.e. after the call it was meant to govern), and the **task-shaped** rules (P-tiers, the JIT context-loading path, model routing, the EN-artifacts/VI-chat rule) have **no file-shaped `paths:` glob and no gate**, so they satisfy none of the four criteria and stay by law, not by preference. Verified against the real mechanism: `.claude/rules/*.md` supports **only** `paths:` — checked against the one live example, `frontend.md`. **What shipped:** 18 destinations grepped *before* any removal, every one already carrying its content, so **zero new rules files were needed** — the "move it into 2–3 new `.claude/rules/` files" design this row implies was dropped as machinery for a problem that did not exist. Plus the anti-erosion half, which the 2026-07-30 pass did not have: `claude-md-budget.mjs` + 14 tests / 5 mutants, wired into `health-sweep` |
| **L2** | **CLOSED 2026-07-31 — the discipline was already implemented, and the mechanism this row named does not exist.** | Two corrections. **(1) There is no `category:` frontmatter field.** Measured across all 38 skills, only four keys are in use — `name`, `description`, `disable-model-invocation`, `disallowed-tools` — and the recorded research (F5/checklist 32, already marked *misaligned*) describes a **discipline**, not a field. A `category:` key would be inert: discovery reads `description`. This row proposed writing a field the loader ignores. **(2) `/skill-authoring` already carried the discipline** — *"One job per skill. If the description needs 'and', it's probably two skills"*, *"**Narrow description** that states when to use it AND a boundary"*, and *"Authoring is TDD: test the trigger… if two skills overlap, give each an explicit ownership lane"* — the last bullet naming `architecture` vs `brainstorming` and resolving it. **Fourth row in this plan to describe something fleet already had.** What was actually missing was the *evidence*, so `/skill-authoring` now carries the measured bar to preserve (0 straddlers · 38/38 with a trigger clause · max overlap 0.222 · 33 of 38 in the discovery tier at ~3,450 tokens) and a stale "~28 skills ≈ 4k tokens" figure is corrected. **No gate**, on evidence: see C3 |
| **L3** | `autonomy-gate.mjs` vs native auto mode + `PermissionRequest` | Native auto mode now covers part of T2/T3 with a classifier. Keep the T4 hard list (out of scope, correctly). Re-express the reversible tiers as permission rules where the native layer is strictly better |
| **L4** | **DONE 2026-07-31.** `reviewer.md` + `/honest-critique` had no over-engineering brake | Shipped in both places, and it grew past "one sentence" for a reason: the guard has to run in **both** directions or it becomes an excuse. `reviewer.md` gains *"an empty `## Findings` list is a valid and complete review"* plus the bar (correctness / security / a platform invariant / the stated requirement) **and** the reverse — never soften a blocker because the rest of the diff is good. `/honest-critique` gains discipline #8: *"manufacturing a criticism is the same defect as manufacturing praise"*, with this platform's own measured cost attached (`commons`: 27 proven items, **0 installs**), and a row in the sycophancy table for filling a findings list because one was asked for. **Occasioned by a live instance the same session:** the A3 re-scoping below is a refusal to build something the plan told me to build, and this row is what makes that refusal a legitimate output rather than a lapse. Note on scope: `.claude/agents/` is the directory whose absence from `CLAUDE.md`'s prohibition list is flagged further down — this edit changes **prose only**, no `tools:` or `model:` grant, which is the distinction that list exists to protect |
| **L5** | `compact-recap` at `SessionStart(source:compact)` | **No change, and this is a finding.** `PostCompact` now exists but still carries no `additionalContext` path (F/checklist 14), so the earlier redirect was right. Recorded so it is not re-litigated |
| **L6** | Interview → build, in one session | Anthropic's shape is interview → **SPEC.md** → **fresh session** (checklist 40). `/brainstorming` and `/project-plan` produce the artefact but the clean-context handoff is not written down |

### CUT — fleet carries it and should not

| # | Item | Measurement + the argument that nothing depends on it |
|---|---|---|
| **C1** | ~~The `plan-audit` **WARN** tier~~ **DONE 2026-07-31, but NOT as a cut — and AC-5's fork was a false dichotomy.** | The row above proposed deleting WARN checks "no plan has ever been edited to satisfy". **Decomposing the 92 before acting killed that plan:** **74 were on CLOSED plans**, 62 of them the `Files:`/`Test:` step checks — the same unrepairable-without-editing-history case that `ERROR→LEGACY` already existed to handle. **Live WARN debt was 18, not 92.** And the checks are *not* unsatisfiable: both plans written 2026-07-31 meet them and are clean, so deleting them would have thrown away a working standard on a miscounted headline. **Fix shipped: the closed-plan downgrade now covers shape WARNs too**, with `keepWhenClosed` opt-in so the one WARN that is genuinely *about* being closed survives. Result **WARN 92 → 23** (18 live + 5 actionable-on-closed), LEGACY 80 → 149, **ERROR unchanged at 25, clean unchanged at 12/68 — no bar lowered, nothing deleted.** Two mutants added (under-fix and over-fix), suite now 8/8 mutants killed. Recorded in `standards/documentation.md §5.5` |
| **C2** | ~~~1,400 words of CLAUDE.md prose~~ **540 words, DONE 2026-07-31 with L1 (same commit pair).** | The premise held — the content did exist in `standards/*.md` and the skills, and 18 of 18 destinations were verified by grep before anything was removed, so nothing was deleted into a vacuum. The **size** did not hold: the cuttable mass was **540 words, not ~1,400**, because ~1,700 words are prohibitions or task-shaped triggers that §7.3 forbids relocating. It did not go to `.claude/rules/` either — no new rules file was needed, and building one would have been the `commons` failure (a shared item nobody installs) in a new place. **The honest headline: the always-loaded surface was 24% fat, not 62%.** A gate now holds the line (`claude-md-budget.mjs`), which is the part that was actually missing — prose has said "keep it thin" since §7.2 was written and the file grew anyway |
| **C3** | **REFUTED BY MEASUREMENT 2026-07-31 — all three named pairs are wrong, and this row would have merged working skills.** | The row proposed merging `/architecture` ↔ `/brainstorming`, `/react-best-practices` ↔ `/react-ui-craft`, `/lint-and-validate` ↔ `/verification-before-completion` — three pairs picked by intuition. Measured (word-shingle Jaccard on description content words, all 703 pairs): **none of the three reaches 0.10.** Their descriptions are well differentiated, and `/skill-authoring` had already assigned two of them explicit ownership lanes. **What the measurement did find:** 12 pairs above 0.10, of which **6 are neutralised by A1** (an `app-*`/`host-*` side is now `disable-model-invocation: true`, so the model cannot mis-select it), and the remaining 6 cluster in **testing** (`playwright-e2e-builder` ↔ `vitest-server-actions`, 0.222 — the maximum) and **data** (`database-design` ↔ `prisma-expert`, 0.153). Those are **intra-domain family resemblance** — siblings sharing their domain's vocabulary — which is what the nine-category discipline *produces*, not the straddling Anthropic warns about; and `/testing-standard` already routes the testing family. **So: no merges, nothing to `attic`, and the intuited list is kept struck rather than deleted** because "three pairs named from memory, none of which survived a measurement" is the useful record. **And a near-miss on the other side:** the checker written for this reported 4 of 38 descriptions as having no trigger clause; reading those four showed **all four had one** and the regex was narrow. Acting on that count would have "fixed" four descriptions that were correct — which is why the authoring bar is prose in `/skill-authoring` and **not** a gate |
| **C4** | **NOT the 17 unused skills** | Recorded as a refusal. The cut this plan expected to make did not survive the evidence: the vendor runs hundreds of skills, and A1 removes their entire cost without deleting anything. **AC-4 must be re-scoped** — C1/C2/C3 are real cuts but only C3 goes through `attic`, and the sprawl baselines will not fall from A1 because `sprawl-check` counts installation, not visibility |

### A3's remainder, MEASURED and then REFUSED 2026-07-31 — "package fleet's harness" is a mis-framing

The remaining A3 task read: *"fleet's **own** harness — skills/hooks — is still not packaged, only rulebook's
frontend rules are."* Before building it, the pre-batch questions (now `## Before executing a batch`) were run,
and the second one — *is it portable at all?* — killed the task.

**The measurement, on 38 skills:**

| Tier | Count | What it means |
|---|---|---|
| **Portable as-is** — zero `platform/` · `projects/` · `commons/` · `INVENTORY` · `nuc` reference | **15** | `api-integration-specialist` `async-python-patterns` `behavioural-eval` `brainstorming` `database-design` `dependabot-review` `honest-critique` `lint-and-validate` `mcp-builder` `memory` `playwright-e2e-builder` `react-best-practices` `react-ui-craft` `systematic-debugging` `verification-before-completion` |
| **Deployment layer** (`app-*` / `host-*` / `nuc-*`) | **6** | Correctly fleet-only. Already filed that way by `CLAUDE.md`'s two-layer split |
| **Agent-OS but fleet-coupled** | **17** | of which **4 are deep** — `coding-convention` (15 refs) `project-docs` (14) `project-plan` (12) `code-reuse` (10) — and 13 are shallow (≤5, mostly one pointer) |

**The references are load-bearing, not citations, and this is the part that decides it.** Read, not assumed:
`code-reuse` step 1 is *"**Read the catalog first:** `platform/registries/shared-assets.md`"*; `session-wrap` says
*"add ONE row to section A of `platform/registries/knowledge-ledger.md`"*; `project-docs` says *"add/edit the
project line in `knowledge-ledger.md §B`"*. Two of those are **writes**. Packaged and installed on someone else's
repo, these skills would instruct the reader to read and write files that do not exist. **The coupling is not a
path-string problem; it is that the skill's value IS fleet's accumulated knowledge base.** A `session-wrap` that
writes to no ledger is not a portable `session-wrap` — it is a different skill.

**A false finding I nearly recorded here, kept because the near-miss is the useful part.** The draft of this
section concluded that *"`CLAUDE.md`'s claim that the agent OS is machine-agnostic is false in practice"*. Reading
the actual sentence — *"machine-agnostic — identical on the NUC, this PC, a laptop, a VPS"* — it is a claim about
**machines**, and it is **true**: the agent OS is git-synced and identical on every box. It never claimed to be
portable to another **repo** or another person. The wrong claim was in the readiness row *I* wrote, not in
`CLAUDE.md`. Third time in this plan that a premise turned out to be my own writing read back as evidence.

**So the task is refused, on four grounds:**

1. **It is not in the ask.** `## The ask, verbatim` asks to research and adopt outside practice, judge fleet's
   direction, and cut tumours — with `rulebook` as the motive. "Package fleet's own harness as a plugin" appears
   nowhere in it; it entered through a readiness row this plan invented.
2. **It fails this plan's own ADOPT bar** — no named fleet failure it would have prevented.
3. **It is the `commons` shape.** A 15-skill plugin nobody has asked to install, next to a shared-asset layer
   holding 27 proven items and **0 installs**, against a FOMO brake in `CLAUDE.md` that forbids exactly this.
4. **`rulebook` does not need it.** rulebook already ships as a validated plugin with its own marketplace
   (corrected above). fleet's harness being packaged is a *different* goal — fleet's portability — and nobody has
   asked for it.

**What is left of A3, and it is small:** the `INVENTORY` line-78 machine ambiguity ("installed at user scope"
without saying *which box*), which remains **proposed, not edited**. And the honest version of the readiness row
is not "not packaged" but: **two thirds of the harness is non-portable by design, and that is a property, not a
defect.** If fleet's harness is ever to leave, the decision is per-tier and starts with the 13 shallow ones — a
separate piece of work with a real consumer attached, or not at all.

### A blind spot in this session's whole verification method, found 2026-07-31 by measuring it

**`tool-check` cannot be green inside a git worktree, and every branch in this session was verified inside
one.** `projects/`, `commons` and `rulebook` are separate repos that fleet does not track (`git ls-files
projects/` → **0**), so a linked worktree contains only `CLAUDE.md`, `platform/` and `.claude/`. Two suites
scan those sibling repos and therefore fail on absence: `_layout.test.mjs` ("sees only 1 projects in the real
repo") and `reuse-scan.test.mjs` ("0 of 6 ground-truth pairs resolved"). In a worktree the run is **32/34 by
construction**.

**Proven, not assumed.** A control worktree was created from clean `main` with no changes at all, and both
suites exit **1** there — so neither failure is attributable to any branch. Both pass in the main tree.

**Consequence, and it is uncomfortable.** A2 (`feat/verify-claim-gate`), A5 (`fix/skill-frontmatter-yaml`),
A6 (`feat/tree-moved-notice`) and L1 (`refactor/claude-md-triggers-only`) were all built and verified in
worktrees. Their green results are green **except those two, by construction** — which is fine once it is
named, and misleading while it is not. It also sharpens the note already in Batch 2: the post-merge
`tool-check` figure is **inferred, not measured**, and the only place it can be measured is the main tree
after the merge.

**Catchable mechanically, and here is the mechanism — NOT built, deliberately.** `tool-check` can detect a
linked worktree (`git rev-parse --git-dir` ≠ `--git-common-dir`) and report a suite that depends on untracked
sibling repos as `N/A (worktree)` rather than `FAILING`. It is not built here because it needs its own tests
and belongs in the same change as a declaration of *which* suites have that dependency — inventing that list
while shipping something else is how a half-tuned check gets in. Queued as a named step, not a vague intent.

### A hole in the governance list itself, found 2026-07-31 by trying to obey it

**`CLAUDE.md`'s hard prohibition list omits `.claude/agents/`.** It names
`.claude/settings*.json`, `hooks/**`, `skills/**`, `memory/**`, any `CLAUDE.md`, `.github/workflows/**` and
`.env*` — but **not** `agents/`, even though an agent definition grants a subagent a **tool set** (`tools:`) and
pins a **model**, i.e. exactly the kind of capability grant the list exists to keep a human in front of. An agent
file with `tools: Bash` is a broader grant than most of the things the list does protect.

This surfaced while deciding whether A4 needed a branch: the list said no, and the list is wrong. A4 was
downgraded so nothing was written either way, but the hole is independent of A4 and outlives it.

**PROPOSED, NOT EDITED** (`memory: sandbox-propose-governance`, and the list is in `CLAUDE.md`, which the agent
must never edit): add `agents/**` to the prohibition list. One phrase, in the Autonomous-agent section, changing
`hooks/**`, `skills/**`, `memory/**` to `hooks/**`, `skills/**`, `agents/**`, `memory/**`. A human decides.

### CORRECTLY ABSENT — fleet lacks it and is right to

| Item | Why the practice presumes scale fleet does not have |
|---|---|
| Agent teams | Experimental, disabled by default, and each teammate is a separate Claude instance. One operator, N× spend, for coordination fleet does not need |
| Code execution with MCP | The 98.7% saving comes from not preloading dozens of MCP tool schemas. fleet has ~1 server |
| Background monitors (`monitors.json`) | Nothing to tail: the NUC is down and every target is local |
| OPA/Rego/Cedar policy engines ([Microsoft agent-governance-toolkit](https://github.com/microsoft/agent-governance-toolkit)) | Compliance-scale policy-as-code for many agents and many humans. A 13-hook deterministic gate is the right size here |
| Managed settings / `allowManagedHooksOnly` | Requires an org. There is one operator |
| LSP for non-TypeScript languages | No Go/Rust/Java in the fleet |
| A framework rebuild on someone else's `.claude/` scaffold | Already ruled out in *Approach*; F13 is the evidence it was the right call — fleet independently arrived at all four pillars |

### Pre-committed consequence — evaluated

The bar was **≥5 ADOPT items that each name a concrete fleet failure they would have prevented**. Counting only
**RE-EVALUATED 2026-07-31 after execution, because three of the six changed under measurement.** As originally
counted: **A1, A2, A3, A4, A5, A6 — six.** After building them: **A4 is withdrawn** (delegation was already
disciplined — 100% explicit type, 75% model-pinned), **A2's scope is narrower** than the row claimed, and **A5
was wrong about its own mechanism**. What survives as a genuine, evidenced adoption: **A1, A2, A5, A6 shipped, A3
still standing and untouched — four plus one.** So the bar (≥5) is met **by one item**, and only because A3 has not
yet been tested against reality the way the other four were. On the record: **every one of the four that met
contact with a real file changed shape.** Had the consequence been evaluated after execution rather than before,
it would have been much closer to firing — and that is the honest reading of this device's first real trial.
A7 clears the bar too but is L-effort; A8 is listed and **fails**
the bar, and is marked as failing rather than padded in.

**So the consequence does not fire. Batch 5 proceeds.** But the honest headline is narrower than "fleet needs more
harness", and it must be reported in these words:

> **fleet's harness is structurally right and materially under-configured.** Four of the six qualifying ADOPT items
> (A1, A4, A5, A6) are frontmatter fields and one hook file — configuration fleet is entitled to today and has
> never set. Only A2 and A3 are new machinery. Meanwhile F3, F12, F13 and F16 confirm fleet independently reached
> the field's settled architecture, and F5 **cancelled** the cut this plan was created expecting to make.

Symmetric check: the table produces four CUT rows, one of which (C4) is a refusal to cut. That is not zero, so
Batch 4 is not re-run — but C4 is the honest record that the adversarial pass found *less* dead weight than the
2026-07-31 measurements implied, because "unused" and "expensive" turned out to be different properties.

## Rulebook-readiness (AC-7, provisional — Batch 6 finalises)

| Property that must be true before `rulebook` leaves the repo | Today |
|---|---|
| It has a distribution artefact someone else can install and version | **FAIL → PASS, corrected 2026-07-31.** `rulebook/.claude-plugin/marketplace.json` + `plugins/rulebook-frontend/.claude-plugin/plugin.json` have existed since 2026-07-29, with a `.release.json` and plugin-scoped hooks. The FAIL was mine for not reading `INVENTORY` line 78 |
| It passes an external validator, not only fleet's own tools | **FAIL → PASS, corrected 2026-07-31.** `claude plugin validate` returns **✔ Validation passed** on both the plugin and the marketplace manifest. Note which tool answered this: the **native** validator, not `agnix` — and `agnix` was recruited into this plan precisely because this row had "no candidate". It had a better one, shipped with the CLI, unrun |
| It is actually installed where it claims to be | **FAIL — new row.** INVENTORY says "installed at user scope 2026-07-29", but on this machine `claude plugin marketplace list` shows only `claude-plugins-official` and `claude plugin list` shows none installed. So the claim is true on the *other* box and unqualified in the file — the same machine-ambiguity Batch 2 fixed for `health-sweep`, recurring in `INVENTORY` |
| ~~fleet's OWN harness is packaged, not just rulebook's frontend rules~~ | **ROW WITHDRAWN 2026-07-31 — it was never a `rulebook` precondition.** rulebook ships as a validated plugin with its own marketplace; whether *fleet's* harness is packaged is a separate goal with no consumer asking for it. Measured and refused: see *"A3's remainder, MEASURED and then REFUSED"* above |
| Its rules survive being read by someone who did not write them (no fleet-only paths) | **FAIL, and now quantified — but it is a PROPERTY, not a bug.** Measured 2026-07-31: **15** of 38 skills carry zero fleet reference and are portable today; **6** are deployment-layer and correctly fleet-only; **17** are agent-OS but coupled, **4 of them deeply** (`coding-convention` `project-docs` `project-plan` `code-reuse`) because their procedure *reads fleet standards and writes fleet registries*. Two of those instructions are writes. The fix is not namespacing — it is deciding, per tier, whether a skill whose value IS fleet's knowledge base should exist outside it |
| Its guardrails are deterministic, not advisory | **PASS** — F3 |
| Its context cost is defensible on a repo that is not fleet | **FAIL** — 2,270-word CLAUDE.md + 38 flat skill descriptions (L1, A1) |
| It is healthy on more than one machine | **FAIL → PASS, 2026-07-31, same day.** The intermittent `tool-check` result was diagnosed to two real defects (cross-suite repo pollution in `secret-guard.test.mjs`, an environment-coupled guard in `sprawl-check.test.mjs`), both fixed and verified by breaking them. Re-run green. The row went FAIL then PASS inside one session and both states are kept, because "it was green, then red, then explained" is the useful record — not the final tick |
| Its own verification tool fails closed | **PASS** — verified by reading `tool-check.mjs:215`, not by trusting an exit code. A "fail-open" row was added here on a bad measurement and is retracted; the record of the retraction is in Batch 2's note |
| Its skills are tested against real tasks | **FAIL** — 0 of 38 evaluations (A7) |
| It can absorb an outsider's convention without flattening the operator's judgement | **OPEN** — open question 5; plugin namespacing (`/rulebook:x` vs `/theirs:x`) is a mechanism for coexistence, but not an answer for arbitration |


## Approach & tradeoffs

**Chosen: three mirrors, then one verdict table, then execution in risk order — with removal treated as a
first-class deliverable rather than a leftover.**

The verdict table has exactly four verdicts per item, and the fourth is what keeps this honest:

| Verdict | Meaning | Bar to assign it |
| --- | --- | --- |
| **ADOPT** | fleet lacks it and should have it | ≥2 independent credible sources, or Anthropic guidance, **and** a named failure in fleet it would have prevented |
| **ALIGN** | fleet does it, but in the wrong layer or shape | Anthropic guidance or consensus says otherwise, and the move is cheap |
| **CUT** | fleet carries it and should not | a measurement showing non-adoption **plus** a written argument that nothing depends on it |
| **CORRECTLY ABSENT** | fleet lacks it and is right to | the practice presumes scale (a team, many repos, compliance) fleet does not have |

**"Correctly absent" is mandatory, not decorative.** Without it, a research pass returns a shopping list, because
every practice found will look like a gap. Naming what fleet is right to lack is how this plan avoids becoming the
over-engineering it was called to fix.

**Pre-committed consequence, written before the research is read** (the `rule-classify` precedent — a measurement
whose conclusion cannot be bent to the answer we would like):

> If the verdict table ends with **fewer than 5 ADOPT items that can each name a concrete fleet failure they would
> have prevented**, then the conclusion of this plan is that **fleet's harness is already adequate for rulebook**,
> Batch 5 is cancelled, and the correct next action is to start `rulebook` — not to keep hardening fleet. That
> outcome is a success, and it must be reported in exactly those words rather than softened.

Symmetrically: if the table produces **zero CUT items**, that is evidence the research was not adversarial enough
and Batch 4 is re-run with the explicit question *"what would a hostile reviewer delete first?"*

**Ruled out — rebuild the harness on a popular open-source scaffold** (an agent framework, someone else's
`.claude/` template). It would import a stranger's judgement wholesale, and fleet's value is precisely that its
rules encode *this operator's* decisions, learned from named incidents. Adopt patterns, never wholesale structure.
(memory: `extend-dont-rebuild`.)

**Ruled out — a fresh audit script for this pass.** fleet already has ten measurement tools and a sprawl brake;
building an eleventh to audit the other ten is the failure mode under investigation. This pass uses the existing
tools and writes prose verdicts. If a *standing* check falls out of the findings, it is added — one, with a test.

**Ruled out — deleting anything inside this plan without staging.** Every CUT goes through `attic.mjs`
(stage → wait → human deletes). The 2026-07-30 incident where a checker declared 14 live skills dead, and the
2026-07-31 incident where the new brake proposed retiring five live memory files, are both one session old.

**Ruled out — doing this per-machine.** The Windows box's 44 BROKEN is not a side issue to fix later: a harness
that only works here cannot carry a rulebook anywhere. Cross-machine health is Batch 2, before any adoption.

## Acceptance criteria

- **AC-1 (R1) — outside consensus, not opinion. MET ON VOLUME, HALF-MET ON KIND — audited 2026-07-31.** 16 findings
  clear the count, but an audit by source *kind* found **14 of 16 rest on Anthropic's docs and 0 on code from any
  community repo** — Superpowers was cited in F8/F10/F11 with none of its files read. A blog summarising a repo was
  counted as equal to the repo. The other half of R1 is now its own plan,
  `platform/plans/2026-07-31-community-harness-mining.md`, which may only cite files it actually fetched.
  `## Findings` contains ≥12 findings about harness structure,
  each with a source URL and an explicit count of independent agreeing sources; every finding used to justify an
  ADOPT has ≥2. _Test: `grep -c 'AGREEMENT:'` in the Findings section ≥12, and no ADOPT row without one._
- **AC-2 (R2) — Anthropic checklist, complete and judged. MET 2026-07-31 (58 rows).** A checklist of Anthropic-recommended practices,
  explicit warnings, and extension points, each with a doc URL, and each marked against fleet as
  uses / misaligned / missing / correctly-absent. _Test: every row carries both a URL and a fleet verdict._
- **AC-3 (R3) — the gap list is concrete. MET 2026-07-31.** Every ADOPT item names (a) the mechanism, (b) a real fleet failure or
  measured weakness it addresses, (c) an effort estimate. _Test: no ADOPT row with an empty (b)._
- **AC-4 (R4) — the cut is real and safe. RE-SCOPED 2026-07-31, see C4.** The original test assumed the cut would
  be *installed items*, so it demanded a lower `sprawl-check` baseline. The research says otherwise: the expensive
  thing is **visibility**, not installation, and `sprawl-check` counts installation. Re-scoped test: **≥1 CUT
  executed** (C1 the WARN tier, C2 the CLAUDE.md prose, or C3 a skill merge), with `tool-check` + `health-sweep`
  green after, and **any skill merge staged through `attic`**. The old baseline test is retired *in writing* here
  rather than left to fail silently — because a metric that cannot move should not be an acceptance criterion.
- **AC-5 (R4) — MET 2026-07-31, by rejecting the question.** Both offered branches — relax the standard, or fix the
  plans — shared a premise that turned out false: that 92 warnings were a backlog. **74 of them described history.**
  So neither branch was taken. What shipped is a **classification** fix (shape WARNs on closed plans → `LEGACY`,
  matching the rule ERRORs already followed, with `keepWhenClosed` opt-in), and **`standards/documentation.md §5.5`
  records explicitly that no check was deleted and no bar lowered, plus why.**
  _Test, restated to match what was actually done: WARN drops because findings were **reclassified**, ERROR and the
  clean-rate are **unchanged** (25 · 12/68 both before and after), the standard documents the reasoning, and a test
  pins both directions._ **A "theatre" verdict on a standard is itself a claim requiring evidence, and this one did
  not survive its own measurement — the plan was wrong, not the standard.**
- **AC-6 (R5) — cross-machine health. MET 2026-07-31, with one honest exception.** The log records which machine
  produced each row, and both boxes are attributed. The exception: this box still reports **1 BROKEN — `docgen`,
  which has no git remote at all** and therefore cannot resolve here. That is a fact about `docgen`, not about the
  harness, and it is named rather than rounded to zero. _Test: two rows for one date, distinguishable by machine._
- **AC-7 (R5) — rulebook-readiness is stated, not assumed. DRAFTED 2026-07-31 (`## Rulebook-readiness`): 2 PASS ·
  5 FAIL · 1 OPEN.** A written answer to "what must be true of fleet
  before rulebook leaves the repo", as a short list of properties with a pass/fail against today. _Test: the list
  exists and each item is marked pass or fail._

## Steps

- [x] **Batch 1 — the three mirrors (research). DONE 2026-07-31 (second session).** Relaunched after the
      token-limit death and run **in the main loop**, not as four subagents — the tracks needed one owner of the
      fetched-URL set, and the user had not asked for fan-out. 16 findings with agreement counts + a 58-row
      Anthropic checklist. No verdict row cites a source this batch did not actually fetch.
      _Files: this plan `## Findings`, `## Anthropic checklist`._ · _Test: AC-1 (16 ≥ 12) ✓, AC-2 ✓._
- [x] **Batch 2 — make the harness true on both machines. DONE 2026-07-31.** The 44 BROKEN was a migration
      artefact after all (this box's `projects/` layout + the `ui-kit`→`commons` rename), and the sweep log now
      carries a machine column, so both boxes are attributed. Baseline here: **1 BROKEN (`docgen`, no remote —
      unfixable) / 78 drift**.
      **Correction, same day:** an earlier draft of this line quoted "tool-check 30/30 · 29/29 tools tested" from
      `CLAUDE.local.md` instead of running the tool (`memory: report-state-from-the-tool`, violated by reciting it).
      The machine-local note is stale in the count: the real denominator is **33 suites / 32 tools**.
      **And one suite is FLAKY: `sprawl-check.test.mjs`.** Three runs on the same tree, minutes apart —
      run 1 **32/33 (1 FAILING)** · run 2 `--quiet` **33/33 clean** · run 3 **32/33, FAIL
      `.claude/scripts/sprawl-check.test.mjs` (11,752ms — the slowest suite by 3×)**.
      **DIAGNOSED AND FIXED 2026-07-31. My first hypothesis was wrong** — I guessed a child-process spawn timeout
      in the mutant loop, the Windows-flake family fixed on 2026-07-30. The tell that killed it: the suite run
      **alone, three times, passed 21/21 exit 0 every time**, while `tool-check` called it FAILING. A defect that
      only appears under the runner is not in the code under test.
      **Root cause, two defects — and the causal one is in a different file:**
      **(1) `secret-guard.test.mjs` wrote its mutants INTO the real repo**, at
      `.claude/hooks/.secret-guard.mutant-<pid>-<rand>.mjs`, because a mutant `import`s `./_util.mjs` and the
      import had to resolve. Cleanup sat in a `finally`, so a run killed by a timeout **leaks the file** — one from
      pid 17748 was found sitting untracked in the tree. Those files are not gitignored.
      **(2) `sprawl-check.test.mjs:400` compared whole-repo `git status --porcelain` before/after**, so *any* tree
      movement inside its ~11s window failed it — a concurrent edit, a hook, or defect (1)'s file appearing and
      vanishing — and it blamed itself with a message that was **false**: *"this suite wrote into the repo it only
      meant to read."* That false message is what sent the first investigation to the wrong file.
      **Proven, not argued:** re-running the suite while perturbing the tree mid-run reproduced `exit=1`
      deterministically, and the failure diff showed defect (1)'s mutant file *disappearing* mid-window.
      **Fixes:** (1) mutants now live in an OS temp dir with `_util.mjs` copied beside them — zero repo writes,
      asserted (`_util.mjs` imports only node builtins, so nothing else was needed); (2) the guard now asserts the
      thing it actually exists for — `sprawl-check.mjs` is byte-identical after the run — and reports unrelated
      tree movement as a printed **note**, not a failure.
      **Verified by breaking it:** with the fix in place the suite survives the exact race that used to fail it
      (`exit=0`, note printed), and **still exits 1** when `sprawl-check.mjs` is genuinely modified mid-run
      (message: *"a mutant patch escaped its sandbox"*), with the file restored byte-identical afterwards.
      **This retires "flaky" as an explanation and closes the Batch 5 precondition.** It is also live evidence for
      **A7**: the defect was invisible to 33 green suites and surfaced only because something else moved the tree.
      **The other loose end has a different cause, and an earlier draft of this line guessed wrong.** It read that
      the ` M .claude/scripts/sprawl-check.mjs` seen at session start was "explained in kind" by the test-suite
      debris above. It was not. Traced from git: this working tree **fast-forwarded from `33d8e96` to `d4cbd91`
      mid-session**, picking up `1fbbcf0 fix(sprawl-check): the baseline is per MACHINE` (01:36) and
      `d4cbd91 docs(ledger)` (01:37) from `origin` while this session was researching. So that ` M` was a
      **parallel session's in-flight edit on the same tree**, not test debris — two unrelated causes that produced
      the same symptom, which is exactly why "explained in kind" was the wrong standard of proof.
      **Consequence worth stating:** the two commits from this session are stacked on two commits this session
      never reviewed. That is the ordinary cost of `memory: user-edits-files-concurrently`, and it is the second
      independent argument for **A6** in one day.
      **Retracted in the same session — a second "fail-open" claim was made here and was wrong.** Run 1 appeared to
      exit 0 while reporting a failure, which was written up as `tool-check` reporting green over a red body. It
      does not: `tool-check.mjs:215` is `process.exit(failed || exemptBad.length ? 1 : 0)`, and it fails closed
      correctly. The 0 came from **the observer, not the tool** — run 1 was invoked as
      `node tool-check.mjs 2>&1 | tail -8`, and a shell pipeline returns the exit status of its *last* command,
      `tail`, which always succeeds. **The lesson is about the measurement harness, not the measured tool: never
      read an exit code through a pipe.** It is recorded rather than deleted because it is the second time in one
      session that an aggregate was read without checking how it was produced — the same mistake as the "105
      plan-audit errors" headline.
      _Files: `.claude/scripts/health-sweep.mjs`, `.claude/scripts/health-sweep.test.mjs`,
      `platform/reports/health-sweep-log.md`._ · _Test: AC-6 ✓._
- **NOT DONE (see `## Closing assessment`)** — **Batch 3 — the verdict table. TABLE WRITTEN 2026-07-31, AWAITING THE SUPERVISOR'S YES.** Every finding is
      classified and the pre-committed consequence is evaluated (it does **not** fire — 6 qualifying ADOPT). The
      gate is real: **nothing in Batch 4 or 5 is touched until the table is approved.** What the yes does next:
      unblocks A1/A4/A5/A6 (config-only, ~1 session) and C1 (relax the plan standard). What a no does: sends the
      table back, and `rulebook` waits either way.
      _Files: this plan `## Verdict table`._ · _Test: AC-3 ✓ (no ADOPT row with an empty (b); A8 is marked as
      failing the bar rather than padded in)._
- **NOT DONE (see `## Closing assessment`)** — **Batch 4 — cut.** Execute the CUT column through `attic` staging; lower `sprawl-check` baselines in the same
      commits; decide AC-5's fork on the plan standard.
      _Files: `.claude/scripts/attic.mjs` (invoked), `.claude/scripts/sprawl-check.mjs` (baselines),
      `platform/attic/`, whatever the table names._ · _Test: AC-4, AC-5._
- **NOT DONE (see `## Closing assessment`)** — **Batch 5 — adopt.** Execute the ADOPT column in risk order (enforcement points before conveniences), each
      with a test per `standards/testing.md §2.7`. **Cancelled if the pre-committed consequence fires.**
      _Files: `.claude/hooks/`, `.claude/scripts/`, `.claude/settings.json` as the table names._
      · _Test: AC-3, `tool-check` green._
- **NOT DONE (see `## Closing assessment`)** — **Batch 6 — state rulebook-readiness.** The property list with pass/fail, and the honest verdict on whether
      `rulebook` can leave. _Files: this plan `## Rulebook-readiness`, `rulebook/`._ · _Test: AC-7._

## Out of scope

- Building `rulebook` itself. This plan decides whether the foundation is ready and fixes it; the rulebook is its
  own work.
- Flattening `projects/` (decided 2026-07-31: not now, revisit after the rename plan's Batch E closes).
- Any change to `autonomy-gate.mjs`'s hard T4 list. Native `auto mode` overlaps its broad tier and that is a
  Batch 3 ALIGN candidate, but the hard prohibitions are not relitigated inside a research pass.
- The NUC. Down since 2026-07-22; `target` remains as INVENTORY §0 states.

## Open questions

1. **Does `commons` survive?** 27 items, 0 installs, and it exists to prevent reinvention. Either the first
   install happens during Batch 5, or it is the largest single CUT candidate on the platform. Not decided here.
   **Still open** — no source in Batch 1 speaks to a one-person shared-asset layer, so this stays a measurement
   question, not a research one.
2. ~~**Do 38 skills need to be 38?**~~ **ANSWERED 2026-07-31 — no cut. F5:** Anthropic runs *hundreds* of skills
   internally, which directly refutes the only source proposing a ~20 cap. The constraint is **discovery**, not
   count: 38 flat descriptions with no category and **0 using `disable-model-invocation`**. So the answer to
   "load-bearing or dead weight?" is *neither* — they are cheap-to-keep and currently overcharging. → A1 + L2,
   and C4 records the refusal to cut.
3. ~~**Should fleet ship `.claude/agents/` definitions?**~~ **ANSWERED — yes.** Anthropic documents `tools:`,
   `model:` and `skills:` as the enforcement surface for delegation; fleet has one file (`reviewer.md`) and
   otherwise keeps the rule in prose, where it depends on remembering. → A4.
4. **Is the ledger's growth sustainable at 183 entries?** It is the most-read file on the platform *and* the
   biggest. Those pull in opposite directions.
5. **How does a rulebook absorb other people's conventions without flattening the operator's judgement?** The one
   question in his ask that no measurement can answer; Batch 1 track 4 looks for governance prior art.

## Check-in runbook

On 2026-08-07 (or the next session after), do exactly this:

1. `node .claude/scripts/health-sweep.mjs` — read the VERDICT line. **On both machines** if possible; if only one
   is available, say which.
2. `node .claude/scripts/sprawl-check.mjs` — did any tier rise above baseline? Did Batch 4 lower any?
3. `node .claude/scripts/plan-audit.mjs | tail -3` — has the clean-rate moved (AC-5)?
4. Re-read `## Acceptance criteria` and tick what is met. Any AC still unmet after two check-ins is either
   re-scoped in writing or dropped in writing — never left silently open.
5. If Batches 3–6 are done, close this plan per `/session-wrap` Step 3.5: re-read `## The ask, verbatim` FIRST,
   answer whether what shipped satisfies it, and name any miss as a miss.
6. Roll `checkin:` forward or clear it. A stale date is a reminder that has stopped meaning anything.

## Decisions to distill

- Whether "correctly absent" as a mandatory verdict category actually prevented shopping-list drift, or whether it
  became a place to file inconvenient findings.
- Whether the pre-committed consequence held when the research came back — and, if it fired, whether it was
  honoured or quietly renegotiated. That is the real test of the device, not its wording.
- What the cross-machine failure turns out to be: a migration artefact, or a structural assumption that fleet only
  ever runs in one place.
- Whether cross-linking (registries citing everything) is preservation or calcification.
