// Test for reuse-scan.mjs — the tool that turns "look before you build" from a habit into a number.
// Run: node .claude/scripts/reuse-scan.test.mjs
//
// WHY THIS EXISTS. `/code-reuse` has said "grep the siblings first" since 2026-06 and four apps still grew
// four different theme toggles, because the agent had to invent the keyword. This script is the measurement
// that replaced the habit — and its verdicts decide whether code gets extracted into `commons`, which is a
// real, hard-to-reverse change to several repos.
//
// Both failure directions have already happened here:
//   TOO QUIET — after the 2026-07-30 move into `projects/` it found 0 projects and reported "no duplication"
//               with no error at all. Its `--calibrate` mode ALSO went silent, printing "n/a" for all six
//               ground-truth pairs, so the one thing that could have caught it was broken by the same change.
//   TOO LOUD  — before the UPSTREAM class existed, the report was topped by seven groups of vendored shadcn
//               primitives: mathematically correct, and useless. "Extract cn() to commons" is precisely the
//               over-engineering this scan exists to prevent.
//
// So the suite pins the rule of three in both directions, every exemption class, and — in the real repo —
// that the calibration still calibrates something.
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
const SCRIPT = join(HERE, "reuse-scan.mjs");

const write = (p, body) => {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, body);
};

/** A file long and varied enough to clear MIN_CODE_LINES (3) and MIN_GRAMS (8). */
const THEME_TOGGLE = `import { useTheme } from "next-themes";
export function ThemeToggle({ label }) {
  const { theme, setTheme } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return { theme, next, label, onClick: () => setTheme(next) };
}
`;
const DB_HELPER = `import { PrismaClient } from "@prisma/client";
const globalForPrisma = globalThis;
export const db = globalForPrisma.prisma ?? new PrismaClient({ log: ["error"] });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
`;
const UNRELATED = `export function formatStreak(days, locale) {
  const label = days === 1 ? "day" : "days";
  const formatted = new Intl.NumberFormat(locale).format(days);
  return formatted + " " + label + " in a row";
}
`;

function sandbox({ files = {}, registry = null, catalog = null, src = null } = {}) {
  const root = mkdtempSync(join(tmpdir(), "reuse-scan-"));
  const scripts = join(root, ".claude", "scripts");
  mkdirSync(scripts, { recursive: true });
  writeFileSync(join(scripts, "reuse-scan.mjs"), src ?? readFileSync(SCRIPT, "utf8"));
  copyFileSync(join(HERE, "_layout.mjs"), join(scripts, "_layout.mjs"));
  for (const [rel, body] of Object.entries(files)) write(join(root, rel), body);
  if (registry)
    for (const [name, item] of Object.entries(registry))
      write(join(root, "commons", "public", "r", `${name}.json`), JSON.stringify(item));
  if (catalog) write(join(root, "platform", "registries", "shared-assets.md"), catalog);
  return { root, script: join(scripts, "reuse-scan.mjs") };
}

/** Every project needs a `_layout` marker or it is invisible — that is the whole point of that module. */
const project = (name, files) =>
  Object.fromEntries([
    [`projects/${name}/package.json`, "{}\n"],
    ...Object.entries(files).map(([p, b]) => [`projects/${name}/${p}`, b]),
  ]);

