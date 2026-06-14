// gate-cli.mjs — the WORKER side of the two-way control plane (plan B4a.2). Reuses gate-verify.mjs (the trust core).
//
// The local gates clone (GATE_REPO_DIR) has two dirs: requests/ (worker→bot) and gates/ (bot→worker, signed).
// The dumb orchestrator git-pushes after `request` and git-pulls before `check` — this CLI only touches local files.
//
//   node gate-cli.mjs request <gate_id> <branch> <title> [digestFile]
//        → writes requests/<gate_id>.json (the ask) + the current-gate STATE file the hook reads. Then exits.
//   node gate-cli.mjs check
//        → reads the state + the signed approval, verifies it (public key, gate_id, exp, jti), prints one word:
//          "approve" | "deny" | "none"  (none = not decided yet / invalid). The worker un-parks ONLY on "approve".
//   node gate-cli.mjs consume
//        → after the gate is crossed: record the jti as used + delete the approval/request/state files (single-use).
//
// Paths (env-overridable; defaults = the documented install layout):
//   GATE_REPO_DIR   local clone of the gates repo (has requests/ + gates/)   ~/.claude/agent-gates
//   GATE_STATE_FILE the current parked gate {gate_id, branch}                 ~/.claude/state/current-gate.json
//   GATE_PUBKEY_FILE the approval PUBLIC key (non-secret, committed)          .claude/keys/gate-approval.pub.pem
//   GATE_NONCE_FILE  consumed-jti store                                       ~/.claude/agent-gate-nonces.json

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { verifyGateToken, loadConsumedJtis, markJtiConsumed } from './gate-verify.mjs';

const HOME = homedir();
const REPO_DIR = process.env.GATE_REPO_DIR || join(HOME, '.claude', 'agent-gates');
const STATE_FILE = process.env.GATE_STATE_FILE || join(HOME, '.claude', 'state', 'current-gate.json');
const PUBKEY_FILE = process.env.GATE_PUBKEY_FILE || join(process.cwd(), '.claude', 'keys', 'gate-approval.pub.pem');
const NONCE_FILE = process.env.GATE_NONCE_FILE || join(HOME, '.claude', 'agent-gate-nonces.json');

const reqPath = (id) => join(REPO_DIR, 'requests', `${id}.json`);
const gatePath = (id) => join(REPO_DIR, 'gates', `${id}.json`);
const writeFileEnsured = (p, s) => {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, s);
};
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const nowSec = () => Math.floor(Date.now() / 1000);

function cmdRequest([gateId, branch, title, digestFile]) {
  if (!gateId || !branch) throw new Error('usage: request <gate_id> <branch> <title> [digestFile]');
  const digest = digestFile && existsSync(digestFile) ? readFileSync(digestFile, 'utf8') : '';
  writeFileEnsured(reqPath(gateId), JSON.stringify({ gate_id: gateId, branch, title: title || '', digest, created: nowSec() }));
  writeFileEnsured(STATE_FILE, JSON.stringify({ gate_id: gateId, branch }));
  process.stdout.write(`requested ${gateId} (branch ${branch})\n`);
}

function readDecision() {
  if (!existsSync(STATE_FILE)) return { decision: 'none', reason: 'no current gate' };
  const state = readJson(STATE_FILE);
  const gateId = state?.gate_id;
  if (!gateId) return { decision: 'none', reason: 'state has no gate_id' };
  const gp = gatePath(gateId);
  if (!existsSync(gp)) return { decision: 'none', reason: 'no approval yet' };
  const token = readJson(gp)?.token;
  if (typeof token !== 'string') return { decision: 'none', reason: 'approval file malformed' };
  if (!existsSync(PUBKEY_FILE)) return { decision: 'none', reason: 'public key missing' };
  const publicKeyPem = readFileSync(PUBKEY_FILE, 'utf8');
  const now = nowSec();
  const { set } = loadConsumedJtis(NONCE_FILE, now);
  const r = verifyGateToken({ token, publicKeyPem, expectedGateId: gateId, nowSec: now, consumedJtis: set });
  if (!r.ok) return { decision: 'none', reason: r.reason, gateId };
  return { decision: r.decision, gateId, jti: r.jti, exp: r.exp };
}

function cmdCheck() {
  try {
    process.stdout.write(readDecision().decision + '\n');
  } catch {
    process.stdout.write('none\n'); // fail-safe: unknown ⇒ stay parked
  }
}

function cmdConsume() {
  const d = readDecision();
  if (d.jti && d.exp) markJtiConsumed(NONCE_FILE, d.jti, d.exp, nowSec());
  if (d.gateId) {
    rmSync(gatePath(d.gateId), { force: true });
    rmSync(reqPath(d.gateId), { force: true });
  }
  rmSync(STATE_FILE, { force: true });
  process.stdout.write(`consumed ${d.gateId || '(none)'}\n`);
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'request') cmdRequest(rest);
else if (cmd === 'check') cmdCheck();
else if (cmd === 'consume') cmdConsume();
else {
  process.stderr.write('usage: gate-cli.mjs request|check|consume\n');
  process.exit(1);
}
