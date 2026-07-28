---
proposed_name: ui-pattern-lock
status: installed
created: 2026-07-23
grounding: # rule of three — every instance is a rule that was STATED, WRITTEN DOWN, and violated anyway
  - sakubun/lib/no-emoji.test.ts header — "this rule had already been stated and was broken anyway"
  - sakubun/lib/layout-standard.test.ts header — "the same two regressions kept coming back after being written down"
  - sakubun/lib/spoken-line.test.ts header — "stated, documented in components/_INDEX.md, and violated anyway"
  - .claude/memory/enforce-rules-with-gates.md — the user's own meta-rule: a rule he states must be ENFORCED, not documented
  - .claude/memory/capability-over-rearrangement.md — two redesigns rejected on the same ground
  - user, 2026-07-23 — "tôi liên tục điều hướng hay luôn nhắc về một pattern UI quen thuộc mà bạn không bao giờ để tâm … bị một vài lần tôi đã quá khó chịu"
self_verify:
  generalizes: yes — any project gets a registry at <project>/docs/ui-patterns.json; the runner and hook are project-agnostic
  lean: yes — SKILL.md ~90 lines, hook ~80 lines, generic gate ~140 lines (replaces N bespoke gate files)
  description_what_and_when: yes — fires on a user UI correction and before the first UI write of a session
  no_overlap: >
    /react-ui-craft owns HOW to build UI well (generic craft); /coding-convention owns naming+commits;
    12-ui-layout-standard.md owns the page frame. NONE of them capture "this specific user had to repeat
    himself, lock it". This skill owns only the capture + enforcement loop, and points at those for content.
review:
  outcome: installed
  why: >
    Installed at .claude/skills/ui-pattern-lock/ (with install-ui-pattern-lock.mjs); it is referenced as
    mandatory from the root CLAUDE.md and enforced by lib/ui-pattern-lock.test.ts plus a PreToolUse hook.
    The `status:` field was left at `proposed` at install time and only corrected on 2026-07-28 — a stale
    sandbox row that made an installed skill keep resurfacing as pending in every proposal scan.
---

# Proposed skill: ui-pattern-lock

> Draft — **not installed**. Three of the four artifacts below are governance (`.claude/skills/`,
> `.claude/hooks/`, `.claude/settings.json`, `CLAUDE.md`) so a human installs them. The other two —
> `sakubun/docs/ui-patterns.json` (the registry) and `sakubun/lib/ui-pattern-lock.test.ts` (the gate) —
> are ordinary project files and are **already written and passing**.

## The problem this closes

The user states a UI preference. It gets written into a doc. The doc is on the just-in-time read path, so
the next session writes the UI first and reads the doc never. He notices, repeats himself, and re-verifies
by hand. That loop has now run enough times that three separate bespoke gate files exist, each one written
*after* a repeat violation — and each one cost a file of code, which is exactly why locking a pattern
usually did not happen at all.

The fix has three parts, in order of how much they actually help:

1. **A PreToolUse hook that blocks the session's first UI write** and prints the locked list. A rule the
   agent can skip reading is not a rule; being unable to touch a `.tsx` until the list has been put in
   front of it is.
2. **A registry where locking a pattern is DATA, not code** — one JSON entry instead of a new test file.
   The marginal cost drops to ~2 minutes, so it actually gets done at the moment of correction.
3. **One generic vitest runner** over that registry — the durable backstop for anything greppable.

Rules that cannot be grepped (reuse the shared component; apply it to every surface) live in the registry
as `kind: "manual"`: the runner skips them, the hook still prints them, and the `check` verb audits them.

## Install steps (human)

1. Create `.claude/skills/ui-pattern-lock/SKILL.md` from the block below.
2. Create `.claude/hooks/ui-pattern-lock.mjs` from the block below.
3. Patch `.claude/settings.json` — add the hook to the existing `PreToolUse` `Edit|Write|MultiEdit` group.
4. Patch the root `CLAUDE.md` — add the block below to the `/react-ui-craft` section.
5. Flip `status: installed` here.

---

## 1. The proposed `.claude/skills/ui-pattern-lock/SKILL.md`

````markdown
---
name: ui-pattern-lock
description: Lock a UI pattern the user has had to repeat so he never repeats it again — capture it into the project's docs/ui-patterns.json registry, which a gate and a PreToolUse hook then enforce. Fires the moment the user corrects or re-states a UI preference, and before committing UI work.
---

# Skill: Lock a repeated UI pattern (ui-pattern-lock)

The user should never have to state a UI preference twice. When he does, that is a **defect in the
enforcement layer**, not a memory problem — this skill converts the correction into something mechanical
before the current work continues.

