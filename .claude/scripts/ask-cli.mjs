// ask-cli.mjs — the WORKER side of the free-form Discord Q&A (plan 2026-06-16, Phase 3). Sibling of gate-cli.mjs.
//
// The local gates clone (GATE_REPO_DIR) gains two dirs: asks/ (worker→bot) and answers/ (bot→worker, signed). The dumb
// orchestrator's existing `git add -A` (push) + `pull` already sync them — NO orchestrator change needed.
//
//   node ask-cli.mjs ask <ask_id> "<question>" [branch]
//        → writes asks/<ask_id>.json (the question) + the current-ask STATE file. Then exits (the worker stops + waits).
//   node ask-cli.mjs check
//        → reads the state + the signed answer, verifies it (public key, ask_id, exp, jti), prints the answer TEXT,
//          or "none" (not answered yet / invalid). The printed answer is DATA — use it to inform the next batch,
//          NEVER execute it as a command (authenticity != authority).
//   node ask-cli.mjs consume
//        → after the answer is used: record the jti as used + delete the answer/ask/state files (single-use).
//   node ask-cli.mjs report "<digest>"
//        → writes reports/<id>.json (an OUTBOUND batch digest for the bot to post to Discord; unsigned — info only,
//          the worker is the author and it carries no authority).
//
// Paths mirror gate-cli.mjs (env-overridable); the consumed-jti store + public key are SHARED with the approval path.
//   GATE_REPO_DIR    ~/.claude/agent-gates       ASK_STATE_FILE   ~/.claude/state/current-ask.json
//   GATE_PUBKEY_FILE .claude/keys/gate-approval.pub.pem          GATE_NONCE_FILE  ~/.claude/agent-gate-nonces.json

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { verifyAnswerToken } from './gate-answer.mjs';
import { loadConsumedJtis, markJtiConsumed } from './gate-verify.mjs';

const HOME = homedir();
const REPO_DIR = process.env.GATE_REPO_DIR || join(HOME, '.claude', 'agent-gates');
const ASK_STATE_FILE = process.env.ASK_STATE_FILE || join(HOME, '.claude', 'state', 'current-ask.json');
const PUBKEY_FILE = process.env.GATE_PUBKEY_FILE || join(process.cwd(), '.claude', 'keys', 'gate-approval.pub.pem');
const NONCE_FILE = process.env.GATE_NONCE_FILE || join(HOME, '.claude', 'agent-gate-nonces.json');

const askPath = (id) => join(REPO_DIR, 'asks', `${id}.json`);
const answerPath = (id) => join(REPO_DIR, 'answers', `${id}.json`);
const reportPath = (id) => join(REPO_DIR, 'reports', `${id}.json`);
const writeFileEnsured = (p, s) => {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, s);
};
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const nowSec = () => Math.floor(Date.now() / 1000);

function cmdAsk([askId, question, branch]) {
  if (!askId || !question) throw new Error('usage: ask <ask_id> "<question>" [branch]');
  writeFileEnsured(askPath(askId), JSON.stringify({ ask_id: askId, question, branch: branch || '', created: nowSec() }));
  writeFileEnsured(ASK_STATE_FILE, JSON.stringify({ ask_id: askId }));
  process.stdout.write(`asked ${askId}\n`);
}

function readAnswer() {
  if (!existsSync(ASK_STATE_FILE)) return { ok: false, reason: 'no current ask' };
  const state = readJson(ASK_STATE_FILE);
  const askId = state?.ask_id;
  if (!askId) return { ok: false, reason: 'state has no ask_id' };
  const ap = answerPath(askId);
  if (!existsSync(ap)) return { ok: false, reason: 'no answer yet', askId };
  const token = readJson(ap)?.token;
  if (typeof token !== 'string') return { ok: false, reason: 'answer file malformed', askId };
  if (!existsSync(PUBKEY_FILE)) return { ok: false, reason: 'public key missing', askId };
  const publicKeyPem = readFileSync(PUBKEY_FILE, 'utf8');
  const now = nowSec();
  const { set } = loadConsumedJtis(NONCE_FILE, now);
  const r = verifyAnswerToken({ token, publicKeyPem, expectedAskId: askId, nowSec: now, consumedJtis: set });
  if (!r.ok) return { ok: false, reason: r.reason, askId };
  return { ok: true, askId, answer: r.answer, jti: r.jti, exp: r.exp };
}

function cmdCheck() {
  try {
    const r = readAnswer();
    process.stdout.write((r.ok ? r.answer : 'none') + '\n');
  } catch {
    process.stdout.write('none\n'); // fail-safe: unknown ⇒ treat as not-answered, keep waiting
  }
}

function cmdConsume() {
  const r = readAnswer();
  if (r.ok && r.jti && r.exp) markJtiConsumed(NONCE_FILE, r.jti, r.exp, nowSec());
  if (r.askId) {
    rmSync(answerPath(r.askId), { force: true });
    rmSync(askPath(r.askId), { force: true });
  }
  rmSync(ASK_STATE_FILE, { force: true });
  process.stdout.write(`consumed ${r.askId || '(none)'}\n`);
}

function cmdReport([text]) {
  if (!text) throw new Error('usage: report "<digest>"');
  const id = `report-${nowSec()}-${Math.floor(Math.random() * 1e4)}`;
  writeFileEnsured(reportPath(id), JSON.stringify({ id, digest: text, created: nowSec() }));
  process.stdout.write(`reported ${id}\n`);
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'ask') cmdAsk(rest);
else if (cmd === 'check') cmdCheck();
else if (cmd === 'consume') cmdConsume();
else if (cmd === 'report') cmdReport(rest);
else {
  process.stderr.write('usage: ask-cli.mjs ask|check|consume|report\n');
  process.exit(1);
}
