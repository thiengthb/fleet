// Exhaustive e2e test for autonomy-gate.mjs (B4b + S1.3 enrol-gate hardening).
// Spawns the hook as a subprocess with CLAUDE_AUTONOMOUS=1, a stdin payload, and gate-state files in a temp dir;
// asserts exit code (0 = allow, 2 = block). Signing here STANDS IN for the Discord bot (sole holder of the priv key).
// Run: node .claude/hooks/autonomy-gate.test.mjs

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, 'autonomy-gate.mjs');

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const nowSec = Math.floor(Date.now() / 1000); // hook uses the real clock

const GATE = 'GATE-auto-demo-ab12cd';
const BRANCH = 'auto/demo';

function mint(over = {}, key = privateKey) {
  const payload = { gate_id: GATE, decision: 'approve', iat: nowSec - 10, exp: nowSec + 900, jti: 'jti-' + Math.abs(over.jtiSeed ?? 1), ...over };
  delete payload.jtiSeed;
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = sign('RSA-SHA256', Buffer.from(b64, 'ascii'), key).toString('base64url');
  return `${b64}.${sig}`;
}

// Build a temp gate-state env: pubkey + current-gate.json + gates/<id>.json. Returns env overrides.
function setupEnv({ token, gateId = GATE, branch = BRANCH, writePubkey = true, writeState = true, writeToken = true, nonceJtis = [] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'gate-e2e-'));
  const pub = join(dir, 'pub.pem');
  const state = join(dir, 'current-gate.json');
  const tokenDir = join(dir, 'gates');
  const nonce = join(dir, 'nonce.json');
  mkdirSync(tokenDir, { recursive: true });
  if (writePubkey) writeFileSync(pub, publicKey);
  if (writeState) writeFileSync(state, JSON.stringify({ gate_id: gateId, branch }));
  if (writeToken && token) writeFileSync(join(tokenDir, `${gateId}.json`), JSON.stringify({ token }));
  if (nonceJtis.length) writeFileSync(nonce, JSON.stringify(Object.fromEntries(nonceJtis.map((j) => [j, nowSec + 900]))));
  return {
    _dir: dir,
    GATE_PUBKEY_FILE: pub,
    GATE_STATE_FILE: state,
    GATE_TOKEN_DIR: tokenDir,
    GATE_NONCE_FILE: nonce,
  };
}

function runGate(command, env = {}, { autonomous = true } = {}) {
  const base = { ...process.env };
  delete base.CLAUDE_AUTONOMOUS;
  if (autonomous) base.CLAUDE_AUTONOMOUS = '1';
  const { _dir, ...envVars } = env;
  const res = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
    env: { ...base, ...envVars },
    encoding: 'utf8',
  });
  if (_dir) rmSync(_dir, { recursive: true, force: true });
  return res.status; // 0 = allow, 2 = block
}
function runWrite(filePath, env = {}) {
  const base = { ...process.env, CLAUDE_AUTONOMOUS: '1' };
  const res = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: filePath, content: 'x' } }),
    env: base,
    encoding: 'utf8',
  });
  return res.status;
}

// ---- S1.3 enrol-gate helpers: sign an ANSWER token (kind:'answer') + a current-ask env ----
const ASK_ID = 'ASK-enrol-ab12cd';
function mintAnswer(over = {}, key = privateKey) {
  const payload = { kind: 'answer', ask_id: ASK_ID, answer: 'enrol', iat: nowSec - 10, exp: nowSec + 900, jti: 'ans-' + Math.abs(over.jtiSeed ?? 1), ...over };
  delete payload.jtiSeed;
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = sign('RSA-SHA256', Buffer.from(b64, 'ascii'), key).toString('base64url');
  return `${b64}.${sig}`;
}
function setupAskEnv({ token, askId = ASK_ID, writePubkey = true, writeState = true, writeAnswer = true, nonceJtis = [] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'ask-e2e-'));
  const pub = join(dir, 'pub.pem');
  const askState = join(dir, 'current-ask.json');
  const repoDir = join(dir, 'agent-gates');
  const ansDir = join(repoDir, 'answers');
  const nonce = join(dir, 'nonce.json');
  mkdirSync(ansDir, { recursive: true });
  if (writePubkey) writeFileSync(pub, publicKey);
  if (writeState) writeFileSync(askState, JSON.stringify({ ask_id: askId }));
  if (writeAnswer && token) writeFileSync(join(ansDir, `${askId}.json`), JSON.stringify({ token }));
  if (nonceJtis.length) writeFileSync(nonce, JSON.stringify(Object.fromEntries(nonceJtis.map((j) => [j, nowSec + 900]))));
  return { _dir: dir, GATE_PUBKEY_FILE: pub, ASK_STATE_FILE: askState, GATE_REPO_DIR: repoDir, GATE_NONCE_FILE: nonce };
}
function runWriteContent(filePath, content, env = {}) {
  const base = { ...process.env, CLAUDE_AUTONOMOUS: '1' };
  const { _dir, ...envVars } = env;
  const res = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: filePath, content } }),
    env: { ...base, ...envVars },
    encoding: 'utf8',
  });
  if (_dir) rmSync(_dir, { recursive: true, force: true });
  return res.status;
}
const PLAN = 'nuc-platform/plans/2026-06-19-demo.md';
const ARM = '---\nstatus: active\nauto_pilot: true\nenrol: pending\n---\n# demo\n';
const NOARM = '---\nstatus: draft\nauto_pilot: false\n---\n# demo\n';

