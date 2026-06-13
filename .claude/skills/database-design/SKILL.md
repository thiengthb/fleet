---
name: database-design
description: Vendor-neutral database DESIGN judgment for a MiniServer app — choosing the database (SQLite-first, Postgres when warranted), schema/normalization, relationship modeling, indexing strategy, and avoiding N+1 before it's written. Use when starting a data model or deciding "what database / how to structure this". Defers Prisma mechanics (migrations/query syntax) to /prisma-expert; ORM is fixed = Prisma.
---

# Database Design (platform-adapted)

> **Learn to THINK about the data, not copy SQL.** The *how* (Prisma schema/migration/query syntax) lives in
> `/prisma-expert`; this skill is the *what/why* decided before you write the schema.

> **Adapted from** `development/database-design` (`davila7/claude-code-templates`). **Dropped its ORM-selection
> guidance** (Drizzle/Kysely vs Prisma) — on this platform **the ORM is fixed = Prisma** (invariant). Kept the database
> selection + schema/index/relationship thinking.

## 1. Choosing the database (this IS a real choice here)

Default order of preference for a new MiniServer app — **start simple**:

- **SQLite** (the platform default; `todo` + `yakudoku` use it). A file in the app's named volume. Right for a
  single-writer app, personal/low-concurrency tools, embedded data. Zero extra container, trivial backup (copy the file).
- **Postgres** — choose only when you genuinely need: high write concurrency / multiple writers, advanced types
  (JSONB, arrays, full-text), or features SQLite lacks. It adds a container + connection management — don't pay that
  cost without a reason.

Decision check before modeling: *does this app actually outgrow SQLite?* If not, SQLite. (Don't default to Postgres "to
be safe" — that's the anti-pattern.) Whichever you pick, set it as the Prisma `provider` and let `/prisma-expert` drive
the schema.

> SQLite consequence to design around: **no native enums, single writer.** Model fixed value-sets as a `String` + an
> app-level union type (or a lookup table); serialize writes through one path (e.g. server actions / a single core
> service, as `yakudoku` does).

## 2. Schema & relationships

- **Normalize by default**; denormalize only for a measured read-path win.
- One clear **primary key** per table (`cuid()`/`uuid()` string ids on this stack).
- Model relationships explicitly: 1-1, 1-n, n-m (explicit join table when the relation carries its own data).
- Prefer **computing dynamically** over storing derived columns when feasible — `todo` computes streak/delay live to
  avoid drift (see its `lib/streak.ts`). Store a derived value only when recomputation is too expensive, and own the
  invalidation.
- Store structured data as columns, not a JSON blob, when you'll query/filter it.

## 3. Indexing

- Add an index for every field you **filter, sort, or join** on; composite index (column order matters) for multi-column
  WHERE. Unique constraints where the domain is unique (e.g. `email`).
- Don't over-index a write-heavy table (each index costs on write). Index to the queries you actually run.

## 4. Avoid N+1 at design time

Design the access pattern, not just the tables: if a screen lists parents with their children, plan to fetch them in one
query (Prisma `include`/`select`) — never a loop of per-row queries. (Mechanics: `/prisma-expert` query section.)

## Decision checklist

- [ ] Picked the database for THIS app's real concurrency/feature needs (SQLite unless it genuinely won't do)?
- [ ] PKs + relationship types defined; derived data computed-vs-stored decided (with invalidation if stored)?
- [ ] Index strategy matches the real queries (filter/sort/join fields)?
- [ ] SQLite constraints (no enums, single writer) designed around, if SQLite?
- [ ] Handing schema/migration/query *implementation* to `/prisma-expert`?

## Anti-patterns

❌ Default to Postgres for a simple app (SQLite usually suffices) · ❌ skip indexing filtered fields · ❌ `SELECT *` /
over-fetch in production · ❌ JSON blob where structured columns belong · ❌ store a derived value you could compute,
then let it drift · ❌ re-deciding the ORM (it's Prisma).
