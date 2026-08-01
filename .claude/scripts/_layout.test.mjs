// Test for _layout.mjs — the single place that knows where projects live.
// Run: node .claude/scripts/_layout.test.mjs
//
// WHY THIS EXISTS, and why `tool-check` not counting it is the point. `tool-check` skips `_`-prefixed files as
// "libraries, covered through their callers". That is only true for callers that HAVE tests — and this file is
// imported by five discovery tools, so it is the single highest-fan-out piece of untested code on the platform.
// It also exists BECAUSE of a failure: on 2026-07-30 the nine app repos moved into `projects/` and four tools
// degraded silently and identically (repo discovery 13 → 4, plan-audit 0 of 63 plans, reuse-scan 0 of 22
// groups, plan-checkin printing "nothing due" for the wrong reason). Not one raised an error.
//
// So the cases below are the two failure modes that produced that day:
//   - a project one level deeper than expected is invisible  (the move)
//   - `platform` itself is misread as a container and descended past  (the marker set)
// The second one is subtler and cost a check-in reminder: `platform/` is not a git repo and has no `docs/`,
// so without `plans` in the marker set it looks like a folder that merely holds projects.
//
// Per platform/standards/testing.md §2.5 the suite also MUTATES the module and asserts it notices.

import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join, dirname, resolve, basename, sep } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  looksLikeProject,
  projectRoots,
  gitRepos,
  posix,
  worktreeInfo,
  worktreeCaveat,
} from "./_layout.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
let MUTANTS_RUN = 0;
const MODULE = join(HERE, "_layout.mjs");

const root = mkdtempSync(join(tmpdir(), "layout-"));
const dir = (...p) => {
  const full = join(root, ...p);
  mkdirSync(full, { recursive: true });
  return full;
};
const file = (rel, body = "x") => {
  const full = join(root, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, body);
  return full;
};

/* ── the fixture fleet: every shape the real repo has, plus the ones that broke it ──────────────── */

file("todo/package.json", "{}"); //          a project at depth 1, by package.json
dir("yakudoku/.git"); //                     a project at depth 1, by .git
file("commons/docs/README.md"); //           a project at depth 1, by docs/
file("platform/plans/2026-07-30-x.md"); //   the platform itself, ONLY by `plans`
file("projects/sakubun/package.json", "{}"); // a project inside a container (the 2026-07-30 move)
dir("projects/journal/.git");
file("apps/web/deep/package.json", "{}"); // three levels down — past the default depth
file("node_modules/some-dep/package.json", "{}"); // must never be a project
file("dist/package.json", "{}");
file("build/docs/x.md");
file("coverage/package.json", "{}");
dir(".hidden/.git"); //                      hidden dirs are skipped entirely
dir("empty-folder"); //                      no marker, no children — neither project nor useful container

const names = (opts) => projectRoots(root, opts).map((p) => p.name).sort();

/* ═══════════════════ 1. what counts as a project, marker by marker ═══════════════════ */
{
  assert.equal(looksLikeProject(join(root, "todo")), true, "package.json");
  assert.equal(looksLikeProject(join(root, "yakudoku")), true, ".git");
  assert.equal(looksLikeProject(join(root, "commons")), true, "docs/");
  assert.equal(
    looksLikeProject(join(root, "platform")),
    true,
    "`plans` — without this marker `platform/` reads as a container, gets descended past, and every platform " +
      "plan becomes invisible to plan-checkin. That is a check-in reminder that stops arriving.",
  );
  assert.equal(looksLikeProject(join(root, "empty-folder")), false, "a bare directory is not a project");
  assert.equal(looksLikeProject(join(root, "does-not-exist")), false, "a missing directory must not throw");
}

