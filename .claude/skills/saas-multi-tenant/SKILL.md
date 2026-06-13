---
name: saas-multi-tenant
description: Design tenant isolation when an app serves multiple customers/orgs sharing one database — tenant_id on every scoped table, automatic tenant-scoped queries via a Prisma client extension, a DB-level safety net, and safe cross-tenant admin. Use when building (or retrofitting) multi-tenancy. NOTE multi-tenancy is itself a reason to choose Postgres (RLS); SQLite can't do RLS — isolation is app-layer only there.
---

# SaaS Multi-Tenant (platform-adapted)

> **Adapted from** `development/saas-multi-tenant` (`davila7/claude-code-templates`). Kept the isolation discipline +
> "never do this" rules. **Adapted for the platform:** identity/tenant comes from **Authentik** (not a self-built JWT —
> invariant: don't self-code auth/JWT); the per-request example is a **Next.js server action** (matching the platform
> stack, no separate HTTP framework); and a key
> caveat — **SQLite (todo/yakudoku) has no Row-Level Security**, so multi-tenancy is a real reason to pick **Postgres**
> (see `/database-design`). On SQLite, isolation is **application-layer only** — do it very carefully or use Postgres.

> Most relevant **when an app actually serves >1 tenant**. A single-user/household tool doesn't need this.

## Decide the model

Shared-schema with a `tenant_id` column on every tenant-scoped table is the right default under ~1000 tenants.
Schema-per-tenant (migrations run N times) and database-per-tenant (only for data-residency rules) add real ops cost.

## The discipline

1. **`tenant_id` on every scoped table** — `NOT NULL`, and the **first column of every composite index** (Postgres
   leftmost-prefix: `(tenant_id, created_at)` serves both "tenant's rows" and "sorted by date").
2. **Resolve tenant from Authentik, per request.** The tenant is derived from the authenticated Authentik identity
   (`X-authentik-*` headers / group), read via `headers()` in a server action — NOT from a hand-rolled JWT.
3. **Scope every ORM query automatically** — a **Prisma Client Extension** (Prisma 5/6; `prisma.$use` middleware is
   deprecated) that injects `where: { tenantId }` on reads and `data.tenantId` on writes, skipping a known set of global
   tables:
   ```ts
   const GLOBAL = new Set(["Plan", "FeatureFlag"]);
   const forTenant = (tenantId: string) =>
     prisma.$extends({
       query: {
         $allModels: {
           async $allOperations({ model, operation, args, query }) {
             if (GLOBAL.has(model)) return query(args);
             if (["findMany", "findFirst", "count", "aggregate", "updateMany", "deleteMany"].includes(operation))
               (args as any).where = { ...(args as any).where, tenantId };
             if (operation === "create") (args as any).data = { ...(args as any).data, tenantId };
             return query(args);
           },
         },
       },
     });
   ```
   Never rely on developers remembering a manual `WHERE tenant_id`.
4. **DB-level safety net (Postgres only).** Enable RLS so a forgotten filter can't leak data:
   ```sql
   ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
   CREATE POLICY tenant_isolation ON projects
     USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
   ```
   Set `app.current_tenant_id` per transaction (`SELECT set_config('app.current_tenant_id', $1, true)`). **SQLite has no
   equivalent** — there the app-layer extension is your *only* line, so test it hard.
5. **Cross-tenant admin separately** — admin/aggregation routes bypass tenant scope and MUST use a separate auth path
   (a distinct Authentik group/provider), never a tenant user's session.
6. **Migrations** — every new scoped table includes `tenant_id`; a CI/lint check rejects a scoped table without it
   (unless explicitly global). On Postgres, run migrations with a `bypassrls`/superuser role.

## Never do this

1. Query a scoped table without a tenant filter (raw SQL bypasses the extension — add `WHERE tenant_id` or rely on RLS).
2. Enforce isolation only in app code on Postgres — run RLS too (defense in depth). On SQLite there's no net, so the
   app-layer filter must be airtight + well-tested.
3. Sequential integer IDs for tenant-scoped rows (enumeration leak) — use `cuid()`/UUID.
4. Let a tenant user reach an admin cross-tenant endpoint.
5. Background jobs/cron without tenant context — the **job payload carries `tenant_id`** and the worker sets the scope
   before processing (no HTTP request to derive it from).

## Best practices

- A `tenants` table is the single source of truth (`name`, `slug` for subdomain routing, `plan_id`, `deleted_at`).
- Tenant deletion = soft-delete + revoke sessions + batched background cleanup (cascade deletes time out at scale).
- GDPR export = a maintained registry of all tenant-scoped tables so nothing is missed.
- Seed **≥3 tenants** in dev — 1 hides every leak, 2 hides asymmetric leaks.
- Per-tenant rate limits/quotas, not global (one noisy tenant shouldn't starve the rest).
