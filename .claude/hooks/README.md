# MiniServer Claude Code hooks

Deterministic enforcement layer for the platform invariants — the rules that used to live only as prose in `CLAUDE.md`
and skills now fire as code that the model cannot skip. Written in Node ESM (`.mjs`) so they run identically on Windows,
macOS, and Linux (no bash/PowerShell branching) and stay package-ready for a future plugin bundle.

Wired in `../settings.json` under `hooks` (committed, shared). They complement — do not replace — the git
`commit-msg`/`pre-commit` hooks: git hooks fire at commit for any tool; these fire **in-loop on every Claude tool call**,
much earlier, and feed back into Claude's context.

| Hook | Event | Matcher | Behaviour |
|---|---|---|---|
| `secret-guard.mjs` | PreToolUse | `Edit\|Write\|MultiEdit` | **Blocks** (exit 2) hardcoding a real secret into any file that is not `.env*`. Invariant #4. |
| `invariant-warn.mjs` | PostToolUse | `Edit\|Write\|MultiEdit` | **Advisory** (exit 2 = feedback, never blocks): certbot/letsencrypt/acme in config (#6), self-hosted runner in CI (#1), host port-publish in an app compose (#2). |
| `prettier-on-edit.mjs` | PostToolUse | `Edit\|Write\|MultiEdit` | Best-effort `prettier --write` with the project's **local** prettier; silent no-op if none is installed. |
| `suggest-session-wrap.mjs` | Stop | (none) | **Advisory, non-blocking** `systemMessage` nudge to run `/session-wrap`. Fires **at most once per session**, and ONLY when the transcript shows substantial work (≥3 distinct non-knowledge files OR ≥5 edits) that has NOT been wrapped (no edit to `decisions.md`/`00-map.md`/`registries/knowledge-ledger.md`/`MEMORY.md`/`memory/*`/`registries/known-traps.md`). Once-per-session via a `session_id` marker in the OS temp dir; respects `stop_hook_active`. Never blocks the stop. |
| `autonomy-gate.mjs` | PreToolUse | `Bash\|Edit\|Write\|MultiEdit` | **Blocks** (exit 2) irreversible/outward actions when the run is unattended — `CLAUDE_AUTONOMOUS=1` **or** a known non-interactive `CLAUDE_CODE_ENTRYPOINT` (`sdk-cli`, verified by probe 2026-07-28; interactive reports `cli`). An **unknown** entrypoint stands down but warns once per session rather than passing silently. Blocks: push/merge `main`, deploy, destructive (`rm -rf`/docker prune/db drop/force-push), dep-install, PR create, `ssh`, and any write to the agent's OWN governance (`settings*.json`/`hooks/**`/`skills/**`/`memory/**`/`CLAUDE.md`/`.github/workflows/**`/`.env*`). Fail-closed. The SOLE gate for unattended runs — contract: `platform/standards/autonomy-contract.md`. |
| `../scripts/plan-audit.mjs --hook` | PostToolUse | `Edit\|Write\|MultiEdit` | **Advisory** (exit 2 = feedback, never blocks): audits a plan/proposal file as it is written — missing `kind:`, <2 external prior-art URLs on a feature plan past `draft`, absent acceptance criteria, unfilled template placeholders, and (from 2026-07-30) a missing or empty `## The ask, verbatim`. **Supersedes `prior-art-check.mjs`**, which was a strict subset and was folded in during June; five documents still cited the retired name until `recurrence-check.mjs` found them on 2026-07-30. |
| `git-sync-check.mjs` | SessionStart | (none) | **Advisory, non-blocking** multi-machine git-sync guard. Best-effort `git fetch` (non-interactive, 8s/repo, parallel) + `ahead`/`behind`/`dirty` scan across the root repo **and every sibling repo** under `MiniServer/`; surfaces a `systemMessage` (to the user) + `additionalContext` (to the model, so it pulls stale repos before editing). SKIPS `source: compact` (frequent/automatic). Completely **silent when everything is synced & clean**. Exit always 0 (SessionStart can't block). Catches "local is stale (pushed from another box)" and "left work unpushed here". |
| `memory-wiring-check.mjs` | SessionStart | (none) | **Advisory, non-blocking.** Verifies the agent actually *has* its memory this session: `autoMemoryDirectory` resolves to this repo's `.claude/memory/` (the setting is an absolute path, so it lives in each machine's gitignored `settings.local.json` and a fresh clone has none — memory then silently does not load), auto memory isn't disabled, `MEMORY.md` exists and is inside the 200-line / 25KB load cap, and no memory file is missing from the index. Emits both a `systemMessage` (to the user) and `additionalContext` (so the model knows not to assume it remembers anything). **Completely silent when correct**; exit always 0. Exists because the failure mode is invisible: a machine-local memory written 2026-07-24 was found on 2026-07-28 to have never loaded, its directory having no index. |
| `harness-drift-check.mjs` | SessionStart | (none) | **Advisory, non-blocking.** Trigger **T1** of the self-update loop: compares the installed Claude Code version (read free from the basename of `CLAUDE_CODE_EXECPATH` — no subprocess) against `reviewedVersion` in `.claude/harness-baseline.json`. On a change it asks **once** for a single question to be answered — *did the harness just ship something we hand-rolled?* — then to file anything found via `/idea` and bump the baseline. SKIPS `source: compact`; silent when unchanged. Exists because ~6 sessions of `auto-pilot` were deleted on 2026-07-28 after Claude Code shipped scheduled/remote agents natively: nothing in that process was wrong, the premise had silently expired and no step re-checked it. |
| `plan-checkin.mjs` | SessionStart | (none) | **Advisory, non-blocking** plan clock. Scans `<project>/docs/plans/*.md` + `<project>/plans/*.md` across **every** project and surfaces (a) plans whose frontmatter `checkin:` date has arrived, (b) `status: active` plans untouched ≥10 days (capped at 3), (c) **config defects** — a `checkin:` with no `## Check-in runbook` section or an unparseable date. Exists because a gate that can only be answered by letting time pass otherwise dies quietly: the user had to remember the date AND re-ask the steps. The runbook in the plan IS the procedure, so nothing is re-derived in chat. SKIPS `source: compact`; silent when nothing is due. Manual: `node .claude/hooks/plan-checkin.mjs --list`. Test: `plan-checkin.test.mjs`. |

## Conventions

- **Exit codes:** `0` = silent pass. `2` on PreToolUse = block + stderr shown to Claude; `2` on PostToolUse = feedback to
  Claude (the write already happened, cannot block).
- **stdin:** each hook reads the JSON payload (`tool_name`, `tool_input`, `permission_mode`, `session_id`, `cwd`, …)
  via `_util.mjs` → `readPayload()`. **Exception:** `autonomy-gate.mjs` parses strictly instead — `readPayload()`
  returns `{}` on unparseable input, which is right for an advisory hook and wrong for a gate that claims fail-closed
  (a payload it cannot read is one it cannot check). Caught by its own test suite.
- **False positives are designed out, not blocked through:** `secret-guard` uses tight high-confidence patterns + a
  placeholder allowlist and always exempts `.env*`; invariant checks that can have legitimate exceptions (port-publish in
  local-dev compose) are advisory, never blocking.

## Why the skill grep-guard is NOT automated here

`/skill-authoring`'s conflict grep-guard regex contains the very tokens it forbids (`forwardRef`, `letsencrypt`, …), so the
rule-documenting skills (`skill-authoring`, `react-ui-craft`) would false-fire. That check needs human judgment to tell
"documenting the ban" from "violating it" — it stays a manual step in the skill.

## Activation

Hook config changes require Claude Code to re-read `settings.json` — review via `/hooks` (or restart the session) so the
new hooks take effect. Test a hook standalone by piping a payload:

```bash
echo '{"tool_input":{"file_path":"x.ts","content":"ghp_<40chars>"}}' | node .claude/hooks/secret-guard.mjs; echo $?
```
