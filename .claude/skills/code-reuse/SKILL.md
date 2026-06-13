---
name: code-reuse
description: Before building a feature in any MiniServer project, check whether it already exists in another project (todo/yakudoku/journal/…) and decide reuse-vs-rebuild — so a piece built ≥3× becomes a shared asset instead of being reinvented. Use when scaffolding/coding a feature, when you notice the same thing built twice, or when explicitly auditing duplication. Owns the shared-assets catalog (nuc-platform/08-SHARED-ASSETS.md). NOT for in-repo refactors (that's normal coding) and NOT for visual UI components (ui-kit owns those).
---

# Code reuse across projects (DRY across independent repos)

The platform is **independent repos** (1 repo → 1 image → Watchtower) — there is no monorepo, so reuse is never free.
This skill exists so the agent stops **reinventing** the same subsystem in each project (saving your tokens + dev time,
letting each project focus on its *special* feature), without falling into the opposite trap — coupling independent
services through a premature shared library.

> Proven case it guards against: the **MCP self-issued OAuth shim** was built twice — `todo/lib/mcp/{auth,oauth}.ts` +
> `app/api/oauth/*` is near-identical to `yakudoku/web/...` (auth.ts 38≈39, oauth.ts 86≈89, token 63≈67, authorize 124≈129).
> Only `server.ts` (the *tool definitions*) legitimately differs per app. That glue is exactly what should have been shared.

## When this fires

1. **Before scaffolding/coding a feature** — first ask "has a sibling project already built this?" (auth glue, Prisma
   singleton, Discord bot bootstrap, deploy.yml, Dockerfile, forward-auth header reader, a public-router split…).
2. **When you notice the same thing built a 2nd time** — record it in the catalog as a duplication (don't extract yet).
3. **On an explicit "audit duplication" request** — sweep the projects, reconcile against the catalog.

It does **not** fire for an in-repo refactor (ordinary coding) or for visual shadcn components (those belong to `ui-kit`).

## Step 1 — Look before you build (this is the whole point)

1. **Read the catalog first:** `nuc-platform/08-SHARED-ASSETS.md`. It is the cheap index of "what reusable thing
   already exists and where its canonical copy lives." If the thing is listed → reuse per its share mechanism; skip the grep.
2. If not listed, **grep the sibling projects** for prior art before writing anything new:
   ```bash
   grep -rl "<feature keyword>" todo yakudoku journal jobhunter-bot nuc-monitor nuc-ops-bot \
     --include=*.ts --include=*.tsx --include=*.py -I 2>/dev/null | grep -v node_modules
   ```
   (Only `todo` + `yakudoku` are usually checked out locally; for the rest, reason from the catalog + INVENTORY, or ask
   the user to check out the repo.)

## Step 2 — The stability ladder (rule of three — do NOT extract too early)

Premature sharing couples independent deploys and creates a version bottleneck — the opposite of "develop fast." Gate:

| Times built | Action |
|---|---|
| **1×** | Build it locally. Do nothing shared. |
| **2×** | Add a row to the catalog marking it **DUPLICATED — extract candidate**. Still copy-by-hand; do NOT extract yet. |
| **3×, same shape, stable** | **Extract** to a shared asset (Step 3). All three conditions required: built three times, the same shape each time, and the shape has stopped churning. |

Never extract something still in flux, or where the three copies have genuinely diverged (then they aren't the same asset).

## Step 3 — Pick the share mechanism (hybrid model)

| Kind of asset | Mechanism | Where |
|---|---|---|
| Visual UI / shadcn component | **copy-in registry** (already chosen) | `ui-kit` (`thiengthb/ui-kit`) |
| Cross-cutting backend code, stable + heavy + security-sensitive (e.g. the MCP OAuth glue) | **published package** `@thiengthb/*` | GitHub Packages (npm) — consumed at CI build time, baked into the image |
| Backend snippet / starter, lighter or still-evolving | **copy-in** (ui-kit-style registry or a documented template) | the canonical project + a catalog pointer |
| Config / scaffold (deploy.yml, Dockerfile, hooks, Prettier) | **template** | `coding-convention/templates`, or "copy from a living app" |

Default to **copy-in + catalog**; reserve a **published package** for the one proven-stable heavy piece. The detailed
how-to for each path (publish steps, copy-in steps, the CI-auth note) lives in `references/extraction-playbook.md`.

**Boundary rule:** extract only the *glue*, keep the *feature* local. (MCP: share `auth.ts`/`oauth.ts`/the `oauth/*`
routes; each app keeps its own `server.ts` tool definitions.)

## Step 4 — Keep the catalog in sync (anti-drift, like INVENTORY)

Any time you reuse, extract, or notice a new duplication → **update `08-SHARED-ASSETS.md` in the same change**. A stale
catalog is worse than none (the next session trusts it). This is the standing obligation of this skill.

## Guardrails

- **Respect every invariant** — independent repos, CI builds (not the NUC), secrets only in `.env`, no self-coded auth.
  A shared package is consumed at build time; it never changes the deploy chain.
- **Don't couple deploys.** A shared lib version bump should be opt-in per repo (pin a version), not a forced lockstep.
- **Security-sensitive shared code** (auth/OAuth) gets *more* review when extracted, not less — one bug now hits N apps.
- **When unsure between copy-in and a package, prefer copy-in** — it's reversible; a published package is a commitment.

## Done when

- [ ] Checked the catalog + grepped prior art **before** building.
- [ ] Applied the rule of three (didn't extract at 1×/2×; only extracted at 3× stable same-shape).
- [ ] Chose the mechanism from the hybrid table; extracted glue, kept feature local.
- [ ] Updated `08-SHARED-ASSETS.md` in the same change.
