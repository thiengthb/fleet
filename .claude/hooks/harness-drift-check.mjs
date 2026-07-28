#!/usr/bin/env node
/**
 * harness-drift-check.mjs — SessionStart. Advisory, non-blocking. Silent unless the harness changed.
 *
 * Trigger T1 of the self-update loop: **when the tool you run inside gets upgraded, ask once whether it
 * just shipped something you hand-rolled.**
 *
 * Why. Between 2026-06-14 and 06-20 this platform spent ~6 sessions building "auto-pilot": an external
 * orchestrator relaunching a fresh `claude -p` per batch, a scheduled Windows-Task wrapper, and a two-way
 * Discord control plane with RS256-signed single-use approval tokens. It worked. On 2026-07-28 all of it
 * was deleted, because Claude Code had since shipped scheduled cloud agents and remote execution natively.
 * Nothing about the process was wrong — research-before-design ran, the gate was exhaustively tested,
 * propose-don't-execute held. The *premise* expired and no step ever re-checked it.
 *
 * Polling for that is the wrong shape: the answer changes about once per release, so a weekly research job
 * would burn sessions to find nothing. A version bump is the cheap, precise trigger.
 *
 * Cost: no subprocess. The installed version is the basename of CLAUDE_CODE_EXECPATH
 * (…/versions/2.1.220), so this is an env read plus one small JSON file.
 *
 * Exit code is always 0 — SessionStart cannot block, and this must never be why a session won't start.
 */

import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASELINE = join(REPO, '.claude', 'harness-baseline.json');

// Compaction re-runs SessionStart; a version can't change mid-session, so don't re-nag.
let source = '';
try {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (raw) source = JSON.parse(raw)?.source ?? '';
} catch {
  /* no payload / unparseable — treat as a normal start */
}
if (source === 'compact') process.exit(0);

/** `…/versions/2.1.220` → `2.1.220`. Falls back to nothing rather than guessing. */
function installedVersion() {
  const p = process.env.CLAUDE_CODE_EXECPATH || '';
  const base = p ? basename(p) : '';
  return /^\d+\.\d+\.\d+/.test(base) ? base : null;
}

const current = installedVersion();
if (!current || !existsSync(BASELINE)) process.exit(0);

let baseline;
try {
  baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
} catch {
  process.exit(0); // a malformed baseline is not worth blocking a session over
}

const reviewed = baseline.reviewedVersion;
if (!reviewed || reviewed === current) process.exit(0);

const message =
  `Claude Code changed: ${reviewed} (last reviewed) → ${current} (installed).\n` +
  `T1 self-update check — do this ONCE, then move on:\n` +
  `  1. Read the changelog/docs for ${current} with exactly one question in mind:\n` +
  `     "did the harness just ship something this platform hand-rolled?"\n` +
  `  2. Anything it did → file it via /idea (propose, don't self-execute). Anything it didn't → nothing to do.\n` +
  `  3. Update .claude/harness-baseline.json (reviewedVersion + a findings entry) so this stops asking.\n` +
  `This trigger exists because ~6 sessions of auto-pilot were deleted on 2026-07-28 after the harness shipped\n` +
  `the same capability natively. Cheap and boring beats a standing research job: the official docs of the tool\n` +
  `you are running inside are the highest-yield source, and the easiest one to skip.`;

console.log(
  JSON.stringify({
    systemMessage: `🔄 harness upgraded ${reviewed} → ${current} — one-time review requested (see context)`,
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: message },
  }),
);
process.exit(0);
