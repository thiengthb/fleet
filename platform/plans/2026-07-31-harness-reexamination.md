---
title: Re-examine the fleet harness against outside consensus and Anthropic's own guidance — adopt, align, and cut
kind: system-change
status: active
created: 2026-07-31
updated: 2026-07-31
checkin: 2026-08-07
checkin_every: 7d
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

Batch 1 below adds four more source families (harness-architecture consensus; real public setups and their
regrets; exhaustive Anthropic checklist; rule-distribution mechanics). Findings land in `## Findings` as they
arrive, each with its source and an agreement count.

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

- **AC-1 (R1) — outside consensus, not opinion.** `## Findings` contains ≥12 findings about harness structure,
  each with a source URL and an explicit count of independent agreeing sources; every finding used to justify an
  ADOPT has ≥2. _Test: `grep -c 'AGREEMENT:'` in the Findings section ≥12, and no ADOPT row without one._
- **AC-2 (R2) — Anthropic checklist, complete and judged.** A checklist of Anthropic-recommended practices,
  explicit warnings, and extension points, each with a doc URL, and each marked against fleet as
  uses / misaligned / missing / correctly-absent. _Test: every row carries both a URL and a fleet verdict._
- **AC-3 (R3) — the gap list is concrete.** Every ADOPT item names (a) the mechanism, (b) a real fleet failure or
  measured weakness it addresses, (c) an effort estimate. _Test: no ADOPT row with an empty (b)._
- **AC-4 (R4) — the cut is real and safe.** ≥1 CUT executed via `attic` staging, with `sprawl-check` baselines
  lowered in the same commit, and `tool-check` + `health-sweep` green after. _Test: `sprawl-check` shows a lower
  baseline than 2026-07-31's (skill 15 / knowledge 7) and the sweep says nothing broken._
- **AC-5 (R4) — the plan standard stops being theatre.** The 105 plan-audit errors are resolved in ONE of two
  ways, chosen deliberately and written down: the standard is relaxed to what is actually worth meeting, or the
  plans are fixed. _Test: `plan-audit` clean-rate rises above 50%, or `standards/documentation.md` records the
  relaxation with its reason._
- **AC-6 (R5) — cross-machine health.** `health-sweep` reports nothing broken on **both** machines, and its log
  records which machine produced each row. _Test: two rows for one date, distinguishable by machine._
- **AC-7 (R5) — rulebook-readiness is stated, not assumed.** A written answer to "what must be true of fleet
  before rulebook leaves the repo", as a short list of properties with a pass/fail against today. _Test: the list
  exists and each item is marked pass or fail._

## Steps

- [ ] **Batch 1 — the three mirrors (research).** Four parallel tracks: harness-architecture consensus; real
      public Claude Code setups and their removal stories; the exhaustive Anthropic checklist and gap list;
      rule-distribution mechanics for `rulebook`. Each returns distilled claim + extract + URL + agreement count;
      the main loop owns the fetched-URL set and never refetches.
      _Files: this plan `## Findings`._ · _Test: AC-1, AC-2._
      **BLOCKED 2026-07-31:** all four tracks were launched and all four died on a session limit (resets 04:00
      Asia/Ho_Chi_Minh). Nothing was returned; nothing is assumed. Relaunch is the first action of the next
      session, and no verdict row may cite a source this batch has not actually produced.
- [ ] **Batch 2 — make the harness true on both machines.** Diagnose the Windows box's 44 BROKEN (it is a
      migration artefact until proven otherwise, and "until proven" is the point). Add a machine identifier to
      `health-sweep`'s log row so contradictory verdicts stop being anonymous.
      _Files: `.claude/scripts/health-sweep.mjs`, `.claude/scripts/health-sweep.test.mjs`,
      `platform/reports/health-sweep-log.md`._ · _Test: AC-6._
- [ ] **Batch 3 — the verdict table.** Every finding classified ADOPT / ALIGN / CUT / CORRECTLY-ABSENT against the
      bars above. Evaluate the pre-committed consequence and say the result plainly. **This is the supervisor's
      gate: he approves the table before anything is built or deleted.**
      _Files: this plan `## Verdict table`._ · _Test: AC-3._
- [ ] **Batch 4 — cut.** Execute the CUT column through `attic` staging; lower `sprawl-check` baselines in the same
      commits; decide AC-5's fork on the plan standard.
      _Files: `.claude/scripts/attic.mjs` (invoked), `.claude/scripts/sprawl-check.mjs` (baselines),
      `platform/attic/`, whatever the table names._ · _Test: AC-4, AC-5._
- [ ] **Batch 5 — adopt.** Execute the ADOPT column in risk order (enforcement points before conveniences), each
      with a test per `standards/testing.md §2.7`. **Cancelled if the pre-committed consequence fires.**
      _Files: `.claude/hooks/`, `.claude/scripts/`, `.claude/settings.json` as the table names._
      · _Test: AC-3, `tool-check` green._
- [ ] **Batch 6 — state rulebook-readiness.** The property list with pass/fail, and the honest verdict on whether
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
2. **Do 38 skills need to be 38?** 17 unused, 0 eligible under the two-number rule because registries cite them
   all. Does the cross-linking mean they are load-bearing, or does it mean the registries are indexing dead
   weight? Batch 3.
3. **Should fleet ship `.claude/agents/` subagent definitions** instead of ad-hoc Task calls? Anthropic documents
   subagents as the context-isolation mechanism; fleet uses the shape without the artefact.
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
