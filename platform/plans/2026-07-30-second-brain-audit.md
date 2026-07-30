---
title: Second-brain audit — is everything outside projects/ actually working, and what should retire
kind: system-change
status: active
created: 2026-07-30
updated: 2026-07-31
related:
  [
    platform/inventory.md,
    .claude/scripts/health-sweep.mjs,
    .claude/scripts/link-check.mjs,
    platform/plans/2026-07-28-fleet-rename-and-restructure.md,
  ]
checkin: 2026-08-06
checkin_every: 7d
checkin_owner: agent
---

<!--
  A PERSISTED, multi-session plan. Standard: platform/standards/documentation.md §5.5.
  LANGUAGE: the body is English per the dev-artifact rule in CLAUDE.md. The summary block immediately below
  is Vietnamese on purpose — the supervisor is this report's actual reader, and a report he has to translate
  is a report that gets skimmed. Same exemption logic as an app's in-product /guide page.
-->

## The ask, verbatim

> hãy viết cho tôi một file md báo cáo rõ, trong fleet đặc biệt những phần nằm ngoài projects những phần
> quan trọng như platform, .claude là những phần bộ não thứ 2 (1 là bạn), có hoạt đông ổn thỏa không, cần
> một báo và một đợt plan truy quét để đánh giá, những thứ obsolete, những thứ nên đưa vào danh sách để loại
> bỏ (nhưng chưa loại bỏ liền), cần thời gian làm việc dài để loại bỏ dần, chứ không phải thứ hư loại bỏ
> phát một (trường hợp mà lỡ tool hoặc bạn đánh giá sai rồi delete hay update lỗi sẽ làm hỏng hết thành quả
> chúng ta đã gây dựng). tôi cần một file báo cáo rõ […] phải có giám sát rõ ràng từ tôi, và những session
> sau từ bạn để chúng ta chắc chắn hơn với những gì mới xây, tôi vẫn nghi ngờ, sẽ có một điểm lỏng lẻo,
> hoặc phần nào đó bị mất kết nối. rồi một plan chi tiết và có các công cụ truy quét toàn diện để nắm trọn
> sự hoạt động có bình thường hay không của platform này. Rồi tôi mới an tâm đi tiếp đến các project

---

## Tóm tắt (tiếng Việt — phần còn lại của file là tiếng Anh theo luật tài liệu)

**Kết luận: bộ não thứ hai đang chạy được, nhưng nghi ngờ của bạn là đúng — có chỗ đứt, và tôi đã tìm ra.**

Việc dọn 9 dự án vào `projects/` sáng nay làm hỏng **5 công cụ trong im lặng**. Sáng nay tôi bắt được 4 và
tưởng đã xong. Đợt truy quét này tìm ra **cái thứ 5, nguy hiểm nhất**: công cụ soát kỹ năng bỗng báo *"14 kỹ
năng không còn gì để làm"* — trong khi `/docker-expert` có 12 Dockerfile và `/prisma-expert` có 4 schema
ngay trong cây thư mục. Nếu tôi tin con số đó, bước tiếp theo nó mời gọi chính là **xoá 14 kỹ năng**.

Đó là bằng chứng cụ thể nhất cho điều bạn lo: **một công cụ đánh giá sai không kêu lỗi — nó đưa ra một câu
trả lời nhỏ hơn nhưng trông vẫn thật.** Vì vậy quy trình loại bỏ trong file này là *dời vào kho → chờ →
mới xoá*, không bao giờ xoá thẳng.

| | |
|---|---|
| **Hỏng thật** | 0 — cả 9 lỗi tìm được hôm nay đã sửa xong (xem bảng §2) |
| **Dây nối** | 6/6 thông (hook ↔ cấu hình, đường dẫn sổ kiểm kê, liên kết trí nhớ, mỏ neo sổ tri thức, đường dẫn trong `CLAUDE.md`, kho tài sản dùng chung) |
| **Có mùi mục** | 159 mục — **là danh sách ứng viên, không phải danh sách việc cần làm** |
| **Máy đề xuất loại bỏ** | 34 mục — tôi soi từng cái và **khuyến nghị GIỮ CẢ 34** |

