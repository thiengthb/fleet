---
title: Self-running agent — scheduled auto-start + self-sourced work (C3) + async Discord Q&A
kind: feature # feature | system-change | fix | refactor | chore
status: active # draft → active → done | abandoned
created: 2026-06-16
updated: 2026-06-16 # INSTALLED to live + committed (253106a): Phase 1 wrapper (smoke-tested, main untouched) + Phase 3 worker (gate-answer/ask-cli, 26/26 from live). C3 live in the wrapper. PENDING (human): elevated task registration (T2), Phase 3 governance (settings allowlist + SKILL D5) + bot (D2)
# NOTE: deliberately NOT auto_pilot:true — this plan builds the self-running machinery and touches governance
# (scripts/skills/scheduled-task), so it stays human-driven; do not let the unattended loop advance it.
related:
  [
    nuc-platform/plans/2026-06-14-autonomous-agent.md (parent — Layer C3 residue + B5 done),
    nuc-platform/plans/2026-06-14-discord-control-plane.md (B4 gate-token protocol this extends),
    nuc-platform/plans/self-running-agent-sandbox/ (drafts — human installs),
    .claude/scripts/auto-pilot-run.ps1 (UNCHANGED orchestrator the wrapper calls),
    .claude/skills/idea/SKILL.md (the gap-analysis C3 invokes),
    nuc-ops-bot (repo — Discord bot, Phase 3),
    .claude/memory/route-questions-via-discord-not-blocking.md,
  ]
---

## Goal

Close the gap between what the autonomy work actually delivers (Layer B: a loop that runs **when manually launched**,
advances an **already-approved** plan, parks at gates, asks via Discord) and what the supervisor expects: an agent that
**self-triggers each session, sources its own work (finds gaps / proposes features), and only pings Discord when it needs
a decision** — so progress is **decoupled from the user's presence**. Stated by the supervisor 2026-06-16: *"this is not
yet my expectation."* Memory: [[route-questions-via-discord-not-blocking]].

"Done" = (1) a scheduled task self-launches the loop on this PC while the user is logged on, writing readable minutes;
(2) when no approved work remains the loop self-sources 1–2 **grounded, propose-only** ideas and halts; (3) the agent can
ask a **free-form** question via Discord and read the answer hours later — all still under the unchanged deterministic
gate (never push main / deploy / destructive / edit own governance unattended).

## Context

