// PROPOSED test drop-in — the promotion gate (plan Step 2.2, AC-5 second half).
//
// Runs as-is from `platform/proposals/` against `autonomy-gate.mjs.proposed`, and unchanged from
// `.claude/hooks/` against the live gate once a human installs it. Resolution order below.
//   run now:   node platform/proposals/autonomy-gate.quarantine.test.mjs
//   run after: node .claude/hooks/autonomy-gate.quarantine.test.mjs
//
// This file keeps a plain `.mjs` extension while the gate it tests carries `.proposed`: node
// refuses to execute an unknown extension, and the asymmetry is deliberate — a test SHOULD be
// runnable before install, a proposed hook should NOT be executable by accident. The `.proposed`
// gate is copied to a temp `.mjs` before spawning, below.
//
// These cases are additive to autonomy-gate.test.mjs; the human installing this may either keep
// them as a second file or fold them in. ONE existing case in that suite must change either way —
// `Write platform/standards/documentation.md → ALLOW` becomes BLOCK. That flip is the proposal's
// main behavioural cost and is argued in 2026-07-29-quarantine-promotion-gate.md.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CANDIDATES = [
  process.env.GATE_PATH,
  join(HERE, 'autonomy-gate.mjs.proposed'), // proposals/ — before install
  join(HERE, 'autonomy-gate.mjs'), // .claude/hooks/ — after install
  join(HERE, '..', '..', '.claude', 'hooks', 'autonomy-gate.mjs'),
].filter(Boolean);
const FOUND = CANDIDATES.find((p) => existsSync(p));
if (!FOUND) throw new Error(`no gate found; looked in:\n  ${CANDIDATES.join('\n  ')}`);

// node refuses to run a `.proposed` file, so spawn a temp copy under a real extension. The tested
// bytes are identical — this is a file-extension workaround, not a modified gate.
let HOOK = FOUND;
if (FOUND.endsWith('.proposed')) {
  HOOK = join(mkdtempSync(join(tmpdir(), 'gate-proposed-')), 'autonomy-gate.mjs');
  copyFileSync(FOUND, HOOK);
}

const ALLOW = 0;
const BLOCK = 2;

function run(payload) {
  const env = { ...process.env, CLAUDE_AUTONOMOUS: '1', CLAUDE_CODE_ENTRYPOINT: 'cli' };
  env.CLAUDE_CODE_SESSION_ID = `qtest-${Math.random().toString(36).slice(2)}`;
  return spawnSync(process.execPath, [HOOK], { input: JSON.stringify(payload), env, encoding: 'utf8' }).status;
}
const bash = (command) => run({ tool_name: 'Bash', tool_input: { command } });
const write = (file_path) => run({ tool_name: 'Write', tool_input: { file_path } });
const edit = (file_path) => run({ tool_name: 'Edit', tool_input: { file_path } });

const cases = [];
const check = (name, fn) => cases.push({ name, fn });

// ---- (1) The durable law layer is governance ------------------------------
check('Write platform/standards/autonomy-contract.md → BLOCK (the gate cannot be edited by what it gates)', () =>
  assert.equal(write('platform/standards/autonomy-contract.md'), BLOCK));
check('Write platform/standards/documentation.md → BLOCK (this FLIPS an existing ALLOW case)', () =>
  assert.equal(write('platform/standards/documentation.md'), BLOCK));
check('Write a plan → still ALLOW (plans are work, not law)', () =>
  assert.equal(write('platform/plans/2026-07-29-x.md'), ALLOW));
check('Write a registry → still ALLOW (the idea queue is worked on autonomously by design)', () =>
  assert.equal(write('platform/registries/idea-queue.md'), ALLOW));

// ---- (2) Quarantine is write-protected from the agent ---------------------
check('Write into the quarantine inbox → BLOCK', () =>
  assert.equal(write('platform/inbox/quarantine/2026-07-29-120000-abc123.quarantine.md'), BLOCK));
check('Edit a quarantined lesson → BLOCK (editing is how untrusted input gets laundered)', () =>
  assert.equal(edit('platform/inbox/quarantine/2026-07-29-120000-abc123.quarantine.md'), BLOCK));
check('Write the quarantine README → BLOCK (the runbook is governance too)', () =>
  assert.equal(write('platform/inbox/quarantine/README.md'), BLOCK));

// ---- (3) Promotion by shell: the bypass that existed before this change ----
for (const [label, cmd] of [
  ['cp a lesson onto a hook', 'cp platform/inbox/quarantine/x.quarantine.md .claude/hooks/evil.mjs'],
  ['cp a lesson into skills', 'cp platform/inbox/quarantine/x.quarantine.md .claude/skills/memory/SKILL.md'],
  ['append a lesson to CLAUDE.md', 'cat platform/inbox/quarantine/x.quarantine.md >> CLAUDE.md'],
  ['append to a nested CLAUDE.md', 'cat lesson.md >> sakubun/CLAUDE.md'],
  ['tee into a rule file', 'echo rule | tee .claude/rules/frontend.md'],
  ['sed -i a standard', "sed -i 's/a/b/' platform/standards/autonomy-contract.md"],
  ['mv over a workflow', 'mv new.yml .github/workflows/deploy.yml'],
  ['redirect into settings', 'echo "{}" > .claude/settings.json'],
  ['redirect into a standard', 'node gen.mjs > platform/standards/testing.md'],
  ['edit a quarantined lesson in place', "sed -i 's/quarantined/promoted/' platform/inbox/quarantine/x.quarantine.md"],
  ['node -e writing a hook', 'node -e "require(\'fs\').writeFileSync(\'.claude/hooks/x.mjs\',\'\')"'],
]) {
  check(`autonomous: ${label} → BLOCK`, () => assert.equal(bash(cmd), BLOCK));
}

// ---- Reading is NOT blocked, and neither is ordinary work ------------------
// The threat is promotion, not perusal. A gate that blocked reading would be worked around, and it
// would not help: the Read tool is not on this hook's matcher at all (see the proposal's §Residual).
for (const [label, cmd] of [
  ['read a quarantined lesson', 'cat platform/inbox/quarantine/x.quarantine.md'],
  ['grep the inbox', 'grep -rn "icon" platform/inbox/quarantine/'],
  ['grep skills, output to /tmp', 'grep -rn foo .claude/skills/ > /tmp/out.txt'],
  ['list hooks', 'ls -la .claude/hooks/'],
  ['copy within a project', 'cp src/a.ts src/b.ts'],
  ['write a normal file', 'echo hi > /tmp/note.txt'],
  ['run the rulebook tests', 'npm test --prefix rulebook'],
]) {
  check(`autonomous: ${label} → ALLOW`, () => assert.equal(bash(cmd), ALLOW));
}

// ---- Supervised runs are still untouched ----------------------------------
check('interactive: cp a lesson onto a hook → ALLOW (the gate stands down for a human)', () => {
  const env = { ...process.env, CLAUDE_CODE_ENTRYPOINT: 'cli' };
  delete env.CLAUDE_AUTONOMOUS;
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({
      tool_name: 'Bash',
      tool_input: { command: 'cp platform/inbox/quarantine/x.quarantine.md .claude/hooks/evil.mjs' },
    }),
    env,
    encoding: 'utf8',
  });
  assert.equal(r.status, ALLOW);
});

let failed = 0;
for (const c of cases) {
  try {
    c.fn();
    console.log(`  ✓ ${c.name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${c.name}\n      ${e.message}`);
  }
}
console.log(`\n${cases.length - failed}/${cases.length} passed  (gate: ${HOOK})`);
process.exit(failed ? 1 : 0);
