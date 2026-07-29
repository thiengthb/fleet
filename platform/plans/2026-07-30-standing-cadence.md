---
title: Standing cadence — the clock for health-sweep (weekly) and platform-report (monthly)
kind: chore
status: active
created: 2026-07-30
updated: 2026-07-30
checkin: 2026-08-06
checkin_every: 7d
checkin_owner: agent
related:
  [
    .claude/scripts/health-sweep.mjs,
    .claude/scripts/platform-report.mjs,
    platform/reports/health-sweep-log.md,
    platform/plans/2026-07-30-second-brain-audit.md,
  ]
---

> **Tiếng Việt — đây là cái "đồng hồ" anh đặt.** Nó **không phải** một kế hoạch để làm cho xong: nó là một
> **nghĩa vụ thường trực**, sống mãi trong `platform/plans/` để mỗi lần mở phiên, hook `plan-checkin` đọc dòng
> `checkin:` và nhắc. **Hàng tuần** chạy `health-sweep` (nền tảng có đang hỏng gì không). **Hàng tháng** chạy
> `platform-report` (bảng số từng file để anh giám sát). Không cần anh nhớ ngày; đến hạn là nó tự hiện ra ở đầu
> phiên, kèm sẵn các bước — trong mục "Check-in runbook" dưới đây.
>
> **Vì sao không dùng một trường `last_run:` gõ tay:** một cái đồng hồ tự khai báo sẽ luôn hiện "đúng hạn" ngay
> khoảnh khắc có người quên gõ. Nên ngày chạy được **đo từ dấu vết mà chính công cụ để lại**: `health-sweep` tự
> ghi một dòng có ngày vào `platform/reports/health-sweep-log.md`, còn `platform-report` để lại chính file báo
> cáo có ngày trong tên. Quên roll ngày cũng không sao — bước 1 của runbook là đọc dấu vết đó, nên nó tự sửa mình.

## The ask, verbatim

> rồi bạn hãy làm phần đặt đồng hồ cho (lưu trong file) cho việc thông báo health sweep và platform report

## Goal

At every session start, if the weekly sweep or the monthly report is due, the reminder appears on its own with
the steps attached — and the "is it due?" question is answered from artefacts the tools write, not from a date a
human maintains.

## Context

Both tools were built on 2026-07-30 and `CLAUDE.md` says to run them "weekly" / "monthly", which is a hope, not a
mechanism. The supervisor works across machines and is often away from this one, so anything requiring him to
remember a cadence will silently lapse — the same failure the `checkin:` rail was built for.

## Approach & tradeoffs

**Chosen: ride the existing `checkin:` rail.** `.claude/hooks/plan-checkin.mjs` is already registered on
SessionStart, already scans every project's plan dirs, already reports due / overdue / "soon" / config defects in
Vietnamese to the user and English to the model, and already has a passing test. One file with `checkin:` +
`checkin_every: 7d` buys the whole clock: **no new hook, no `settings.json` change, nothing new to keep working.**
The monthly cadence rides inside the weekly check as a conditional step (step 3 below), because a monthly gate that
is only *looked at* monthly can drift by up to four weeks before anyone notices.

**Ruled out — a new `platform/cadence.md` + a dedicated `cadence-check.mjs` SessionStart hook.** More precise
(each cadence gets its own independently-derived due date) but it means a second, parallel reminder mechanism to
maintain and test, **and registering a new hook is a T4 governance change** requiring the supervisor to install it.
Two clocks that can disagree is worse than one clock that is slightly coarse. (memory: `extend-dont-rebuild`.)

**Ruled out — cron / systemd timer on this machine.** It would fire when nobody is watching, and the output of
both tools is *judgement material for a human*, not an alert: a sweep result nobody reads is not a check. It also
would not travel to another machine, which is the whole point of keeping the clock in the repo. (`target: none` for
this repo — there is no host to schedule on; the NUC has been down since 2026-07-22.)

**Ruled out — a `last_run:` field in this file.** See the Vietnamese note: a hand-edited clock reports "on
schedule" precisely when it has been forgotten. Evidence beats self-report.

## Steps

