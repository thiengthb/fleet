---
name: code-reuse
description: Before building a feature in any MiniServer project, check whether it already exists — in a sibling project, in an already-installed tool, or in the open-source world outside — and decide adopt-vs-rebuild. A piece built ≥3× becomes a shared asset, not reinvented. Owns the catalog platform/registries/shared-assets.md and the external verdict log commons/docs/external-patterns.md. Use when scaffolding a feature, noticing the same thing built twice, or auditing duplication. NOT for in-repo refactors or visual UI components (commons owns those).
---

# Code reuse across projects (DRY across independent repos)

The platform is **independent repos** (1 repo → 1 image → Watchtower) — there is no monorepo, so reuse is never free.
This skill exists so the agent stops **reinventing** the same subsystem in each project (saving your tokens + dev time,
letting each project focus on its *special* feature), without falling into the opposite trap — coupling independent
services through a premature shared library.

> Proven case it guards against: the **MCP self-issued OAuth shim** was built twice — `projects/todo/lib/mcp/{auth,oauth}.ts` +
> `app/api/oauth/*` is near-identical to `projects/yakudoku/web/...` (auth.ts 38≈39, oauth.ts 86≈89, token 63≈67, authorize 124≈129).
> Only `server.ts` (the *tool definitions*) legitimately differs per app. That glue is exactly what should have been shared.

## When this fires

1. **Before scaffolding/coding a feature** — ask, in this order: has a sibling project already built this (auth glue,
   Prisma singleton, Discord bot bootstrap, deploy.yml, Dockerfile, forward-auth header reader, a public-router split…),
   does a tool already installed resolve it, and **has the open-source world already solved it better than the spec asks
   for**. Writing original code is the LAST of those, not the first.
2. **When you notice the same thing built a 2nd time** — record it in the catalog as a duplication (don't extract yet).
3. **On an explicit "audit duplication" request** — sweep the projects, reconcile against the catalog.

It does **not** fire for an in-repo refactor (ordinary coding) or for visual shadcn components (those belong to `commons`).

## Step 1 — Look before you build (this is the whole point)

1. **Read the catalog first:** `platform/registries/shared-assets.md`. It is the cheap index of "what reusable thing
   already exists and where its canonical copy lives." If the thing is listed → reuse per its share mechanism; skip the grep.
2. If not listed, **grep the sibling projects** for prior art before writing anything new:
   ```bash
   grep -rl "<feature keyword>" todo yakudoku journal jobhunter-bot nuc-monitor nuc-ops-bot \
     --include=*.ts --include=*.tsx --include=*.py -I 2>/dev/null | grep -v node_modules
   ```
   (Only `todo` + `yakudoku` are usually checked out locally; for the rest, reason from the catalog + INVENTORY, or ask
   the user to check out the repo.)
3. **Then look OUTSIDE.** Sources 1 and 2 only ever answer "have *we* built this" — the request is broader than that:
   *"điều bạn nghĩ đầu tiên không phải là code làm sao để hoàn thành giúp tôi"* — the first thought is whether it already
   exists out there, whether it is good enough, and what to bring back. **An outside source may exceed what the user was
   able to ask for, and surfacing that is doing the job, not scope creep.** Two sub-steps, strictly in this order:

   **1c-i — Probe the tools already installed, BEFORE searching prose.** Cheapest source, and the most likely to be
   directly usable. Measured 2026-07-30: eight `shadcn search` calls found ~3,400 external items reachable with **zero
   configuration** — the whole vendoring pipeline that had been planned was unnecessary. Ask literally: does a registry /
   package / CLI already on this machine resolve this?
   ```bash
   npx shadcn@latest search @<namespace> -l 5     # UI, blocks, configs — 8 namespaces resolve with no config
   npx shadcn@latest view @<ns>/<item>            # read `dependencies` BEFORE adopting anything
   npm search <keyword> | head                    # is this a solved, maintained package?
   ```

   **1c-ii — Web, but only when the probe is inconclusive AND the work is P2 or above.** P1 (a CRUD shape built before,
   copy, a small fix) gets **no external search** — an unconditional search-first rule is a token furnace that slows
   exactly the work that must stay fast. Budget = the research tiers already in
   `platform/standards/token-and-research.md` (Quick is the default: 1–2 searches, ≤2 fetches, no fan-out). Search wide,
   fetch narrow.

   **Then record a verdict — including the refusals.** One row in `commons/docs/external-patterns.md`. A refusal *with
   its reason* is the valuable half: on 2026-07-30 exactly 1 of 8 candidate registries fit, and naming why the other 7
   did not is what stopped them being re-evaluated. The four pre-adopt gates live in that file's §2 (read
   `dependencies` first — reject a second primitive library beside Radix; the licence must be named; never `--overwrite`
   a living app; record the row).

