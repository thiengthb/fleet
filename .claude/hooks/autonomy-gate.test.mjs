// e2e test for autonomy-gate.mjs — the deterministic gate for unattended runs.
// Spawns the hook as a subprocess with a stdin payload; asserts exit code (0 = allow, 2 = block).
// Run: node .claude/hooks/autonomy-gate.test.mjs
//
// 2026-07-28: rewritten when the home-grown auto-pilot and its Discord control plane were retired
// (superseded by Claude Code's native scheduled/remote agents). The old suite spent ~120 lines on
// RSA token minting to exercise a signed-approval release path that no longer exists; `git push`
// and `gh pr create` are now plainly blocked in autonomous mode. What survives is what actually
// protects anything: the governance-write blocks, the T4 command denies, and the stand-down.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, 'autonomy-gate.mjs');

const ALLOW = 0;
const BLOCK = 2;

function run(payload, { autonomous = true, entrypoint = 'cli', sid } = {}) {
  const env = { ...process.env };
  if (autonomous) env.CLAUDE_AUTONOMOUS = '1';
  else delete env.CLAUDE_AUTONOMOUS;
  // The trigger reads the entrypoint, so tests must pin it rather than inherit the runner's.
  if (entrypoint === null) delete env.CLAUDE_CODE_ENTRYPOINT;
  else env.CLAUDE_CODE_ENTRYPOINT = entrypoint;
  env.CLAUDE_CODE_SESSION_ID = sid ?? `test-${Math.random().toString(36).slice(2)}`;
  // The suite fires the gate ~76 times per run; without this it would be the loudest entry in the
  // hook-usage counter that `_util.mjs` keeps, and that counter exists to measure REAL firing.
  env.HOOK_USAGE_LOG = 'off';
  const r = spawnSync(process.execPath, [HOOK], {
    input: typeof payload === 'string' ? payload : JSON.stringify(payload),
    env,
    encoding: 'utf8',
  });
  return r.status;
}

/** Same, but returns stdout too — for the unknown-entrypoint notice. */
function runFull(payload, opts) {
  const env = { ...process.env };
  if (opts.autonomous) env.CLAUDE_AUTONOMOUS = '1';
  else delete env.CLAUDE_AUTONOMOUS;
  env.CLAUDE_CODE_ENTRYPOINT = opts.entrypoint;
  env.CLAUDE_CODE_SESSION_ID = opts.sid;
  env.HOOK_USAGE_LOG = 'off';
  return spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify(payload),
    env,
    encoding: 'utf8',
  });
}

const bash = (command, opts) => run({ tool_name: 'Bash', tool_input: { command } }, opts);
const write = (file_path, opts) => run({ tool_name: 'Write', tool_input: { file_path } }, opts);
const edit = (file_path, opts) => run({ tool_name: 'Edit', tool_input: { file_path } }, opts);

const cases = [];
const check = (name, fn) => cases.push({ name, fn });

// ---- Stand-down: supervised runs must never be disrupted -------------------
check('interactive: git push origin main → ALLOW (gate stands down)', () =>
  assert.equal(bash('git push origin main', { autonomous: false }), ALLOW));
check('interactive: write to a hook → ALLOW (gate stands down)', () =>
  assert.equal(write('.claude/hooks/anything.mjs', { autonomous: false }), ALLOW));
check('interactive: rm -rf → ALLOW (gate stands down)', () =>
  assert.equal(bash('rm -rf build', { autonomous: false }), ALLOW));