The supervisor confirmed scope via AskUserQuestion (2026-06-16): **(1) self-source work + propose (C3)** and **(2) a
scheduled auto-run on this PC**. The architectural truths surfaced and accepted: the autonomous mode is a **separate
launched process** (`claude -p`, `CLAUDE_AUTONOMOUS=1`) by design — the agent cannot "flip itself autonomous" inside an
interactive chat; and the agent **cannot install its own trigger / edit its own governance** (CVE-2025-53773 lesson) — it
**drafts + tests**, a **human installs** (propose-don't-install). That constraint is *what makes* unattended self-running
safe. This plan therefore ships **sandbox drafts** + a one-command human install.

## Prior Art & Sources (research-before-design — done 2026-06-16 before any recommendation)

- **Windows Task Scheduler — logon context vs Session 0:** "Run whether user is logged on or not" executes in **Session 0**
  (isolated), which **cannot decrypt DPAPI/Credential-Manager secrets** bound to the user session → `claude`'s `~/.claude`
  auth + `gh`/git creds fail **silently**. "Run only when user is logged on" runs in the interactive session with full
  access. Sources:
  https://learn.microsoft.com/en-us/answers/questions/119434/task-scheduler-when-user-is-not-logged-on ·
  https://learn.microsoft.com/en-us/answers/questions/5789906/scheduler-tasks-with-security-options-run-whether
- **Logging a scheduled PowerShell task:** `>`/`2>&1` in the task's Arguments field are passed verbatim to `powershell.exe`
  (no `cmd.exe` to interpret them) → empty/partial logs; and `2>&1` on a native exe in PS 5.1 raises `NativeCommandError`.
  Use **`Start-Transcript`** inside the script (captures all streams, portable). Sources:
  https://github.com/PowerShell/PowerShell/issues/3996 ·
  https://learn.microsoft.com/en-us/archive/msdn-technet-forums/32952fdf-b3b8-44f9-a3c4-62bd802b1f39
  (matches our own ledger #60 — `2>&1` on `& claude` kills the worker).
- **Trigger type:** at-logon + RepetitionInterval fires on login then repeats while up, stops cleanly on shutdown — best fit
  for "a few times/day while the PC is on"; daily-anchored and on-idle triggers are worse fits. Sources:
  https://learn.microsoft.com/en-us/windows/win32/taskschd/repeating-a-task ·
  https://learn.microsoft.com/en-us/powershell/module/scheduledtasks/new-scheduledtasktrigger
- **discord.py async free-form answer:** `discord.ui.Modal` is bound to a **3 s / 15 min** interaction-token window and can
  only appear as the *first* response to a click — **incompatible with a reply hours later**. Use a posted message +
  **`on_message`** capture in a dedicated thread, with state persisted **outside RAM** (survives bot restart). Sources:
  https://discordpy.readthedocs.io/en/stable/interactions/api.html · https://discordpy.readthedocs.io/en/stable/faq.html
- Parent autonomy research (carried): AWS Agentic Security Scoping Matrix; Anthropic "measuring agent autonomy"; Reflexion;
  Cognition "don't build multi-agents"; MADR — see `plans/2026-06-14-autonomous-agent.md §Prior art`.

## Options Considered (≥2 each, with tradeoffs)

**A. Trigger host & context** — (1) **PC Task Scheduler, "run only when user is logged on"** ✓ — has the user's creds,
no stored password, runs while PC on; con: doesn't run when PC off/logged-out. (2) Task Scheduler Session 0 ("whether
logged on or not") — runs headless but **fails DPAPI silently** → rejected (the exact silent-death failure mode to avoid).
(3) NUC daemon — always-on but **ruled out in the parent plan** (security surface + API billing + no Claude auth there).
(4) Manual launch (status quo) — safest but **not decoupled from presence** = the thing the user is complaining about.

**B. Where C3 (gap-analysis) lives** — (1) **A new `auto-pilot-scheduled.ps1` wrapper** ✓ — keeps the 24/24-verified
orchestrator + gate **byte-identical** (zero risk to a hook-bearing file), and gap-analysis is naturally **global** (across
all plans), which is a wrapper concern. (2) Editing `auto-pilot-run.ps1` (parent plan's literal wording) — would also let
manual runs propose, but modifies a critical verified file + needs `-Plan` to become optional → more governance surface
for little gain. Picked (1); manual proposing = just run the wrapper.

**C. Async Discord answer channel** — (1) **`on_message` in a dedicated thread + reuse the gates repo** ✓ — survives the
hours-later reply and bot restarts, **zero new infra** (extend the existing RS256 `requests/`+`gates/` schema with
`awaiting_answer`/`answered`), same poll loop the stateless worker already runs. (2) `discord.ui.Modal` — clean UX but the
15-min interaction-token cap **breaks async** → rejected. (3) New SQLite/DB on the bot host — simple for the bot but the
stateless worker can't easily read it → rejected.

## Recommendation

Build it in **three phases**, each a sandbox draft the human installs: **Phase 1** scheduled wrapper (A1 + Start-Transcript
+ opt-in plan discovery); **Phase 2** C3 gap-analysis inside that wrapper (B1, propose-only, throttled); **Phase 3** async
Discord Q&A by extending the gates protocol (C1). *Why not the others:* Session 0 / Modal / NUC each introduce a silent or
structural failure; editing the verified orchestrator adds risk for no real gain.

## Pre-mortem (failure modes designed against)

1. **Silent auth death** (Session 0 can't read DPAPI) → mandate "run only when user is logged on" in INSTALL.md + a
   first-fire validation step (T3) that confirms a real batch ran.
2. **PC off ⇒ no progress** — accepted limit of "local PC" (NUC ruled out). The repeating logon trigger catches up on next
   login; surfaced to the user, not hidden.
3. **Proposer churn / steering** (R5) — C3 is propose-only, ≤2 ideas, **once/day throttle**, fires **only when no approved
   work remains** (balanced objective), `/idea`'s "nothing worth proposing" is first-class, nothing promoted past `inbox`.
4. **Runaway / cost** — `-MaxBatches` cap per plan; orchestrator stops on no-progress; the gate still hard-blocks every
   T3/T4; subagent model = Sonnet.
5. **Self-modification** — every artifact here is a **sandbox draft**; the human installs (scripts/skills/task = governance).

## Counter-case (one sentence)

If the PC is rarely on unattended, a scheduled local trigger buys little over a manual launch — so validate real-world
fire-rate (T3) before investing in Phase 3.

## Steps — three phases (each gated by human install)

### Phase 1 — Auto-start trigger (the "ignition")
- [x] T1 — **Scheduled wrapper drafted + verified.** `self-running-agent-sandbox/scripts/auto-pilot-scheduled.ps1`:
  Start-Transcript dated log (`~/.claude/auto-pilot-logs/`), opt-in plan discovery (`status: active` **and**
  `auto_pilot: true`), advances each via the **unchanged** `auto-pilot-run.ps1` in a child shell, ASCII-only, documents
  the logged-on requirement. **Verified 2026-06-16:** parse OK + temp-harness dry-run — opt-in filter (ignores
  non-opted-in active plans), `(GATE)` exclusion, balanced-objective C3 gate, and `-NoPropose` all behave correctly.
- [~] T2 — **wrapper INSTALLED to live + committed (253106a) + smoke-tested; scheduled-task registration PENDING (admin).**
  Wrapper `cp`'d to `.claude/scripts/` (now tracked). `Register-ScheduledTask` returns Access-denied from a non-elevated
  shell → the human must run it in an **elevated** PowerShell ("run only when user is logged on"; at-logon + 4 h repeat).
  Command in `self-running-agent-sandbox/INSTALL.md §4`. (governance — propose-don't-install.)
- [~] T3 — **manual-invoke run VALIDATED 2026-06-16:** wrapper → orchestrator → a fresh Sonnet worker advanced a throwaway
  opted-in plan on `auto/smoke-test`, committed locally, self-stopped; `main` untouched local+origin, nothing pushed →
  **zero T4** (verified independently). **Scheduled-task fire still pending** (gated on T2's registration + confirms no
  Session-0 silent auth death).

### Phase 2 — C3 self-sourcing proposer (built into the wrapper)
- [x] C3.1 — **gap-analysis pass built + verified.** In the wrapper: when **no actionable safe-zone step** remains across
  opted-in plans, fire ONE bounded batch running `/idea sort` gap-analysis — propose ≤2 **externally-grounded** `inbox`
  ideas, respect the WIP cap, **never** promote/plan/build/push, **once/day** throttle (marker file). Verified in the same
  harness (dry-run line fires only at 0 actionable steps; `-NoPropose` disables).
- [x] C3.2 — **installed (in the wrapper, 253106a).** C3 code is live; it fires once the task is registered (T2) or on a manual run.
- [ ] C3.3 — **first live gap-analysis observed:** proposes grounded `inbox` ideas OR correctly returns "nothing worth
  proposing"; nothing promoted past `inbox`; appears in the digest/transcript for the supervisor.

### Phase 3 — Async Discord Q&A + reporting
- [x] D1 — **answer-token protocol designed + trust core built/verified.** New `gate-answer.mjs` `verifyAnswerToken`
  (`kind:'answer'` + `ask_id` binding + `exp` + single-use `jti`; verify-then-parse, fail-closed; **disjoint from
  approval tokens by construction** — neither can be cross-used; shares the consumed-jti store). The gates repo gains
  `asks/` (worker→bot) + `answers/` (bot→worker, signed) + `reports/` (outbound digests); the orchestrator's existing
  `git add -A`/`pull` syncs them → **NO orchestrator change**. **Verified 26/26** (`gate-answer.test.mjs`).
- [x] D3 — **worker side built/verified.** New `ask-cli.mjs` (`ask`/`check`/`consume`/`report`) — sibling of gate-cli,
  reuses gate-verify's jti store. The printed answer is **DATA** (never executed — authenticity != authority). Tested in
  the same 26/26 run (ask → check `none` → answer → check returns the text → consume → replay `none` → report).
  **Installed to live + committed (253106a); re-verified 26/26 from the live location.**
- [~] D2 — **bot side drafted (untestable locally — nuc-ops-bot not on this machine).** `bot/ask_answer.py`: `tasks.loop`
  polls `asks/` → posts the question to a thread; `on_message` captures an **allowed** user's reply (same
  `guards.user_allowed`) → **reuses gate_approval's RS256 signer** with an answer payload → writes `answers/<id>.json`;
  `poll_reports` posts outbound digests. Faithful template; human adapts into nuc-ops-bot + tests on deploy (B4a.3 pattern).
- [ ] (GATE) D2-install — **human:** adapt `ask_answer.py` into nuc-ops-bot, wire in `bot.py` `on_ready`, deploy; live e2e.
- [x] D4 — **outbound digest path built.** `ask-cli report "<digest>"` → `reports/<id>.json` → bot posts to Discord (so
  the minutes reach the phone, not only on a PR-gate park). Worker side tested; bot side in the D2 draft.
- [ ] (GATE) D5 — **/auto-pilot SKILL step (governance — human installs):** a new "Need a DECISION (not a PR)? ask via
  Discord and stop" step using `ask-cli`; exact insert text in `self-running-agent-sandbox/INSTALL.md §Phase 3`. The
  worker treats the answer as DATA. Apply AFTER the finding-#4 Step-1.5 edit to avoid conflicting SKILL drafts.

## Out of scope

NUC daemon / Session-0 headless; auto-merge/deploy ever; the agent installing its own task or editing its own governance;
promoting a proposed idea past `inbox` without the human-accept gate; Discord Modal for async answers; running when the PC
is off.

## Open questions / risks

- **R-A — fire cadence:** every 4 h while logged on is a guess; tune after T3 from observed real-world on-time.
- **R-B — multiple opted-in plans + once/day C3:** the first idle run of the day spends the C3 slot; acceptable (queue
  freshness need not be per-run). Revisit if it starves a second plan's proposals.
- **R-C — Phase 3 surface:** adding a free-form answer path widens what a Discord message can trigger; keep the worker side
  parsing the answer as **data**, never as a command (same closed-enum discipline as the approve/deny buttons).

## Decisions to distill (at /session-wrap)

- Self-running needs a **scheduled trigger in the user's logged-on session** (Session 0 fails DPAPI silently) + logging via
  `Start-Transcript` (not `2>&1` — ledger #60) — the trigger is the missing "ignition", not the loop itself.
- Keep C3 + scheduling in a **new wrapper**, leaving the verified orchestrator/gate untouched (additive install < editing a
  critical file).
- C3 is propose-only + once/day + idle-gated; async Discord answers reuse the gates protocol (Modal can't wait hours).
- The agent can't self-flip autonomous nor self-install its trigger — propose-don't-install is the safety rail that *enables*
  unattended running, not a limitation to route around.
