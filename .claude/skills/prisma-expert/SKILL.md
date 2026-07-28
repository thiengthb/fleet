---
name: prisma-expert
description: Prisma ORM depth for a MiniServer web-app — schema & relations design, migrations (dev vs deploy), N+1 / query optimization, and transactions. Use when designing or debugging a Prisma schema, a migration, a slow/over-fetching query, or a transaction. Complements /database-design (vendor-neutral design choices) and /coding-convention; the data layer of the standard web stack (Next.js + Prisma + server actions).
---

# Prisma Expert (platform-adapted)

Deep Prisma knowledge for the standard data layer. Living references: `todo/prisma/schema.prisma` + `todo/lib/db.ts`
(the singleton) + `todo/app/actions.ts` (server actions calling `prisma.*`).

> **Adapted from** `development/prisma-expert` (`davila7/claude-code-templates`). Stripped: its "recommend a different
> specialist" routing (those skills don't exist here) and its serverless connection-pooling framing — **our apps are
> long-lived Docker containers, and several use SQLite** (`todo`, `yakudoku`), not just Postgres. Keeps the
> schema/migration/query/transaction playbooks.

## Platform facts (don't fight these)

- **ORM is fixed = Prisma.** Provider is per-app: **SQLite** (`provider = "sqlite"`, file in the app's named volume) for
  `todo`/`yakudoku`, or Postgres where chosen. Vendor-neutral "should I use Prisma/Drizzle/Kysely" decisions belong to
  `/database-design`, not here.
- **Client = a singleton** (`lib/db.ts`: `globalForPrisma.prisma ?? new PrismaClient()`), imported as `@/lib/db`. This is
  the correct pattern for a long-lived container — there is no serverless cold-start / connection-leak problem to solve.
- **Migrations live in `prisma/migrations/`**; CI/containers run `prisma migrate deploy`, dev uses `migrate dev`.

## When invoked — detect first

```bash
npx prisma --version 2>/dev/null || echo "Prisma not installed"
grep "provider" prisma/schema.prisma | head -1          # sqlite | postgresql
ls prisma/migrations/ 2>/dev/null | head                 # migrations present?
```

Then: identify the category (schema / migration / query / transaction), check for the anti-patterns below, apply the
smallest correct fix, validate with the Prisma CLI.

## Schema design

`npx prisma validate` · `npx prisma format`. Good shape:

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  posts     Post[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([email])
  @@map("users")           // snake_case table (per /coding-convention DB fields)
}

model Post {
  id       String @id @default(cuid())
  title    String
  author   User   @relation(fields: [authorId], references: [id], onDelete: Cascade)
  authorId String
  @@index([authorId])
  @@map("posts")
}
```

- Explicit `@relation` with `fields` + `references`; define `onDelete`/`onUpdate`.
- `@@index` on fields you filter/sort by; composite `@@index` for multi-column WHERE.
- `@@map`/`@map` for snake_case table/column names (matches the DB-field convention).
- **SQLite caveat:** no native enums (use a `String` + app-level union or a lookup table); some Postgres-only types
  (e.g. `@db.*`) don't apply.

## Migrations

```bash
npx prisma migrate dev --name descriptive_name     # development only
npx prisma migrate deploy                           # CI / container (NEVER migrate dev in prod)
npx prisma migrate status
npx prisma migrate resolve --applied "name"         # repair a partially-applied prod migration
```

Keep changes backward-compatible (no silent data loss). A reset (`migrate reset`) is dev-only — it **drops data**,
never on a deployed app.

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
   The copy exists to be MIGRATED and then deleted; it is not a way to read production data. Reading rows stays
   in-place and read-only (`docker exec … {readOnly:true}`, only the columns you need).
3. **Apply to the COPY** — `DATABASE_URL="file:./copy.db" npx prisma migrate deploy`.
4. **Diff the fingerprints.** Every pre-existing row count must be IDENTICAL; only the intended tables/indexes may
   appear. A changed row count on an untouched table means stop.
5. **Back up live**, dated and gitignored (`backup-prod-<what>-<YYYYMMDD>.db`), THEN apply. If the container runs
   `migrate deploy` at start-up, applying = rebuilding the image so the new migration is inside it.
6. **Re-fingerprint the LIVE db against the step-2 fingerprint** and state the result. "The migration succeeded" is
   the tool's claim; "0 drift, counts identical" is the evidence.

Delete the backups only once the migration is trusted in daily use — and say in the report that they exist, or they
become litter nobody dares remove.

## Query optimization (N+1 is the usual culprit)

```ts
// BAD — N+1
const users = await prisma.user.findMany();
for (const u of users) await prisma.post.findMany({ where: { authorId: u.id } });

// GOOD — include the relation
const users = await prisma.user.findMany({ include: { posts: true } });

// BETTER — select only what the DTO needs (also keeps the client payload minimal)
const users = await prisma.user.findMany({
  select: { id: true, email: true, posts: { select: { id: true, title: true } } },
});

// COMPLEX aggregation — raw, parameterized
const rows = await prisma.$queryRaw`SELECT author_id, COUNT(*) FROM posts GROUP BY author_id`;
```

Enable query logging in dev (`new PrismaClient({ log: ["query"] })`) to find slow/duplicated queries. `select` over
`include` when you don't need the whole relation — and it pairs with returning a **minimal DTO** to the client
(react-ui-craft security floor).

## Transactions

```ts
// Sequential atomic batch
await prisma.$transaction([prisma.user.create({ data: u }), prisma.profile.create({ data: p })]);

// Interactive — business logic inside the transaction
await prisma.$transaction(async (tx) => {
  const user = await tx.user.create({ data: u });
  if (blocked(user.email)) throw new Error("blocked"); // rolls back
  return tx.profile.create({ data: { ...p, userId: user.id } });
}, { timeout: 10_000, isolationLevel: "Serializable" });
```

Conflict code `P2034` = retry. Use optimistic concurrency (`where: { id, version }, data: { version: { increment: 1 } }`)
for racey updates.

## Review checklist

- [ ] Models have `@id`; relations explicit with `onDelete`; `@@index` on queried fields; `@@map` snake_case.
- [ ] No N+1; `select` trims fields; list endpoints paginate.
- [ ] Migration tested, backward-compatible; `migrate deploy` (not `dev`) in CI/containers.
- [ ] SQLite apps: no native enums / Postgres-only types assumed.
- [ ] Errors handled; the client gets a minimal DTO, not raw rows.

## Anti-patterns

Over-`include` (fetch only what you need) · implicit m-n when an explicit join table is clearer · `migrate dev` in prod ·
`$queryRaw` where a typed Prisma query works · assuming Postgres features on a SQLite app.
