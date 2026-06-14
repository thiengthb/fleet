// gate-verify.mjs — the SHARED trust core for the Discord two-way control plane (plan B4).
//
// ONE verifier, reused by two consumers so they can never disagree:
//   - B4a: the auto-pilot worker reads an approval at batch start and decides un-park vs stay-parked.
//   - B4b: autonomy-gate.mjs verifies the SAME token to conditionally allow exactly one bounded T3 push.
//
// An approval is a compact signed token  `<payloadB64url>.<sigB64url>`  where the bot (and ONLY the bot,
// on the NUC, holding the RSA *private* key) signs. This repo only ever VERIFIES, with the *public* key —
// it can never mint an approval. RSA-SHA256 (PKCS#1 v1.5) is HARD-CODED here and the key is pinned, so there
// is no `alg` field to confuse (the JWT `alg:none` class of attacks is structurally impossible).
//
// Security contract (every line matters — this is part of the sole gate):
//   - VERIFY-THEN-PARSE: the signature is checked over the raw payloadB64 bytes BEFORE the JSON is parsed,
//     so we never act on (or even parse) attacker-controlled JSON that isn't signed.
//   - PURE CORE: verifyGateToken() does NO file IO and takes `nowSec` + `consumedJtis` as inputs — fully
//     deterministic + unit-testable, and safe to call from inside the PreToolUse hook.
//   - FAIL-CLOSED: every rejection path and the catch-all return { ok: false, reason }. A caller MUST treat
//     anything other than { ok: true, decision: 'approve' } as "do not proceed".
//   - decision: 'deny' is a VALID, authentic token meaning "explicitly denied" → ok:true but decision:'deny'.
//     ok:true means "authentic", NOT "go ahead"; the caller still gates on decision === 'approve'.
//   - Single-use + gate-scoped + expiring: jti (nonce) blocks replay, gate_id binds the approval to one gate,
//     exp bounds its lifetime. Three independent controls; none alone is the whole guard.
// Contract: nuc-platform/09-autonomy-contract.md · plan: nuc-platform/plans/2026-06-14-discord-control-plane.md

import { createPublicKey, verify } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const DECISIONS = new Set(['approve', 'deny']);

function deny(reason) {
  return { ok: false, reason };
}

/**
 * Verify an approval token. PURE — no IO, no clock of its own.
 * @param {object} a
 * @param {string} a.token            the `<payloadB64url>.<sigB64url>` string
 * @param {string} a.publicKeyPem     the bot's RSA PUBLIC key (PEM) — pinned by the caller
 * @param {string} a.expectedGateId   the gate the caller is currently at (binds the approval)
 * @param {number} a.nowSec           current epoch seconds (caller supplies — testable + no Date in core)
 * @param {Set<string>} [a.consumedJtis] jti values already consumed (replay rejection)
 * @returns {{ok:true, decision:'approve'|'deny', jti:string, gate_id:string, exp:number} | {ok:false, reason:string}}
 */
export function verifyGateToken({ token, publicKeyPem, expectedGateId, nowSec, consumedJtis }) {
  try {
    if (typeof token !== 'string' || !token) return deny('token missing / not a string');
    const parts = token.split('.');
    if (parts.length !== 2) return deny('token must be exactly payloadB64.sigB64');
    const [payloadB64, sigB64] = parts;
    if (!payloadB64 || !sigB64) return deny('empty payload or signature segment');

    // 1) VERIFY signature over the raw payloadB64 ASCII bytes — BEFORE touching the JSON.
    let pub;
    try {
      pub = createPublicKey(publicKeyPem);
    } catch (e) {
      return deny('bad public key: ' + (e?.message || e));
    }
    let sigOk = false;
    try {
      sigOk = verify('RSA-SHA256', Buffer.from(payloadB64, 'ascii'), pub, Buffer.from(sigB64, 'base64url'));
    } catch (e) {
      return deny('signature verify threw: ' + (e?.message || e));
    }
    if (!sigOk) return deny('bad signature');

    // 2) Only now parse the (authenticated) payload.
    let p;
    try {
      p = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    } catch {
      return deny('payload is not valid JSON');
    }
    if (!p || typeof p !== 'object') return deny('payload not an object');

    // 3) Bounded-enum + binding + freshness + single-use.
    if (!DECISIONS.has(p.decision)) return deny(`decision not in {approve,deny}: ${p.decision}`);
    if (typeof p.gate_id !== 'string' || !p.gate_id) return deny('missing gate_id');
    if (p.gate_id !== expectedGateId) return deny(`gate_id mismatch (token=${p.gate_id} expected=${expectedGateId})`);
    if (!Number.isFinite(p.exp)) return deny('exp missing / not a number');
    if (!Number.isFinite(nowSec)) return deny('nowSec missing / not a number');
    if (p.exp <= nowSec) return deny('token expired');
    if (typeof p.jti !== 'string' || !p.jti) return deny('missing jti');
    if (consumedJtis instanceof Set && consumedJtis.has(p.jti)) return deny('jti already consumed (replay)');

    return { ok: true, decision: p.decision, jti: p.jti, gate_id: p.gate_id, exp: p.exp };
  } catch (e) {
    return deny('verify error: ' + (e?.message || e)); // fail-closed catch-all
  }
}

// ---- consumed-jti store: a tiny self-pruning JSON map { jti: exp }. IO kept OUT of the pure core above. ----

/** Load consumed jtis, dropping any whose exp has passed (self-prune). Returns a Set + the pruned map. */
export function loadConsumedJtis(path, nowSec) {
  const map = {};
  if (path && existsSync(path)) {
    try {
      const raw = JSON.parse(readFileSync(path, 'utf8'));
      for (const [jti, exp] of Object.entries(raw)) {
        if (Number.isFinite(exp) && exp > nowSec) map[jti] = exp; // keep only still-valid → store stays small
      }
    } catch {
      /* corrupt store → treat as empty; the worst case is we re-accept, but gate_id+exp still bind */
    }
  }
  return { set: new Set(Object.keys(map)), map };
}

/** Mark a jti consumed (persisted with its exp so the store self-prunes later). Best-effort, atomic-ish. */
export function markJtiConsumed(path, jti, exp, nowSec) {
  const { map } = loadConsumedJtis(path, nowSec);
  map[jti] = exp;
  writeFileSync(path, JSON.stringify(map), { mode: 0o600 });
}
