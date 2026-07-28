<!-- A proposed EXTENSION to an existing skill, not a new one. Inert until a human applies it. -->

---
proposed_name: prisma-expert-migration-rehearsal
kind: extension # NOT a new skill — a section to paste into .claude/skills/prisma-expert/SKILL.md
extends: prisma-expert
status: installed
created: 2026-07-27
grounding: # rule of three, all three on REAL user data in the live sakubun container
  - "log/2026-07-26.md + sakubun `Item.challenge/challengeObservations` — Prisma turned ADD COLUMN into a full table REDEFINE (drop+recreate+copy) because FKs were present; rehearsed on a copy of the live DB (12 table counts identical, 6 indexes rebuilt, sampled content intact), backed up, applied, 0 drift"
  - "log/2026-07-27.md (2026-07-27-02/03) + sakubun `ReviewLog.errorDetail` — the SAME shape was a plain ALTER TABLE ADD COLUMN, not a redefine (17 table counts identical, 53 indexes unchanged, column appended). Proves the outcome must be READ off the generated SQL, not predicted"
  - "log/2026-07-27.md (2026-07-27-04) + sakubun `LearnerNote` — a pure CREATE TABLE (tables 19→20, indexes 53→55, all 17 row counts identical), rehearsed and backed up anyway; the cheapest class still went through the same gate"
self_verify:
  generalizes: yes — the three instances span the three migration classes (redefine / add-column / create-table) and the procedure is identical for all of them; the only per-class difference is what the diff is EXPECTED to show, which the draft states
  lean: yes — one section, ~50 lines, pasted into an existing skill rather than a new file tree
  description_what_and_when: n/a — an extension carries no description of its own; the host skill's description already covers "migrations"
  no_overlap: >
    Deduped against /prisma-expert (the migrations owner — it currently says only "test before deploy" with no
    procedure, which is the gap), /database-design (vendor-neutral design, not operations), /host-audit
    (reconciles INVENTORY vs reality, never migrates), /verification-before-completion (generic "run it and read
    the output", no DB specifics). NO new skill is proposed: the platform has 54 already and this is one section
    of an existing one.
review:
  outcome: installed
  why: >
    Applied 2026-07-28 at the supervisor's instruction into .claude/skills/prisma-expert/SKILL.md,
    replacing "test before deploy". Step 2 gained a clause the draft lacked: the copy exists to be
    MIGRATED and deleted, and is not a route for reading production data — reading rows stays in-place
    and read-only. By then the procedure had five instances, not three (Sentence.extraPatterns and
    CalibrationProposal, both 2026-07-28).
---

# Proposed extension: rehearse a live migration on a copy before applying it

> Draft — not applied. On approval, paste the section below into `.claude/skills/prisma-expert/SKILL.md`,
> replacing the single sentence "Keep changes backward-compatible (no silent data loss); test before deploy."
> The agent must not edit `.claude/skills/**` itself.

## The section to paste (into `## Migrations`, after the command list)

```markdown
### Rehearse on a COPY before touching live data (any migration on a deployed app)

"Test before deploy" is not a procedure, and the interesting failures are silent. Prisma on SQLite may implement
`ADD COLUMN` as a full table REDEFINE (drop + recreate + copy) when FKs are present — or as a plain `ALTER TABLE`.
Which one you got is READ off the generated SQL, never predicted: the same shape did both on the same schema a day
apart. So run the same six steps regardless of how safe the change looks; the cheapest class costs about two minutes.

1. **Read the generated SQL first.** `npx prisma migrate dev --name <x>` against a THROWAWAY db (point
   `DATABASE_URL` at a scratch file), then open `prisma/migrations/<ts>_<x>/migration.sql`. A `CREATE TABLE` is the
   safest class; a `PRAGMA foreign_keys=OFF` + `CREATE TABLE new_X` + `INSERT INTO new_X SELECT` block is a REDEFINE
   and rewrites every row.
2. **Copy the live database out** (`docker cp <container>:<path> ./copy.db`) and **fingerprint it**: table count,
   index count, and a per-table row count. Keep the fingerprint — it is the only thing that can prove "0 drift".
3. **Apply to the COPY** — `DATABASE_URL="file:./copy.db" npx prisma migrate deploy`.
4. **Diff the fingerprints.** Every pre-existing row count must be IDENTICAL; only the intended tables/indexes may
   appear. A changed row count on an untouched table means stop.
5. **Back up live**, dated and gitignored (`backup-prod-<what>-<YYYYMMDD>.db`), THEN apply. If the container runs
   `migrate deploy` at start-up, applying = rebuilding the image so the new migration is inside it.
6. **Re-fingerprint the LIVE db against the step-2 fingerprint** and state the result. "The migration succeeded" is
   the tool's claim; "0 drift, counts identical" is the evidence.

Delete the backups only once the migration is trusted in daily use — and say in the report that they exist, or they
become litter nobody dares remove.
```

## Why this is worth capturing (the rule-of-three case)

- **Instance 1 (2026-07-26, `Item.challenge`)** — the discovery: a nullable additive column on an FK'd SQLite table
  was implemented as a full REDEFINE, so "additive" rewrote every row of real user data. Caught because it was
  rehearsed on a copy first.
- **Instance 2 (2026-07-27, `ReviewLog.errorDetail`)** — the same shape was a plain `ADD COLUMN`. This is the
  instance that makes the skill worth writing: the lesson from #1 ("always a redefine") would have been the WRONG
  generalisation. The procedure is what transfers, not the prediction.
- **Instance 3 (2026-07-27, `LearnerNote`)** — a pure `CREATE TABLE`, the safest possible class, run through the
  same six steps anyway. Cost: ~2 minutes. That is the argument for making it unconditional.

**What was re-provided each time**: the fingerprint script (tables / indexes / per-table row counts), the
`docker cp` + scratch-`DATABASE_URL` invocations, the dated-backup naming, and the discipline of re-checking the
LIVE database after the fact rather than trusting `migrate deploy`'s success message. All four were re-derived from
scratch on each occasion.

## Curator note (no action proposed)

While scanning: `auto-pilot` + `auto-pilot-smoke-test` remain in `.claude/skills/` and, per the platform's own
memory, were "built to completion, never run on real work". Not proposing a retirement — flagging them as the
strongest retire-or-run candidates if the human wants the set to stop growing.
