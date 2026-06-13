---
name: systematic-debugging
description: Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes — find the root cause first (read errors, reproduce, check recent changes, trace data flow) instead of guessing. Pairs with /verify and /vitest-server-actions (failing test) and /verification-before-completion (confirm the fix).
---

# Systematic Debugging (platform-adapted)

> **Adapted from** `development/systematic-debugging` (`davila7/claude-code-templates`). Kept the four-phase discipline;
> replaced the dangling external sub-skill and supporting-file references with this platform's skills
> (`/vitest-server-actions` for the failing test, `/verification-before-completion` for confirming the fix).

Random fixes waste time and create new bugs. Quick patches mask the real issue.

**Core principle:** ALWAYS find the root cause before attempting a fix. A symptom fix is a failure.

## The Iron Law

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

Use it for ANY technical issue (test failure, prod bug, unexpected behaviour, perf, build/integration). **Especially**
when under time pressure, when "one quick fix" looks obvious, or when a previous fix didn't work. Don't skip because the
issue "seems simple" — simple bugs have root causes too, and the process is fast for them.

## The four phases (complete each before the next)

### Phase 1 — Root cause investigation (BEFORE any fix)
1. **Read the error carefully** — full stack trace, line numbers, file paths, codes. The message often contains the fix.
2. **Reproduce consistently** — exact steps; every time? If not reproducible → gather more data, don't guess.
3. **Check recent changes** — `git diff`/recent commits, new deps, config/env differences.
4. **Gather evidence in multi-component systems** — when the path crosses boundaries (CI → build → sign, action → Prisma
   → DB, app → Traefik → tunnel), add diagnostic logging at EACH boundary: what data enters, what exits, is env/config
   propagated. Run once to see WHERE it breaks, then investigate that component. (This maps onto the platform's
   debug-by-layer rule: DNS → tunnel → traefik → app.)
5. **Trace data flow backward** — where does the bad value originate? What passed it in? Keep tracing up to the source;
   fix at the source, not the symptom.

### Phase 2 — Pattern analysis
Find similar **working** code in the same codebase; if implementing a pattern, read the reference implementation
COMPLETELY (don't skim). List every difference between working and broken — don't assume "that can't matter". Understand
the dependencies/config/assumptions it needs.

### Phase 3 — Hypothesis & testing
State ONE hypothesis ("X is the root cause because Y"). Test it with the SMALLEST possible change, one variable at a
time. Worked → Phase 4. Didn't → form a NEW hypothesis; do NOT stack more fixes. When you don't know, say "I don't
understand X" and research — don't pretend.

### Phase 4 — Implementation
1. **Create a failing test first** (simplest reproduction) — via `/vitest-server-actions` (or a one-off script if no
   framework). Must exist before the fix.
2. **One fix** addressing the root cause — no "while I'm here" refactors.
3. **Verify** via `/verification-before-completion`: the test passes, nothing else broke, the issue is actually resolved.
4. **If the fix fails:** count attempts. < 3 → return to Phase 1 with the new info. **≥ 3 → STOP and question the
   architecture** (each fix revealing a new coupling/problem elsewhere = wrong architecture, not a failed hypothesis —
   discuss with the user before fix #4).

## Red flags — STOP and return to Phase 1

"Quick fix now, investigate later" · "just try changing X" · "add several changes, run tests" · "skip the test, I'll
verify manually" · "it's probably X" · proposing fixes before tracing data flow · **"one more fix attempt" after 2+
failures**. User signals you're guessing: "stop guessing", "is that not happening?", "we're stuck?" → STOP, Phase 1.

## Common rationalizations

| Excuse | Reality |
|--------|---------|
| "Simple issue, skip the process" | Simple bugs have root causes; the process is fast for them. |
| "Emergency, no time" | Systematic is FASTER than guess-and-check thrashing. |
| "Try this first, investigate later" | The first fix sets the pattern. Do it right from the start. |
| "Test after I confirm the fix" | Untested fixes don't stick; the test first proves it. |
| "Multiple fixes at once saves time" | Can't isolate what worked; causes new bugs. |
| "I see the problem" | Seeing the symptom ≠ understanding the root cause. |

## When investigation reveals "no root cause"

If it's genuinely environmental/timing/external: you've completed the process — document what you investigated,
implement appropriate handling (retry/timeout/clear error + logging). But ~95% of "no root cause" is incomplete
investigation.
