// gate-answer.mjs — verify a free-form ANSWER token for the Discord async Q&A path (plan 2026-06-16, Phase 3).
//
// Sibling of gate-verify.mjs (the APPROVAL trust core). An *answer* is the supervisor's free-text reply to a worker's
// free-form question, signed by the bot (RS256, the SAME pinned key). It is AUTHENTICATED (proves it came from the bot,
// which only signs after guards.user_allowed), but the `answer` string is DATA — the worker / the /auto-pilot SKILL
// MUST treat it as information for the next batch and NEVER as a command to execute. Authenticity != authority
// (the same lesson as the approve/deny buttons in B4).
//
// Disjoint-by-construction from approval tokens: an answer REQUIRES kind==='answer' + ask_id + a string `answer`, and
// carries NO decision/gate_id — so verifyGateToken() rejects an answer token, and this rejects an approval token.
// Neither channel's token can ever be cross-used. The consumed-jti store (in gate-verify.mjs) is shared, so a jti can
// never be replayed across either channel. Mirrors verifyGateToken's verify-then-parse, fail-closed structure exactly.

import { createPublicKey, verify } from 'node:crypto';

function deny(reason) {
  return { ok: false, reason };
}

/**
 * Verify a free-form answer token. PURE — no IO, no clock of its own (mirrors verifyGateToken).
 * @param {object} a
 * @param {string} a.token            the `<payloadB64url>.<sigB64url>` string
 * @param {string} a.publicKeyPem     the bot's RSA PUBLIC key (PEM) — pinned by the caller
 * @param {string} a.expectedAskId    the ask the caller is currently waiting on (binds the answer)
 * @param {number} a.nowSec           current epoch seconds (caller supplies — testable + no Date in core)
 * @param {Set<string>} [a.consumedJtis] jti values already consumed (replay rejection)
 * @returns {{ok:true, ask_id:string, answer:string, jti:string, exp:number} | {ok:false, reason:string}}
 */
export function verifyAnswerToken({ token, publicKeyPem, expectedAskId, nowSec, consumedJtis }) {
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

    // 3) kind-discriminated + binding + freshness + single-use. `answer` is DATA (any string), not a bounded enum.
    if (p.kind !== 'answer') return deny(`kind must be 'answer': ${p.kind}`);
    if (typeof p.ask_id !== 'string' || !p.ask_id) return deny('missing ask_id');
    if (p.ask_id !== expectedAskId) return deny(`ask_id mismatch (token=${p.ask_id} expected=${expectedAskId})`);
    if (typeof p.answer !== 'string') return deny('answer missing / not a string');
    if (!Number.isFinite(p.exp)) return deny('exp missing / not a number');
    if (!Number.isFinite(nowSec)) return deny('nowSec missing / not a number');
    if (p.exp <= nowSec) return deny('token expired');
    if (typeof p.jti !== 'string' || !p.jti) return deny('missing jti');
    if (consumedJtis instanceof Set && consumedJtis.has(p.jti)) return deny('jti already consumed (replay)');

    return { ok: true, ask_id: p.ask_id, answer: p.answer, jti: p.jti, exp: p.exp };
  } catch (e) {
    return deny('verify error: ' + (e?.message || e)); // fail-closed catch-all
  }
}
