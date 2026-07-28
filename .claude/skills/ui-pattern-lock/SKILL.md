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
