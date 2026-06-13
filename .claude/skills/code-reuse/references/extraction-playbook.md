# Extraction playbook — how to actually share a piece of code

Open this only when Step 3 of the skill says "extract." Pick the row's mechanism, follow that section.

---

## A. Copy-in registry (default — frontend AND lighter backend snippets)

The model `ui-kit` already uses: the canonical copy lives in one place, each consuming repo copies it in (owns its copy).

1. **Choose the canonical home.** Frontend component → `ui-kit` (`thiengthb/ui-kit`, the shadcn registry). Backend
   snippet → either add it to `ui-kit` under a non-UI namespace, or keep the canonical copy in the most-mature project and
   point the catalog at it.
2. **Make it copy-ready:** no project-specific imports, no hardcoded names/paths, configurable via params/env, documented
   header comment ("canonical source: <repo>/<path>; copied into <repo> on <date>").
3. **Consume it** by copying the file(s) into the target repo (for `ui-kit`, via the shadcn registry mechanism it already
   exposes). The copy is now owned by the target repo.
4. **Drift is the known cost:** a bugfix in the canonical copy does NOT propagate. When you fix the canonical, the catalog
   row's "Reused in" column tells you which repos to re-copy. Note the fix in the canonical file's header.

Pros: zero runtime coupling, no version hell, reversible. Cons: manual propagation. **Prefer this when in doubt.**

---

## B. Published package `@thiengthb/*` (reserve for proven-stable heavy/security pieces)

Use only when the rule of three is satisfied AND the piece is heavy + stable + security-sensitive (the MCP OAuth glue is
the archetype). A package trades copy-in's drift for version discipline.

1. **New repo** `thiengthb/<pkg>` (`kind: meta`, not deployed). Scoped name `@thiengthb/<pkg>` in `package.json`,
   `"publishConfig": { "registry": "https://npm.pkg.github.com" }`, ESM, Node ≥ 22, TS types emitted.
2. **Publish via GitHub Actions** on tag push. Same-org consumers authenticate with the workflow's built-in `GITHUB_TOKEN`
   (read:packages) — **no new secret to manage** in most cases; a private cross-machine pull may need a PAT in `.npmrc`.
3. **Consume:** add `@thiengthb/<pkg>` to the app's `package.json` pinned to an exact version; add a one-line `.npmrc`
   pointing the `@thiengthb` scope at GitHub Packages. `npm ci` runs inside the Docker build → the package is **baked into
   the image at CI build time**. The NUC still only pulls the finished image — the deploy chain is unchanged.
4. **Version discipline:** semver; a breaking change = major; each app upgrades **opt-in** by bumping its pinned version
   (never a forced lockstep across apps).

Pros: real DRY, fix propagates on version bump. Cons: version+release overhead, a publish pipeline to maintain. **Don't
reach here for something that copy-in handles fine.**

### The MCP OAuth shim, concretely
Extract the **glue only**: `lib/mcp/auth.ts`, `lib/mcp/oauth.ts`, and the `app/api/oauth/*` route handlers (near-identical
across todo/yakudoku). Each app **keeps its own `lib/mcp/server.ts`** — that file holds the app-specific tool definitions
and legitimately differs (todo 281 lines vs yakudoku 515). The package exposes the OAuth/issuer/validation glue + a helper
to mount the routes; the app supplies its tools. Because it's auth code, the extraction PR gets extra review (one bug now
hits every app that depends on it).

---

## C. Template (config / scaffold)

For files that are structurally identical but per-repo (CI workflow, Dockerfile, hooks, Prettier config): keep a template
under `coding-convention/templates/` (or the platform's "copy `deploy.yml` from a living ghcr app" rule). Not code-sharing —
just a canonical starting point. The catalog records where the template lives so nobody re-derives it.

---

## After any extraction

- Update `08-SHARED-ASSETS.md`: flip the row's status (DUPLICATED → SHARED), set the canonical location + mechanism, list
  the consuming repos.
- If the lesson is cross-project-worthy, `/session-wrap` distills it into `06-SO-TRI-THUC.md`.
- Run the `/skill-authoring` grep-guard if the shared code touched anything invariant-adjacent.