> **The FOMO brake — this is why the step is PULL, not PUSH.** Never pre-build or pre-vendor for software that might be
> written later. Evidence: `commons` holds 27 proven items and **0 installs into any app** so far, which is what the
> 2026-08-26 check-in exists to measure. **A verdict row is cheap; an item is expensive.** So the outside check produces
> knowledge on every run and code only when a real project needs it. Anything else is, in the user's own words,
> *"chuẩn bị một thứ mà mình chưa rõ có làm hay không — FOMO tốn tài nguyên."*

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
| Visual UI / shadcn component | **copy-in registry** (already chosen) | `commons` (`thiengthb/commons`) |
| Cross-cutting backend code, stable + heavy + security-sensitive (e.g. the MCP OAuth glue) | **published package** `@thiengthb/*` | GitHub Packages (npm) — consumed at CI build time, baked into the image |
| Backend snippet / starter, lighter or still-evolving | **copy-in** (commons-style registry or a documented template) | the canonical project + a catalog pointer |
| Config / scaffold (deploy.yml, Dockerfile, hooks, Prettier) | **template** | `coding-convention/templates`, or "copy from a living app" |

Default to **copy-in + catalog**; reserve a **published package** for the one proven-stable heavy piece. The detailed
how-to for each path (publish steps, copy-in steps, the CI-auth note) lives in `references/extraction-playbook.md`.

**Boundary rule:** extract only the *glue*, keep the *feature* local. (MCP: share `auth.ts`/`oauth.ts`/the `oauth/*`
routes; each app keeps its own `server.ts` tool definitions.)

## Step 4 — Keep the catalog in sync (anti-drift, like INVENTORY)

Any time you reuse, extract, or notice a new duplication → **update `registries/shared-assets.md` in the same change**. A stale
catalog is worse than none (the next session trusts it). This is the standing obligation of this skill.

## Guardrails

- **Respect every invariant** — independent repos, CI builds (not the NUC), secrets only in `.env`, no self-coded auth.
  A shared package is consumed at build time; it never changes the deploy chain.
- **Don't couple deploys.** A shared lib version bump should be opt-in per repo (pin a version), not a forced lockstep.
- **Security-sensitive shared code** (auth/OAuth) gets *more* review when extracted, not less — one bug now hits N apps.
- **When unsure between copy-in and a package, prefer copy-in** — it's reversible; a published package is a commitment.

## Done when

- [ ] Checked the catalog + grepped prior art **before** building.
- [ ] Looked OUTSIDE too (Step 1c): probed the installed tools first, then web only if inconclusive and the work is P2+.
      P1 legitimately skips this — say so rather than searching by reflex.
- [ ] Wrote the verdict — adopted or refused, with the reason — into `commons/docs/external-patterns.md`.
- [ ] Nothing was pre-built or pre-vendored "for later". Code entered only because a real project needed it now.
- [ ] Applied the rule of three (didn't extract at 1×/2×; only extracted at 3× stable same-shape).
- [ ] Chose the mechanism from the hybrid table; extracted glue, kept feature local.
- [ ] Updated `registries/shared-assets.md` in the same change.
