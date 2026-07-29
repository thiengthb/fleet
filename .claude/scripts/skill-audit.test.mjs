// Test for skill-audit.mjs — the tool that answers "does this skill still have anything to act on?"
// Run: node .claude/scripts/skill-audit.test.mjs
//
// WHY THIS EXISTS, in one sentence: on 2026-07-30 this script declared **14 live skills dead** and exited 0
// doing it. The nine app repos had moved into `projects/`, its `*/Dockerfile`-style substrate patterns were
// anchored at the repo root, and so /docker-expert was reported as having nothing to act on with twelve
// Dockerfiles in the tree. Nothing failed. Nothing warned. The output simply became false, and the next step
// a NO-SUBSTRATE list invites is deletion.
//
// So this suite's centre of gravity is that regression (case 3), and the shape of the fix: the glob roots are
// seeded from `_layout.projectRoots()`, so the next reorganisation must not need an edit here either — the
// case therefore asserts a substrate found through a CONTAINER directory, not through a hardcoded `projects/`.
//
// The second thing it pins is a CROSS-TOOL CONTRACT that has already been broken once. `health-sweep` reads
// the count out of the `── NO SUBSTRATE (14) ──` heading by regex; its first parser looked for the hyphenated
// spelling and reported `ok` over 14 findings. Anyone reformatting that heading breaks a different tool
// silently, so the exact text is asserted here (case 7).
//
// Method: a sandbox repo under a temp dir with its own `.claude/skills/`, its own substrate map and its own
// fixture tree. The real repo is never read for verdicts — a suite whose expectations depend on how many
// Dockerfiles happen to exist today is a suite that fails for reasons that are nobody's fault.
//
// Per platform/standards/testing.md §2.5 the suite also MUTATES the script and asserts it notices.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  copyFileSync,
} from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const SCRIPT = join(HERE, "skill-audit.mjs");

const write = (p, body) => {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, body);
};

/**
 * A sandbox repo. `.claude/scripts/` holds a copy of the script under test plus `_layout.mjs` (imported
 * relative to it), so the script resolves the sandbox as its repo root exactly as it resolves the real one.
 */
function sandbox({ skills, map, files = {} }) {
  const root = mkdtempSync(join(tmpdir(), "skill-audit-"));
  const scripts = join(root, ".claude", "scripts");
  mkdirSync(scripts, { recursive: true });
  copyFileSync(SCRIPT, join(scripts, "skill-audit.mjs"));
  copyFileSync(join(HERE, "_layout.mjs"), join(scripts, "_layout.mjs"));
  if (map !== null)
    write(join(scripts, "skill-substrate.json"), JSON.stringify({ skills: map }));

  for (const name of skills) {
    // A skill IS a directory containing SKILL.md — the frontmatter is what gets injected every session.
    write(
      join(root, ".claude", "skills", name, "SKILL.md"),
      `---\nname: ${name}\ndescription: fixture skill ${name}\n---\n\nbody\n`,
    );
  }
  for (const [rel, body] of Object.entries(files)) write(join(root, rel), body);
  return { root, scripts };
}

const run = (scripts, args = []) => {
  const r = spawnSync(process.execPath, [join(scripts, "skill-audit.mjs"), ...args], {
    encoding: "utf8",
    timeout: 60_000,
  });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
};

const verdicts = (scripts) => {
  const { out } = run(scripts, ["--json"]);
  const j = JSON.parse(out);
  return Object.fromEntries(j.skills.map((s) => [s.name, s]));
};

