# Proposal — `.claude/agents/**` is governance, and nothing was guarding it

**Status:** proposed, not applied. `.claude/hooks/autonomy-gate.mjs` and `CLAUDE.md` are both governance, so the
agent may propose and a human decides (`CLAUDE.md` §Autonomous agent, the CVE-2025-53773 lesson).

**Date:** 2026-08-01 · **Raised by:** a carry-forward item that had been recorded as "awaiting a human" since
2026-07-31 with no artefact attached, so there was nothing for a human to act on.

**Files in this proposal**

| File | What it is |
|---|---|
| `2026-08-01-autonomy-gate.mjs.proposed` | drop-in replacement for `.claude/hooks/autonomy-gate.mjs`, **two changed lines** |
| `2026-08-01-agents-gate-measure.mjs` | runs 15 cases against the LIVE gate and the proposed one, side by side |

## The measurement (run it yourself: `node platform/proposals/2026-08-01-agents-gate-measure.mjs`)

```
live gate: 7/15 correct · proposed gate: 15/15 correct
✓ 8 hole(s) closed, 0 regressions.
```

Every one of these was **ALLOWED** by the live gate under `CLAUDE_AUTONOMOUS=1`, while the same operation on
`.claude/skills/`, `.claude/rules/` or `.claude/hooks/` was blocked:

| Case | live | proposed |
|---|---|---|
| `Write .claude/agents/reviewer.md` | allow | BLOCK |
| `Edit .claude/agents/reviewer.md` | allow | BLOCK |
| `Write .claude/agents/exfiltrator.md` (a brand-new subagent) | allow | BLOCK |
| `MultiEdit .claude/agents/reviewer.md` | allow | BLOCK |
| `cp evil.md .claude/agents/reviewer.md` | allow | BLOCK |
| `cat evil.md >> .claude/agents/reviewer.md` | allow | BLOCK |
| `sed -i s/a/b/ .claude/agents/reviewer.md` | allow | BLOCK |
| `.claude\agents\reviewer.md` (Windows separators) | allow | BLOCK |

## Why this is governance, not an ordinary file

A file in `.claude/agents/` **is a subagent's system prompt.** `reviewer.md` is what tells the review agent what
to look for and what to refuse — the same kind of artefact as a skill or a path-scoped rule, both of which the
gate already blocks. It was the only member of that class missing, and the omission is invisible by inspection
because the array it belongs to reads as complete.

The concrete attack it leaves open, in one line: an unattended run edits `reviewer.md` to stop reporting a class
of finding, and every later review is clean for a reason no diff of the reviewed code will ever show. That is
worse than editing a skill, because a skill's effect shows up in the session that loads it, whereas a subagent's
prompt shapes a *second* model's output that the main loop then trusts as an independent opinion.

## The change

Two lines, both additive, no existing behaviour touched:

1. `GOVERNANCE` array (the `Write`/`Edit`/`MultiEdit` branch) gains
   `{ name: 'a subagent definition (agent behaviour)', re: /\.claude\/agents\// }`.
2. The Bash branch's `GOV_PATH` alternation gains `agents`:
   `(?:settings|hooks|skills|rules|scripts|memory)` → `(?:settings|hooks|skills|rules|scripts|memory|agents)`.

**Both are required, and this is the part worth checking.** Step 2.2 of the idea-0023 build plan found that the
governance block lived *only* on the file-tool branch, so `cp evil.md .claude/hooks/x.mjs` was allowed — the gate
had read as airtight since June because every test reached it through `Write`/`Edit`. Patching only the array
here would have reproduced that exact bug in a new file class, five weeks after it was found and written up.

## Not over-blocking — four cases exist specifically to prove that

A gate that blocks too much gets switched off, which is strictly worse than a hole. All four stay **allowed** in
the proposed gate:

- `grep -rn reviewer .claude/agents/` — reading governance is not the threat, and never has been in this gate.
- `grep -r x .claude/agents/ > /tmp/out.txt` — a redirect is judged by its **target**, not by what it reads.
- `Write platform/plans/whatever.md` — an ordinary artefact.
- `Write projects/todo/app/agents-page/page.tsx` — the word "agents" outside `.claude/`. The regex requires the
  `.claude/agents/` prefix, so `agents-page`, and also `.claude/agents-backup/`, are untouched.