// ---- Governance surface: the CVE-2025-53773 class --------------------------
for (const [label, path] of [
  ['settings.json', '.claude/settings.json'],
  ['settings.local.json', '.claude/settings.local.json'],
  ['a hook', '.claude/hooks/autonomy-gate.mjs'],
  ['a skill', '.claude/skills/memory/SKILL.md'],
  ['a path-scoped rule', '.claude/rules/frontend.md'],
  ['an agent script', '.claude/scripts/memory-audit.mjs'],
  ['agent memory', '.claude/memory/user-profile.md'],
  // INSTALLED 2026-08-01. A subagent definition is a SYSTEM PROMPT — the same class as a skill or a
  // rule, and it was the only one of that class absent from the gate. Measured before the fix: every
  // door below was ALLOWED while its three siblings above were blocked.
  ['a subagent definition', '.claude/agents/reviewer.md'],
  ['a NEW subagent', '.claude/agents/exfiltrator.md'],
  ['a subagent, Windows separators', '.claude\\agents\\reviewer.md'],
  // INSTALLED 2026-08-01, and it is NOT the same surface as `.github/workflows/` two lines below — that is
  // CI. `.claude/workflows/**` is JavaScript the runtime executes to spawn subagents (16 concurrent, 1,000
  // per run) with a tool set and model the script picks. The pair below is deliberate: the two directories
  // must BOTH block, because `claude-md-budget`'s GOVERNANCE-SYNC check tokenises on words and therefore
  // cannot tell them apart — this suite is the only place the distinction is actually verified.
  ['a workflow script', '.claude/workflows/deep-research.js'],
  ['a NEW workflow script', '.claude/workflows/exfiltrate.js'],
  ['a workflow, Windows separators', '.claude\\workflows\\deep-research.js'],
  ['CLAUDE.md', 'CLAUDE.md'],
  ['a nested CLAUDE.md', 'sakubun/CLAUDE.md'],
  ['CLAUDE.local.md', 'CLAUDE.local.md'],
  ['a CI workflow', '.github/workflows/deploy.yml'],
  ['git internals', '.git/config'],
  ['an env secret', 'sakubun/.env'],
  ['an env variant', 'sakubun/.env.local'],
]) {
  check(`autonomous: Write to ${label} → BLOCK`, () => assert.equal(write(path), BLOCK));
}
check('autonomous: Edit to a hook → BLOCK (Edit is gated too, not just Write)', () =>
  assert.equal(edit('.claude/hooks/secret-guard.mjs'), BLOCK));
check('autonomous: Edit a subagent definition → BLOCK', () =>
  assert.equal(edit('.claude/agents/reviewer.md'), BLOCK));
check('autonomous: MultiEdit a subagent definition → BLOCK', () =>
  assert.equal(run({ tool_name: 'MultiEdit', tool_input: { file_path: '.claude/agents/reviewer.md' } }), BLOCK));
check('autonomous: Edit a workflow script → BLOCK', () =>
  assert.equal(edit('.claude/workflows/deep-research.js'), BLOCK));
check('autonomous: cp into .claude/workflows/ → BLOCK (the shell door, on the other branch)', () =>
  assert.equal(bash('cp evil.js .claude/workflows/deep-research.js'), BLOCK));

// The SHELL doors into `.claude/agents/`. These are separate from the three above because the block
// lives on a different branch: step 2.2 of the idea-0023 build found the governance block existed only
// on Write/Edit, so `cp evil.md .claude/hooks/x.mjs` walked straight past it. Patching the file-tool
// array alone would have re-created that bug in a new file class five weeks after it was written up.
check('autonomous: cp into .claude/agents/ → BLOCK', () =>
  assert.equal(bash('cp evil.md .claude/agents/reviewer.md'), BLOCK));
check('autonomous: append into .claude/agents/ → BLOCK (a redirect is judged by its TARGET)', () =>
  assert.equal(bash('cat evil.md >> .claude/agents/reviewer.md'), BLOCK));
check('autonomous: sed -i on a subagent definition → BLOCK', () =>
  assert.equal(bash('sed -i s/a/b/ .claude/agents/reviewer.md'), BLOCK));

// ---- …and the four cases that prove it does NOT over-block. A gate that blocks too much gets switched
// off, which is strictly worse than a hole, so each of these is load-bearing.
check('autonomous: READING .claude/agents/ → ALLOW (reading governance was never the threat)', () =>
  assert.equal(bash('grep -rn reviewer .claude/agents/'), ALLOW));
check('autonomous: read agents, redirect ELSEWHERE → ALLOW', () =>
  assert.equal(bash('grep -r x .claude/agents/ > /tmp/out.txt'), ALLOW));
check('autonomous: Write a path merely CONTAINING "agents" → ALLOW', () =>
  assert.equal(write('projects/todo/app/agents-page/page.tsx'), ALLOW));
check('autonomous: Write .claude/agents-backup/ → ALLOW (the regex requires the exact dir)', () =>
  assert.equal(write('.claude/agents-backup/old.md'), ALLOW));

