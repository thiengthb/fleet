#!/usr/bin/env node
/**
 * PROPOSAL — adds a top-level `permissions: contents: read` to every workflow that lacks one.
 *
 * The agent may not edit `.github/workflows/**` (governance; the CVE-2025-53773 lesson), so this
 * script exists to be run by a human. It is the finding of `@thiengthb/test-ci-hardening` RULE 1,
 * measured 2026-07-30: 0 of 8 workflows on this platform declared top-level permissions, so every job
 * without its own block inherited the repository default token scope — which on an older repo is
 * read/write. The jobs that actually matter are the `test` jobs in journal / todo / sakubun and both
 * jobs in commons/registry.yml: they run `npm ci`, i.e. arbitrary dependency postinstall scripts.
 *
 * Why this is safe, verified before writing it: job-level `permissions` REPLACES the workflow-level
 * block rather than merging with it, so adding a narrower default would break any job whose own block
 * omitted something it needs. All 7 existing job-level blocks already declare BOTH `contents: read`
 * and `packages: write`, so nothing is taken away from them.
 *
 * Scope: this does NOT pin actions to commit SHAs. That is RULE 2 of the same gate and remains open by
 * decision — published guidance targets third-party actions, and this fleet uses only `actions/*` and
 * `docker/*`. Flip `"strict": true` in a repo's `docs/gates.json` to take the stronger position.
 *
 *   node platform/proposals/2026-07-30-workflow-permissions.mjs           # show the plan, change nothing
 *   node platform/proposals/2026-07-30-workflow-permissions.mjs --apply   # write the files
 *
 * Then, per repo: git add .github/workflows && git commit -m "ci: least-privilege default token scope"
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const APPLY = process.argv.includes('--apply');

const BLOCK = [
  '# Least privilege by DEFAULT: without this block every job inherits the repository default token',
  '# scope, which on an older repo is read/write. A job that runs `npm ci` executes arbitrary dependency',
  '# postinstall scripts and must not hold a token that can push. Jobs widen this individually.',
  'permissions:',
  '  contents: read',
  '',
];

/** Discover workflow dirs by SHAPE, so a repo-layout change cannot silently narrow the search. */
function workflowDirs(dir, depth = 0, out = []) {
  if (depth > 2) return out;
  const wf = join(dir, '.github', 'workflows');
  if (existsSync(wf)) out.push(wf);
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.') || entry === 'node_modules') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) workflowDirs(full, depth + 1, out);
  }
  return out;
}

const files = workflowDirs(ROOT)
  .flatMap((dir) => readdirSync(dir).map((f) => join(dir, f)))
  .filter((f) => /\.ya?ml$/.test(f))
  .sort();

let changed = 0;
let already = 0;

for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  const rel = file.slice(ROOT.length + 1);

  if (lines.some((l) => /^permissions:/.test(l))) {
    already++;
    console.log(`  ok    ${rel} — already declares top-level permissions`);
    continue;
  }

  // Insert before the top-level `jobs:` key: always valid at the document's top level.
  const at = lines.findIndex((l) => /^jobs:/.test(l));
  if (at === -1) {
    console.log(`  SKIP  ${rel} — no top-level \`jobs:\` found, needs a look by hand`);
    continue;
  }

  lines.splice(at, 0, ...BLOCK);
  changed++;
  console.log(`  ${APPLY ? 'write' : 'would'} ${rel} — insert at line ${at + 1} (before \`jobs:\`)`);
  if (APPLY) writeFileSync(file, lines.join('\n'));
}

console.log(
  `\n${files.length} workflow(s): ${changed} ${APPLY ? 'changed' : 'to change'}, ${already} already compliant.`,
);
if (!APPLY && changed) console.log('Re-run with --apply to write. Nothing has been modified.');
