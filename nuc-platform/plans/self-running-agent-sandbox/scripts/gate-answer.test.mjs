// gate-answer.test.mjs — verifies the free-form answer trust path. Run: node gate-answer.test.mjs
// Pure verifyAnswerToken() cases (a real generated keypair stands in for the bot) + a full ask-cli round-trip.

import { generateKeyPairSync, sign } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { verifyAnswerToken } from './gate-answer.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const { privateKey: otherPriv } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pubPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

function makeToken(payload, key = privateKey) {
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = sign('RSA-SHA256', Buffer.from(payloadB64, 'ascii'), key).toString('base64url');
  return `${payloadB64}.${sig}`;
}

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error('  FAIL:', name); } };

// ---- pure verifyAnswerToken ----
const NOW = 1_000_000;
const base = { kind: 'answer', ask_id: 'ASK-demo-abc123', answer: 'use approach B', exp: NOW + 900, jti: 'j1' };
const V = (over, expectedAskId = 'ASK-demo-abc123', now = NOW, consumed) =>
  verifyAnswerToken({ token: makeToken({ ...base, ...over }), publicKeyPem: pubPem, expectedAskId, nowSec: now, consumedJtis: consumed });

let r = V({});
ok('valid answer accepted', r.ok && r.answer === 'use approach B' && r.jti === 'j1');
ok('reject wrong ask_id', !V({}, 'ASK-other').ok);
ok('reject expired (exp<now)', !V({ exp: NOW - 1 }).ok);
ok('reject exp==now', !V({ exp: NOW }).ok);
ok('reject replay (jti consumed)', !V({}, 'ASK-demo-abc123', NOW, new Set(['j1'])).ok);
ok('reject wrong kind (approve)', !V({ kind: 'approve' }).ok);
ok('reject missing kind', !verifyAnswerToken({ token: makeToken({ ask_id: 'ASK-demo-abc123', answer: 'x', exp: NOW + 9, jti: 'j' }), publicKeyPem: pubPem, expectedAskId: 'ASK-demo-abc123', nowSec: NOW }).ok);
ok('reject non-string answer', !V({ answer: 42 }).ok);
ok('reject missing jti', !verifyAnswerToken({ token: makeToken({ kind: 'answer', ask_id: 'ASK-demo-abc123', answer: 'x', exp: NOW + 9 }), publicKeyPem: pubPem, expectedAskId: 'ASK-demo-abc123', nowSec: NOW }).ok);
ok('reject empty answer ask_id', !V({ ask_id: '' }).ok);
ok('reject wrong signing key', !verifyAnswerToken({ token: makeToken({}, otherPriv), publicKeyPem: pubPem, expectedAskId: 'ASK-demo-abc123', nowSec: NOW }).ok);

// tamper: flip a char in the payload segment -> signature must fail
const t = makeToken({});
const tampered = (t[0] === 'A' ? 'B' : 'A') + t.slice(1);
ok('reject tampered payload', !verifyAnswerToken({ token: tampered, publicKeyPem: pubPem, expectedAskId: 'ASK-demo-abc123', nowSec: NOW }).ok);

// an APPROVAL-shaped token (decision/gate_id, no kind/ask_id/answer) must NOT pass as an answer
ok('reject approval-token-as-answer', !verifyAnswerToken({ token: makeToken({ decision: 'approve', gate_id: 'G', exp: NOW + 9, jti: 'g1' }), publicKeyPem: pubPem, expectedAskId: 'ASK-demo-abc123', nowSec: NOW }).ok);

// malformed tokens
ok('reject no-dot token', !verifyAnswerToken({ token: 'abc', publicKeyPem: pubPem, expectedAskId: 'X', nowSec: NOW }).ok);
ok('reject 3-part token', !verifyAnswerToken({ token: 'a.b.c', publicKeyPem: pubPem, expectedAskId: 'X', nowSec: NOW }).ok);
ok('reject empty token', !verifyAnswerToken({ token: '', publicKeyPem: pubPem, expectedAskId: 'X', nowSec: NOW }).ok);
ok('answer is DATA only (no enum on answer)', V({ answer: 'rm -rf / ; anything goes as TEXT' }).ok);

// ---- ask-cli round-trip (real spawned process) ----
const T = join(tmpdir(), 'ask-cli-test-' + process.pid);
rmSync(T, { recursive: true, force: true });
mkdirSync(T, { recursive: true });
const pubFile = join(T, 'pub.pem');
writeFileSync(pubFile, pubPem);
const env = {
  ...process.env,
  GATE_REPO_DIR: join(T, 'gates'),
  ASK_STATE_FILE: join(T, 'state', 'current-ask.json'),
  GATE_PUBKEY_FILE: pubFile,
  GATE_NONCE_FILE: join(T, 'nonces.json'),
};
const run = (...args) => execFileSync('node', ['ask-cli.mjs', ...args], { cwd: HERE, env, encoding: 'utf8' }).trim();
const realNow = Math.floor(Date.now() / 1000);
const askId = 'ASK-int-0001';

run('ask', askId, 'Which approach should I take?', 'auto/foo');
ok('ask wrote asks/ file', existsSync(join(env.GATE_REPO_DIR, 'asks', `${askId}.json`)));
ok('ask wrote state file', existsSync(env.ASK_STATE_FILE));
ok('check before answer == none', run('check') === 'none');

// bot signs the answer
const answerToken = makeToken({ kind: 'answer', ask_id: askId, answer: 'approach B', exp: realNow + 900, jti: 'int-j1' });
mkdirSync(join(env.GATE_REPO_DIR, 'answers'), { recursive: true });
writeFileSync(join(env.GATE_REPO_DIR, 'answers', `${askId}.json`), JSON.stringify({ token: answerToken }));
ok('check returns the answer TEXT', run('check') === 'approach B');

run('consume');
ok('consume deleted answer file', !existsSync(join(env.GATE_REPO_DIR, 'answers', `${askId}.json`)));
ok('consume deleted ask file', !existsSync(join(env.GATE_REPO_DIR, 'asks', `${askId}.json`)));
ok('consume deleted state', !existsSync(env.ASK_STATE_FILE));

// replay: re-stage the same token+state -> jti already consumed -> none
writeFileSync(env.ASK_STATE_FILE, JSON.stringify({ ask_id: askId }));
mkdirSync(join(env.GATE_REPO_DIR, 'answers'), { recursive: true });
writeFileSync(join(env.GATE_REPO_DIR, 'answers', `${askId}.json`), JSON.stringify({ token: answerToken }));
ok('replay after consume == none', run('check') === 'none');

// report subcommand writes an outbound digest
const out = run('report', 'batch did X; next is Y');
ok('report wrote a reports/ file', /^reported report-/.test(out) && existsSync(join(env.GATE_REPO_DIR, 'reports', out.replace('reported ', '') + '.json')));

rmSync(T, { recursive: true, force: true });

console.log(`gate-answer: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