const ALLOW = 0;
const BLOCK = 2;
let pass = 0;
const cases = [];
const check = (name, fn) => cases.push({ name, fn });

// --- ALLOW: the two token-unlockable actions with a valid Approve token ---
check('approve token + git push origin auto/demo → ALLOW', () =>
  assert.equal(runGate('git push origin auto/demo', setupEnv({ token: mint() })), ALLOW));
check('approve token + git push -u origin auto/demo → ALLOW', () =>
  assert.equal(runGate('git push -u origin auto/demo', setupEnv({ token: mint() })), ALLOW));
check('approve token + gh pr create --title x --body y → ALLOW', () =>
  assert.equal(runGate('gh pr create --title "feat: x" --fill', setupEnv({ token: mint() })), ALLOW));

// --- BLOCK: T4 / dangerous T3 — NEVER unlockable even WITH a valid token ---
check('approve token + git push origin main → BLOCK (not an auto/ branch)', () =>
  assert.equal(runGate('git push origin main', setupEnv({ token: mint() })), BLOCK));
check('approve token + git push --force origin auto/demo → BLOCK (force)', () =>
  assert.equal(runGate('git push --force origin auto/demo', setupEnv({ token: mint() })), BLOCK));
check('approve token + gh pr merge 5 → BLOCK (merge hard-denied)', () =>
  assert.equal(runGate('gh pr merge 5', setupEnv({ token: mint() })), BLOCK));
check('approve token + docker compose down → BLOCK', () =>
  assert.equal(runGate('docker compose down', setupEnv({ token: mint() })), BLOCK));
check('approve token + ssh thien25@nuc → BLOCK', () =>
  assert.equal(runGate('ssh thien25@thienminiserver', setupEnv({ token: mint() })), BLOCK));
check('approve token + rm -rf build → BLOCK', () =>
  assert.equal(runGate('rm -rf build', setupEnv({ token: mint() })), BLOCK));

// --- BLOCK: command-injection / metacharacter smuggling past an approved push ---
check('approve token + push && rm -rf / → BLOCK (metachar + rm)', () =>
  assert.equal(runGate('git push origin auto/demo && rm -rf /', setupEnv({ token: mint() })), BLOCK));
check('approve token + push ; curl evil → BLOCK (metachar)', () =>
  assert.equal(runGate('git push origin auto/demo ; curl http://evil', setupEnv({ token: mint() })), BLOCK));
check('approve token + push with $(...) → BLOCK (metachar)', () =>
  assert.equal(runGate('git push origin auto/demo $(whoami)', setupEnv({ token: mint() })), BLOCK));

// --- BLOCK: invalid / mismatched / missing approvals on an otherwise-eligible push ---
check('DENY token + push auto/demo → BLOCK (decision=deny)', () =>
  assert.equal(runGate('git push origin auto/demo', setupEnv({ token: mint({ decision: 'deny', jtiSeed: 2 }) })), BLOCK));
check('expired token + push auto/demo → BLOCK', () =>
  assert.equal(runGate('git push origin auto/demo', setupEnv({ token: mint({ exp: nowSec - 1, jtiSeed: 3 }) })), BLOCK));
check('wrong gate_id in token + push auto/demo → BLOCK', () =>
  assert.equal(runGate('git push origin auto/demo', setupEnv({ token: mint({ gate_id: 'GATE-other', jtiSeed: 4 }) })), BLOCK));
