#!/usr/bin/env node
// @vi WHAT: MỘT lệnh chạy hết test của mọi hook và script, rồi gọi tên công cụ nào chưa có test.
// @vi WHEN: Sau khi thêm hoặc sửa một hook/script.
// @vi WHY: Chủ trương của platform là "dùng công cụ để chính xác, nhưng đừng tin một công cụ mình chưa kiểm". Nửa sau đó
//   không làm được cho đến 2026-07-30. Một công cụ muốn được miễn test thì phải khai báo công khai kèm lý do, và một
//   lý do ngắn hơn một câu sẽ làm lệnh này thất bại — vì một ngoại lệ không ai đọc được thì không khác gì một lỗ hổng
//   không ai thấy.
//
/**
 * tool-check.mjs — ONE command that runs every test the agent's own tools have, and names the ones that
 * have none. Run: `node .claude/scripts/tool-check.mjs`
 *
 * WHY THIS EXISTS. The platform's doctrine is "use tools to be exact, but never trust a tool you have not
 * checked". Until 2026-07-30 there was no way to act on the second half: the tests that existed had to be
 * remembered and run one file at a time, so in practice they were run when someone was already suspicious
 * — which is the one moment a green suite tells you least. Measured that day: 3 of 11 hooks had a test,
 * 0 of 15 scripts did, and nothing listed the gap.
 *
 * IT REPORTS TWO THINGS, and the second matters as much as the first:
 *   1. PASS/FAIL for every `*.test.mjs` under `.claude/`.
 *   2. UNTESTED — every hook and script with no test file beside it. A gate with no test is not "probably
 *      fine", it is unverified; this list is the backlog, in the open, instead of in someone's memory.
 *
 * WHAT IT DOES NOT DO. It does not judge whether a test is any good — a file can pass here and assert
 * nothing. The defence against that is mutation testing (`standards/testing.md §2.5`), which the individual
 * suites do internally; this runner only reports that they ran.
 *
 * Usage:
 *   node .claude/scripts/tool-check.mjs            # run everything, then list what has no test
 *   node .claude/scripts/tool-check.mjs --quiet     # only failures + the summary line
 *   node .claude/scripts/tool-check.mjs --list      # list tests and gaps, run nothing
 *
 * Exit code: 1 if any test fails (so it can gate a commit), otherwise 0. An UNTESTED tool is reported but
 * never fails the run — that would make the honest thing (admitting the gap) the thing people silence.
 */

