# PROPOSAL — two governance edits, batched into one review (2026-08-01)

**Why batched.** `platform/plans/2026-08-01-harness-upgrade.md` diagnoses the operator's "rất khó khăn" feeling as a
throughput limit, not an attitude: every improvement to fleet is a governance change, and a governance change needs the
supervisor. One of the plan's three answers is to **batch governance diffs so one review covers many changes.** This is
that, for the two items this session could not apply itself.

Neither is applied. `CLAUDE.md`, `.claude/hooks/` and `.claude/settings.json` are on the hard-prohibition list, and the
agent proposes there — the CVE-2025-53773 lesson.

---

## 1. `.claude/workflows/` is missing from the prohibition list — **the security-relevant one**

**The hole.** `CLAUDE.md`'s 13 protected surfaces name **`.github/workflows/`** (CI). They do **not** name
**`.claude/workflows/`**, which holds JavaScript that the runtime executes to spawn subagents — **up to 16 concurrent
and 1,000 per run** — with a tool set the script itself chooses, plus `isolation: worktree` and a custom `agentType`.

That is a strictly larger capability grant than several surfaces the list *does* protect. And it is not hypothetical:
`.claude/workflows/deep-research.js` already exists (fleet-authored, 5 phases, fans out `WebSearch`/`WebFetch` agents),
so the directory is live, in use, and unguarded.

**Same shape as the hole found on 2026-07-31**, which was `.claude/agents/` — an agent definition grants `tools:` and
pins `model:`, and the list omitted it. Both were found the same way: by trying to obey the list and noticing what it
does not cover. Two omissions of the same kind means the list was written by enumerating *what had been edited*, not
*what confers capability*.

### The diff — BOTH files, in ONE commit

`claude-md-budget.mjs`'s GOVERNANCE-SYNC check counts the gate's surfaces against the prose in `CLAUDE.md`. Applying
one without the other turns it red.

**(a) `CLAUDE.md`**, in the Autonomous-agent section:

```diff
-  the agent **NEVER edits its own governance** — under `.claude/`: `settings*.json`, `hooks/`, `skills/`, `agents/`
-  (a subagent's prompt), `rules/`, `scripts/`, `memory/`; plus any `CLAUDE.md`, `.github/workflows/`,
+  the agent **NEVER edits its own governance** — under `.claude/`: `settings*.json`, `hooks/`, `skills/`, `agents/`
+  (a subagent's prompt), `workflows/` (a script that spawns subagents), `rules/`, `scripts/`, `memory/`; plus any
+  `CLAUDE.md`, `.github/workflows/`,
```

Also update the count in the same sentence: **13 → 14** enforced surfaces (`All 13 enforced by autonomy-gate.mjs` →
`All 14 …`).

**(b) `.claude/hooks/autonomy-gate.mjs`**, in the `GOVERNANCE` array and the `GOV_PATH` alternation — the same two
places the `agents/` patch touched:

```diff
   { name: 'a subagent definition (agent behaviour)', re: /\.claude\/agents\// },
+  { name: 'a workflow script (spawns subagents with a tool set of its choosing)', re: /\.claude\/workflows\// },
```

```diff
-(?:settings|hooks|skills|rules|scripts|memory|agents)
+(?:settings|hooks|skills|rules|scripts|memory|agents|workflows)
```

### Verify after applying

```
node .claude/scripts/claude-md-budget.mjs     # expect: … · 15/15 governance surfaces named
node .claude/hooks/autonomy-gate.test.mjs     # expect: green
node .claude/scripts/tool-check.mjs --quiet    # expect: 39/39 · 38/38
```

**Note on the count.** GOVERNANCE-SYNC currently reports `14/14`; the gate array is one longer than
`CLAUDE.md`'s prose count because the array splits one prose item. After this patch expect **15/15**. If it reports
`14/15`, the prose edit landed and the gate edit did not — that is the check doing its job, not a regression.

**One test is required, not optional** (`standards/testing.md §2.7`): `autonomy-gate.test.mjs` must gain a case that a
write to `.claude/workflows/x.js` is refused under `CLAUDE_AUTONOMOUS=1`, and the `agents/` case is the template. A
protected surface with no test is a surface that is protected until someone reorders a regex.

---

## 2. Statusline — plan step 2.7, the cheapest item in the plan

**Why.** fleet reasons continuously about token economics (`token-and-research.md`, `usage-census`, `sprawl-check`,
`platform-report`) and has **no live read-out**. `/context` answers the question on demand; a statusline answers it
without being asked, which is the difference between a metric and an instrument.

**Honest scope:** this is a *convenience*, not a named-failure adoption. It fails the plan's own ADOPT bar and is in
the plan as F-new-8's cheap tier. If the supervisor would rather not add a file for it, **declining costs nothing** and
the correct record is "refused as a convenience", not "pending".

**Not written as a script yet, deliberately.** Consequence 2 caps new fleet-authored machinery in this plan at 3 files,
and spending one of three on a cosmetic read-out before `commons` (the plan's only live cut candidate) is decided
would be spending the cap on the least valuable item. **Decision requested first, file second.**

If accepted, the shape is one `.claude/statusline.mjs` reading the JSON Claude Code passes on stdin, plus:

```diff
 {
+  "statusLine": { "type": "command", "command": "node \"${CLAUDE_PROJECT_DIR}/.claude/statusline.mjs\"" },
   "hooks": {
```

---

## What the supervisor is deciding

| # | Gate | Yes does | No does |
|---|---|---|---|
| 1 | Apply the two-file `workflows/` patch | closes a capability hole the agent found by trying to obey the list; `claude-md-budget` then reads `15/15` | `.claude/workflows/` stays writable by an unattended agent, and the plan records it as a known, accepted hole |
| 2 | Build the statusline | one new file, a live context/cost read-out from the next session | recorded as "refused as a convenience"; nothing else in the plan depends on it |

Gate 1 is recommended and is the only one with a security argument behind it. Gate 2 is genuinely optional.
