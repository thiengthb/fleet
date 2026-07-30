#!/usr/bin/env node
/**
 * Finds the same artifact built in more than one project, and applies the rule of three.
 *
 * WHY THIS EXISTS. `/code-reuse` already says "grep the sibling projects before you build" — but the
 * agent has to invent the keyword, so nothing ever counts. The result is measurable: six rows in
 * `platform/registries/shared-assets.md` sit at "DUPLICATED — 2x, and the expected 3rd never arrived",
 * and four apps independently grew four different theme toggles. This turns "look before you build"
 * from a habit into a number.
 *
 * WHY NOT jscpd. Tried first, on this fleet (2026-07-29). It reports **0 clones** for
 * `todo/lib/db.ts` vs `journal/lib/db.ts` — files that differ by one comment — because it hunts
 * copy-pasted BLOCKS of >= 50 tokens inside a codebase. The question here is different: is this
 * ARTIFACT (a whole helper, component or config, often small) present in more than one PROJECT? So the
 * unit is a file, the count is distinct projects, and small files are in scope. Parameters are still
 * borrowed rather than invented: k-gram size k=5 from the winnowing literature, and a 5-code-line floor
 * from jscpd's own `minLines` default.
 *
 * Report-only. It never edits a project — extraction is a judgement call (the shape may have genuinely
 * diverged, in which case the copies are not one asset).
 *
 * Usage:
 *   node .claude/scripts/reuse-scan.mjs                 # whole fleet
 *   node .claude/scripts/reuse-scan.mjs todo            # only pairs involving `todo` (the usual mode:
 *                                                       #   "I am working here — what do I share?")
 *   node .claude/scripts/reuse-scan.mjs --new           # hide what shared-assets.md already records
 *   node .claude/scripts/reuse-scan.mjs --all           # also show vendored shadcn primitives
 *   node .claude/scripts/reuse-scan.mjs --json          # machine-readable, for a hook
 *   node .claude/scripts/reuse-scan.mjs --calibrate     # score the known clone/not-clone pairs
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { projectRoots } from "./_layout.mjs";

const FLEET = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CATALOG = join(FLEET, "platform", "registries", "shared-assets.md");
const REGISTRY_BUILT = join(FLEET, "commons", "public", "r");

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const focus = args.filter((a) => !a.startsWith("--"))[0] ?? null;

// ---------------------------------------------------------------- tuning (borrowed, not invented)
const K = 5; // k-gram size — winnowing literature
// jscpd's minLines default is 5, but that number is tuned for a BLOCK inside one codebase. Measured here
// (--calibrate): it silently dropped `lib/db.ts` — 4 code lines after comments, and one of the most-copied
// artifacts on the platform, present in 3 projects. A file-level scan needs a lower floor, so the noise is
// held back by MIN_GRAMS instead: a file must produce enough k-grams for a Jaccard score to mean anything.
const MIN_CODE_LINES = 3;
const MIN_GRAMS = 8;
const NEAR = 0.72; // calibrated against this fleet's known pairs — see --calibrate
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "build",
  "coverage",
  "generated",
  "migrations",
  ".venv",
  "__pycache__",
  "test-results",
  "playwright-report",
]);
const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|py)$/;

// Files a SCAFFOLDER writes, not a person: `shadcn init` and `create-next-app` emit these identically in
// every project. They are duplicated by construction, already have an upstream owner, and "extract cn()
// to commons" is exactly the over-engineering this scan is supposed to prevent. Data, not logic — add a
// name here when a generator starts emitting it, and say which generator.
// Matched against the tail of the path, because a monorepo puts the app one level down
// (`yakudoku/web/postcss.config.mjs`) — an exact compare silently missed those.
const GENERATED = new Set([
  "lib/utils.ts", // shadcn init — the cn() helper
  "postcss.config.mjs", // create-next-app + tailwind
  "next-env.d.ts", // next build
  "tailwind.config.ts", // tailwind init (v3-era)
]);

/**
 * Projects = the dirs that hold consumer code. `platform` and `commons` are not consumers.
 * Discovery is delegated to `_layout.mjs` so this keeps working now that the app repos live under
 * `projects/` — before that fix this returned 0 projects and the scan reported "no duplication" silently.
 */