/* ─────────────────────────────────────────────────────── 1. the three verdict classes ── */
{
  const { root, scripts } = sandbox({
    skills: ["docker-expert", "dependabot-review", "honest-critique"],
    map: {
      "docker-expert": "*/Dockerfile",
      "dependabot-review": ".github/dependabot.yml",
      "honest-critique": null, // behavioural: no artifact can prove or disprove it
    },
    files: {
      "projects/todo/Dockerfile": "FROM node:22\n",
      "projects/todo/package.json": "{}\n", // a `_layout` project marker — see case 3b for why it is required
    },
  });

  const v = verdicts(scripts);
  assert.equal(v["docker-expert"].verdict, "HAS-SUBSTRATE", "a Dockerfile exists in the tree");
  assert.match(
    v["docker-expert"].hit,
    /Dockerfile$/,
    "the verdict must name WHICH file justified it — an unfalsifiable verdict cannot be audited",
  );
  assert.equal(
    v["dependabot-review"].verdict,
    "NO-SUBSTRATE",
    "nothing in this fixture enables dependabot",
  );
  assert.equal(
    v["honest-critique"].verdict,
    "BEHAVIOURAL",
    "a null pattern means the question is not answerable by a file check, NOT that the skill is dead",
  );
  assert.equal(run(scripts).code, 0, "report-only: it must never exit non-zero on findings");
  rmSync(root, { recursive: true, force: true });
}

/* ──────────────────────────── 2. map drift must be reported in BOTH directions ──
 * A stale map that looks authoritative is worse than no map: every verdict below it is computed from it.
 */
{
  const { root, scripts } = sandbox({
    skills: ["mapped", "not-in-map"],
    map: { mapped: null, "gone-from-disk": "*/Dockerfile" },
  });
  const { out } = run(scripts);
  assert.match(out, /MAP DRIFT/, "drift must be announced, not buried");
  assert.match(
    out,
    /installed but not in skill-substrate\.json: not-in-map/,
    "an unmapped installed skill must be named",
  );
  assert.match(
    out,
    /in skill-substrate\.json but not installed: gone-from-disk/,
    "a map entry with no skill must be named — otherwise the map rots invisibly",
  );
  assert.equal(verdicts(scripts)["not-in-map"].verdict, "UNMAPPED");
  rmSync(root, { recursive: true, force: true });
}

/* ═══════════════════════ 3. THE REGRESSION: substrate inside a container directory ═══════
 * The 2026-07-30 defect, reproduced as a fixture. `*​/Dockerfile` must find `projects/todo/Dockerfile`,
 * i.e. the glob roots must include directories that merely HOLD projects. Asserted via `_layout`'s marker
 * detection rather than a literal "projects/" so a future rename cannot quietly re-break it.
 */
{
  const { root, scripts } = sandbox({
    skills: ["docker-expert", "prisma-expert"],
    map: {
      "docker-expert": "*/Dockerfile",
      "prisma-expert": "*/prisma/schema.prisma",
    },
    files: {
      // Nested one level deeper than the pattern's own depth, exactly as the real repo is after the move.
      "projects/todo/Dockerfile": "FROM node:22\n",
      "projects/todo/package.json": "{}\n", // a `_layout` project marker
      "projects/sakubun/prisma/schema.prisma": "datasource db {}\n",
      "projects/sakubun/package.json": "{}\n",
    },
  });

  const v = verdicts(scripts);
  assert.equal(
    v["docker-expert"].verdict,
    "HAS-SUBSTRATE",
    "12 Dockerfiles in the tree were reported as NO-SUBSTRATE on 2026-07-30 — this is that case",
  );
  assert.equal(
    v["prisma-expert"].verdict,
    "HAS-SUBSTRATE",
    "a schema two levels down must still count",
  );
  const { out } = run(scripts);
  assert.match(out, /NO SUBSTRATE \(0\)/, `nothing here is dead:\n${out}`);
  rmSync(root, { recursive: true, force: true });
}

