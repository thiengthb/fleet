# PROPOSAL — a `dated-entry.mjs` appender for the ledger + a project's `decisions.md` (2026-08-01)

**Not applied.** It would live in `.claude/scripts/`, which is on the hard-prohibition list — the agent proposes
there, a human installs (the CVE-2025-53773 lesson). Raised by `/session-wrap` Step 5.5 on a real rule-of-three,
not on a feeling that a script would be nice.

## The recurrence, measured

In one session (2026-08-01, the sakubun terminal surface) the same six-step procedure ran **6 times** — 3 entries
into `projects/sakubun/docs/decisions.md` + `docs/decisions/2026-08.md`, and 3 into
`platform/registries/knowledge-ledger.md` + `platform/ledger/2026-08.md`. Each time:

1. append the entry to the current month's detail file, 2. add the `<a id="…">` anchor, 3. add ONE index row with a
link to that anchor, 4. update the "N entries." line in the detail file, 5. update the lesson/decision count in the
index, 6. verify the anchor actually resolves.

## What went wrong doing it by hand — three failures, all mechanical

1. **The anchor slug convention differs between the two files, and neither states it.** `decisions.md` rows use the
   slug **truncated to 61 characters** (what `decisions-split.mjs` emitted); the ledger uses the full slug. The
   first attempt wrote a 57-char slug, which resolved nowhere, and the convention had to be reverse-engineered by
   diffing an existing row against its heading.
2. **The hand-maintained counts drift, and a concurrent session made one write fail outright.** A script died on
   `if (!s.includes('211 lessons,'))` because another session had, in the meantime, replaced that number with a
   measured 258 and added a note reading *"Recite nothing from here: count it"* — after finding the hand-incremented
   figure had drifted by 47. The detail file's "N entries." line was left saying 8 when the file held 10.
3. **Nothing checks step 6 at write time.** `link-check.mjs` validates ledger anchors, but only when someone runs
   it, and it does not cover a project's `decisions.md` at all — that check had to be hand-written inline, twice.

## The proposal

`node .claude/scripts/dated-entry.mjs --target ledger|decisions [--project <name>] --title "<headline>" --body <file>`

- picks the current month's file (creating it from the previous month's header if absent);
- writes the heading + the `<a id>` anchor + the body, and the index row pointing at it;
- **MEASURES** both counts from the files rather than incrementing them, per the rule the ledger index adopted
  today, and refuses if the index row it just wrote does not resolve;
- encodes the 61-char-vs-full slug difference in ONE place — or, better, the human decides to unify them and the
  script normalises both, which is the part worth a decision rather than a default.

Refuses (never guesses) when: the target file has no recognisable count line, the anchor already exists, or the
index and detail disagree before it starts — i.e. when a concurrent edit is in flight.

## Why a script and not a skill

`/session-wrap` already *tells* the agent to do this and has done so all along; the failures above were not
ignorance of the procedure. The procedure is deterministic and its inputs are files, which is the definition of
something a script should own. A skill would restate what the wrap already says.

## Cost, and the argument against

~80 lines plus a test. The argument against is real: this runs a handful of times a week, by an agent that can also
just do it carefully, and `.claude/scripts/` is already 30 tools — every one is context in `tool-catalog.md`. The
counter is that two of the three failures above (a slug convention nobody wrote down, and counts that drift under
concurrency) are the kind that produce a **silently broken link**, which nothing notices until someone follows it.

**Decision needed from the supervisor:** install it, or accept the manual procedure and instead add the two missing
checks to `link-check.mjs` (project `decisions.md` anchors + count lines matching a measured count), which is
smaller and catches the damage even if the writing stays by hand. The second option is the cheaper half and is
probably the right first step.
