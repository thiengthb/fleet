// Test for tool-check.mjs — the runner that reports how much of this platform's tooling is verified.
// Run: node .claude/scripts/tool-check.test.mjs
//
// WHY THIS EXISTS, and it is the most circular-looking suite in the campaign for a good reason. Every
// coverage number in `platform/plans/2026-07-30-tool-test-coverage.md` came out of this script. If it
// silently skips a test file, miscounts the denominator, or exits 0 with a failing child, then the whole
// campaign's evidence is fiction — and the failure looks exactly like success. That is the same shape as the
// `health-sweep` defect that started all of this: a summariser does not break, it MANUFACTURES CALM.
//
// Three properties are therefore asserted directly rather than trusted:
//   1. it cannot fail to notice a failing test  (exit code + the FAILING count)
//   2. it cannot count a tool as tested without a test file beside it  (the denominator)
//   3. it cannot hide a gap  — an UNTESTED tool is always printed, and an EXEMPT one is printed WITH ITS
//      REASON. The exemption list is the one thing here that could rot into a blanket opt-out, so a reason
//      shorter than a sentence fails the run.
//
// Every case runs in a sandbox: the real repo's 26 suites take ~25s, and a test that re-runs them for each
// case would be the recursion trap that had to be removed from health-sweep.test.mjs.
//
// Per platform/standards/testing.md §2.5 the suite also MUTATES the script and asserts it notices.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const SCRIPT = join(HERE, "tool-check.mjs");

const write = (p, body) => {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, body);
};

const PASSING = 'console.log("fixture suite ok");\n';
const FAILING = 'console.error("fixture suite exploded");\nprocess.exit(1);\n';

/** A sandbox repo holding only the tools and suites a case needs. */
function sandbox({ files = {}, src = null } = {}) {
  const root = mkdtempSync(join(tmpdir(), "tool-check-"));
  const scripts = join(root, ".claude", "scripts");
  mkdirSync(scripts, { recursive: true });
  mkdirSync(join(root, ".claude", "hooks"), { recursive: true });
  writeFileSync(join(scripts, "tool-check.mjs"), src ?? readFileSync(SCRIPT, "utf8"));
  // The copy under test is itself a tool in the tree it scans, so it lands in the denominator and in the
  // UNTESTED list — which made every expected count in this file wrong by one. Giving it a stub suite keeps
  // the numbers about the FIXTURES, which is what each case is actually asserting.
  writeFileSync(join(scripts, "tool-check.test.mjs"), PASSING);
  for (const [rel, body] of Object.entries(files)) write(join(root, rel), body);
  return { root, script: join(scripts, "tool-check.mjs") };
}

