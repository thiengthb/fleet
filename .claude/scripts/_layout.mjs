// @vi WHAT: Nơi DUY NHẤT biết các project nằm ở đâu trong repo này. Các hook và script khác hỏi nó thay vì tự đoán.
// @vi WHY: Trước 2026-07-30 mỗi công cụ tự đoán chỗ. Rồi chín repo app dồn vào folder projects/ và bốn công cụ hỏng IM LẶNG
//   theo cùng một kiểu — chúng vẫn chạy, vẫn báo xanh, chỉ là không còn thấy project nào. File này sinh ra từ đúng vụ
//   đó, và nó cũng là lý do một lần dồn folder nữa phải sửa chỗ tìm kiếm TRƯỚC khi di chuyển file.
//
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
import { spawnSync } from "node:child_process";
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

/**
 * Is this checkout a git WORKTREE rather than the main tree — and therefore missing the sibling repos?
 *
 * WHY THIS EXISTS, measured 2026-08-01 in a real worktree rather than reasoned about. `fleet`'s `.gitignore`
 * is an allowlist: it tracks `platform/`, `.claude/` and `CLAUDE.md`, because every app here is a
 * deliberately INDEPENDENT git repo. A worktree therefore contains the meta layer and **nothing else** — no
 * `projects/`, no `commons`, no `rulebook`. Four checkers answer about the tree they are in, so inside a
 * worktree they answer confidently about a repo that is missing two thirds of its content:
 *
 * | checker | main tree | worktree | direction of the error |
 * | --- | --- | --- | --- |
 * | `link-check` | 1 broken | **45 broken** | condemning — 44 fabricated breaks (INVENTORY dev paths) |
 * | `plan-audit` | 68 scanned | **36 scanned** | protecting — 32 plans silently invisible |
 * | `reuse-scan` | 715 files / 9 projects | **0 / 0** | protecting — "no duplication" over nothing |
 * | `recurrence-check` | 0 firing | **1 firing** (`stale-tool-citation`, 3 HIT) | condemning — a fake recurrence |
 *
 * Two err each way, which is the same both-directions shape as every other broken instrument on this
 * platform: there is no safe direction for a wrong measurement. `skill-audit` and `usage-census` are
 * unaffected — they read `.claude/` and `~/.claude/`, both of which a worktree has.
 *
 * The consequence that makes this worth a guard rather than a note: the branch-based governance workflow the
 * autonomy contract prescribes runs in worktrees, so **the checks meant to gate a merge cannot be trusted
 * before that merge** — which is precisely when they are read.
 *
 * DETECTED, never guessed: `--git-dir` and `--git-common-dir` are the same path in the main tree and differ
 * in a worktree (`.git` vs `.git/worktrees/<name>`). `git` is spawned rather than the `.git` file sniffed,
 * because a `.git` FILE also appears in submodules and in a plain `git-dir` redirect, which are not this.
 */
export function worktreeInfo(root, { spawn } = {}) {
  const run = (args) => {
    try {
      const runner = spawn ?? spawnSync;
      const r = runner("git", args, { cwd: root, encoding: "utf8" });
      return r.status === 0 ? String(r.stdout || "").trim() : null;
    } catch {
      return null;
    }
  };
  const gitDir = run(["rev-parse", "--absolute-git-dir"]);
  const commonDir = run(["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  // Not a git repo at all, or git is unavailable ⇒ say UNKNOWN. Never "not a worktree", which would be a
  // clean pass invented out of a failed measurement.
  if (!gitDir || !commonDir) return { known: false, isWorktree: false, gitDir, commonDir, missing: [] };
  const norm = (p) => posix(p).replace(/\/+$/, "").toLowerCase();
  const isWorktree = norm(gitDir) !== norm(commonDir);
  /**
   * Which top-level entries the MAIN tree has that this one does not — READ from the main tree, never a list
   * of names. The first cut wrote a literal three-element array of the current sibling names, and this
   * module's own suite failed it on the spot: *"the module must not hardcode the current container name — that
   * is what makes the next move survivable"*. That assertion exists because hardcoding the container is what
   * broke five tools on 2026-07-30, and it caught the same mistake being re-committed here — inside the file
   * whose header warns about it.
   *
   * It then failed a SECOND time, on this very comment: the assertion compares SOURCE TEXT, so naming the
   * offending array in prose tripped it just as writing the array would have. That is the fourth time in one
   * day that text *about* a thing was mistaken for the thing (`usage-census` counting a document that
   * discusses a file as depending on it; `canBlock` reading a comment about `exit 2` as an exit-2 path;
   * `claude-md-budget` accepting a rationale as a list entry). The two checks that survive it either strip
   * comments first or scope to a region; this one does neither, so the prose must avoid the pattern instead.
   */
  const missing = [];
  if (isWorktree) {
    const mainRoot = path.dirname(commonDir);
    let entries = [];
    try {
      entries = readdirSync(mainRoot, { withFileTypes: true });
    } catch {
      entries = [];
    }
    for (const e of entries) {
      if (!e.isDirectory() || isHidden(e.name) || SKIP.has(e.name)) continue;
      if (!existsSync(path.join(root, e.name))) missing.push(e.name);
    }
  }
  return { known: true, isWorktree, gitDir, commonDir, missing };
}

/**
 * One line for a checker to print when its answer cannot be trusted here, or null when it can.
 * Kept in this module so all four affected tools say the same thing — a warning worded four ways reads as
 * four different problems.
 */
export function printWorktreeCaveat(root, opts) {
  const line = worktreeCaveat(root, opts);
  if (line) console.log(`  ⚠ UNRELIABLE HERE — ${line}\n`);
  return Boolean(line);
}

/**
 * The caveat WITHOUT a prefix, so each caller can lead with the word that fits its own output —
 * `⚠ UNRELIABLE HERE —` for a checker, `VERDICT: UNMEASURED —` for the sweep. The first cut baked
 * "UNRELIABLE HERE" into the text and the sweep printed "UNMEASURED — UNRELIABLE HERE — …". One text, many
 * prefixes; a warning worded four ways reads as four different problems.
 */
export function worktreeCaveat(root, opts) {
  const wt = worktreeInfo(root, opts);
  if (!wt.isWorktree) return null;
  const missing = wt.missing.length ? wt.missing.join(", ") : "the sibling repos";
  return (
    `this is a git worktree, and ${missing} ${wt.missing.length === 1 ? "is" : "are"} absent from it (they ` +
    `are independent repos, not tracked by fleet). The counts here describe the meta layer only. Re-run ` +
    `from the main tree before believing them.`
  );
}
