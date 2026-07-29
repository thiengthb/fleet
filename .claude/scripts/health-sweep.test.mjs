// Test for health-sweep.mjs — the one command that summarises every other checker.
// Run: node .claude/scripts/health-sweep.test.mjs
//
// WHY THIS EXISTS, precisely. On its first run this summariser reported `ok` for skill-audit while
// skill-audit was reporting **14 findings**: the parser looked for `NO-SUBSTRATE` and the heading says
// `NO SUBSTRATE (14)`. That is the worst possible defect in a tool of this kind — it does not fail, it
// MANUFACTURES CALM, and it does so at exactly the moment someone is checking whether things are fine.
//
// So the suite does not ask "does the sweep run". It asks: **if a sub-checker screams, does the sweep pass
// it through?** Each case replaces one sub-checker with a stub that fails or reports findings, and asserts
// the verdict changes accordingly. A summariser is only as trustworthy as its worst parser.
//
// Method: the sweep resolves its sub-checkers relative to its own directory, so the whole `.claude/scripts`
// tree is copied to a temp dir and individual checkers are replaced with stubs. The real repo is never
// touched, and the real checkers are never made to fail.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, cpSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");

/**
 * A sandbox where EVERY sub-checker is a fast healthy stub, and then one is replaced with the case under
 * test. This is not just a speed trick, though the first version took >120s and had to be killed: what is
 * being tested is the sweep's PARSING and verdict logic, so running the eight real checkers (one of which
 * mines 100MB of transcripts) per case would make the suite slow, flaky and dependent on the repo's mood.
 * The real checkers are still exercised once, live, in case 1.
 */
const HEALTHY = {
  "link-check.mjs": 'console.log("link-check — 6 wire(s) checked, 0 broken");',
  "recurrence-check.mjs":
    'console.log("recurrence-check — 3 detector(s), 0 firing");',
  "tool-check.mjs":
    'console.log("6/6 test file(s) pass · 5/25 tools have a test");',
  "plan-audit.mjs":
    "console.log(JSON.stringify({ scanned: 60, errors: 0, warns: 0, results: [] }));",
  "memory-audit.mjs":
    'console.log("index: 47 lines / 7.4KB (cap 200 lines / 25KB)");',
  "skill-audit.mjs":
    'console.log("38 skills installed");\nconsole.log("── NO SUBSTRATE (0) ──");',
  "reuse-scan.mjs": 'console.log("22 group(s): 0 EXTRACT · 8 CANDIDATE");',
  "usage-census.mjs":
    "console.log(JSON.stringify({ scanned: { files: 9, events: 100 }, rows: [] }));",
};

function sandbox() {
  const root = mkdtempSync(join(tmpdir(), "health-sweep-"));
  // The layout must mirror the real one: health-sweep derives the repo root as two levels up from itself
  // and then looks for `<root>/.claude/scripts/<checker>`. A flatter sandbox makes every checker "missing"
  // rather than stubbed, so the cases would pass for entirely the wrong reason.
  const dir = join(root, ".claude", "scripts");
  mkdirSync(dir, { recursive: true });
  cpSync(join(HERE, "health-sweep.mjs"), join(dir, "health-sweep.mjs"));
  for (const [name, body] of Object.entries(HEALTHY))
    writeFileSync(join(dir, name), body);
  return root;
}

const scriptsOf = (root) => join(root, ".claude", "scripts");

const runSweep = (scriptsDir) => {
  const r = spawnSync(
    process.execPath,
    [join(scriptsDir, "health-sweep.mjs"), "--quiet"],
    {
      encoding: "utf8",
      cwd: REPO,
      timeout: 180_000,
    },
  );
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
};

/* ───────────────────────────────────────────────────────────────────── NOT tested here: the LIVE sweep ──
 *
 * The first version of this file ran the real sweep against the real repo as case 1. That sweep runs
 * `tool-check`, which runs every `*.test.mjs` — INCLUDING THIS ONE — which ran the sweep again. The suite
 * took 2m18s of almost pure waiting and was killed twice before the shape of it was obvious: a test that
 * invokes the tool that invokes all tests is unbounded recursion, and timeouts were the only thing ending it.
 *
 * So the live sweep is deliberately NOT called from here. It is exercised every time anyone runs it, and its
 * verdict is the thing being reported; what needs a standing test is the parsing and verdict logic, which the
 * sandbox below covers precisely and in about a second.
 */