/* ══════════ 3b. THE LIMITATION THE FIX INHERITED, stated instead of discovered later ══════
 * The container roots come from `_layout.projectRoots()`, which recognises a project by a MARKER
 * (`.git` / `docs` / `package.json` / `plans`). A directory holding app code and none of those is invisible
 * to it, so nothing inside it can ever count as substrate — a freshly scaffolded app before `git init`, or a
 * single-script worker. All nine current projects carry `.git`, so this is latent rather than active.
 *
 * This case exists to make the blind spot FAIL VISIBLY the day someone changes the marker set, and to stop a
 * future reader concluding from case 3 that "anything under a container is found". It asserts the CURRENT
 * behaviour and says plainly that the behaviour is a limitation, not a goal.
 */
{
  const { root, scripts } = sandbox({
    skills: ["docker-expert"],
    map: { "docker-expert": "*/Dockerfile" },
    files: { "apps/unmarked-worker/Dockerfile": "FROM python:3.12\n" }, // no marker file at all
  });
  assert.equal(
    verdicts(scripts)["docker-expert"].verdict,
    "NO-SUBSTRATE",
    "KNOWN LIMITATION (asserting current behaviour): a project directory with no _layout marker is not " +
      "searched. If this ever starts passing, _layout's marker set widened — good, and this case should be " +
      "flipped rather than deleted.",
  );
  rmSync(root, { recursive: true, force: true });
}

