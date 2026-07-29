#!/usr/bin/env node
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

/** Tools that SHOULD have a test: every hook and script that is a real entry point. */
const tools = all
  .filter((f) =>
    /\.claude\/(hooks|scripts)\/[^/]+\.mjs$/.test(f.replace(/\\/g, "/")),
  )
  .filter((f) => !f.endsWith(".test.mjs"))
  .filter((f) => !/[/\\]_/.test(f)) // _util.mjs / _layout.mjs are libraries, covered through their callers
  .sort();

const hasTest = (tool) => existsSync(tool.replace(/\.mjs$/, ".test.mjs"));
const untested = tools.filter((t) => !hasTest(t));

if (LIST_ONLY) {
  console.log(`${tests.length} test file(s):`);
  for (const t of tests) console.log(`   ${relative(REPO, t)}`);
  console.log(`\n${untested.length} tool(s) with no test:`);
  for (const t of untested) console.log(`   ${relative(REPO, t)}`);
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
    file: relative(REPO, t),
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
    ` · ${tools.length - untested.length}/${tools.length} tools have a test`,
);

if (untested.length) {
  console.log(
    `\nUNTESTED (reported, never fails this run — a gap you can see beats a gap you cannot):`,
  );
  for (const t of untested) {
    const kind = t.includes(`${"hooks"}`) ? "hook  " : "script";
    console.log(`   ${kind}  ${relative(REPO, t)}`);
  }
  console.log(
    `\n   Priority order is not file order: test the ones that BLOCK something first (a gate that fails\n` +
      `   open is a silent hole), then the ones a decision is read from, and leave pure reporters last.`,
  );
}

process.exit(failed ? 1 : 0);
