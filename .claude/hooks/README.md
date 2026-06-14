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
| `suggest-session-wrap.mjs` | Stop | (none) | **Advisory, non-blocking** `systemMessage` nudge to run `/session-wrap`. Fires **at most once per session**, and ONLY when the transcript shows substantial work (≥3 distinct non-knowledge files OR ≥5 edits) that has NOT been wrapped (no edit to `decisions.md`/`00-map.md`/`06-knowledge-ledger.md`/`MEMORY.md`/`memory/*`/`02-known-traps.md`). Once-per-session via a `session_id` marker in the OS temp dir; respects `stop_hook_active`. Never blocks the stop. |

## Conventions

- **Exit codes:** `0` = silent pass. `2` on PreToolUse = block + stderr shown to Claude; `2` on PostToolUse = feedback to
  Claude (the write already happened, cannot block).
- **stdin:** each hook reads the JSON payload (`tool_name`, `tool_input`, …) via `_util.mjs` → `readPayload()`.
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