Câu cuối là phần quan trọng nhất của cả báo cáo: **danh sách "đồ chết" do máy sinh ra thì gần như sai
hoàn toàn.** Nó sai vì trí nhớ được hệ thống tự nạp chứ không mở bằng tay (nên đếm ra 0), vì sổ ngày được
đọc theo cả tầng chứ không theo từng file, vì kế hoạch đã đóng vẫn được 63 file khác gọi tên. Máy đo được
*"không ai mở"*; nó không đo được *"có đáng giữ không"*. Đó là lý do phải chậm.

Những thứ **thật sự** đã lỗi thời (11 file: bản nháp của các thứ đã cài xong, một sandbox tháng 6, một
script PowerShell còn sót từ thời chạy Windows) thì **không phải máy tìm ra — tôi tìm bằng cách đọc**. Danh
sách đó ở §3, và kể cả chúng cũng chỉ được **dời vào kho `attic/`, chờ ≥30 ngày, rồi bạn mới quyết xoá**.

**Bạn cần làm gì:** mỗi tuần chạy **một câu lệnh** — `node .claude/scripts/health-sweep.mjs` — và chỉ nhìn
dòng VERDICT. Có chữ BROKEN thì gọi tôi; chỉ có drift thì không cần làm gì cả. Mọi việc xoá đều phải qua
bạn duyệt, và không có gì bị xoá trong phiên mà nó được đề xuất.

---

## Goal

A single command answers "is the second brain working?", every broken wire found today is fixed, and
everything that merely *looks* dead sits on a dated, reversible retirement track that no tool can execute
by itself.

## Context

`fleet` outside `projects/` is 3.3MB across 187 markdown files, 12 hooks, 25 scripts and 38 skills —
the accumulated agent OS. It had eight checkers and no way to run them together, so its health was
asserted rather than measured. The trigger is concrete: this morning nine app repos moved into `projects/`,
and the supervisor's stated worry ("sẽ có một điểm lỏng lẻo, hoặc phần nào đó bị mất kết nối") turned out to
be correct within an hour of looking.

## Prior art & sources