/* ═══════════════════ 2. THE REGRESSION: a project inside a container is still found ═══════════ */
{
  const found = names();
  for (const expected of ["todo", "yakudoku", "commons", "platform", "sakubun", "journal"])
    assert.ok(
      found.includes(expected),
      `${expected} was not found. This is the 2026-07-30 failure shape: the answer is smaller, ` +
        `true-looking, and raises no error.\nfound: ${found.join(", ")}`,
    );
  assert.ok(
    !found.includes("projects"),
    "`projects/` is a CONTAINER, not a project — it must be descended into, not reported",
  );
}

/* ─────────── 2b. the rule is "looks like a project", never "look in projects/" ──
 * Hardcoding the folder name would just re-arm the same trap for the next reorganisation.
 */
{
  const src = readFileSync(MODULE, "utf8");
  assert.ok(
    !/["'`]projects["'`]/.test(src),
    "the module must not hardcode the current container name — that is what makes the next move survivable",
  );
}

/* ─────────── 3. depth is bounded, and configurable ── */
{
  assert.ok(
    !names().includes("deep"),
    "a project three levels down is past the default depth — reported as absent rather than found by accident",
  );
  assert.ok(
    names({ depth: 3 }).includes("deep"),
    "…and a caller that needs to go deeper can say so",
  );
}

/* ─────────── 4. build output and hidden directories are never projects ── */
{
  const found = names({ depth: 4 });
  for (const never of ["some-dep", ".hidden", "dist", "build", "coverage", "node_modules"])
    assert.ok(
      !found.includes(never),
      `${never} must never be reported as a project — a vendored package.json would keep it alive forever`,
    );
}

/* ─────────── 5. `name` is the BARE project name, not a path ──
 * INVENTORY, plan frontmatter and every report key off the name; prefixing it with `projects/` would break
 * those joins silently, which is the same class of failure as the move itself.
 */
{
  for (const p of projectRoots(root)) {
    assert.equal(p.name, basename(p.dir), `name must be the directory's own name, got ${p.name} for ${p.dir}`);
    assert.ok(!p.name.includes("/"), `name must carry no path separator: ${p.name}`);
    assert.ok(p.dir.startsWith(root), "dir must be an absolute path inside the root");
  }
}

/* ─────────── 6. first-wins on a duplicate basename — asserted as a KNOWN LIMITATION ──
 * Two projects with the same folder name in different containers collapse to one entry. Nothing in the fleet
 * hits this today; the case exists so that if it ever starts mattering, it fails here rather than in a report
 * that silently lists one of them.
 */
{
  const dupRoot = mkdtempSync(join(tmpdir(), "layout-dup-"));
  mkdirSync(join(dupRoot, "a", "todo"), { recursive: true });
  writeFileSync(join(dupRoot, "a", "todo", "package.json"), "{}");
  mkdirSync(join(dupRoot, "b", "todo"), { recursive: true });
  writeFileSync(join(dupRoot, "b", "todo", "package.json"), "{}");
  const found = projectRoots(dupRoot);
  assert.equal(
    found.filter((p) => p.name === "todo").length,
    1,
    "current behaviour: the first match wins and the second is dropped. If this ever changes, update the " +
      "callers that key off the bare name before flipping this assertion.",
  );
  rmSync(dupRoot, { recursive: true, force: true });
}

/* ═══════════════════ 7. gitRepos — the root repo plus every project that has one ═══════════════ */
{
  // No .git at the fixture root yet.
  const withoutRoot = gitRepos(root);
  assert.ok(!withoutRoot.includes(root), "a root that is not a git repo must not be listed");
  assert.deepEqual(
    withoutRoot.map((d) => basename(d)).sort(),
    ["journal", "yakudoku"],
    `only the projects that actually have .git: ${withoutRoot.join(", ")}`,
  );

  mkdirSync(join(root, ".git"), { recursive: true });
  const withRoot = gitRepos(root);
  assert.ok(withRoot.includes(root), "the root repo itself must be included once it is one");
  assert.equal(withRoot.length, 3, "root + two project repos");
  assert.equal(new Set(withRoot).size, withRoot.length, "no duplicates");
}

/* ─────────── 7b. a path that leaves a tool has ONE shape, whichever OS produced it ──
 * The same report was written `platform\plans\x.md` on Windows and `platform/plans/x.md` on Linux, so two
 * identical runs read as a difference and six suites asserting on reported paths failed on one box only.
 */
{
  assert.equal(posix(join("platform", "plans", "x.md")), "platform/plans/x.md", "the host separator must be normalized away");
  assert.equal(posix("already/posix.md"), "already/posix.md", "…and a POSIX path must survive untouched");
  assert.equal(posix(""), "", "an empty path must not become a slash");
}

/* ═══════════════════ 8. the suite must NOTICE a broken layout (mutation) ═══════════════════ */
{
  // LF-normalized: on a CRLF working tree (Windows) every multi-line mutation patch below would go stale.
  const src = readFileSync(MODULE, "utf8").replace(/\r\n/g, "\n");
  const lab = mkdtempSync(join(tmpdir(), "layout-mutants-"));

  const load = async (mutated) => {
    const p = join(lab, `m-${Math.random().toString(36).slice(2)}.mjs`);
    writeFileSync(p, mutated);
    return import(pathToFileURL(p).href);
  };

  // Counted, not typed into the summary: this line still read "7 mutants" after the 8th, 9th and 10th were
  // added — a suite reciting a remembered number about itself. Same fix as `usage-census.test.mjs` today.
  // It also has to be right per-OS: one mutant only exists where the host separator is not `/`.

  const mutants = [
    {
      name: "`plans` dropped from the marker set (platform becomes invisible)",
      apply: (s) => s.replace('[".git", "docs", "package.json", "plans"]', '[".git", "docs", "package.json"]'),
      probe: (m) => !m.projectRoots(root).some((p) => p.name === "platform"),
    },
    {
      name: "the container descent removed (THE 2026-07-30 DEFECT)",
      apply: (s) => s.replace("} else if (level < depth) {", "} else if (false) {"),
      probe: (m) => {
        const found = m.projectRoots(root).map((p) => p.name);
        return !found.includes("sakubun") && !found.includes("journal");
      },
    },
    {
      name: "the default depth reduced to 1 (same effect, different cause)",
      apply: (s) => s.replace("{ depth = 2 } = {}", "{ depth = 1 } = {}"),
      probe: (m) => !m.projectRoots(root).some((p) => p.name === "sakubun"),
    },
    {
      name: "the skip list emptied (node_modules becomes a project)",
      apply: (s) =>
        s.replace(
          /const SKIP = new Set\(\[[^\]]*\]\);/,
          "const SKIP = new Set();",
        ),
      probe: (m) => m.projectRoots(root, { depth: 4 }).some((p) => p.name === "some-dep"),
    },
    {
      name: "hidden directories no longer skipped",
      apply: (s) => s.replace("const isHidden = (name) => name.startsWith(\".\");", "const isHidden = () => false;"),
      probe: (m) => m.projectRoots(root, { depth: 4 }).some((p) => p.name === ".hidden"),
    },
    {
      name: "the root repo dropped from gitRepos",
      apply: (s) =>
        s.replace('if (existsSync(path.join(root, ".git"))) repos.push(root);', ""),
      probe: (m) => !m.gitRepos(root).includes(root),
    },
    {
      name: "the bare name replaced by a path (every name-keyed join breaks)",
      apply: (s) => s.replace("{ name: e.name, dir: full }", "{ name: full, dir: full }"),
      // Either separator: `path.join` yields `\` on Windows, and a probe that only knows `/` reported this
      // mutant as surviving on one machine and killed on the other.
      probe: (m) => m.projectRoots(root).some((p) => /[\\/]/.test(p.name)),
    },
    {
      // The whole guard neutered: every tree reports as the main tree, so four checkers go back to
      // publishing 45 fabricated breaks and a clean verdict over half the plan corpus.
      name: "worktree detection always says main tree",
      apply: (s) => s.replace("const isWorktree = norm(gitDir) !== norm(commonDir);", "const isWorktree = false;"),
      probe: (m) => {
        const fake = (_c, a) => ({
          status: 0,
          stdout: a.includes("--absolute-git-dir") ? "/r/.git/worktrees/p\n" : "/r/.git\n",
        });
        return m.worktreeInfo(root, { spawn: fake }).isWorktree === false;
      },
    },
    {
      // Normalisation dropped: a trailing slash or a case difference — both of which git really does emit on
      // Windows — would invent a worktree in the MAIN tree, and then every checker would refuse to answer.
      name: "path normalisation dropped (the main tree starts reporting as a worktree)",
      apply: (s) => s.replace('const norm = (p) => posix(p).replace(/\\/+$/, "").toLowerCase();', "const norm = (p) => p;"),
      probe: (m) => {
        const fake = (_c, a) => ({
          status: 0,
          stdout: a.includes("--absolute-git-dir") ? "/R/.git/\n" : "/r/.git\n",
        });
        return m.worktreeInfo(root, { spawn: fake }).isWorktree === true;
      },
    },
    {
      // A failed git call read as "not a worktree" instead of UNKNOWN — a clean pass invented out of a
      // measurement that never happened, which is the exact shape of every defect fixed this week.
      name: "a failed git call reported as known",
      apply: (s) => s.replace("return { known: false, isWorktree: false, gitDir, commonDir, missing: [] };", "return { known: true, isWorktree: false, gitDir, commonDir, missing: [] };"),
      probe: (m) => m.worktreeInfo(root, { spawn: () => ({ status: 1, stdout: "" }) }).known === true,
    },
    ...(sep === "\\"
      ? [
          // Only observable where the host separator is not already `/`. On a POSIX box this mutation is an
          // EQUIVALENT mutant — it changes nothing at all — so asserting it there would fail for the wrong
          // reason, which is the trap this suite's own §8 was written to avoid.
          {
            name: "posix() stops rewriting the separator (reports differ per OS)",
            apply: (s) => s.replace('p.split(path.sep).join("/")', "p"),
            probe: (m) => m.posix(join("a", "b")) !== "a/b",
          },
        ]
      : []),
  ];

  for (const mu of mutants) {
    const mutated = mu.apply(src);
    assert.notEqual(mutated, src, `mutation "${mu.name}" changed nothing — the patch is stale`);
    const mod = await load(mutated);
    assert.ok(
      mu.probe(mod),
      `SURVIVING MUTANT — "${mu.name}" and the suite still passed. Add a case for it.`,
    );
    MUTANTS_RUN += 1;
  }
  rmSync(lab, { recursive: true, force: true });
}