/* ─────── 1b. the sandbox itself must be green, or every case below would pass for the wrong reason ── */
{
  const root = sandbox();
  const { code, out } = runSweep(scriptsOf(root));
  assert.equal(
    code,
    0,
    `the all-healthy sandbox must be green, else the stub cases prove nothing:\n${out}`,
  );
  assert.match(out, /VERDICT: nothing broken/, out);
  rmSync(root, { recursive: true, force: true });
}

/* ─────────────────────────── 2. a sub-checker that FAILS must surface as BROKEN, never as ok ── */

const STUBS = [
  {
    id: "link-check",
    what: "a wire checker that reports broken wires",
    stub: `console.log("link-check — 6 wire(s) checked, 3 broken"); process.exit(1);`,
  },
  {
    id: "recurrence-check",
    what: "a recurrence detector that is firing",
    stub: `console.log("recurrence-check — 3 detector(s), 2 firing"); process.exit(1);`,
  },
  {
    id: "tool-check",
    what: "a test runner with failing tests",
    stub: `console.log("4/6 test file(s) pass — 2 FAILING · 5/25 tools have a test"); process.exit(1);`,
  },
  {
    id: "plan-audit",
    what: "a checker whose --json output is not JSON (a silent parse failure)",
    stub: `console.log("this is not json at all"); process.exit(0);`,
  },
  {
    id: "usage-census",
    what: "a census whose --json output is not JSON",
    stub: `console.log("also not json"); process.exit(0);`,
  },
  {
    id: "memory-audit",
    what: "an audit that exits non-zero",
    stub: `console.log("memory audit exploded"); process.exit(1);`,
  },
];

for (const s of STUBS) {
  const root = sandbox();
  const dir = scriptsOf(root);
  writeFileSync(join(dir, `${s.id}.mjs`), s.stub);
  const { code, out } = runSweep(dir);
  assert.equal(
    code,
    1,
    `SWEEP SWALLOWED A FAILURE: ${s.what} (${s.id})\n${out}`,
  );
  assert.match(
    out,
    new RegExp(`BROKEN\\s+\\d+\\s+${s.id}`),
    `${s.id} must be reported as BROKEN for: ${s.what}\n${out}`,
  );
  assert.match(
    out,
    /VERDICT: \d+ BROKEN/,
    `the verdict line must say BROKEN\n${out}`,
  );
  rmSync(root, { recursive: true, force: true });
}

/* ───────────── 3. the regression that caused this file: a findings COUNT must not be read as zero ── */
{
  const root = sandbox();
  const dir = scriptsOf(root);
  // Verbatim shape of skill-audit's real output, including the space in "NO SUBSTRATE" that the first
  // parser missed and the hyphenated form that appears in its closing advisory line.
  writeFileSync(
    join(dir, "skill-audit.mjs"),
    `console.log("SKILL AUDIT — report only, nothing was uninstalled");
console.log("38 skills installed");
console.log("── NO SUBSTRATE (14) — nothing in this repo for these to act on ──");
console.log("NO-SUBSTRATE is a strong signal, not a verdict.");`,
  );
  const { out } = runSweep(dir);
  assert.match(
    out,
    /drift\s+14\s+skill-audit/,
    `14 findings must be reported as drift 14, not as ok — this is the 2026-07-30 defect:\n${out}`,
  );
  assert.doesNotMatch(
    out,
    /ok\s+skill-audit/,
    "skill-audit must not read as ok while reporting 14 findings",
  );
  rmSync(root, { recursive: true, force: true });
}

/* ───────────── 4. drift must NEVER fail the run — otherwise the honest signal gets silenced ── */
{
  const root = sandbox();
  const dir = scriptsOf(root);
  writeFileSync(
    join(dir, "skill-audit.mjs"),
    `console.log("38 skills installed");\nconsole.log("── NO SUBSTRATE (9) ──");`,
  );
  const { code, out } = runSweep(dir);
  assert.equal(
    code,
    0,
    `drift alone must exit 0 — a sweep that fails on decay is a sweep people stop running:\n${out}`,
  );
  assert.match(out, /VERDICT: nothing broken/, "drift is not brokenness");
  rmSync(root, { recursive: true, force: true });
}

console.log(
  `health-sweep.test.mjs — healthy sandbox green, ${STUBS.length} sub-checker failures each surfaced as BROKEN, the count-parsed-as-zero regression covered, drift never fails the run  ✅`,
);