Registry: `<project>/docs/ui-patterns.json`. Gate: `<project>/lib/ui-pattern-lock.test.ts`.
Write-time enforcement: `.claude/hooks/ui-pattern-lock.mjs`.

## Trigger A — the user corrects a UI pattern (MANDATORY, interrupts the work)

Any of these, in any language: "sao không dùng X", "tôi đã nói rồi", "vẫn như cũ", "cái này phải giống
trang Y", "dùng lại component Z đi", or he simply re-states a preference he has stated before.

**STOP the edit in progress and lock it FIRST.** Do not finish the change and lock it afterwards — that is
the exact order that has failed before, because the change ships and the lock never gets written.

1. Restate the rule in ONE imperative line, in his words, not a generalisation of them.
2. Pick the check kind — try hard for a mechanical one before settling for `manual`:
   - `forbid` — a regex that must never appear (`"pattern"`).
   - `require-with` — if `"when"` appears in a file, `"then"` must appear too. This covers most
     "use the shared component" rules: `when` = the raw thing, `then` = the shared component's name.
   - `manual` — only when it is genuinely about intent/coverage and no regex can see it.
3. Append the entry (never edit or delete an existing one — see Rules below).
4. Run the gate. If it goes red on existing code, that is the point: either fix those files now, or add
   each to `allow` with a real reason. Never weaken the pattern to get green.
5. Say back to him, in one line: what got locked, which check kind, and what now fails if it regresses.
6. THEN continue the original work.

## Trigger B — before writing UI in a project that has a registry

The hook blocks the session's first `.tsx` write and prints the list, so this is automatic. If a project
has no registry yet, create one (`init` below) the first time a pattern is worth locking — not before.

## Trigger C — before committing UI work: `check`

Walk the `manual` entries one by one against the diff and state a verdict for each — they have no gate,
so this is their only enforcement. Then run `npm test` for the greppable ones.

## The entry

```json
{
  "id": "kebab-case",
  "rule": "One imperative line — what to do, not what to avoid.",
  "why": "The consequence when it is broken, in the user's terms.",
  "canonical": "components/x.tsx",
  "source": "user 2026-07-23 | memory <name> | platform CLAUDE.md",
  "repeats": 2,
  "lockedOn": "YYYY-MM-DD",
  "check": { "kind": "forbid", "pattern": "<regex>" },
  "allow": { "path/to/exception.tsx": "why this file is a genuine exception" }
}
```

Optional: `"roots": ["app"]` to narrow the scan, `"flags"` for the regex, `"retired": "<why>"` to
deactivate an entry without deleting it.

## Rules

- **Append-only.** Never delete an entry; retire it with `"retired"`. The history of what he had to
  repeat is the point.
- **`repeats` goes up, never down.** If he raises an already-locked pattern again, increment it and treat
  it as evidence the check is too weak — tighten the check or convert `manual` into something mechanical.
- **An exception goes in `allow` with a reason ≥20 chars.** Never widen or weaken the check to get green
  (the gate tests this: a reasonless or stale `allow` entry fails).
- **Do not seed rules he never asked for.** Every entry needs a real `source`. An invented rule makes the
  registry noise and he stops trusting it.
- **Content lives elsewhere.** Page frame → `platform/12-ui-layout-standard.md`; craft →
  `/react-ui-craft`; naming/commits → `/coding-convention`. This registry holds only what HE had to repeat.

## `init` — a new project

Copy `sakubun/lib/ui-pattern-lock.test.ts` (project-agnostic) and create
`<project>/docs/ui-patterns.json` with `{"$doc": "...", "patterns": []}`. The hook picks it up
automatically by walking up from the edited file — no registration anywhere.
````

---

## 2. The proposed `.claude/hooks/ui-pattern-lock.mjs`