/* ─────────── the real repo, sanity-checked against the fleet it is supposed to describe ──
 * Not a fixture: if this module ever stops seeing the actual projects, every discovery tool goes quiet at
 * once, which is precisely the failure it was written to prevent. A floor, not an exact count.
 */
{
  const REAL = resolve(HERE, "..", "..");
  const real = projectRoots(REAL).map((p) => p.name);
  assert.ok(
    real.includes("platform"),
    `_layout cannot see platform/ in the REAL repo — every platform plan is invisible right now.\nfound: ${real.join(", ")}`,
  );
  assert.ok(
    real.length >= 8,
    `_layout sees only ${real.length} projects in the real repo (${real.join(", ")}). The fleet has ~12; a ` +
      "sudden drop is the shape of the 2026-07-30 regression. Compare against a baseline before dismissing this.",
  );
  assert.ok(gitRepos(REAL).length >= 8, `only ${gitRepos(REAL).length} git repos found in the real repo`);
}

/* ─────────── 9. worktreeInfo / worktreeCaveat — the guard on four false checkers ──────────
 *
 * MEASURED first, in a real worktree, 2026-08-01 — these are the numbers the guard exists for:
 *   link-check 1 -> 45 broken · plan-audit 68 -> 36 scanned · reuse-scan 715 files -> 0 · recurrence-check
 *   0 -> 1 firing. Two panic, two reassure.
 *
 * `spawn` is injected rather than a real worktree being created, so the cases are deterministic and cost
 * nothing — but the DETECTION itself was validated against a real `git worktree add` before being written,
 * because a fake spawn can only confirm the shape I already believed.
 */
{
  const fake = (map) => (_cmd, args) => {
    const key = args.includes("--absolute-git-dir") ? "gitDir" : "commonDir";
    const v = map[key];
    return v === null ? { status: 1, stdout: "" } : { status: 0, stdout: `${v}\n` };
  };

  // Same path both ways ⇒ the main tree. No caveat, and every checker keeps its number.
  const main = worktreeInfo(root, { spawn: fake({ gitDir: "/r/.git", commonDir: "/r/.git" }) });
  assert.equal(main.isWorktree, false, "identical git-dir and common-dir is the MAIN tree");
  assert.equal(main.known, true);
  assert.equal(
    worktreeCaveat(root, { spawn: fake({ gitDir: "/r/.git", commonDir: "/r/.git" }) }),
    null,
    "the main tree must get NO caveat — a warning that always prints is a warning nobody reads",
  );

  // Different ⇒ a worktree.
  const wt = worktreeInfo(root, {
    spawn: fake({ gitDir: "/r/.git/worktrees/probe", commonDir: "/r/.git" }),
  });
  assert.equal(wt.isWorktree, true, "git-dir under .git/worktrees/ is a WORKTREE");

  // Trailing slash and case must not invent a worktree. On Windows git can answer either case.
  const noisy = worktreeInfo(root, { spawn: fake({ gitDir: "/R/.git/", commonDir: "/r/.git" }) });
  assert.equal(noisy.isWorktree, false, "a trailing slash or a case difference is not a worktree");

  // git missing or not a repo ⇒ UNKNOWN, never a clean pass invented from a failed measurement.
  const dead = worktreeInfo(root, { spawn: fake({ gitDir: null, commonDir: null }) });
  assert.equal(dead.known, false, "a failed git call must report UNKNOWN");
  assert.equal(dead.isWorktree, false, "…and must not claim to be a worktree either");

  // The caveat must NAME what is absent, not merely say "something is". A message that does not say which
  // directory is missing sends the reader to guess, which is how a caveat gets ignored.
  const caveat = worktreeCaveat(root, {
    spawn: fake({ gitDir: "/r/.git/worktrees/probe", commonDir: "/r/.git" }),
  });
  assert.match(caveat ?? "", /git worktree/i, `the caveat must name the cause:\n${caveat}`);
  assert.match(caveat ?? "", /main tree/i, "…and tell the reader where to re-run");
  assert.doesNotMatch(caveat ?? "", /UNRELIABLE HERE/, "the prefix belongs to the caller, not the text");

  // The REAL repo, from this file's own location, must not look like a worktree — if it did, every number
  // this suite and tool-check report would already be suspect.
  assert.equal(
    worktreeInfo(resolve(HERE, "..", "..")).isWorktree,
    false,
    "the real fleet checkout reports as a worktree — every count from every checker is unreliable right now",
  );
}

rmSync(root, { recursive: true, force: true });
console.log(
  "_layout.test.mjs — all four project markers incl. the `plans` one, container descent, bounded+configurable " +
    "depth, build/hidden dirs excluded, bare-name invariant, first-wins limitation, gitRepos with and without " +
    `a root repo, worktree detection (4 checkers give false counts inside one), ${MUTANTS_RUN} mutants all ` +
    "killed, plus a floor check against the real fleet  ✅",
);