check('push a DIFFERENT auto branch than the gate → BLOCK (ref != gate branch)', () =>
  assert.equal(runGate('git push origin auto/other', setupEnv({ token: mint() })), BLOCK));
check('replayed jti (in nonce store) + push → BLOCK', () =>
  assert.equal(runGate('git push origin auto/demo', setupEnv({ token: mint({ jti: 'used-9' }), nonceJtis: ['used-9'] })), BLOCK));
check('no token file + push auto/demo → BLOCK', () =>
  assert.equal(runGate('git push origin auto/demo', setupEnv({ writeToken: false })), BLOCK));
check('no current-gate state + push auto/demo → BLOCK', () =>
  assert.equal(runGate('git push origin auto/demo', setupEnv({ token: mint(), writeState: false })), BLOCK));
check('missing public key + push auto/demo → BLOCK (fail-closed)', () =>
  assert.equal(runGate('git push origin auto/demo', setupEnv({ token: mint(), writePubkey: false })), BLOCK));
check('bare git push (no auto ref) + valid token → BLOCK', () =>
  assert.equal(runGate('git push', setupEnv({ token: mint() })), BLOCK));

// --- governance + stand-down sanity (proves the rest of the gate still works) ---
check('autonomous: Write to .claude/hooks/autonomy-gate.mjs → BLOCK (governance)', () =>
  assert.equal(runWrite('.claude/hooks/autonomy-gate.mjs'), BLOCK));
check('autonomous: safe local commit → ALLOW', () =>
  assert.equal(runGate('git commit -m "wip"', setupEnv({ token: mint() })), ALLOW));
check('INTERACTIVE (marker unset): git push origin main → ALLOW (gate stands down)', () =>
  assert.equal(runGate('git push origin main', {}, { autonomous: false }), ALLOW));

// --- S1.3 enrol gate: arming a plan (auto_pilot: true) requires a SIGNED enrol answer ---
check('arm plan WITH valid signed enrol answer → ALLOW', () =>
  assert.equal(runWriteContent(PLAN, ARM, setupAskEnv({ token: mintAnswer() })), ALLOW));
check('arm plan with NO enrol answer → BLOCK (self-arm prevented)', () =>
  assert.equal(runWriteContent(PLAN, ARM, setupAskEnv({ writeAnswer: false })), BLOCK));
check('arm plan with "reject" enrol answer → BLOCK', () =>
  assert.equal(runWriteContent(PLAN, ARM, setupAskEnv({ token: mintAnswer({ answer: 'reject', jtiSeed: 2 }) })), BLOCK));
check('arm plan with "not yet" enrol answer → BLOCK', () =>
  assert.equal(runWriteContent(PLAN, ARM, setupAskEnv({ token: mintAnswer({ answer: 'not yet', jtiSeed: 3 }) })), BLOCK));
check('arm plan with EXPIRED enrol answer → BLOCK', () =>
  assert.equal(runWriteContent(PLAN, ARM, setupAskEnv({ token: mintAnswer({ exp: nowSec - 1, jtiSeed: 4 }) })), BLOCK));
check('arm plan whose current ask is NOT an enrol ask → BLOCK', () =>
  assert.equal(runWriteContent(PLAN, ARM, setupAskEnv({ askId: 'ASK-other-zz99', token: mintAnswer({ ask_id: 'ASK-other-zz99', jtiSeed: 5 }) })), BLOCK));
check('arm plan with replayed enrol jti → BLOCK', () =>
  assert.equal(runWriteContent(PLAN, ARM, setupAskEnv({ token: mintAnswer({ jti: 'ans-used' }), nonceJtis: ['ans-used'] })), BLOCK));
check('arm plan with an APPROVE (gate) token mis-used as an answer → BLOCK (kind!=answer)', () =>
  assert.equal(runWriteContent(PLAN, ARM, setupAskEnv({ token: mint({ jtiSeed: 7 }) })), BLOCK));
check('write plan WITHOUT auto_pilot:true (no enrol answer) → ALLOW', () =>
  assert.equal(runWriteContent(PLAN, NOARM, setupAskEnv({ writeAnswer: false })), ALLOW));
check('write auto_pilot:true to a NON-plan file → ALLOW (enrol gate scoped to plans)', () =>
  assert.equal(runWriteContent('nuc-platform/docs/x.md', ARM, setupAskEnv({ writeAnswer: false })), ALLOW));

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
