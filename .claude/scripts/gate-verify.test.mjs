// Exhaustive test table for gate-verify.mjs (the shared trust core, plan B4a.1).
// Run: node .claude/scripts/gate-verify.test.mjs   → prints "N/N PASS" and exits non-zero on any failure.
// Uses a throwaway in-process RSA keypair; signing here STANDS IN for the bot (which alone holds the private key).

import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { verifyGateToken, loadConsumedJtis, markJtiConsumed } from './gate-verify.mjs';

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
// A *different* keypair, to prove a token signed by the wrong key is rejected.
const other = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const NOW = 1_000_000; // fixed epoch seconds — deterministic, no real clock
const GATE = 'GATE-auto-demo-ab12cd';

// Mint a signed token the way the bot will (RSA-SHA256 over the payloadB64 ASCII bytes).
function mint(payloadObj, key = privateKey) {
  const payloadB64 = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  const sigB64 = sign('RSA-SHA256', Buffer.from(payloadB64, 'ascii'), key).toString('base64url');
  return `${payloadB64}.${sigB64}`;
}
const base = (over = {}) => ({ gate_id: GATE, decision: 'approve', iat: NOW - 10, exp: NOW + 900, jti: 'jti-1', ...over });
const V = (token, over = {}) =>
  verifyGateToken({ token, publicKeyPem: publicKey, expectedGateId: GATE, nowSec: NOW, consumedJtis: new Set(), ...over });

let pass = 0;
const cases = [];
function check(name, fn) {
  cases.push({ name, fn });
}

// --- ACCEPT paths ---
check('valid approve → ok + approve', () => {
  const r = V(mint(base()));
  assert.equal(r.ok, true);
  assert.equal(r.decision, 'approve');
});
check('valid deny → ok + deny (authentic, but caller must NOT proceed)', () => {
  const r = V(mint(base({ decision: 'deny', jti: 'jti-deny' })));
  assert.equal(r.ok, true);
  assert.equal(r.decision, 'deny');
});

// --- REJECT paths (every one must fail-closed) ---
check('expired → reject', () => assert.equal(V(mint(base({ exp: NOW - 1, jti: 'jti-exp' }))).ok, false));
check('exp exactly now → reject (strict >)', () => assert.equal(V(mint(base({ exp: NOW, jti: 'jti-now' }))).ok, false));
check('wrong gate_id → reject', () =>
  assert.equal(V(mint(base({ gate_id: 'GATE-other-zzz', jti: 'jti-wg' }))).ok, false));
check('replayed jti (already consumed) → reject', () =>
  assert.equal(V(mint(base({ jti: 'used-1' })), { consumedJtis: new Set(['used-1']) }).ok, false));
check('tampered payload (sig over old bytes) → reject', () => {
  const t = mint(base());
  const [, sig] = t.split('.');
  const evil = Buffer.from(JSON.stringify(base({ decision: 'approve', gate_id: GATE, jti: 'evil' }))).toString('base64url');
  assert.equal(V(`${evil}.${sig}`).ok, false); // sig no longer matches payload
});
check('signed by WRONG key → reject', () => assert.equal(V(mint(base({ jti: 'jti-ok' }), other.privateKey)).ok, false));
check('bad decision value → reject', () =>
  assert.equal(V(mint(base({ decision: 'maybe', jti: 'jti-bad' }))).ok, false));
check('missing jti → reject', () => assert.equal(V(mint(base({ jti: undefined }))).ok, false));
check('missing gate_id → reject', () => assert.equal(V(mint(base({ gate_id: undefined }))).ok, false));
check('exp not a number → reject', () => assert.equal(V(mint(base({ exp: 'soon', jti: 'jti-x' }))).ok, false));
check('validly-signed but NON-JSON payload → reject', () => {
  const payloadB64 = Buffer.from('not json {{{').toString('base64url');
  const sigB64 = sign('RSA-SHA256', Buffer.from(payloadB64, 'ascii'), privateKey).toString('base64url');
  assert.equal(V(`${payloadB64}.${sigB64}`).ok, false);
});
check('malformed token: 1 part → reject', () => assert.equal(V('onlyonepart').ok, false));
check('malformed token: 3 parts → reject', () => assert.equal(V('a.b.c').ok, false));
check('empty token → reject', () => assert.equal(V('').ok, false));
check('null token → reject', () => assert.equal(V(null).ok, false));
check('empty signature segment → reject', () => assert.equal(V(`${Buffer.from('{}').toString('base64url')}.`).ok, false));
check('garbage public key → reject (no throw)', () => {
  const r = verifyGateToken({ token: mint(base()), publicKeyPem: 'not-a-key', expectedGateId: GATE, nowSec: NOW, consumedJtis: new Set() });
  assert.equal(r.ok, false);
});

// --- consumed-jti store round-trip ---
check('nonce store: mark → reload rejects replay, prunes expired', () => {
  const path = join(tmpdir(), `gate-nonce-test-${NOW}.json`);
  rmSync(path, { force: true });
  markJtiConsumed(path, 'live-jti', NOW + 900, NOW);
  markJtiConsumed(path, 'dead-jti', NOW - 5, NOW); // already expired → should be pruned on reload
  const { set } = loadConsumedJtis(path, NOW);
  assert.equal(set.has('live-jti'), true);
  assert.equal(set.has('dead-jti'), false);
  // a token reusing the live jti is now rejected as replay
  const r = verifyGateToken({ token: mint(base({ jti: 'live-jti' })), publicKeyPem: publicKey, expectedGateId: GATE, nowSec: NOW, consumedJtis: set });
  assert.equal(r.ok, false);
  rmSync(path, { force: true });
});

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