function run(s, args = []) {
  const r = spawnSync(process.execPath, [s.script, ...args], {
    encoding: "utf8",
    timeout: 180_000,
    cwd: s.root,
  });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

const groups = (s, args = []) => {
  const { out, code } = run(s, ["--json", ...args]);
  assert.equal(code, 0, `reuse-scan exited ${code}:\n${out.slice(0, 600)}`);
  return JSON.parse(out);
};

/* ═══════════ 1. THE RULE OF THREE, in both directions ═══════════
 * Two copies is information; three is a decision. Extracting at two is premature coupling, and the platform
 * has the scars to say so — so the verdict, and the ADVICE attached to it, both matter.
 */
{
  const two = sandbox({
    files: {
      ...project("todo", { "components/theme-toggle.tsx": THEME_TOGGLE }),
      ...project("journal", { "components/theme-toggle.tsx": THEME_TOGGLE }),
    },
  });
  const g2 = groups(two);
  assert.equal(g2.length, 1, `the pair must be found:\n${JSON.stringify(g2, null, 2)}`);
  assert.equal(g2[0].verdict, "CANDIDATE", "two projects is a CANDIDATE, never an EXTRACT");
  assert.equal(g2[0].projects, 2);
  assert.match(
    run(two).out,
    /built in 2 projects -> record it in shared-assets\.md as DUPLICATED; do NOT extract yet/,
    "the advice must say what to do INSTEAD of extracting",
  );
  rmSync(two.root, { recursive: true, force: true });

  const three = sandbox({
    files: {
      ...project("todo", { "components/theme-toggle.tsx": THEME_TOGGLE }),
      ...project("journal", { "components/theme-toggle.tsx": THEME_TOGGLE }),
      ...project("yakudoku", { "web/components/theme-toggle.tsx": THEME_TOGGLE }),
    },
  });
  const g3 = groups(three);
  assert.equal(g3[0].verdict, "EXTRACT", `three projects satisfies the rule of three:\n${JSON.stringify(g3)}`);
  assert.equal(g3[0].projects, 3);
  assert.match(run(three).out, /rule of three is satisfied/, "…and the report must say which rule fired");
  assert.match(
    run(three).out,
    /Report only\. Extraction is a decision: diverged copies are not one asset\./,
    "the closing caveat is what keeps this a measurement rather than an instruction",
  );
  rmSync(three.root, { recursive: true, force: true });
}

/* ═══════════ 2. in-repo duplication is a refactor, not reuse ═══════════ */
{
  const s = sandbox({
    files: project("todo", {
      "components/theme-toggle.tsx": THEME_TOGGLE,
      "components/legacy/theme-toggle.tsx": THEME_TOGGLE,
    }),
  });
  assert.deepEqual(
    groups(s),
    [],
    "two copies inside ONE project is a local refactor — reporting it here would bury the cross-project signal",
  );
  rmSync(s.root, { recursive: true, force: true });
}

/* ═══════════ 3. what "the same artifact" means: shape, not text ═══════════
 * Comments get reworded per app and imports use different aliases. If those defeated the match, the tool
 * would find nothing in practice — which is what jscpd did on this fleet (0 clones for two files differing
 * by one comment).
 */
{
  const withComments = `// A different comment in this app entirely.\nimport { useTheme } from "@/lib/theme";\n${THEME_TOGGLE.split("\n").slice(1).join("\n")}`;
  const s = sandbox({
    files: {
      ...project("todo", { "components/theme-toggle.tsx": THEME_TOGGLE }),
      ...project("journal", { "components/theme-toggle.tsx": withComments }),
    },
  });
  assert.equal(
    groups(s).length,
    1,
    "reworded comments and different import aliases must not hide a clone — that is the jscpd failure",
  );
  rmSync(s.root, { recursive: true, force: true });

  // …and two genuinely different files that merely share a NAME are not one asset.
  const different = sandbox({
    files: {
      ...project("todo", { "lib/db.ts": DB_HELPER }),
      ...project("sakubun", { "lib/db.ts": UNRELATED }),
    },
  });
  assert.deepEqual(
    groups(different),
    [],
    "same basename, different shape ⇒ not a group. A name-based scan would report every `db.ts` in the fleet.",
  );
  rmSync(different.root, { recursive: true, force: true });
}

/* ═══════════ 4. UPSTREAM — vendored and generated files have an owner already ═══════════
 * Before this class existed the report was topped by seven groups of shadcn primitives.
 */
{
  const s = sandbox({
    files: {
      ...project("todo", { "components/ui/button.tsx": THEME_TOGGLE, "lib/utils.ts": DB_HELPER }),
      ...project("journal", { "components/ui/button.tsx": THEME_TOGGLE, "lib/utils.ts": DB_HELPER }),
      ...project("yakudoku", { "web/components/ui/button.tsx": THEME_TOGGLE, "web/lib/utils.ts": DB_HELPER }),
    },
  });

  assert.deepEqual(groups(s), [], "vendored primitives and scaffolder output must be hidden by default");
  const shown = groups(s, ["--all"]);
  assert.equal(shown.length, 2, `--all must reveal them:\n${JSON.stringify(shown.map((g) => g.verdict))}`);
  assert.ok(
    shown.every((g) => g.verdict === "UPSTREAM"),
    `both groups are UPSTREAM (components/ui + the shadcn cn() helper):\n${JSON.stringify(shown, null, 2)}`,
  );
  const text = run(s, ["--all"]).out;
  assert.match(text, /it has an upstream owner, nothing to extract/, "the reason must be stated, not implied");
  assert.match(run(s).out, /group\(s\) hidden \(vendored shadcn primitives, or filtered\) — use --all/, "…and the hiding disclosed");
  rmSync(s.root, { recursive: true, force: true });
}

/* ═══════════ 5. HAS CANONICAL — a registry item already owns this shape ═══════════ */
{
  const s = sandbox({
    files: {
      ...project("todo", { "components/theme-toggle.tsx": THEME_TOGGLE }),
      ...project("journal", { "components/theme-toggle.tsx": THEME_TOGGLE }),
      ...project("yakudoku", { "web/components/theme-toggle.tsx": THEME_TOGGLE }),
    },
    registry: {
      "theme-toggle": { name: "theme-toggle", files: [{ target: "~/components/theme-toggle.tsx" }] },
    },
  });
  const g = groups(s);
  assert.equal(
    g[0].verdict,
    "HAS CANONICAL",
    `an existing registry item outranks EXTRACT — the copies should be re-added, not re-invented:\n${JSON.stringify(g)}`,
  );
  assert.match(run(s).out, /the copies should be re-added, not re-invented/);
  rmSync(s.root, { recursive: true, force: true });
}

/* ═══════════ 6. --new hides what the catalog already records ═══════════ */
{
  const files = {
    ...project("todo", { "components/theme-toggle.tsx": THEME_TOGGLE }),
    ...project("journal", { "components/theme-toggle.tsx": THEME_TOGGLE }),
  };
  const catalogued = sandbox({
    files,
    catalog: "| **ThemeToggle** | the light/dark control | components/theme-toggle.tsx | DUPLICATED |\n",
  });
  assert.equal(groups(catalogued).length, 1, "by default a known duplication is still shown");
  assert.equal(groups(catalogued)[0].inCatalog, true, "…and marked as catalogued");
  assert.deepEqual(groups(catalogued, ["--new"]), [], "--new is for finding what nobody has recorded yet");

  const fresh = sandbox({ files });
  assert.equal(groups(fresh)[0].inCatalog, false, "an unrecorded group must be flagged");
  assert.match(run(fresh).out, /\[NOT IN CATALOG\]/, "…visibly, since recording it is the required next step");
  rmSync(catalogued.root, { recursive: true, force: true });
  rmSync(fresh.root, { recursive: true, force: true });
}

/* ═══════════ 7. the boundaries of the scan ═══════════ */
{
  // `platform` / `commons` / `docgen` / `n8n` are not consumers — a shared asset living in commons is the
  // canonical, not a duplicate of itself.
  const s = sandbox({
    files: {
      ...project("todo", { "components/theme-toggle.tsx": THEME_TOGGLE }),
      "commons/registry/block/theme-toggle.tsx": THEME_TOGGLE,
      "commons/package.json": "{}\n",
      "platform/scripts/theme-toggle.tsx": THEME_TOGGLE,
      "platform/plans/x.md": "# a plan\n",
    },
  });
  assert.deepEqual(groups(s), [], "the canonical home and the platform's own tooling are not consumers");
  rmSync(s.root, { recursive: true, force: true });

  // Build output must never be scanned.
  const vendored = sandbox({
    files: {
      ...project("todo", { "components/theme-toggle.tsx": THEME_TOGGLE }),
      ...project("journal", { "node_modules/dep/theme-toggle.tsx": THEME_TOGGLE, ".next/x/theme-toggle.tsx": THEME_TOGGLE }),
    },
  });
  assert.deepEqual(groups(vendored), [], "a dependency's copy is not this fleet's duplication");
  rmSync(vendored.root, { recursive: true, force: true });

  // Files too small to score are skipped rather than guessed at.
  const tiny = sandbox({
    files: {
      ...project("todo", { "lib/tiny.ts": "export const a = 1;\n" }),
      ...project("journal", { "lib/tiny.ts": "export const a = 1;\n" }),
    },
  });
  assert.deepEqual(groups(tiny), [], "below the code-line / k-gram floor a Jaccard score means nothing");
  rmSync(tiny.root, { recursive: true, force: true });
}

/* ═══════════ 8. a focus argument answers "I am working HERE — what do I share?" ═══════════ */
{
  const s = sandbox({
    files: {
      ...project("todo", { "lib/db.ts": DB_HELPER }),
      ...project("journal", { "lib/db.ts": DB_HELPER }),
      ...project("sakubun", { "components/theme-toggle.tsx": THEME_TOGGLE }),
      ...project("yakudoku", { "web/components/theme-toggle.tsx": THEME_TOGGLE }),
    },
  });
  assert.equal(groups(s).length, 2, "the whole fleet has two groups");
  const focused = groups(s, ["todo"]);
  assert.equal(focused.length, 1, "…and only one involves todo");
  assert.ok(focused[0].files.some((f) => f.project.endsWith("todo")));
  assert.match(run(s, ["todo"]).out, /\(focus: todo\)/, "the focus must be stated in the header");
  rmSync(s.root, { recursive: true, force: true });
}

/* ═══════════ 9. --calibrate must still calibrate SOMETHING in the real repo ═══════════
 * On 2026-07-30 the move into `projects/` made all six ground-truth pairs resolve to "n/a", so the
 * calibration silently stopped checking the threshold it exists to justify. A calibration that calibrates
 * nothing is worse than none: it looks like evidence.
 */
{
  const r = spawnSync(process.execPath, [SCRIPT, "--calibrate"], {
    encoding: "utf8",
    timeout: 180_000,
    cwd: REPO,
  });
  const out = (r.stdout || "") + (r.stderr || "");
  assert.equal(r.status, 0, `--calibrate must run in the real repo:\n${out.slice(0, 400)}`);
  const na = (out.match(/n\/a/g) || []).length;
  const scored = (out.match(/^\s+\d\.\d{3}\s/gm) || []).length;
  assert.ok(
    scored >= 3,
    `only ${scored} of the 6 ground-truth pairs resolved (${na} n/a). Either the fixture files moved or the ` +
      `pair lookup went blind — the second is the 2026-07-30 regression, and it is silent.\n${out}`,
  );
  assert.match(out, /k=5\s+NEAR=0\.72/, "the borrowed parameters must be printed with the result");
}

/* ═══════════ 10. the suite must NOTICE a broken scan (mutation) ═══════════ */
{
  // LF-normalized: on a CRLF working tree (Windows) every multi-line mutation patch below would go stale.
  const src = readFileSync(SCRIPT, "utf8").replace(/\r\n/g, "\n");

  const PAIR = {
    ...project("todo", { "components/theme-toggle.tsx": THEME_TOGGLE }),
    ...project("journal", { "components/theme-toggle.tsx": THEME_TOGGLE }),
  };
  const TRIO = {
    ...PAIR,
    ...project("yakudoku", { "web/components/theme-toggle.tsx": THEME_TOGGLE }),
  };

  const mutants = [
    {
      name: "project discovery returns nothing (THE 2026-07-30 SHAPE — 'no duplication', silently)",
      files: PAIR,
      apply: (s) => s.replace("return projectRoots(FLEET)", "return [].concat(projectRoots(FLEET)).slice(0, 0).concat([])\n    .concat([])"),
      probe: (s) => groups(s).length === 0 && /No cross-project duplication found/.test(run(s).out),
    },
    {
      name: "the same-project guard removed (local refactors flood the report)",
      files: project("todo", {
        "components/theme-toggle.tsx": THEME_TOGGLE,
        "components/legacy/theme-toggle.tsx": THEME_TOGGLE,
      }),
      apply: (s) => s.replace("if (other.project === seed.project) continue;", ""),
      probe: (s) => groups(s).length > 0,
    },
    {
      name: "the similarity threshold raised out of reach (clones stop being clones)",
      files: PAIR,
      apply: (s) => s.replace("const NEAR = 0.72;", "const NEAR = 1.01;"),
      probe: (s) => groups(s).length === 0,
    },
    {
      name: "the rule of three moved out of reach (EXTRACT never fires)",
      files: TRIO,
      apply: (s) => s.replace("projectCount >= 3", "projectCount >= 99"),
      probe: (s) => groups(s)[0]?.verdict === "CANDIDATE",
    },
    {
      name: "the UPSTREAM class removed (the report is topped by shadcn primitives again)",
      files: {
        ...project("todo", { "components/ui/button.tsx": THEME_TOGGLE }),
        ...project("journal", { "components/ui/button.tsx": THEME_TOGGLE }),
        ...project("yakudoku", { "web/components/ui/button.tsx": THEME_TOGGLE }),
      },
      // Replace the whole expression: wrapping it in `false && (` leaves the parens unbalanced, which makes
      // a crash mutant rather than a behavioural one.
      apply: (s) => s.replace(/const upstream =[\s\S]*?!hasCanonical;/, "const upstream = false;"),
      probe: (s) => groups(s).some((g) => g.verdict === "EXTRACT"),
    },
    {
      name: "normalisation dropped (a reworded comment hides a clone — the jscpd failure)",
      files: {
        ...project("todo", { "components/theme-toggle.tsx": `// one comment\n${THEME_TOGGLE}` }),
        ...project("journal", {
          "components/theme-toggle.tsx": `// a completely different comment, much longer than the other one, mentioning several unrelated identifiers like alpha beta gamma delta epsilon\n${THEME_TOGGLE}`,
        }),
      },
      apply: (s) => s.replace("function normalize(text) {\n  return text", "function normalize(text) {\n  return text.slice(0)"),
      applyExtra: (s) =>
        s
          .replace('.replace(/\\/\\*[\\s\\S]*?\\*\\//g, " ")', "")
          .replace('.replace(/(^|\\s)\\/\\/[^\\n]*/g, " ")', ""),
      probe: (s) => groups(s).length === 0,
    },
    {
      name: "a registry item no longer outranks EXTRACT (commons gets a second copy of itself)",
      files: TRIO,
      registry: {
        "theme-toggle": { name: "theme-toggle", files: [{ target: "~/components/theme-toggle.tsx" }] },
      },
      apply: (s) => s.replace("const hasCanonical = members.some((m) => canonical.has(m.path));", "const hasCanonical = false;"),
      probe: (s) => groups(s)[0]?.verdict === "EXTRACT",
    },
  ];

  for (const m of mutants) {
    let mutated = (m.applyExtra ?? ((x) => x))(m.apply(src));
    assert.notEqual(mutated, src, `mutation "${m.name}" changed nothing — the patch is stale`);
    const s = sandbox({ files: m.files, registry: m.registry ?? null, src: mutated });
    const sanity = run(s, ["--json"]);
    assert.equal(
      sanity.code,
      0,
      `mutant "${m.name}" crashed instead of changing behaviour:\n${sanity.out.slice(0, 300)}`,
    );
    const killed = m.probe(s);
    rmSync(s.root, { recursive: true, force: true });
    assert.ok(killed, `SURVIVING MUTANT — "${m.name}" and the suite still passed. Add a case for it.`);
  }
}

/* ─────────── and a floor against the real fleet: this scan going quiet is the failure it had ── */
{
  const r = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8", timeout: 180_000, cwd: REPO });
  const header = /reuse-scan\s+(\d+) files across (\d+) projects/.exec(r.stdout || "");
  assert.ok(header, `the real run must print its header:\n${(r.stdout || "").slice(0, 300)}`);
  assert.ok(
    Number(header[2]) >= 5,
    `only ${header[2]} projects scanned in the real fleet — discovery may have gone blind again`,
  );
  assert.ok(Number(header[1]) >= 100, `only ${header[1]} files scanned; the fleet is much larger than that`);
}

console.log(
  "reuse-scan.test.mjs — the rule of three in both directions with its advice text, in-repo duplication " +
    "excluded, shape-not-text matching (and same-name/different-shape rejected), UPSTREAM + HAS CANONICAL + " +
    "--new + focus, three scan boundaries, --calibrate still calibrating in the real repo, 7 mutants all " +
    "killed  ✅",
);