```javascript
// PreToolUse hook (Write|Edit|MultiEdit) — BLOCKS the session's first UI write per project, once,
// and prints that project's LOCKED UI PATTERNS (`<project>/docs/ui-patterns.json`) as feedback.
//
// Why blocking and not advisory: the same UI corrections kept coming back because the rules lived in
// docs that are read just-in-time — i.e. usually not before the UI was already written. A doc the
// agent may skip is not a rule; being unable to touch a .tsx before the list has been put in front of
// it is. Cost is one blocked call per session per project; the retry goes straight through.
//
// Non-greppable rules ("reuse the shared component first", "apply it to every surface") exist ONLY
// here — `lib/ui-pattern-lock.test.ts` can only gate what a regex can see.
import os from 'node:os';
import path from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { readPayload } from './_util.mjs';

const payload = await readPayload();
const filePath = payload?.tool_input?.file_path || '';
if (!filePath) process.exit(0);

const posix = filePath.replace(/\\/g, '/');

// Only UI files: a .tsx under an app/ or components/ directory.
if (!/\.tsx$/.test(posix) || !/\/(app|components)\//.test(posix)) process.exit(0);

// Walk up from the file to the nearest project that has a registry.
function findRegistry(start) {
  let dir = path.dirname(start);
  for (let i = 0; i < 12; i++) {
    const candidate = path.join(dir, 'docs', 'ui-patterns.json');
    if (existsSync(candidate)) return { registry: candidate, project: dir };
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const found = findRegistry(filePath);
if (!found) process.exit(0); // project has no locked patterns yet — nothing to enforce

let patterns;
try {
  patterns = JSON.parse(readFileSync(found.registry, 'utf8')).patterns ?? [];
} catch {
  process.exit(0); // a malformed registry is the test's problem, not a reason to block editing
}
const live = patterns.filter((p) => !p.retired);
if (!live.length) process.exit(0);

// Once per session per project. Fail-open on any FS problem: this hook must never wedge a session.
const sessionId = String(payload?.session_id || 'no-session').replace(/[^\w.-]/g, '');
const projectKey = path.basename(found.project);
const markerDir = path.join(os.tmpdir(), 'miniserver-ui-pattern-lock');
const marker = path.join(markerDir, `${sessionId}--${projectKey}`);
try {
  if (existsSync(marker)) process.exit(0);
  mkdirSync(markerDir, { recursive: true });
  writeFileSync(marker, new Date().toISOString());
} catch {
  process.exit(0);
}

const lines = live.map((p) => {
  const bits = [`- [${p.id}] ${p.rule}`, `    why: ${p.why}`];
  if (p.canonical) bits.push(`    copy from: ${p.canonical}`);
  bits.push(`    raised by the user ${p.repeats}x - locked ${p.lockedOn}`);
  return bits.join('\n');
});

console.error(
  `LOCKED UI PATTERNS - ${projectKey} (${path.relative(found.project, found.registry).replace(/\\/g, '/')})\n\n` +
    `This is the session's first UI write, so the rules the user should never have to repeat are ` +
    `listed below. Read them, then make the SAME edit again - the retry is not blocked.\n\n` +
    `${lines.join('\n')}\n\n` +
    `Applies to your edit of ${path.relative(found.project, filePath).replace(/\\/g, '/')}. ` +
    `The greppable ones fail "npm test" (lib/ui-pattern-lock.test.ts); the rest are on you. ` +
    `If the user corrects a UI pattern during this session, add it to the registry BEFORE continuing ` +
    `the work - skill /ui-pattern-lock.`,
);
process.exit(2); // PreToolUse: block this one call, feed the list back to Claude.
```

---

## 3. The proposed `.claude/settings.json` patch

Add one entry to the **existing** `PreToolUse` group whose matcher is `Edit|Write|MultiEdit` (the one
that currently holds `secret-guard.mjs`), after `secret-guard`:

```json
{
  "type": "command",
  "command": "node \"${CLAUDE_PROJECT_DIR}/.claude/hooks/ui-pattern-lock.mjs\"",
  "timeout": 15
}
```

---

## 4. The proposed root `CLAUDE.md` patch

Append to the `## Frontend — skill /react-ui-craft` section:

```markdown
- **Locked UI patterns — skill `/ui-pattern-lock` (the user must never state a UI preference twice).**
  A project's repeated-correction registry is `<project>/docs/ui-patterns.json`, gate-enforced by
  `lib/ui-pattern-lock.test.ts` and printed by a PreToolUse hook before the session's first `.tsx` write.
  **The moment the user corrects or re-states a UI pattern, STOP the edit and lock it FIRST** (append an
  entry — `forbid` / `require-with` / `manual`), then resume. Locking is DATA, not a new test file. An
  exception goes in that entry's `allow` map with a reason; never weaken a check to go green.
```

---

## Pre-mortem — how this fails

- **The hook becomes noise and gets disabled.** Mitigated: it fires once per session per project, only on
  `.tsx` under `app/`/`components/`, and is a no-op when the registry is empty or missing.
- **The registry fills with invented rules and he stops reading it.** Mitigated by the `source` field
  being required and the skill's explicit "do not seed rules he never asked for".
- **`manual` becomes the lazy default**, and manual entries have no gate. Mitigated: the skill orders the
  kinds and requires trying `require-with` first; the `check` verb is the only real enforcement for them,
  so it must actually be run before committing UI work.
- **Stale `allow` entries silently un-gate a file.** Already gated: the runner fails if an `allow` path no
  longer exists or its reason is under 20 characters.