// ---- Safe-zone writes ------------------------------------------------------
check('autonomous: Write app code → ALLOW', () => assert.equal(write('sakubun/lib/foo.ts'), ALLOW));
// PROPOSED 2026-07-29 — this case FLIPPED. `platform/standards/**` is the durable law layer (it
// holds autonomy-contract.md, the policy this hook enforces), so it is governance, not a doc.
// A genuinely safe doc path stands in for the original intent.
check('autonomous: Write a project doc → ALLOW', () => assert.equal(write('sakubun/docs/00-map.md'), ALLOW));
check('autonomous: Write a platform standard → BLOCK (was ALLOW before 2026-07-29)', () =>
  assert.equal(write('platform/standards/documentation.md'), BLOCK));
check('autonomous: Write a plan → ALLOW', () => assert.equal(write('platform/plans/2026-07-28-x.md'), ALLOW));
check('autonomous: Write a test → ALLOW', () => assert.equal(write('sakubun/lib/foo.test.ts'), ALLOW));

// ---- Outward actions (T3) — no release path exists any more -----------------
check('autonomous: git push origin auto/demo → BLOCK', () => assert.equal(bash('git push origin auto/demo'), BLOCK));
check('autonomous: git push origin main → BLOCK', () => assert.equal(bash('git push origin main'), BLOCK));
check('autonomous: git push --force → BLOCK', () => assert.equal(bash('git push --force origin auto/demo'), BLOCK));
check('autonomous: gh pr create → BLOCK', () => assert.equal(bash('gh pr create --title x --body y'), BLOCK));
check('autonomous: gh pr merge → BLOCK', () => assert.equal(bash('gh pr merge 5'), BLOCK));
check('autonomous: gh release → BLOCK', () => assert.equal(bash('gh release create v1'), BLOCK));
check('autonomous: npm publish → BLOCK', () => assert.equal(bash('npm publish'), BLOCK));

// ---- Irreversible / high-blast (T4) ----------------------------------------
for (const [label, cmd] of [
  ['git rebase', 'git rebase -i HEAD~3'],
  ['git reset --hard', 'git reset --hard origin/main'],
  ['git commit --amend', 'git commit --amend -m x'],
  ['git merge', 'git merge feature'],
  ['git branch -D', 'git branch -D old'],
  ['git clean -fd', 'git clean -fd'],
  ['rm -rf', 'rm -rf build'],
  ['rm -f', 'rm -f important.db'],
  ['docker compose down', 'docker compose down'],
  ['docker volume rm', 'docker volume rm sakubun_data'],
  ['docker system prune', 'docker system prune -a'],
  ['ssh', 'ssh thien25@thienminiserver'],
  ['watchtower', 'docker logs watchtower'],
  ['drop table', 'sqlite3 x.db "drop table users"'],
  ['dropdb', 'dropdb sakubun'],
  ['truncate table', 'psql -c "truncate table users"'],
  ['prisma migrate reset', 'npx prisma migrate reset'],
  ['prisma migrate deploy', 'npx prisma migrate deploy'],
  ['npm install <pkg>', 'npm install left-pad'],
  ['pnpm add <pkg>', 'pnpm add zod'],
  ['pip install <pkg>', 'pip install requests'],
  ['systemctl', 'systemctl restart docker'],
  ['shutdown', 'shutdown -h now'],
]) {
  check(`autonomous: ${label} → BLOCK`, () => assert.equal(bash(cmd), BLOCK));
}

// ---- Command smuggling: a denied command riding behind an allowed one -------
check('autonomous: safe commit && rm -rf / → BLOCK', () =>
  assert.equal(bash('git commit -m wip && rm -rf /'), BLOCK));
check('autonomous: safe test ; git push → BLOCK', () => assert.equal(bash('npm test ; git push origin main'), BLOCK));
check('autonomous: $(git push) substitution → BLOCK', () => assert.equal(bash('echo $(git push origin main)'), BLOCK));

