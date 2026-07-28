// Installer for the `ui-pattern-lock` hook — RUN BY A HUMAN, never by the agent.
//
// The agent is not allowed to write into `.claude/hooks/` (a hook steers every future session, so
// installing one is a human move — the propose-don't-install line, see skill-proposals/README.md).
// This script performs that install from the reviewed proposal, so the human does not have to
// hand-copy 80 lines. Read `ui-pattern-lock.md` first — this only moves what is written there.
//
//   node platform/skill-proposals/install-ui-pattern-lock.mjs
//
// Does two things, both idempotent:
//   1. extracts the ```javascript block of ui-pattern-lock.md -> .claude/hooks/ui-pattern-lock.mjs
//   2. registers that hook in the existing PreToolUse "Edit|Write|MultiEdit" group of .claude/settings.json
// Re-running it is safe: it overwrites the hook with the proposal's current text and never duplicates
// the settings entry.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..'); // platform/skill-proposals -> repo root
const proposal = path.join(here, 'ui-pattern-lock.md');
const hookPath = path.join(repo, '.claude', 'hooks', 'ui-pattern-lock.mjs');
const settingsPath = path.join(repo, '.claude', 'settings.json');
const COMMAND = 'node "${CLAUDE_PROJECT_DIR}/.claude/hooks/ui-pattern-lock.mjs"';

function fail(msg) {
  console.error(`install-ui-pattern-lock: ${msg}`);
  process.exit(1);
}

// --- 1. the hook file -------------------------------------------------------
if (!existsSync(proposal)) fail(`proposal not found: ${proposal}`);
const md = readFileSync(proposal, 'utf8');
const block = md.match(/```javascript\n([\s\S]*?)\n```/);
if (!block) fail('no ```javascript block in the proposal — did the file change shape?');
const code = block[1];
if (!code.includes('ui-patterns.json') || !code.includes('process.exit(2)'))
  fail('the extracted block does not look like the hook (missing registry read / block exit)');

mkdirSync(path.dirname(hookPath), { recursive: true });
const hookExisted = existsSync(hookPath);
writeFileSync(hookPath, `${code}\n`, 'utf8');
console.log(`${hookExisted ? 'updated' : 'created'}  .claude/hooks/ui-pattern-lock.mjs (${code.split('\n').length} lines)`);

// --- 2. register it in settings.json ----------------------------------------
if (!existsSync(settingsPath)) fail(`settings not found: ${settingsPath}`);
const raw = readFileSync(settingsPath, 'utf8');
const settings = JSON.parse(raw);
const groups = settings?.hooks?.PreToolUse;
if (!Array.isArray(groups)) fail('settings.json has no hooks.PreToolUse array — patch it by hand');

const group = groups.find((g) => g?.matcher === 'Edit|Write|MultiEdit');
if (!group) fail('no PreToolUse group with matcher "Edit|Write|MultiEdit" — patch it by hand');
group.hooks ??= [];

if (group.hooks.some((h) => String(h?.command ?? '').includes('ui-pattern-lock.mjs'))) {
  console.log('unchanged .claude/settings.json (hook already registered)');
} else {
  group.hooks.push({ type: 'command', command: COMMAND, timeout: 15 });
  // Match the file's existing 2-space indentation + trailing newline.
  writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
  console.log('updated  .claude/settings.json (registered the hook after secret-guard)');
}

console.log(
  '\nDone. It takes effect in the NEXT session (hooks are read at session start).\n' +
    'Sanity check now:\n' +
    '  echo {"session_id":"x","tool_input":{"file_path":"' +
    repo.replace(/\\/g, '/') +
    '/sakubun/components/items-table.tsx"}} | node .claude/hooks/ui-pattern-lock.mjs\n' +
    'Expected: it prints the locked patterns and exits 2. Then flip `status: installed` in the proposal.',
);