function projects() {
  const skip = new Set(["platform", "commons", "docgen", "n8n"]);
  return projectRoots(FLEET)
    .filter((p) => !skip.has(p.name))
    .map((p) => relative(FLEET, p.dir));
}

const isGenerated = (path) =>
  [...GENERATED].some((g) => path === g || path.endsWith(`/${g}`));

function walk(abs, rel, out) {
  for (const entry of readdirSync(abs)) {
    if (SKIP_DIRS.has(entry) || entry.startsWith(".")) continue;
    const child = join(abs, entry);
    const childRel = rel ? `${rel}/${entry}` : entry;
    if (statSync(child).isDirectory()) walk(child, childRel, out);
    else if (CODE_EXT.test(entry)) out.push({ abs: child, rel: childRel });
  }
  return out;
}

/**
 * Strip what legitimately differs between two copies of the same artifact, keeping what does not:
 * comments (reworded per app), imports (different alias paths), and whitespace. What survives is the
 * shape. Deliberately regex-level — an AST would be more precise and is not worth the dependency.
 */
function normalize(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|\s)\/\/[^\n]*/g, " ")
    .replace(/(^|\n)\s*#[^\n]*/g, "\n") // python comments
    .replace(/^\s*(import|from)\s[^\n]*$/gm, "")
    .replace(/^\s*export\s+\*\s+from[^\n]*$/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

const codeLines = (text) =>
  text.split("\n").filter((l) => {
    const t = l.trim();
    return (
      t &&
      !t.startsWith("//") &&
      !t.startsWith("*") &&
      !t.startsWith("/*") &&
      !t.startsWith("#")
    );
  }).length;

function shingles(normalized) {
  const tokens =
    normalized.match(/[A-Za-z_$][\w$]*|\d+|[^\sA-Za-z_$\d]/g) ?? [];
  if (tokens.length < K)
    return new Set(tokens.length ? [tokens.join(" ")] : []);
  const set = new Set();
  for (let i = 0; i + K <= tokens.length; i += 1)
    set.add(tokens.slice(i, i + K).join(" "));
  return set;
}

function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let shared = 0;
  for (const s of small) if (large.has(s)) shared += 1;
  return shared / (a.size + b.size - shared);
}

// ---------------------------------------------------------------- what is already known
/** Item names + install targets the registry already publishes: these have a canonical home already. */
function registryTargets() {
  const targets = new Set();
  if (!existsSync(REGISTRY_BUILT)) return targets;
  for (const entry of readdirSync(REGISTRY_BUILT)) {
    if (!entry.endsWith(".json") || entry === "registry.json") continue;
    const item = JSON.parse(readFileSync(join(REGISTRY_BUILT, entry), "utf8"));
    for (const f of item.files ?? []) {
      if (f.target) targets.add(f.target.replace(/^~\//, ""));
    }
  }
  return targets;
}

/** Crude but sufficient: does the catalog mention this path or basename anywhere? */
function catalogText() {
  return existsSync(CATALOG) ? readFileSync(CATALOG, "utf8") : "";
}

// ---------------------------------------------------------------- scan
const known = catalogText();
const canonical = registryTargets();

const files = [];
for (const project of projects()) {
  for (const f of walk(join(FLEET, project), "", [])) {
    const raw = readFileSync(f.abs, "utf8");
    if (codeLines(raw) < MIN_CODE_LINES) continue;
    const norm = normalize(raw);
    if (!norm) continue;
    const grams = shingles(norm);
    if (grams.size < MIN_GRAMS) continue;
    files.push({
      project,
      path: f.rel,
      base: f.rel.split("/").pop(),
      lines: codeLines(raw),
      norm,
      grams,
    });
  }
}

if (flags.has("--calibrate")) {
  // Ground truth from this repo's own record, so the threshold is measured rather than guessed.
  const pairs = [
    [
      "todo/lib/db.ts",
      "journal/lib/db.ts",
      "CLONE (catalog: identical but one comment)",
    ],
    // Was a clone until 2026-07-29, when todo adopted the shared 99-line component and journal did not.
    // Keeping the pair as a NOT case is the point: it proves adoption actually shows up as a low score.
    [
      "todo/components/theme-toggle.tsx",
      "journal/components/theme-toggle.tsx",
      "NOT any more (todo adopted commons)",
    ],
    [
      "journal/components/theme-toggle.tsx",
      "yakudoku/web/components/theme-toggle.tsx",
      "CLONE",
    ],
    [
      "todo/lib/db.ts",
      "sakubun/lib/db.ts",
      "NOT (same name, tenancy guard — 9 vs 93 lines)",
    ],
    [
      "todo/lib/dates.ts",
      "journal/lib/dates.ts",
      "NOT (both date helpers, different functions)",
    ],
    ["todo/lib/ai.ts", "sakubun/lib/coach.ts", "NOT (unrelated)"],
  ];
  // Match on the TAIL of `<project>/<path>` rather than splitting off the first segment. The pairs above
  // are written as `todo/lib/db.ts`, but `projects()` now yields `projects/todo` (the 2026-07-30 move into
  // `projects/`), and a first-segment split turned all six pairs into "n/a" — the calibration silently
  // stopped calibrating anything. A tail match survives the next reorganisation too, which is the same
  // reasoning `_layout.mjs` applies to discovery.
  const find = (p) =>
    files.find((f) => {
      const full = `${f.project}/${f.path}`;
      return full === p || full.endsWith(`/${p}`);
    });
  console.log(`k=${K}  NEAR=${NEAR}\n`);
  for (const [a, b, label] of pairs) {
    const fa = find(a);
    const fb = find(b);
    if (!fa || !fb) {
      console.log(
        `  ${"n/a".padStart(5)}  ${a} <-> ${b}  (missing: ${!fa ? a : b})`,
      );
      continue;
    }
    const score = jaccard(fa.grams, fb.grams);
    const verdict = score >= NEAR ? "MATCH" : "-----";
    console.log(
      `  ${score.toFixed(3)}  ${verdict}  ${a} <-> ${b}\n           expected ${label}`,
    );
  }
  process.exit(0);
}

// Group by similarity. A group is a set of files from DISTINCT projects that all resemble the first.
const groups = [];
const claimed = new Set();
for (let i = 0; i < files.length; i += 1) {
  if (claimed.has(i)) continue;
  const seed = files[i];
  const members = [{ ...seed, score: 1 }];
  for (let j = i + 1; j < files.length; j += 1) {
    if (claimed.has(j)) continue;
    const other = files[j];
    if (other.project === seed.project) continue; // in-repo duplication is a refactor, not reuse
    const score = jaccard(seed.grams, other.grams);
    if (score >= NEAR) {
      members.push({ ...other, score });
      claimed.add(j);
    }
  }
  if (members.length > 1) {
    claimed.add(i);
    groups.push(members);
  }
}

const results = groups
  .map((members) => {
    const projectCount = new Set(members.map((m) => m.project)).size;
    const hasCanonical = members.some((m) => canonical.has(m.path));
    const inCatalog = members.some(
      (m) =>
        known.includes(m.path) ||
        known.includes(m.base.replace(/\.(tsx?|jsx?|mjs|py)$/, "")),
    );
    // A file under components/ui/ that is NOT one of our registry items is a VENDORED third-party
    // primitive (shadcn's button/tabs/tooltip/...). It is identical across four apps because that is how
    // shadcn works — its canonical home is upstream, and "extract it to commons" would be wrong. Without
    // this class the report was topped by seven such groups, i.e. mathematically right and useless.
    const upstream =
      members.every(
        (m) => /(^|\/)components\/ui\//.test(m.path) || isGenerated(m.path),
      ) && !hasCanonical;
    const verdict = hasCanonical
      ? "HAS CANONICAL"
      : upstream
        ? "UPSTREAM"
        : projectCount >= 3
          ? "EXTRACT"
          : "CANDIDATE";
    return { members, projectCount, verdict, inCatalog };
  })
  /*
   * Focus matches the project's NAME or the tail of its path. `projects()` yields `projects/todo` after the
   * 2026-07-30 move, so an exact compare against `todo` matched nothing and the documented "usual mode"
   * (`reuse-scan todo` — "I am working here, what do I share?") reported **No cross-project duplication
   * found** while the unfocused run reported 22 groups. Found 2026-07-30 by reuse-scan.test.mjs; it is the
   * same failure shape as the discovery regression `_layout.mjs` exists to prevent, and it was invisible
   * until this file also started disclosing how many groups it had filtered out.
   */
  .filter((g) =>
    focus
      ? g.members.some(
          (m) => m.project === focus || m.project.endsWith(`/${focus}`),
        )
      : true,
  )
  .filter((g) => (g.verdict === "UPSTREAM" ? flags.has("--all") : true))
  .filter((g) =>
    flags.has("--new") ? !g.inCatalog && g.verdict !== "HAS CANONICAL" : true,
  )
  .sort(
    (a, b) =>
      b.projectCount - a.projectCount ||
      b.members[0].lines - a.members[0].lines,
  );

if (flags.has("--json")) {
  console.log(
    JSON.stringify(
      results.map((g) => ({
        verdict: g.verdict,
        projects: g.projectCount,
        inCatalog: g.inCatalog,
        files: g.members.map((m) => ({
          project: m.project,
          path: m.path,
          lines: m.lines,
          score: +m.score.toFixed(3),
        })),
      })),
      null,
      2,
    ),
  );
  process.exit(0);
}

const RULE = {
  EXTRACT:
    "built in 3+ projects, same shape -> EXTRACT to commons (rule of three is satisfied)",
  CANDIDATE:
    "built in 2 projects -> record it in shared-assets.md as DUPLICATED; do NOT extract yet",
  "HAS CANONICAL":
    "a registry item already owns this — the copies should be re-added, not re-invented",
  UPSTREAM:
    "vendored or generated by a scaffolder (shadcn / create-next-app) — it has an upstream owner, nothing to extract",
};

console.log(
  `reuse-scan  ${files.length} files across ${projects().length} projects${focus ? `  (focus: ${focus})` : ""}`,
);
console.log(
  `k-gram k=${K}, similarity >= ${NEAR}, files under ${MIN_CODE_LINES} code lines skipped\n`,
);

if (results.length === 0) {
  console.log("No cross-project duplication found above the threshold.");
  // …but say so honestly. Found 2026-07-30 by reuse-scan.test.mjs: when EVERY group was filtered out (all
  // vendored primitives, or a `--new`/focus filter), this branch printed a flat "nothing found" and never
  // mentioned the groups it had hidden. That is the manufacture-calm failure this platform keeps catching —
  // the number is right and the sentence is misleading, and it is read as "the fleet is clean".
  const hidden = groups.length - results.length;
  if (hidden > 0) {
    console.log(
      `${hidden} group(s) hidden (vendored shadcn primitives, or filtered)` +
        `${flags.has("--all") ? "" : " — use --all to see them"}` +
        `${focus ? ` · focus: ${focus}` : ""}${flags.has("--new") ? " · --new" : ""}`,
    );
  }
} else {
  for (const g of results) {
    const tag = g.inCatalog ? "" : "  [NOT IN CATALOG]";
    console.log(`${g.verdict}  ${g.projectCount} projects${tag}`);
    g.members.forEach((m, i) => {
      const s = i === 0 ? "seed" : m.score.toFixed(2);
      console.log(
        `    ${s.padStart(4)}  ${m.project}/${m.path}  (${m.lines} lines)`,
      );
    });
    console.log(`    -> ${RULE[g.verdict]}\n`);
  }
  const extract = results.filter((r) => r.verdict === "EXTRACT").length;
  const candidate = results.filter((r) => r.verdict === "CANDIDATE").length;
  const uncatalogued = results.filter((r) => !r.inCatalog).length;
  const upstreamHidden = groups.length - results.length;
  console.log(
    `${results.length} group(s): ${extract} EXTRACT · ${candidate} CANDIDATE · ${uncatalogued} not in the catalog` +
      (upstreamHidden > 0 && !flags.has("--all")
        ? `\n${upstreamHidden} group(s) hidden (vendored shadcn primitives, or filtered) — use --all to see them`
        : ""),
  );
  console.log(
    "Report only. Extraction is a decision: diverged copies are not one asset.",
  );
}