/* ───────────────────── 4. existence is not always proof — the `grep:` form ──
 * Every project has a package.json; only some declare an external-API client. A checker that treats
 * presence as proof would mark half the catalog alive on a technicality.
 */
{
  const { root, scripts } = sandbox({
    skills: ["api-integration-specialist"],
    map: {
      "api-integration-specialist": "grep:openai|anthropic:*/package.json",
    },
    files: {
      "projects/todo/package.json": JSON.stringify({ dependencies: { next: "15" } }),
    },
  });
  assert.equal(
    verdicts(scripts)["api-integration-specialist"].verdict,
    "NO-SUBSTRATE",
    "the file exists but its CONTENT does not match — presence alone must not count",
  );

  writeFileSync(
    join(root, "projects/todo/package.json"),
    JSON.stringify({ dependencies: { anthropic: "1" } }),
  );
  const v = verdicts(scripts)["api-integration-specialist"];
  assert.equal(v.verdict, "HAS-SUBSTRATE", "a matching body must count");
  assert.match(v.hit, /matched \//, "the verdict must show which regex matched where");
  rmSync(root, { recursive: true, force: true });
}

/* ─────────────────────────────── 5. an array spec means "any of these counts" ── */
{
  const { root, scripts } = sandbox({
    skills: ["testing-standard"],
    map: { "testing-standard": ["*/vitest.config.ts", "*/playwright.config.ts"] },
    files: {
      "projects/todo/playwright.config.ts": "export default {}\n",
      "projects/todo/package.json": "{}\n",
    },
  });
  assert.equal(
    verdicts(scripts)["testing-standard"].verdict,
    "HAS-SUBSTRATE",
    "the SECOND alternative matched — an array must not short-circuit to a verdict on the first",
  );
  rmSync(root, { recursive: true, force: true });
}

/* ─────────────────────── 6. build output must never count as substrate ──
 * A vendored copy inside node_modules would keep a skill alive forever on somebody else's file.
 *
 * NOTE ON THE FIXTURE, because the first version of this case was worthless: it put the file at
 * `projects/todo/node_modules/some-dep/Dockerfile`, which a `*​/Dockerfile` pattern cannot reach at ANY
 * setting of IGNORE_DIRS — two segments do not span four. The case passed while proving nothing, and the
 * mutation run is what exposed it. The file therefore sits exactly where the `*` segment lands.
 */
{
  const { root, scripts } = sandbox({
    skills: ["docker-expert"],
    map: { "docker-expert": "*/Dockerfile" },
    files: {
      "node_modules/Dockerfile": "FROM scratch\n", // a dependency's own container build
      "projects/todo/package.json": "{}\n",
    },
  });
  assert.equal(
    verdicts(scripts)["docker-expert"].verdict,
    "NO-SUBSTRATE",
    "a Dockerfile inside node_modules is not this repo's substrate",
  );
  rmSync(root, { recursive: true, force: true });
}

/* ══════════════ 7. THE CROSS-TOOL CONTRACT: health-sweep parses this heading by regex ══════ */
{
  const { root, scripts } = sandbox({
    skills: ["a", "b", "c"],
    map: { a: "nope/x", b: "nope/y", c: null },
  });
  const { out } = run(scripts);
  assert.match(
    out,
    /── NO SUBSTRATE \(2\) — nothing in this repo for these to act on ──/,
    `health-sweep.mjs reads the count out of this exact heading (/NO[ -]SUBSTRATE\\s*\\((\\d+)\\)/). Its\n` +
      `first parser missed the space and reported "ok" over 14 findings. Reformat this line and you break a\n` +
      `DIFFERENT tool, silently:\n${out}`,
  );
  assert.match(out, /report only, nothing was uninstalled/, "the report-only framing is part of the contract");
  assert.match(
    out,
    /NO-SUBSTRATE is a strong signal, not a verdict/,
    "the closing caveat is what stops the list being read as a deletion order",
  );
  rmSync(root, { recursive: true, force: true });
}

/* ─────────────────────── 8. a missing substrate map must FAIL LOUDLY, not report zero ──
 * Every other checker on this platform fails open. This one must not: with no map, every skill would be
 * UNMAPPED and the output would look like a clean audit of nothing.
 */
{
  const { root, scripts } = sandbox({ skills: ["x"], map: null });
  const { code, out } = run(scripts);
  assert.equal(code, 1, "a missing map must be an error, not an empty report");
  assert.match(out, /substrate map missing/, out);
  rmSync(root, { recursive: true, force: true });
}

/* ────────────────── 9. a directory without SKILL.md is not an installed skill ── */
{
  const { root, scripts } = sandbox({ skills: ["real"], map: { real: null } });
  mkdirSync(join(root, ".claude", "skills", "leftover-dir"), { recursive: true });
  const { out } = run(scripts, ["--json"]);
  const j = JSON.parse(out);
  assert.equal(j.skillCount, 1, "a stray directory must not be counted as a skill");
  assert.deepEqual(
    j.skills.map((s) => s.name),
    ["real"],
  );
  rmSync(root, { recursive: true, force: true });
}

/* ───────────────────────── 10. the suite must NOTICE a broken audit (mutation) ── */
{
  const src = readFileSync(SCRIPT, "utf8");

  /** Build a fresh sandbox, overwrite the script with a mutant, and return the verdict map. */
  const withMutant = (apply, spec) => {
    const s = sandbox(spec);
    const mutated = apply(src);
    assert.notEqual(mutated, src, "mutation changed nothing — the patch is stale");
    writeFileSync(join(s.scripts, "skill-audit.mjs"), mutated);
    return { ...s, mutated };
  };

  const CONTAINER_SPEC = {
    skills: ["docker-expert"],
    map: { "docker-expert": "*/Dockerfile" },
    files: {
      "projects/todo/Dockerfile": "FROM node:22\n",
      "projects/todo/package.json": "{}\n",
    },
  };

  const mutants = [
    {
      name: "glob roots collapsed back to the repo root (THE 2026-07-30 DEFECT)",
      spec: CONTAINER_SPEC,
      apply: (s) => s.replace("for (const p of projectRoots(REPO)) roots.add(dirname(p.dir));", ""),
      probe: (s) => verdicts(s.scripts)["docker-expert"].verdict === "NO-SUBSTRATE",
    },
    {
      name: "node_modules no longer ignored",
      spec: {
        skills: ["docker-expert"],
        map: { "docker-expert": "*/Dockerfile" },
        files: {
          "node_modules/Dockerfile": "FROM scratch\n",
          "projects/todo/package.json": "{}\n",
        },
      },
      apply: (s) =>
        s.replace(/const IGNORE_DIRS = new Set\(\[[^\]]*\]\);/, "const IGNORE_DIRS = new Set();"),
      probe: (s) => verdicts(s.scripts)["docker-expert"].verdict === "HAS-SUBSTRATE",
    },
    {
      name: "the grep: form ignores the regex (presence counts as proof)",
      spec: {
        skills: ["api"],
        map: { api: "grep:NEVERAPPEARS:*/package.json" },
        files: { "projects/todo/package.json": "{}\n" },
      },
      apply: (s) =>
        s.replace(
          "if (re.test(readFileSync(join(REPO, rel), \"utf8\"))) return `${rel} (matched /${re.source}/)`;",
          "return `${rel} (matched /${re.source}/)`;",
        ),
      probe: (s) => verdicts(s.scripts)["api"].verdict === "HAS-SUBSTRATE",
    },
    {
      name: "stale map entries no longer reported",
      spec: { skills: ["a"], map: { a: null, "gone-from-disk": "x/y" } },
      apply: (s) =>
        s.replace(
          "const staleInMap = Object.keys(map).filter((s) => !installed.includes(s));",
          "const staleInMap = [];",
        ),
      probe: (s) => !/in skill-substrate\.json but not installed/.test(run(s.scripts).out),
    },
    {
      name: "the NO SUBSTRATE heading reformatted (breaks health-sweep's parser)",
      spec: { skills: ["a"], map: { a: "nope/x" } },
      apply: (s) => s.replace("── NO SUBSTRATE (${dead.length})", "── DEAD SKILLS: ${dead.length}"),
      probe: (s) => !/NO SUBSTRATE \(1\)/.test(run(s.scripts).out),
    },
    {
      name: "a directory with no SKILL.md counted as a skill",
      mayCrash: true, // it also throws reading the missing SKILL.md; either outcome is a kill
      spec: { skills: ["real"], map: { real: null } },
      apply: (s) =>
        s.replace(
          'e.isDirectory() && existsSync(join(SKILLS_DIR, e.name, "SKILL.md"))',
          "e.isDirectory()",
        ),
      probe: (s) => {
        mkdirSync(join(s.root, ".claude", "skills", "leftover"), { recursive: true });
        const { out, code } = run(s.scripts, ["--json"]);
        // The mutant will also throw when it tries to read the missing SKILL.md — either way it is caught.
        return code !== 0 || JSON.parse(out).skillCount !== 1;
      },
    },
  ];

  for (const m of mutants) {
    const s = withMutant(m.apply, m.spec);
    // A mutant that merely CRASHES the script proves the suite notices a broken file, not that it notices
    // the behaviour being claimed. (Learned twice on 2026-07-30: an unbalanced-paren patch "passed" in two
    // different suites.) So unless a mutant is expected to break execution, it must still run cleanly.
    if (!m.mayCrash) {
      const sanity = run(s.scripts, ["--json"]);
      let ok = false;
      try {
        ok = Array.isArray(JSON.parse(sanity.out).skills);
      } catch {
        ok = false;
      }
      assert.ok(
        ok,
        `mutant "${m.name}" did not run — it is a syntax error, not a behavioural change:\n${sanity.out.slice(0, 400)}`,
      );
    }
    const killed = m.probe(s);
    rmSync(s.root, { recursive: true, force: true });
    assert.ok(
      killed,
      `SURVIVING MUTANT — "${m.name}" and the suite still passed. Add a case for it.`,
    );
  }
}

/* ────────────── the real repo must be untouched: this suite only ever writes to temp dirs ── */
{
  const dirty = spawnSync("git", ["status", "--porcelain"], {
    cwd: REPO,
    encoding: "utf8",
  }).stdout;
  assert.ok(
    !/skill-substrate|skills\/leftover/.test(dirty),
    `the suite leaked fixtures into the real repo:\n${dirty}`,
  );
}

console.log(
  "skill-audit.test.mjs — 3 verdict classes, drift both ways, the container-directory regression, " +
    "grep:/array specs, node_modules ignored, the health-sweep heading contract, loud failure on a missing " +
    "map, 6 mutants all killed  ✅",
);
