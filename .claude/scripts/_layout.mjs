/**
 * _layout.mjs — the ONE place that knows where projects live in this repo. Imported by hooks and scripts.
 *
 * WHY THIS EXISTS. Until 2026-07-30 every tool that needed "the list of projects" re-implemented
 * `readdirSync(REPO)` and assumed each project was an immediate child of the repo root. Then the nine app
 * repos moved into `projects/` and four tools degraded **silently and identically**: repo discovery went
 * 13 → 4, plan-audit found 0 of 63 plans, reuse-scan found 0 of 22 duplicate groups, plan-checkin kept
 * printing "nothing due" for the wrong reason. Not one of them raised an error — which is the dangerous
 * shape: a tool that returns a smaller true-looking answer is worse than one that crashes.
 *
 * THE RULE, deliberately not "look in projects/". Hardcoding the new folder name would just re-arm the same
 * trap for the next reorganisation. Instead: a directory is a PROJECT if it looks like one (it has `.git` or
 * a `docs/` folder); a directory that looks like none of that is treated as a CONTAINER and descended into,
 * one level. So `projects/todo` is found today, and `apps/web/todo` would be found tomorrow without an edit.
 */

import { readdirSync, existsSync } from "node:fs";
import path from "node:path";

const SKIP = new Set(["node_modules", "dist", "build", ".next", "coverage"]);
const isHidden = (name) => name.startsWith(".");

/**
 * Does this directory look like a project root (rather than a folder that merely holds some)?
 *
 * `plans` is in the marker set on purpose: `platform/` is not a git repo and has no `docs/`, but it owns
 * `platform/plans/` — the platform's own roadmap. Without that marker the first version of this file
 * classified `platform` as a container, descended past it, and made every platform plan invisible to
 * `plan-checkin`. A marker set that omits the platform is how a check-in reminder stops arriving.
 */
export function looksLikeProject(dir) {
  return [".git", "docs", "package.json", "plans"].some((m) =>
    existsSync(path.join(dir, m)),
  );
}

/**
 * Every project root under `root`, as {name, dir}. `name` stays the bare project name (`todo`), NOT the
 * path — INVENTORY, plan frontmatter and every report key off the name, and prefixing it with `projects/`
 * would silently break those joins.
 *
 * @param {string} root repo root
 * @param {{depth?: number}} [opts] how many container levels to descend (default 2 — root + one container)
 */
export function projectRoots(root, { depth = 2 } = {}) {
  const found = new Map();
  const visit = (dir, level) => {
    let entries = [];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (!e.isDirectory() || isHidden(e.name) || SKIP.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (looksLikeProject(full)) {
        if (!found.has(e.name)) found.set(e.name, { name: e.name, dir: full });
      } else if (level < depth) {
        visit(full, level + 1); // a container (e.g. `projects/`) — descend, don't give up
      }
    }
  };
  visit(root, 1);
  return [...found.values()];
}

/**
 * A repo-relative path as every artefact in this repo spells it: forward slashes, on every OS.
 *
 * `path.relative()` yields backslashes on Windows, so the same tool printed `platform\plans\x.md` on one
 * machine and `platform/plans/x.md` on another. Reports are compared across machines and quoted into plans
 * and catalogs, so a path that changes shape per OS makes two identical runs look like a difference — and it
 * broke six suites that assert on reported paths. Emit through this whenever a path leaves a tool.
 */
export const posix = (p) => p.split(path.sep).join("/");

/** Every git repo to report on: the root repo itself (if it is one) + every project root that has `.git`. */
export function gitRepos(root) {
  const repos = [];
  if (existsSync(path.join(root, ".git"))) repos.push(root);
  for (const p of projectRoots(root))
    if (existsSync(path.join(p.dir, ".git"))) repos.push(p.dir);
  return repos;
}
