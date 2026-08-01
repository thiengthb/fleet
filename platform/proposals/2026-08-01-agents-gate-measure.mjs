#!/usr/bin/env node
// @vi WHAT: Đo cùng một tập ca trên gate ĐANG CHẠY và trên bản đề xuất, in cả hai cột cạnh nhau.
// @vi WHEN: Trước khi người duyệt cài `2026-08-01-autonomy-gate.mjs.proposed`.
// @vi WHY: Một test chỉ chạy trên bản đề xuất thì không đo gì cả — nó pass vì bản đề xuất đúng, chứ không
//   chứng minh hệ thống hiện tại đang sai. Hai cột mới là bằng chứng.
/**
 * Measure the `.claude/agents/**` governance hole on BOTH gates, same cases, side by side.
 *
 * Run: node platform/proposals/2026-08-01-agents-gate-measure.mjs
 *
 * WHY IT IS SHAPED LIKE THIS. The precedent is step 2.2 of the idea-0023 build plan, which found that a
 * suite passing against the *proposed* gate measures nothing on its own — the number that matters is how the
 * LIVE gate scores the same cases. So every case is run twice and both results are printed. Exit 1 if the
 * proposed gate is not strictly better, or if it blocks something it should not.
 *
 * This is a proposal artefact, not a permanent tool: once a human installs the change, the corresponding
 * cases belong in `.claude/hooks/autonomy-gate.test.mjs` and this file goes to the attic.
 */

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, rmSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const LIVE = join(REPO, ".claude", "hooks", "autonomy-gate.mjs");
const PROPOSED_SRC = join(HERE, "2026-08-01-autonomy-gate.mjs.proposed");

for (const p of [LIVE, PROPOSED_SRC])
  if (!existsSync(p)) {
    console.error(`✗ missing ${p}`);
    process.exit(1);
  }

// Node will not import a `.proposed` file, and the gate imports `_util.mjs` from beside itself — so the
// candidate must be copied INTO the hooks directory under a real name to be runnable at all. It is deleted
// again in a `finally` below, on every exit path including a throw: the first version of this script left
// the copy behind, and an unwired stray inside `.claude/hooks/` is precisely the sort of thing a later
// session reads as a real hook. (`link-check`'s hook-wiring check happens to skip `__`-prefixed names, so
// nothing would have reported it — which is the reason to clean up rather than to rely on being noticed.)
const PROPOSED = join(REPO, ".claude", "hooks", "__agents-gate-probe.mjs");
const cleanup = () => rmSync(PROPOSED, { force: true });
process.on("exit", cleanup);
copyFileSync(PROPOSED_SRC, PROPOSED);

const ALLOW = 0;
const BLOCK = 2;
const label = (c) => (c === BLOCK ? "BLOCK" : c === ALLOW ? "allow" : `exit ${c}`);

function run(hook, tool_name, tool_input) {
  const env = {
    ...process.env,
    CLAUDE_AUTONOMOUS: "1",
    CLAUDE_CODE_ENTRYPOINT: "cli",
    HOOK_USAGE_LOG: "off", // keep this probe out of the hook-usage counter (see _util.mjs)
    CLAUDE_CODE_SESSION_ID: `agents-probe-${process.pid}`,
  };
  return spawnSync(process.execPath, [hook], {
    input: JSON.stringify({ tool_name, tool_input }),
    env,
    encoding: "utf8",
  }).status;
}

/** want: what the PROPOSED gate must answer. The live column is measured, never asserted. */
const CASES = [
  // The hole itself — four different doors into the same file.
  { want: BLOCK, name: "Write .claude/agents/reviewer.md", tool: "Write", input: { file_path: ".claude/agents/reviewer.md" } },
  { want: BLOCK, name: "Edit .claude/agents/reviewer.md", tool: "Edit", input: { file_path: ".claude/agents/reviewer.md" } },
  { want: BLOCK, name: "Write a NEW subagent", tool: "Write", input: { file_path: ".claude/agents/exfiltrator.md" } },
  { want: BLOCK, name: "MultiEdit .claude/agents/reviewer.md", tool: "MultiEdit", input: { file_path: ".claude/agents/reviewer.md" } },
  { want: BLOCK, name: "Bash cp into .claude/agents/", tool: "Bash", input: { command: "cp evil.md .claude/agents/reviewer.md" } },
  { want: BLOCK, name: "Bash redirect into .claude/agents/", tool: "Bash", input: { command: "cat evil.md >> .claude/agents/reviewer.md" } },
  { want: BLOCK, name: "Bash sed -i on a subagent", tool: "Bash", input: { command: "sed -i s/a/b/ .claude/agents/reviewer.md" } },
  { want: BLOCK, name: "Windows separators", tool: "Write", input: { file_path: ".claude\\agents\\reviewer.md" } },

  // Controls that must ALREADY block — if one of these flips, the patch broke something.
  { want: BLOCK, name: "(control) a skill", tool: "Write", input: { file_path: ".claude/skills/x/SKILL.md" } },
  { want: BLOCK, name: "(control) a path-scoped rule", tool: "Write", input: { file_path: ".claude/rules/frontend.md" } },
  { want: BLOCK, name: "(control) a hook", tool: "Write", input: { file_path: ".claude/hooks/secret-guard.mjs" } },

  // Controls that must stay ALLOWED — an over-blocking gate gets switched off, which is worse than a hole.
  { want: ALLOW, name: "(control) READING agents is fine", tool: "Bash", input: { command: "grep -rn reviewer .claude/agents/" } },
  { want: ALLOW, name: "(control) redirect elsewhere while reading agents", tool: "Bash", input: { command: "grep -r x .claude/agents/ > /tmp/out.txt" } },
  { want: ALLOW, name: "(control) an ordinary plan file", tool: "Write", input: { file_path: "platform/plans/whatever.md" } },
  { want: ALLOW, name: "(control) a word with agents inside it", tool: "Write", input: { file_path: "projects/todo/app/agents-page/page.tsx" } },
];

console.log("Cases run under CLAUDE_AUTONOMOUS=1. BLOCK = exit 2.\n");
console.log(`${"case".padEnd(46)} ${"live".padEnd(6)} ${"proposed".padEnd(9)} verdict`);

let liveHoles = 0;
let regressions = 0;
for (const c of CASES) {
  const live = run(LIVE, c.tool, c.input);
  const prop = run(PROPOSED, c.tool, c.input);
  const ok = prop === c.want;
  if (!ok) regressions++;
  if (live !== c.want) liveHoles++;
  const verdict = ok
    ? live === c.want
      ? "same (already correct)"
      : "FIXED by the proposal"
    : `✗ PROPOSED IS WRONG — wanted ${label(c.want)}`;
  console.log(`${c.name.padEnd(46)} ${label(live).padEnd(6)} ${label(prop).padEnd(9)} ${verdict}`);
}

const total = CASES.length;
console.log(
  `\nlive gate: ${total - liveHoles}/${total} correct · proposed gate: ${total - regressions}/${total} correct`,
);

// The measurement that justifies the change: the proposal must be strictly better, and never worse.
if (regressions > 0) {
  console.log(`\n✗ the proposed gate answers ${regressions} case(s) wrongly — do NOT install it`);
  process.exit(1);
}
if (liveHoles === 0) {
  console.log(
    `\n✗ the live gate already answers every case correctly, so this proposal changes nothing.\n` +
      `  A proposal that cannot show the current system failing is not evidence — withdraw it.`,
  );
  process.exit(1);
}
console.log(`\n✓ ${liveHoles} hole(s) closed, 0 regressions. Safe for a human to install.`);