## The second, separate defect this exposed — the prose and the gate disagree

`CLAUDE.md` lists **7** governance surfaces: `.claude/settings*.json`, `hooks/**`, `skills/**`, `memory/**`, any
`CLAUDE.md`, `.github/workflows/**`, `.env*` — and says *"Enforced by `autonomy-gate.mjs`"*, which reads as "this
list is that list". The live gate's `GOVERNANCE` array actually holds **12** entries (counted from the array, not
from memory — the first draft of this proposal said 11), adding `.claude/rules/`, `.claude/scripts/`, `.git/`,
`platform/standards/` and `platform/inbox/quarantine/`.

Neither list mentions `agents/`. The drift matters in both directions: a reader trusting `CLAUDE.md` would think
`.claude/scripts/` and `.claude/rules/` are free to edit unattended (they are not), and nobody comparing the two
would notice the file class that is in **neither**. A prohibition that is only in the hook is enforced but not
known; one that is only in the prose is known but not enforced.

**Proposed `CLAUDE.md` edit — a human applies this, the agent must not:** replace the parenthesised list in the
§Autonomous agent prohibition with

> (`.claude/settings*.json`, `hooks/**`, `skills/**`, `agents/**`, `rules/**`, `scripts/**`, `memory/**`, any
> `CLAUDE.md`, `.github/workflows/**`, `platform/standards/**`, `platform/inbox/quarantine/**`, `.env*`)

`.claude/scripts/**` deserves one sentence of justification since it is the one most likely to look wrong: those
scripts *are* the platform's measuring instruments, and today's own session is the argument — a single edit to
`usage-census.mjs` changed which hooks the retirement machinery nominates. An unattended run that can edit its
own instruments can make any verdict come out any way.

**Word budget:** the replacement is longer, and `CLAUDE.md` is gated at 1,800 words by
`.claude/scripts/claude-md-budget.mjs`. Read from the tool 2026-08-01 — `1730/1800 words · 16/16 prohibitions ·
6/6 cited sections resolve` — and the added list is **+18 words**, so it lands at ~1,748: inside the budget, with
room but not much. If a later change needs those words back, the list belongs in the contract with `CLAUDE.md`
citing it, which is the §7.3 exit route every other block took. `claude-md-budget.mjs` also asserts every
prohibition is *present*, matched on whitespace-normalised text, so **the checker must be updated in the same
commit** or it will fail on the new wording. That is agent work once the human decides the wording.

## Install procedure

```
# 1. see exactly what changes — two lines, nothing else
diff .claude/hooks/autonomy-gate.mjs platform/proposals/2026-08-01-autonomy-gate.mjs.proposed

# 2. measure both gates yourself before trusting this document
node platform/proposals/2026-08-01-agents-gate-measure.mjs

# 3. install
cp platform/proposals/2026-08-01-autonomy-gate.mjs.proposed .claude/hooks/autonomy-gate.mjs

# 4. the existing suites must still pass IN PLACE, not just in the sandbox
node .claude/hooks/autonomy-gate.test.mjs
node .claude/hooks/autonomy-gate.quarantine.test.mjs
```

Then, as agent work: fold the 15 cases into `.claude/hooks/autonomy-gate.test.mjs`, update `CLAUDE.md`'s list and
`claude-md-budget.mjs`'s prohibition set together, and attic this proposal plus its measure script — a
measurement kept after it has been acted on becomes a document claiming a hole that no longer exists.

## What was ruled out

- **Leave it.** The gate only fires unattended, and no unattended run happens on this machine today. Rejected:
  `AUTONOMOUS` is also true for non-interactive entrypoints, not just `CLAUDE_AUTONOMOUS=1`, so the surface is
  larger than "when I remember to set the variable" — and a guard added before it is needed costs two lines.
- **The agent installs it, since the change is trivially small and measured.** Rejected on principle, and the
  principle is the whole point: this is the hook that stops the agent editing its own guardrails. An agent that
  may patch it when it judges the patch safe has no guardrail at all.
- **A broader rule — "block everything under `.claude/`".** Tempting and simpler to state, but it would block
  `.claude/agents/`… and also every test file, fixture and future subdirectory, which is how a gate becomes a
  thing people switch off. The list is explicit on purpose.