function run(s, args = []) {
  const r = spawnSync(process.execPath, [s.script, ...args], {
    encoding: "utf8",
    timeout: 120_000,
    cwd: s.root,
  });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

/* ═══════════ 1. IT MUST NOT SWALLOW A FAILURE — the property everything else rests on ═══════════ */
{
  const s = sandbox({
    files: {
      ".claude/hooks/good.mjs": "// a tool\n",
      ".claude/hooks/good.test.mjs": PASSING,
      ".claude/scripts/bad.mjs": "// a tool\n",
      ".claude/scripts/bad.test.mjs": FAILING,
    },
  });
  const { code, out } = run(s);
  assert.equal(code, 1, `a failing suite MUST fail the run, or this script cannot gate a commit:\n${out}`);
  assert.match(out, /^FAIL\s+\d+ms\s+\.claude\/scripts\/bad\.test\.mjs/m, `the failing file must be named:\n${out}`);
  assert.match(out, /fixture suite exploded/, "…and its output shown, or nobody can act on it");
  assert.match(out, /1 FAILING/, "…and counted in the summary line, which is the line people read");
  assert.match(out, /^PASS\s+\d+ms\s+\.claude\/hooks\/good\.test\.mjs/m, "the passing one is still reported");
  rmSync(s.root, { recursive: true, force: true });
}

/* ═══════════ 2. the denominator: a tool counts as tested only if a test sits beside it ═══════════ */
{
  const s = sandbox({
    files: {
      ".claude/hooks/tested.mjs": "// x\n",
      ".claude/hooks/tested.test.mjs": PASSING,
      ".claude/scripts/naked.mjs": "// x\n",
      ".claude/scripts/also-naked.mjs": "// x\n",
      // A test file whose tool does not exist must not credit anything.
      ".claude/scripts/orphan.test.mjs": PASSING,
    },
  });
  const { code, out } = run(s);
  assert.equal(code, 0, "untested tools must NEVER fail the run — that would make admitting the gap the thing people silence");
  assert.match(
    out,
    /2\/4 tools have a test · 2 UNTESTED/,
    `the count must be exact — tools: tested, naked, also-naked, orphan.test? no. Got:\n${out}`,
  );
  assert.match(out, /UNTESTED \(reported, never fails this run/, "the gap must be labelled as a gap, not a failure");
  assert.match(out, /script\s+\.claude\/scripts\/naked\.mjs/, "each untested tool named");
  assert.match(out, /script\s+\.claude\/scripts\/also-naked\.mjs/);
  assert.match(
    out,
    /test the ones that BLOCK something first/,
    "the priority advice must survive — file order is the wrong order and the report has to say so",
  );
  rmSync(s.root, { recursive: true, force: true });
}

/* ═══════════ 3. THE REGRESSION: `_`-prefixed libraries are counted, not skipped ═══════════
 * They were excluded as "libraries, covered through their callers" — true only for callers that have tests,
 * and it hid the two highest-fan-out untested files on the platform.
 */
{
  const s = sandbox({
    files: {
      ".claude/scripts/_layout.mjs": "export const x = 1;\n",
      ".claude/hooks/_util.mjs": "export const y = 1;\n",
      ".claude/scripts/thing.mjs": "// x\n",
      ".claude/scripts/thing.test.mjs": PASSING,
    },
  });
  const { out } = run(s);
  assert.match(
    out,
    /2\/4 tools have a test · 2 UNTESTED/,
    `both libraries must appear in the denominator:\n${out}`,
  );
  assert.match(out, /\.claude\/scripts\/_layout\.mjs/, "_layout must be listed as untested when it is");
  assert.match(out, /\.claude\/hooks\/_util\.mjs/, "…and _util too");
  rmSync(s.root, { recursive: true, force: true });
}

/* ═══════════ 4. EXEMPT — a declared gap you can argue with, never a silent one ═══════════ */
{
  // LF-normalized: on a CRLF working tree (Windows) every multi-line mutation patch below would go stale.
  const src = readFileSync(SCRIPT, "utf8").replace(/\r\n/g, "\n");
  const exemptFor = (path, reason) =>
    src.replace(
      // Matches both the populated form and the empty `const EXEMPT = [];` the real file carries now that the
      // last exemption was closed — anchoring on `\n];` silently stopped injecting anything.
      /const EXEMPT = \[[\s\S]*?\];/,
      `const EXEMPT = [{ path: ${JSON.stringify(path)}, reason: ${JSON.stringify(reason)} }];`,
    );

  // (a) a good exemption: out of UNTESTED, into EXEMPT, still in the denominator, run stays green.
  const good = sandbox({
    src: exemptFor(
      ".claude/scripts/costly.mjs",
      "it spawns a billable model call, so a standing test would spend money re-deriving a recorded number.",
    ),
    files: {
      ".claude/scripts/costly.mjs": "// x\n",
      ".claude/scripts/thing.mjs": "// x\n",
      ".claude/scripts/thing.test.mjs": PASSING,
    },
  });
  const g = run(good);
  assert.equal(g.code, 0, `a properly reasoned exemption must not fail the run:\n${g.out}`);
  assert.match(
    g.out,
    /2\/3 tools have a test · 1 exempt with a written reason/,
    `the exempt tool stays in the denominator — hiding it would inflate the coverage ratio:\n${g.out}`,
  );
  assert.doesNotMatch(g.out, /UNTESTED/, "an exempt tool is not an untested one");
  assert.match(g.out, /EXEMPT \(a declared gap is a gap you can argue with/, "the block must be printed");
  assert.match(g.out, /spawns a billable model call/, "…with the reason, or it is just a quieter silence");
  rmSync(good.root, { recursive: true, force: true });

  // (b) an exemption with no real reason FAILS the run — this is the one way the mechanism could rot.
  const lazy = sandbox({
    src: exemptFor(".claude/scripts/costly.mjs", "too hard"),
    files: { ".claude/scripts/costly.mjs": "// x\n" },
  });
  const l = run(lazy);
  assert.equal(
    l.code,
    1,
    `"too hard" is not a reason. An exemption list that accepts anything is a blanket opt-out:\n${l.out}`,
  );
  assert.match(l.out, /exemption\(s\) have no real reason/, l.out);
  assert.match(l.out, /"unused" is not a reason/, "…and it must say what a reason looks like");
  rmSync(lazy.root, { recursive: true, force: true });

  // (c) --list shows the exemptions too, so the gap is visible without running anything.
  const listed = sandbox({
    src: exemptFor(
      ".claude/scripts/costly.mjs",
      "it spawns a billable model call, so a standing test would spend money re-deriving a recorded number.",
    ),
    files: { ".claude/scripts/costly.mjs": "// x\n" },
  });
  assert.match(run(listed, ["--list"]).out, /1 exempt tool\(s\):\n\s+\.claude\/scripts\/costly\.mjs/, "--list must show them");
  rmSync(listed.root, { recursive: true, force: true });

  // (d) a STALE exemption — one naming a tool that is gone — must be reported, and must not be fatal.
  // Left unreported it makes the list look considered while covering nothing, which is how a future author
  // concludes the whole mechanism is decorative.
  const stale = sandbox({
    src: exemptFor(
      ".claude/scripts/deleted-long-ago.mjs",
      "it spawned a billable model call, so a standing test would have spent money re-deriving a number.",
    ),
    files: { ".claude/scripts/thing.mjs": "// x\n", ".claude/scripts/thing.test.mjs": PASSING },
  });
  const st = run(stale);
  assert.equal(st.code, 0, "a stale exemption is drift, not brokenness — the tool being gone is usually good news");
  assert.match(st.out, /name a tool that is not here any more — delete the entry/, st.out);
  assert.match(st.out, /deleted-long-ago\.mjs/, "…and name it");
  rmSync(stale.root, { recursive: true, force: true });
}

/* ═══════════ 5. it must find every suite, wherever it sits, and run nothing under --list ═══════ */
{
  const marker = join(tmpdir(), `tool-check-ran-${process.pid}-${Math.random().toString(36).slice(2)}`);
  const s = sandbox({
    files: {
      ".claude/scripts/a.mjs": "// x\n",
      ".claude/scripts/a.test.mjs": `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(marker)}, "ran");\n`,
      // Nested one level deeper — the walker must recurse, not just read the two directories.
      ".claude/scripts/sub/b.test.mjs": PASSING,
      ".claude/hooks/c.test.mjs": PASSING,
      // node_modules must never be walked; a vendored suite is not this platform's suite.
      ".claude/scripts/node_modules/dep/d.test.mjs": FAILING,
    },
  });

  const list = run(s, ["--list"]);
  assert.equal(existsSync(marker), false, "--list must RUN NOTHING — it is the cheap way to see the gap");
  assert.match(list.out, /4 test file\(s\):/, `nested and hooks suites must be found, node_modules must not:\n${list.out}`);

  const full = run(s);
  assert.equal(existsSync(marker), true, "…and a normal run must actually execute them");
  assert.match(full.out, /4\/4 test file\(s\) pass/, `node_modules' failing suite must not be run:\n${full.out}`);
  assert.equal(full.code, 0);
  rmSync(marker, { force: true });
  rmSync(s.root, { recursive: true, force: true });
}

/* ═══════════ 6. --quiet keeps the failures and the summary, drops the noise ═══════════ */
{
  const s = sandbox({
    files: {
      ".claude/scripts/ok.mjs": "// x\n",
      ".claude/scripts/ok.test.mjs": PASSING,
      ".claude/scripts/bad.mjs": "// x\n",
      ".claude/scripts/bad.test.mjs": FAILING,
    },
  });
  const { code, out } = run(s, ["--quiet"]);
  assert.equal(code, 1, "--quiet must not change the verdict");
  assert.doesNotMatch(out, /^PASS/m, "passing rows are the noise --quiet exists to drop");
  assert.match(out, /^FAIL/m, "…but a failure must always be shown");
  assert.match(out, /1 FAILING/, "…and the summary always printed");
  rmSync(s.root, { recursive: true, force: true });
}

/* ═══════════ 7. a suite that hangs must not hang the runner ═══════════ */
{
  const s = sandbox({
    files: {
      ".claude/scripts/slow.mjs": "// x\n",
      ".claude/scripts/slow.test.mjs": "setTimeout(() => {}, 10 * 60 * 1000);\n",
    },
  });
  const src = readFileSync(SCRIPT, "utf8");
  assert.match(src, /timeout: 120_000/, "each child must be bounded, or one hung suite blocks every commit");
  rmSync(s.root, { recursive: true, force: true });
}

/* ═══════════ 8. the suite must NOTICE a broken runner (mutation) ═══════════ */
{
  // LF-normalized: on a CRLF working tree (Windows) every multi-line mutation patch below would go stale.
  const src = readFileSync(SCRIPT, "utf8").replace(/\r\n/g, "\n");

  const BASE = {
    ".claude/scripts/tested.mjs": "// x\n",
    ".claude/scripts/tested.test.mjs": PASSING,
    ".claude/scripts/naked.mjs": "// x\n",
    ".claude/hooks/_util.mjs": "export const y = 1;\n",
  };

  const mutants = [
    {
      name: "a failing suite no longer fails the run (a green light over red tests)",
      files: { ...BASE, ".claude/scripts/bad.mjs": "// x\n", ".claude/scripts/bad.test.mjs": FAILING },
      apply: (s) => s.replace("process.exit(failed || exemptBad.length ? 1 : 0);", "process.exit(0);"),
      probe: (s) => run(s).code === 0,
    },
    {
      name: "every tool counted as tested (the gap disappears)",
      files: BASE,
      apply: (s) =>
        s.replace(
          'const hasTest = (tool) => existsSync(tool.replace(/\\.mjs$/, ".test.mjs"));',
          "const hasTest = () => true;",
        ),
      probe: (s) => !/UNTESTED/.test(run(s).out),
    },
    {
      name: "the `_` library exclusion restored (the highest-fan-out files go invisible)",
      files: BASE,
      apply: (s) =>
        s.replace(
          '.filter((f) => !f.endsWith(".test.mjs"))\n  .sort();',
          '.filter((f) => !f.endsWith(".test.mjs"))\n  .filter((f) => !/[/\\\\]_/.test(f))\n  .sort();',
        ),
      probe: (s) => !/_util\.mjs/.test(run(s).out),
    },
    {
      name: "the UNTESTED list no longer printed (a gap nobody can see)",
      files: BASE,
      apply: (s) => s.replace("if (untested.length) {\n  console.log(\n    `\\nUNTESTED", "if (false) {\n  console.log(\n    `\\nUNTESTED"),
      probe: (s) => !/naked\.mjs/.test(run(s).out),
    },
    {
      name: "the empty-reason check removed (the exemption list becomes a blanket opt-out)",
      files: { ".claude/scripts/costly.mjs": "// x\n" },
      apply: (s) =>
        s
          .replace(
            // Matches both the populated form and the empty `const EXEMPT = [];` the real file carries now that the
      // last exemption was closed — anchoring on `\n];` silently stopped injecting anything.
      /const EXEMPT = \[[\s\S]*?\];/,
            'const EXEMPT = [{ path: ".claude/scripts/costly.mjs", reason: "meh" }];',
          )
          .replace("process.exit(failed || exemptBad.length ? 1 : 0);", "process.exit(failed ? 1 : 0);"),
      probe: (s) => run(s).code === 0,
    },
    {
      name: "exempt tools dropped from the denominator (the coverage ratio inflates)",
      files: { ".claude/scripts/costly.mjs": "// x\n", ...BASE },
      apply: (s) =>
        s
          .replace(
            // Matches both the populated form and the empty `const EXEMPT = [];` the real file carries now that the
      // last exemption was closed — anchoring on `\n];` silently stopped injecting anything.
      /const EXEMPT = \[[\s\S]*?\];/,
            'const EXEMPT = [{ path: ".claude/scripts/costly.mjs", reason: "it spawns a billable model call, so a standing test would spend money." }];',
          )
          // Inline, not via a helper: a helper declared after the `tools` list is a temporal-dead-zone
          // error, i.e. a crash mutant, which proves the suite notices a broken file and nothing else.
          .replace(
            '.filter((f) => !f.endsWith(".test.mjs"))\n  .sort();',
            '.filter((f) => !f.endsWith(".test.mjs"))\n  .filter((f) => !f.includes("costly.mjs"))\n  .sort();',
          ),
      // The harm is not a specific ratio, it is that the tool DISAPPEARS: dropped from the denominator, it
      // also drops out of the EXEMPT block, so the report no longer mentions it anywhere. Pinning an exact
      // ratio here would break whenever the fixture gains a file, which is how a brittle assertion teaches
      // the next author to loosen the wrong thing.
      // The harm is that the tool DISAPPEARS from the denominator. What makes it observable is the
      // stale-exemption check: once `costly.mjs` is no longer in `tools`, its exemption names a tool that is
      // not there, and the report says so. That check turns out to be load-bearing rather than cosmetic.
      probe: (s) => /name a tool that is not here any more/.test(run(s).out),
    },
  ];

  for (const m of mutants) {
    const mutated = m.apply(src);
    assert.notEqual(mutated, src, `mutation "${m.name}" changed nothing — the patch is stale`);
    const s = sandbox({ src: mutated, files: m.files });
    const sanity = run(s, ["--list"]);
    assert.match(
      sanity.out,
      /test file\(s\):/,
      `mutant "${m.name}" did not run — syntax error, not behaviour:\n${sanity.out.slice(0, 300)}`,
    );
    const killed = m.probe(s);
    rmSync(s.root, { recursive: true, force: true });
    assert.ok(killed, `SURVIVING MUTANT — "${m.name}" and the suite still passed. Add a case for it.`);
  }
}

/* ─────────── and the number this whole campaign is measured by, read from the real repo ──
 * Not a fixture: if the real run ever reports fewer tools than there are files, every coverage claim in the
 * plan is wrong. A floor, deliberately loose, so it fails on a regression and not on ordinary growth.
 */
{
  const r = spawnSync(process.execPath, [SCRIPT, "--list"], { encoding: "utf8", cwd: REPO });
  const suites = Number((/^(\d+) test file\(s\):/m.exec(r.stdout || "") || [])[1]);
  assert.ok(suites >= 20, `only ${suites} suites found in the real repo — the walker may have gone blind`);
}

console.log(
  "tool-check.test.mjs — a failing suite always fails the run, the denominator counts only real tests, " +
    "`_`-prefixed libraries included, EXEMPT declared with a reason (and a lazy reason failing the run), " +
    "--list runs nothing, node_modules never walked, --quiet keeps failures, 6 mutants all killed  ✅",
);