- [x] Step 1 — `health-sweep` leaves dated evidence · Files: Modify `.claude/scripts/health-sweep.mjs` (`stampRunLog`) → one row per day in `platform/reports/health-sweep-log.md`, `--no-log` / `HEALTH_SWEEP_LOG=off` to suppress · Test: run it twice in one day, assert one row not two
- [x] Step 2 — this file, with `checkin:` + a self-contained runbook · Files: Create `platform/plans/2026-07-30-standing-cadence.md` · Test: `node .claude/hooks/plan-checkin.mjs --list` surfaces it when the date has arrived
- [ ] Step 3 — first real check-in on 2026-08-06 · Files: Modify this file (record the outcome, roll `checkin:`) · Test: the runbook below, executed

## Check-in runbook

**What this gate decides** — whether the second brain is still working, and whether the numbers are moving the
wrong way. A `BROKEN` result **forbids starting other work** until it is fixed; drift forbids nothing and is never
acted on by a tool. This runbook repeats forever: it is never "done", only rolled forward.

1. **Weekly — the sweep.** Run:

   ```
   node .claude/scripts/health-sweep.mjs
   ```

   Read **only the VERDICT line** first. `nothing broken` ⇒ the wires resolve, the tested tools still pass, and no
   past mistake has come back. Any `BROKEN n` ⇒ stop and fix; it is a dead wire, a failing test, or a recurrence.
   The `drift n` count is a **candidate list, not a to-do list** — never delete on it (see
   `plans/2026-07-30-second-brain-audit.md §4` and memory `preserve-data-prove-before-removing`).

2. **Read the trend, not just today.** Open `platform/reports/health-sweep-log.md` (the sweep writes it itself).
   One sweep says "3 drift" and means nothing; four rows saying 3 → 9 → 20 → 40 is a finding. **Rising drift with
   zero broken is the normal shape of decay** — that is what this log exists to make visible.

3. **Monthly — the per-file report, but decide it by evidence.** List the newest report:

   ```
   ls -1 platform/reports/*-platform-report.md | tail -1
   ```

   If the date in that filename is **≥ 28 days old** (or there is none), run:

   ```
   node .claude/scripts/platform-report.mjs
   ```

   Then hand the supervisor the file path and the WATCH count — he is the one who overrules a verdict, so he gets
   the raw per-file numbers, never just a conclusion. If it is younger than 28 days, say so in one line and skip.

4. **Close the loop.** Append a dated line under _Check-in history_ below: the date, the VERDICT line verbatim,
   and whether the monthly report was run. Then roll `checkin:` forward 7 days (`checkin_every: 7d`). **Do not
   clear `checkin:`** — unlike a normal plan gate, this one never closes; clearing it silently switches the clock
   off, which is the failure this file exists to prevent.

## Check-in history

<!-- Append one line per check-in, newest at the bottom. Kept here rather than in a log file because the reminder
     and its outcomes should be readable in a single file. -->

- 2026-07-30 — created; baseline at creation: `nothing broken · 161 drift item(s)`. Monthly report ran the same
  day (`platform/reports/2026-07-30-platform-report.md`), so the next one is due on/after 2026-08-27.

## Out of scope

- **Alerting anywhere off this machine** (Discord, push). The output is judgement material; a notification with
  nobody to judge it is noise. If it is ever wanted, it hangs off this same runbook, not a second clock.
- **Auto-running either tool.** Both are read-only, so it would be safe — but the check is the *reading*, and a
  tool that runs itself and is never read is exactly the dashboard failure `health-sweep`'s own header warns about.
- **Any other cadence** (memory-audit, plan-audit, reuse-scan). They are already inside `health-sweep`, so they
  are covered by step 1 rather than by dates of their own.

## Scope changes

- (empty — matches the ask)

## Open questions / risks

- **A forgotten roll-forward shows as "QUÁ HẠN n ngày" forever.** That is the safe direction (visible, not
  silent), and step 1 of the runbook re-derives the truth from the log anyway.
- **`plan-checkin` skips `source: compact`** — so on a session that starts by compacting, the reminder does not
  re-fire. Acceptable: it fired at the real session start.

## Decisions to distill

- A recurring operational obligation can live as a `status: active` plan with `checkin:` that is **never cleared** —
  the rail already supports it, and this is cheaper than a second reminder mechanism.
- The cadence question ("is it due?") must be answered from an artefact the tool writes, not from a field a human
  edits. `health-sweep-log.md` is that artefact, and it pays for itself twice by carrying the trend.