// ---- Safe-zone commands ----------------------------------------------------
for (const [label, cmd] of [
  ['local commit', 'git commit -m "wip"'],
  ['git add', 'git add -A'],
  ['git status', 'git status --porcelain'],
  ['run tests', 'npm test'],
  ['build', 'npm run build'],
  ['lint', 'npx eslint .'],
  ['grep', 'grep -rn foo src/'],
  ['ls', 'ls -la'],
  ['run a repo script', 'node .claude/scripts/memory-audit.mjs'],
  ['npm install (no package = restore lockfile)', 'npm install'],
]) {
  check(`autonomous: ${label} → ALLOW`, () => assert.equal(bash(cmd), ALLOW));
}

// ---- Trigger: the gate must recognise an unattended run on its own ----------
// Verified 2026-07-28 by probing a real `claude -p`: interactive reports
// CLAUDE_CODE_ENTRYPOINT="cli", headless reports "sdk-cli".
const PUSH = { tool_name: 'Bash', tool_input: { command: 'git push origin main' } };

check('headless entrypoint (sdk-cli) with NO CLAUDE_AUTONOMOUS → BLOCK', () =>
  assert.equal(run(PUSH, { autonomous: false, entrypoint: 'sdk-cli' }), BLOCK));
check('headless entrypoint + governance write → BLOCK', () =>
  assert.equal(
    run({ tool_name: 'Write', tool_input: { file_path: '.claude/settings.json' } }, { autonomous: false, entrypoint: 'sdk-cli' }),
    BLOCK,
  ));
check('headless entrypoint + safe command → ALLOW (trigger widened, tiers unchanged)', () =>
  assert.equal(run({ tool_name: 'Bash', tool_input: { command: 'npm test' } }, { autonomous: false, entrypoint: 'sdk-cli' }), ALLOW));
check('interactive entrypoint (cli) with NO CLAUDE_AUTONOMOUS → ALLOW (stands down)', () =>
  assert.equal(run(PUSH, { autonomous: false, entrypoint: 'cli' }), ALLOW));
check('CLAUDE_AUTONOMOUS=1 still wins even on an interactive entrypoint', () =>
  assert.equal(run(PUSH, { autonomous: true, entrypoint: 'cli' }), BLOCK));

check('UNKNOWN entrypoint → ALLOW but emits a systemMessage notice', () => {
  const sid = `unk-${Date.now()}`;
  const r = runFull(PUSH, { autonomous: false, entrypoint: 'some-future-cloud-runner', sid });
  assert.equal(r.status, ALLOW, 'must not block an unrecognised entrypoint');
  assert.match(r.stdout, /UNKNOWN entrypoint/, 'must announce that it cannot tell');
  assert.match(r.stdout, /systemMessage/, 'notice must reach the user, not just stderr');
});
check('UNKNOWN entrypoint notice fires at most ONCE per session', () => {
  const sid = `unk-once-${Date.now()}`;
  const first = runFull(PUSH, { autonomous: false, entrypoint: 'some-future-cloud-runner', sid });
  const second = runFull(PUSH, { autonomous: false, entrypoint: 'some-future-cloud-runner', sid });
  assert.match(first.stdout, /UNKNOWN entrypoint/);
  assert.equal(second.stdout.trim(), '', 'second call in the same session must be silent');
});
check('no entrypoint at all → ALLOW, no notice (nothing to report)', () => {
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify(PUSH),
    env: (() => {
      const e = { ...process.env, HOOK_USAGE_LOG: 'off' };
      delete e.CLAUDE_AUTONOMOUS;
      delete e.CLAUDE_CODE_ENTRYPOINT;
      return e;
    })(),
    encoding: 'utf8',
  });
  assert.equal(r.status, ALLOW);
  assert.equal(r.stdout.trim(), '');
});

// ---- Out of scope + fail-closed --------------------------------------------
check('autonomous: Read tool → ALLOW (not in scope)', () =>
  assert.equal(run({ tool_name: 'Read', tool_input: { file_path: '.claude/settings.json' } }), ALLOW));
check('autonomous: malformed payload → BLOCK (fail-closed)', () => assert.equal(run('{not json'), BLOCK));

let pass = 0;
let failed = 0;
for (const c of cases) {
  try {
    c.fn();
    pass++;
  } catch (e) {
    failed++;
    console.error(`  ✗ ${c.name}\n    ${e.message}`);
  }
}
console.log(`${pass}/${cases.length} PASS${failed ? ` — ${failed} FAILED` : ''}`);
process.exit(failed ? 1 : 0);