import { readdirSync, existsSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Repo-relative paths leave this runner POSIX-shaped on every OS (`_layout.mjs` explains why in full, and
 * `usage-census.mjs` does the same). Kept local rather than imported: the runner reports on every module in
 * this folder, so it must not stop running because one of them is mid-edit.
 */
const posix = (p) => String(p).replace(/\\/g, "/");

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLAUDE = join(REPO, ".claude");
const QUIET = process.argv.includes("--quiet");
const LIST_ONLY = process.argv.includes("--list");

const walk = (dir, out = []) => {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules") continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};

const all = walk(CLAUDE);
const tests = all.filter((f) => f.endsWith(".test.mjs")).sort();

/**
 * Tools that SHOULD have a test: every hook and script that is a real entry point.
 *
 * `_`-prefixed libraries USED to be excluded here as "covered through their callers". That reasoning only
 * holds for callers that have tests, and on 2026-07-30 it was hiding the two highest-fan-out pieces of
 * untested code on the platform: `_layout.mjs` (imported by five discovery tools, and written *because* a
 * folder move silenced four of them) and `_util.mjs` (imported by eleven hooks, and the sole evidence that
 * any hook ever fires). Both have suites now, so the exclusion is gone and the denominator tells the truth.
 */
const tools = all
  .filter((f) =>
    /\.claude\/(hooks|scripts)\/[^/]+\.mjs$/.test(f.replace(/\\/g, "/")),
  )
  .filter((f) => !f.endsWith(".test.mjs"))
  .sort();

/**
 * A tool may be exempt from needing a test — but only in the open, with a written reason, and never by
 * silence. This list IS the mechanism: it is printed on every run, it counts in the denominator, and a
 * reason shorter than a sentence is refused, exactly as `attic.mjs` refuses "unused" as a retirement reason.
 * An exemption nobody can read is indistinguishable from a gap nobody noticed.
 *
 * EMPTY as of 2026-07-30, and that is the interesting part. The one entry here was `eval-ledger-rule.mjs`,
 * exempt because it spawns `claude -p` twice. The exemption was honest and still wrong in scope: only
 * `runArm` needs a model, and extracting the rest behind a main-guard made it testable for free — the suite
 * that followed immediately found a defect (`platform/registries/` was never created, so every arm of the
 * eval died before the model was asked anything). The lesson for the next entry: an exemption should name the
 * smallest untestable PART, because "this file calls a model" hid a file that could not run at all.
 */
const EXEMPT = [];
const EXEMPT_MIN_REASON = 40;
const exemptBad = EXEMPT.filter(
  (e) => (e.reason || "").trim().length < EXEMPT_MIN_REASON,
);
const exemptPaths = new Set(EXEMPT.map((e) => e.path));
const isExempt = (tool) =>
  exemptPaths.has(posix(relative(REPO, tool)));

const hasTest = (tool) => existsSync(tool.replace(/\.mjs$/, ".test.mjs"));
const untested = tools.filter((t) => !hasTest(t) && !isExempt(t));
const exempt = tools.filter((t) => isExempt(t));

if (LIST_ONLY) {
  console.log(`${tests.length} test file(s):`);
  for (const t of tests) console.log(`   ${posix(relative(REPO, t))}`);
  console.log(`\n${untested.length} tool(s) with no test:`);
  for (const t of untested) console.log(`   ${posix(relative(REPO, t))}`);
  console.log(`\n${exempt.length} exempt tool(s):`);
  for (const t of exempt) console.log(`   ${posix(relative(REPO, t))}`);
  process.exit(0);
}

let failed = 0;
const rows = [];
for (const t of tests) {
  const started = Date.now();
  const r = spawnSync(process.execPath, [t], {
    encoding: "utf8",
    timeout: 120_000,
  });
  const ms = Date.now() - started;
  const ok = r.status === 0;
  if (!ok) failed++;
  rows.push({
    file: posix(relative(REPO, t)),
    ok,
    ms,
    out: (r.stdout || "").trim(),
    err: (r.stderr || "").trim(),
  });
}

for (const r of rows) {
  if (r.ok && QUIET) continue;
  const tag = r.ok ? "PASS" : "FAIL";
  console.log(`${tag}  ${String(r.ms).padStart(5)}ms  ${r.file}`);
  if (r.ok) {
    if (r.out && !QUIET) console.log(`         ${r.out.split("\n").pop()}`);
  } else {
    const why = (r.err || r.out || "(no output)")
      .split("\n")
      .slice(0, 12)
      .join("\n         ");
    console.log(`         ${why}`);
  }
}

console.log(
  `\n${tests.length - failed}/${tests.length} test file(s) pass` +
    (failed ? ` — ${failed} FAILING` : "") +
    ` · ${tools.length - untested.length - exempt.length}/${tools.length} tools have a test` +
    (exempt.length ? ` · ${exempt.length} exempt with a written reason` : "") +
    (untested.length ? ` · ${untested.length} UNTESTED` : ""),
);

if (exempt.length) {
  console.log(
    `\nEXEMPT (a declared gap is a gap you can argue with; a silent one is not):`,
  );
  const present = new Set(exempt.map((t) => posix(relative(REPO, t))));
  for (const e of EXEMPT.filter((e) => present.has(e.path))) {
    console.log(`   ${e.path}`);
    for (const line of e.reason.match(/.{1,96}(\s|$)/g) || [e.reason])
      console.log(`      ${line.trim()}`);
  }
}

/**
 * A STALE exemption — one naming a tool that no longer exists — is drift in the direction that matters: it
 * makes the list look considered while covering nothing, and it is how a future author concludes the
 * mechanism is decorative. Reported, not fatal: the tool being gone is usually good news.
 */
const staleExempt = EXEMPT.filter(
  (e) => !tools.some((t) => posix(relative(REPO, t)) === e.path),
);
if (staleExempt.length) {
  console.log(
    `\n?? ${staleExempt.length} exemption(s) name a tool that is not here any more — delete the entry:`,
  );
  for (const e of staleExempt) console.log(`   ${e.path}`);
}

if (exemptBad.length) {
  console.log(
    `\n!! ${exemptBad.length} exemption(s) have no real reason (< ${EXEMPT_MIN_REASON} chars). ` +
      `"unused" is not a reason; say what makes a test impossible or worthless:`,
  );
  for (const e of exemptBad) console.log(`   ${e.path}`);
}

if (untested.length) {
  console.log(
    `\nUNTESTED (reported, never fails this run — a gap you can see beats a gap you cannot):`,
  );
  for (const t of untested) {
    const kind = t.includes(`${"hooks"}`) ? "hook  " : "script";
    console.log(`   ${kind}  ${posix(relative(REPO, t))}`);
  }
  console.log(
    `\n   Priority order is not file order: test the ones that BLOCK something first (a gate that fails\n` +
      `   open is a silent hole), then the ones a decision is read from, and leave pure reporters last.`,
  );
}

// An UNTESTED tool never fails the run — that would make admitting the gap the thing people silence. An
// exemption with no reason DOES fail it, because that is the one way this mechanism could rot into a
// blanket opt-out.
process.exit(failed || exemptBad.length ? 1 : 0);