- [Google SRE — Monitoring Distributed Systems, "symptoms vs causes"](https://sre.google/sre-book/monitoring-distributed-systems/)
  — why a dashboard must state what a green signal actually proves; adopted as the `clean means:` line printed
  next to every checker in `health-sweep.mjs`. Avoided their paging model: nothing here is urgent enough to alert on.
- [Martin Fowler — StranglerFigApplication](https://martinfowler.com/bliki/StranglerFigApplication.html) — retire by
  moving the old thing out of the path first and deleting only once nothing has failed for a while. That is exactly
  the `attic/` + wait + delete procedure in §4; what we take is the staging, not the traffic-routing machinery.
- Internal, and the sharpest source available: `platform/plans/2026-07-28-fleet-rename-and-restructure.md` §Decisions
  to distill — a blanket rewrite silently corrupted the very documents that described the rename, twice in one
  session, and "knowing the trap did not prevent it". That is why §4 forbids bulk deletion by pattern.

## Approach & tradeoffs

**Chosen: one orchestrating command over the checkers that already exist, plus exactly one genuinely new
capability (`link-check`), and a retirement path that stages rather than deletes.** The platform's problem
was never a shortage of checkers — it was that they answered different questions, were run only when someone
was already suspicious, and none of them looked at the wires *between* files. Orchestration is cheap and
adds no new thing to maintain per checker; `link-check` is new because nothing covered the failure mode that
actually bit us three times in three days.

Ruled out:

- **A dashboard / status file regenerated on a schedule.** Rejected: a green dashboard is read as "the system
  is fine", which is the exact misreading §1 exists to prevent, and a stale one is worse than none. A command
  run on demand carries its own timestamp and cannot rot silently.
- **A SessionStart hook that sweeps automatically.** Rejected on cost and on noise: the sweep takes up to 8
  seconds and its output is mostly drift, which must never be acted on reflexively. Session start is for
  things that change what you do *now*; this is a weekly question.
- **Let the agent delete the obsolete items directly, since they are verifiably superseded.** Rejected, and
  this is the plan's central tradeoff. It would be faster and it would be right most of the time — but defect
  5 in §2 is a tool confidently declaring 14 live skills dead, six hours before this was written. The cost of
  being wrong is asymmetric and unrecoverable, so the slow path wins even though it will feel like friction
  for weeks.
- **Delete nothing, ever; just let it accumulate.** Rejected too: the skill catalog is loaded into every
  session, so dead weight is a permanent tax, and an unreviewed pile is where a stale instruction hides.

The accepted cost: retirement takes ≥30 days per batch, the attic will hold files that turn out to be needed,
and the supervisor has to make a decision he could have delegated. That is the price of never losing work.

## 1 — What was checked, and what a clean result actually proves

Run it all with **`node .claude/scripts/health-sweep.mjs`** (0.5–8s, no network, no writes).

| Checker | A clean result proves | And does NOT prove |
|---|---|---|
| `link-check` **(new)** | every wire between files resolves | that what they connect is worth keeping |
| `recurrence-check` **(new)** | no mistake we already recorded has come back | that new mistakes are caught |
| `tool-check` **(new)** | every checker that *has* a test still passes it | that the untested ones work |
| `plan-audit` | plans are well **shaped** | that anyone is working on them |
| `memory-audit` | the memory index is inside its caps, no orphans | that the memories are still true |
| `skill-audit` | every skill has something in this repo to act on | that any of them is any good |
| `reuse-scan` | nothing was built a third time | that the second copy was wise |
| `usage-census` | **nothing.** It measures use; it never says "safe to delete" | anything about value |

The last row is the one to keep in mind while reading §3.

## 2 — Findings: everything BROKEN, and all of it fixed

Nine defects, all found on 2026-07-30, all repaired the same day. Eight of the nine were caused by one
structural change — moving the projects — which is the pattern worth remembering: **a reorganisation does not
announce what it breaks.**

| # | What was broken | How it failed | Status |
|---|---|---|---|
| 1 | git repo discovery | watched 13 repos → 4, silently | fixed — `_layout.mjs` |
| 2 | `plan-audit` | found 0 of 63 plans, reported success | fixed |
| 3 | `plan-checkin` | scanned no project plans; still printed "nothing due" | fixed |
| 4 | `reuse-scan` | 0 of 9 projects → "no duplication found" | fixed |
| 5 | **`skill-audit`** | **declared 14 skills dead** (`/docker-expert` with 12 Dockerfiles in the tree) | fixed |
| 6 | INVENTORY `Dev path` | all 9 rows pointed at the pre-move location | fixed |
| 7 | shared-asset catalog | 3 rows pointed at files that had moved inside `sakubun` | fixed |
| 8 | 4 documents + 1 memory | instructed the reader to run `prior-art-check.mjs`, retired in June | fixed |
| 9 | `/ui-pattern-lock` | claimed a write-time hook that was never installed | fixed (now says so) |
| 10 | **`plan-audit` itself** | its heading regex let whitespace cross a newline, so the optional trailing descriptor `[—\-–:(]` matched the section's first `-` **bullet** and ate it. It failed this very report for "prior art has 1 external URL" while the file listed two | fixed — `[ \t]*` |

Defect 5 is the one that matters for policy: the tool did not crash, it produced a **confident false
verdict of death**, and the action it invites is deletion. Nothing in the old process would have caught it —
this morning's own verification read the tail of that tool's output and missed it.

## 3 — Drift: 161 items, and why the machine's list is mostly wrong

Drift is not damage. These are things that work and may be decaying.

| Signal | Count | Read it as |
|---|---|---|
| tools with no test | 20 of 25 | the real backlog; prioritise the ones that **block** |
| plan files with a shape error | 105 across 64 files | 84 of them on `done`/`superseded` plans — history, not debt |
| artefacts with no recorded use and ≤1 inbound link | 34 | **candidates only — see below** |

### The machine's 34 "retirement candidates", reviewed one by one

| Group | n | My recommendation | Why |
|---|---|---|---|
| Day logs, June–July | 21 | **KEEP — reject** | The tier was measured on 2026-07-29 at **93 reads vs 20 writes**. Reads land on *recent* days; an old day scoring 0 is the tier working, not the file dying. |
| Memory files | 10 | **KEEP — reject, and the count is not even valid** | Memory content is injected by the harness, which is not a tool call and cannot be mined. `usage-census` says so in its own LIMITS block. Retiring a memory on this number is forbidden. |
| Closed plans | 3 | **KEEP — reject** | Measured 2026-07-29: **63 files reference closed plans by name.** Deleting them breaks the links that stop us re-litigating settled decisions. |

**All 34 rejected.** That is the finding, not a footnote: an automated dead-weight list, run against a
knowledge base, is wrong nearly every time, because it can only measure *access* and the question is *value*.

**And the list moved while being read.** `platform/skill-proposals/behavioural-eval.md` was a candidate at
the start of this audit and had dropped off by the end — because the audit opened it, which counts as a read.
The metric is affected by observing it. Two consequences: a single day's candidate list is noise, and the
30-day wait in §4 is doing real work rather than being caution theatre.

### Genuinely obsolete, found by inspection rather than by the counter

These are superseded by something that now exists — verifiable, not a judgement call:

| Item | Superseded by | Note |
|---|---|---|
| `platform/proposals/2026-07-29-reuse-guard-hook.mjs.proposed` | the installed `.claude/hooks/reuse-guard.mjs` | installed 2026-07-30 by the supervisor |
| `platform/proposals/2026-07-29-settings-legibility-hook.json.proposed` | the applied `.claude/settings.json` | applied 2026-07-29 |
| `platform/proposals/autonomy-gate.mjs.proposed`, `.proposed-v2`, `autonomy-gate.test.mjs.proposed` | the installed gate + its two live test files | three drafts of a shipped thing |
| `platform/plans/nuc-set-env-sandbox/` (4 files) | the installed `/app-env` skill | a June sandbox for a skill that shipped |
| `platform/skill-proposals/behavioural-eval.md` | the installed `/behavioural-eval` | |
| `.claude/scripts/app-env.ps1` | `app-env.sh` | PowerShell; this fleet has run on Linux since the move off Windows. 0 recorded uses |

Total: **11 files**, none of them load-bearing, none of them deleted by this plan.

**One contradiction needing a human decision, not an agent guess:**
`platform/skill-proposals/prisma-expert-migration-rehearsal.md` says `status: installed`, but no such skill
directory exists. Either the status is wrong or an installed skill was removed. Do not resolve by deleting.

## 4 — The retirement procedure: move, wait, then delete

Non-negotiable, and it exists because of defect 5 above.

```
stage 1  git mv <item> platform/attic/<YYYY-MM>/     ← reversible in one command, history preserved
stage 2  record it in platform/attic/MANIFEST.md     ← what, when, why, what supersedes it, earliest delete date
stage 3  run: node .claude/scripts/health-sweep.mjs  ← must stay at 0 BROKEN, in the same session
stage 4  WAIT ≥ 30 days and ≥ 4 sessions             ← the wait IS the test; nothing else proves absence of need
stage 5  the supervisor deletes, or says keep        ← a human move, always
```

Rules that make it safe:

1. **Never more than 5 items per pass**, and never two groups in one pass. A batch is how a wrong assumption
   scales.
2. **Never by pattern.** No `rm` with a glob, no "all files older than X". Each item is named individually in
   the manifest with its own reason. (July's rename learned this twice in one session with `sed`.)
3. **The wait is not negotiable and not shortened by confidence.** Anything read once during the wait resets
   its clock and goes back.
4. **`health-sweep` must be green before AND after** each stage-1 move, in the same session, by the same person.
5. **Nothing in `.claude/memory/`, `platform/log/` or any closed plan enters the attic** without a specific
   argument that beats the three rejections in §3 — and that argument goes in the manifest, in writing.
6. **The agent may propose and stage; only the supervisor deletes.** Deletion is irreversible-shaped and is
   therefore his move, per the autonomy contract.

## 5 — Supervision: who checks what, and when

| Cadence | Who | Command | What to look at |
|---|---|---|---|
| Weekly | **supervisor** | `node .claude/scripts/health-sweep.mjs` | the VERDICT line only. `BROKEN` → tell the agent. `drift` → do nothing. |
| Monthly, or when in doubt | **supervisor** | `node .claude/scripts/platform-report.mjs` | writes `platform/reports/<date>-platform-report.md`: every file, every metric, one row each. This is how you audit the agent's judgement instead of accepting it. |
| Before any deletion | both | `node .claude/scripts/attic.mjs verify` | any ALIVE row restores the file and voids its clock |
| Every session that changes structure | agent | `health-sweep` before and after | a move that changes a count is the bug, and it is silent |
| At `/session-wrap` | agent | `recurrence-check` | a lesson recorded twice must leave a guard behind (Step 4b) |
| Monthly | agent + supervisor | `usage-census --days 30` | one retirement pass, ≤5 items, per §4 |
| 2026-08-06, then weekly | agent | this plan's check-in runbook | the numbers below must not drift silently |

**Numbers to beat, recorded 2026-07-30** so a future session can tell improvement from noise:

| Metric | Today (2026-07-30) | Direction |
|---|---|---|
| BROKEN | 0 | must stay 0 |
| wires checked / broken | 6 / 0 | wires only ever added |
| tools with a test | 5 of 25 | up; block-first order |
| drift total | 159 | falling is good, rising without a cause is a finding |
| plan-shape errors | 105 over 64 plans | only the ~21 on live plans are real debt |
| hooks that have fired at least once | unknown until ~2026-08-06 | ≥1 firing each, or justify the hook |
| retirement candidates rejected on review | 34 of 34 | if this stays >50%, the counter needs work, not the repo |

**Re-measured on the WINDOWS box, 2026-07-30 (later the same day).** The numbers above were taken on the Linux
box; this is the same tree on the second machine, and the gap between the two columns was almost entirely the
platform's own tooling failing on Windows — not repo drift.

| Metric | Windows, before | Windows, after | What the difference was |
|---|---|---|---|
| BROKEN | 59 | **44** | all 15 closed were tool defects, not repo faults (list below) |
| tool suites passing | 15 of 29 | **30 of 30** | CRLF-stale mutation patches · native path separators in reports · `HOME` not redirecting `os.homedir()` on Windows |
| tools with a test | 28 of 29 (1 exempt) | **29 of 29 · 0 exempt** | the exemption was closed, not re-argued (see `tool-test-coverage` Close) |
| recurrence detectors firing | 1 | **0** | the firing one was a path-shape disagreement, fixed at the source |
| plan-shape errors | 105 over 64 plans | **25 live + 80 legacy** | Batch D2 |
| drift total | 178 | **90** | mostly D2; `usage-census` also stopped counting this session's own reads as unused |
| link-check BROKEN | 44 | **44** | untouched on purpose — this is the machine's layout, not the repo's. Batch E9 of the rename plan |

**The five defects the Windows box exposed, each one silent** — none reported an error, all four produced a
confident wrong answer, which is the failure shape this whole audit exists for:

1. `platform-report` built its git-log format with bash `$'\x01%at'` and `shell: "/bin/bash"`. There is no
   `/bin/bash` on Windows → the spawn threw → the `catch` returned an empty history map → **every age in the
   repo was unknown**, which is trap #1 of that same file arriving through a different door. Ages feed WATCH,
   so the retirement candidate list was being computed from nothing.
2. `attic` shelled out to `grep -rl … 2>/dev/null || true` through `cmd.exe`, where none of those exist. The
   mention scan — the guard that stops a wrongful retirement — reported **"nobody mentions this file"** on
   every call. Worst reader is `attic verify`, the C5 gate: an empty scan is what would tell the supervisor a
   staged file is safe to delete. Now `git grep`, and a scan that fails is fatal rather than empty.
3. `git-sync-check` measured a directory that merely *has* a `.git`; git walks UP to the nearest real repo, so
   a corrupt or half-cloned project was reported with an **ancestor's** dirt under its own name. It now
   requires `rev-parse --show-toplevel` to agree.
4. Three test sandboxes set only `HOME`. `os.homedir()` reads `USERPROFILE` on Windows, so those fixtures were
   silently measuring the **developer's real transcript store**. The lesson had been learned in
   `usage-census.test.mjs` that morning and applied to one file of four.
5. `eval-ledger-rule`'s `buildSandbox` never created `platform/registries/`, so **every arm died with ENOENT
   before the model was asked anything** — found within minutes of extracting the deterministic half, i.e. the
   exemption was hiding a script that could not run, not just an untested one.

## Acceptance criteria (Given / When / Then)

- **AC-1** — Given a clean checkout, When `node .claude/scripts/health-sweep.mjs` runs, Then it prints one line
  per checker plus a VERDICT, and exits 0 with `nothing broken`. ✅ verified 2026-07-30.
- **AC-2** — Given any wire named in §1, When it is broken deliberately (a hook renamed, an INVENTORY path
  edited), Then `link-check` reports it and exits 1. ✅ verified for stale citations; **not yet** for the other five.
- **AC-3** — Given the retirement procedure, When an item is staged, Then it is in `platform/attic/MANIFEST.md`
  with an earliest-delete date ≥30 days out, and `health-sweep` is green in the same session.
- **AC-4** — Given a structural change (a move, a rename), When the session ends, Then `health-sweep` was run
  before and after and both counts recorded — the check this morning's work skipped.

## Steps

**Batch A — the sweep exists and is honest** (done 2026-07-30)

- [x] A1 — `link-check.mjs`: 6 wires · Files: `.claude/scripts/link-check.mjs` · Test: AC-1 ✅ found 3 real breaks on first run
- [x] A2 — `health-sweep.mjs`: one command, one verdict, `clean means:` per row · Files: `.claude/scripts/health-sweep.mjs` · Test: AC-1 ✅
- [x] A3 — Fix all 9 defects in §2 · Files: `_layout.mjs`, `skill-audit.mjs`, `inventory.md`, `shared-assets.md`, 5 docs · Test: AC-1 ✅ 0 BROKEN
- [x] A4 — Record the 2026-07-30 baseline numbers (§5) · Files: this plan · Test: manual

**Batch B — prove the sweep can fail** (the part that makes it trustworthy)

- [x] B1 — `link-check.test.mjs`: a fixture fleet with all 6 wires intact, then **8 breakages one at a time**, each asserting that check fires *and that no other one does* — a checker that reports six problems for one broken file gets skimmed. Needed a `FLEET_ROOT` override so the suite can damage a copy instead of the repo · Test: AC-2 ✅
- [x] B2 — `health-sweep.test.mjs`: 6 sub-checker failure modes each surfaced as BROKEN, plus a case pinning the 2026-07-30 regression verbatim (a findings count read as zero), plus drift never failing the run · Test: AC-2 ✅
- [x] B2a — `attic.test.mjs`, added because `attic` is the only tool here that MOVES files. It asserts the thing that actually matters: **after every refusal, `git status` is byte-identical** — a half-done refusal would leave the repo in a state nobody chose. Also asserts no delete path exists at all · Test: AC-2 ✅
- [x] B3 — Tests for the two hooks that BLOCK and still have none: `guide-coverage-reminder` and `reuse-guard` · Files: 2 test files · Test: AC-2 ✅ delivered by `plans/2026-07-30-tool-test-coverage.md` **B1** the same day (both files exist and pass); recorded here rather than re-done, because the coverage campaign superset-ed this step

> **What building Batch B taught, and it is the most useful thing in this batch:** the first `health-sweep`
> test ran the live sweep, which runs `tool-check`, which runs every test file — **including that test**,
> which ran the sweep again. Unbounded recursion, ended only by timeouts (2m18s, killed twice before the
> shape was obvious). A test suite that invokes the tool that invokes all suites cannot contain itself. The
> rule: a summariser's test stubs its children; it never calls the real thing.
>
> Coverage went 5/27 → **8/27**, and `tool-check` runs the lot in 14s.

**Batch C — the first retirement pass** (supervisor approved the attic mechanism 2026-07-30)

- [x] C1 — `attic.mjs` + `platform/attic/MANIFEST.md` + `evidence/`. Five refusal paths verified: PROTECTED class, PROTECTED even under `--force`, a reason under 20 chars, an ACTIVE file, and a file with live inbound mentions · Files: `.claude/scripts/attic.mjs` · Test: AC-3 ✅
- [x] C1a — **Reversibility proven, not assumed**: staged → `restore` → the file is back at its original path and `git status` shows no change at all → re-staged. A retirement path that has never been walked backwards is not reversible, it is only believed to be · Test: AC-3 ✅
- [x] C3 — Staged `platform/plans/nuc-set-env-sandbox/` (6 files, superseded by the installed `/app-env`), with an evidence snapshot and an `⚠ OVERRIDE` note: its one remaining live mention is this plan, which is what authorised the staging · Files: `git mv` · Test: AC-3 ✅ sweep 0 BROKEN in the same session
- [ ] C2 — The 5 superseded proposal drafts. **Blocked by the measurement, deliberately**: `platform-report` scores them ACTIVE because this audit read them, so the tool disagrees with the agent's judgement. They will qualify once that contamination ages out, or the supervisor may authorise `--force` with a reason · Files: — · Test: AC-3
- [ ] C4 — Ask the supervisor to resolve the `prisma-expert-migration-rehearsal` contradiction (`status: installed`, no such skill) · Files: — · Test: manual
- [ ] C5 — **2026-08-29 at the earliest**: `attic.mjs verify` must report 0 ALIVE, then the supervisor deletes or restores and records which, and why · Files: manifest · Test: manual

**Batch D — close the measurement gaps**

- [ ] D1 — After 7 days of hook-usage data, report which hooks have never fired · Files: — · Test: manual
- [x] D2 — Decide whether the 106 plan-shape errors on closed plans should be exempted by status, so the number
      means something · Files: `plan-audit.mjs` · Test: the count drops to live plans only
      ✅ **2026-07-30 — decided: exempt by status, but never silently.** A shape ERROR on a plan whose status is
      `done`/`superseded`/`abandoned`/`rejected` is reported as a new level `LEGACY` — same message, its own
      total, and out of the count that gates (`--strict`, and the sweep's drift number). Repairing one would mean
      editing the record of what was actually done, which this platform does not do to satisfy a checker.
      Measured: **105 ERROR → 25 ERROR (live) + 80 LEGACY**, so the number now names work someone can do. The
      same reasoning as the existing `preStandard` exemption, and it is printed on every run rather than
      subtracted quietly. Two new cases + a mutant pin it, incl. `--strict` passing on a repo of closed plans
      and failing on one live gap.

## Check-in runbook

**What this gate decides** — whether the second brain is still healthy, and whether anything staged for
retirement has proved it is still needed. A failing result forbids starting the next retirement batch.

1. `node .claude/scripts/health-sweep.mjs`
2. Read the VERDICT line. **`0 BROKEN` is the pass condition**; any BROKEN item stops all retirement work
   until it is fixed, because a broken wire means the sweep's other answers are suspect too.
3. Compare the drift numbers against the table in §5. A drift count that *rose* without a change explaining
   it is itself a finding.
4. If a retirement batch is in the attic: `git log --since=<stage date> -- platform/attic/` and grep the
   session transcripts for any attic path. **Anything read during the wait goes back and its clock resets.**
5. **Close the loop** — write the outcome into this plan under a dated heading, then roll `checkin:` forward
   by `checkin_every` (7d), or clear it when Batch C5 has been decided.

## Out of scope

- **Anything inside `projects/`.** The supervisor's sequencing is explicit: the platform is verified first.
- **Deleting anything.** This plan stages at most; C5 is a human action ≥30 days out.
- **Rewriting history in `platform/log/` or `platform/ledger/`.** Those record what was true on the day.
- **Reducing the skill catalog.** 0 NO-SUBSTRATE after the fix; there is no evidence-based case today.

## Scope changes

<!-- Append-only, dated. Empty is a valid state and a finding in itself. -->

- (none yet — the plan still matches the ask above)

## Open questions / risks

- **The biggest risk is this plan's own tooling.** Four new checkers were written in one day; two of them
  mis-reported on their first run and were retuned. Batch B exists precisely because they are not yet
  trustworthy, and until B lands, a green sweep is *weak* evidence, not proof.
- **The hook-usage counter has no history.** It began on 2026-07-30, so "never fired" means nothing before
  ~2026-08-06. Do not retire a hook on it until then.
- ~~Are the connections between files intact?~~ **Answered 2026-07-30 by measurement:** memory cross-links
  0 broken, ledger anchors 0 broken, hook wiring 0 broken; INVENTORY and the shared-asset catalog were broken
  and are fixed.

## 6 — What building the retirement mechanism itself revealed (2026-07-30)

Five defects, every one of them found because the mechanism was pointed at real files instead of being
reasoned about. Recorded because each is a way a *measurement* can be confidently wrong, which is the class
of failure this whole plan exists to contain.

| # | The defect | Which direction it erred | Fix |
|---|---|---|---|
| 1 | `--format="C%at"` collided with **`CLAUDE.md`** — a path in most commits parsed as a timestamp, so every file's age became NaN | **condemning**: unknown age fell through to WATCH. The most important file in the repo was quietly nominating everything else | a `\x01` marker, which no path can contain |
| 2 | Renames not followed, so the 2026-07-28 restructure made the whole repo look 2 days old | **protecting**: nothing could ever qualify. A mechanism that condemns nobody looks safe and has silently stopped working | `--name-status -M` + an alias chain |
| 3 | Unknown age treated as old age | **condemning**: `platform-report.mjs` nominated *itself* 30 seconds after being written | unknown age ⇒ NEW, never WATCH. When in doubt, protect |
| 4 | The generated report was itself in the link corpus | **protecting**: on the day the first report was written, every file in the repo gained an inbound link from it — the instrument manufacturing its own signal | `platform/reports/` and `attic/` excluded from both corpus and inventory |
| 5 | Inbound links matched on bare basenames | **protecting**: the sandbox scored 6 inbound links, and all six were about two *other* sandboxes' `INSTALL.md` | generic names (`README`, `INSTALL`, `SKILL`…) must be cited with their parent directory to count |

Two of the five erred toward protecting and two toward condemning, which is the useful part: there is no
"safe" direction for a broken measurement. A protecting error is not benign — it makes the mechanism useless
while looking responsible, and a mechanism that never nominates anything is one people eventually bypass.

**Observer effect, twice, in both directions.** Reading a file to audit it counts as using it. That
exonerated one plan mid-audit and it is why the five superseded proposal drafts now read as ACTIVE. It
biases toward keeping — the safe way to be wrong — but it means a single day's numbers are noise, and the
30-day wait is doing real work rather than being caution theatre.

## Decisions to distill

- **A structural change breaks tools without breaking anything visibly.** One folder move broke five
  independent checkers; every one kept exiting 0 and returned a smaller true-looking answer. The rule:
  after any move or rename, re-run every discovery tool and **compare counts to a pre-change baseline** —
  reading the tail of the output is what let defect 5 through for six hours.
- **An automated "dead weight" list, run over a knowledge base, is wrong ~97% of the time.** 34 of 35
  candidates were rejected on review. Access is measurable; value is not. Any retirement mechanism must
  therefore be staged, slow and human-gated — the counter's job is to nominate, never to decide.
- **The most dangerous tool output is a confident false verdict of death**, because the action it invites is
  irreversible. A checker that says "this is unused" needs a higher standard of proof than one that says
  "this is broken", and it must state what it cannot see.
