// PreToolUse hook (Bash|Write|Edit|MultiEdit) — THE AUTONOMY GATE.
//
// The SOLE deterministic safety gate for unattended (headless) runs. When CLAUDE_AUTONOMOUS=1 it
// HARD-BLOCKS (exit 2) every irreversible / high-blast-radius action (T4) and every outward action
// that needs human approval (T3) — including any attempt to edit the agent's OWN governance
// (settings / hooks / skills / CLAUDE.md / CI). That last class is the CVE-2025-53773 lesson:
// a Copilot agent rewrote its own approval settings and gained unrestricted shell. Never again.
//
// B4b token-gated release (the ONLY softening of the bare "never push" rule): a fresh, gate-bound,
// single-use, RSA-signed Approve token — minted ONLY by the Discord ops bot (which alone holds the
// private key) and verified here with the pinned PUBLIC key — turns EXACTLY two otherwise-blocked
// actions into allowed:  `git push <remote> auto/<branch>`  and  `gh pr create`.  Nothing else, and
// NONE of T4 (push main / deploy / destroy / governance edits), is ever unlockable by any token.
// Default-deny + fail-closed: any missing file / bad signature / metacharacter / mismatch ⇒ block.
//
// Modes:
//   - Interactive / supervised (marker UNSET): exit 0 — the human + Claude Code's own permission
//     prompts are the gate; this hook stands down so it never disrupts hands-on work.
//   - Autonomous (CLAUDE_AUTONOMOUS=1): enforce the tiers below. FAIL-CLOSED — any error blocks
//     (a halted run is safe; an ungated one is not).
//
// Tiers + full contract: nuc-platform/09-autonomy-contract.md. This is enforcement, not policy.

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readPayload } from './_util.mjs';
import { verifyGateToken, loadConsumedJtis } from '../scripts/gate-verify.mjs';

const AUTONOMOUS = process.env.CLAUDE_AUTONOMOUS === '1';

// Supervised run → gate stands down (human is in control).
if (!AUTONOMOUS) process.exit(0);

function block(reason) {
  console.error(
    `[autonomy-gate] BLOCKED (autonomous mode): ${reason}\n` +
      `This is a T3/T4 action — irreversible, outward, or governance-altering — and must NOT run unattended.\n` +
      `PARK it: record the intent in the plan as a step needing human approval, post a digest, continue safe-zone work.\n` +
      `Contract: nuc-platform/09-autonomy-contract.md`,
  );
  process.exit(2);
}

// ---- B4b approval-token plumbing (paths are env-overridable for testing; defaults = real install layout) ----
const HOME = homedir();
const STATE_FILE = process.env.GATE_STATE_FILE || join(HOME, '.claude', 'state', 'current-gate.json');
const TOKEN_DIR = process.env.GATE_TOKEN_DIR || join(HOME, '.claude', 'agent-gates', 'gates');
const PUBKEY_FILE = process.env.GATE_PUBKEY_FILE || join(process.cwd(), '.claude', 'keys', 'gate-approval.pub.pem');
const NONCE_FILE = process.env.GATE_NONCE_FILE || join(HOME, '.claude', 'agent-gate-nonces.json');

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

// Returns { ok:true } ONLY if a valid, fresh, gate-matched APPROVE token authorizes this exact command.
// Everything is fail-closed: any missing/corrupt input, bad signature, or mismatch ⇒ { ok:false }.
function gateApproves(cmd, kind) {
  try {
    if (!existsSync(STATE_FILE)) return { ok: false, reason: 'no current-gate state' };
    const state = readJson(STATE_FILE);
    const gateId = state?.gate_id;
    const branch = state?.branch;
    if (typeof gateId !== 'string' || !gateId) return { ok: false, reason: 'current gate has no gate_id' };

    // A push must target THIS gate's branch — bind the approved action to the approved gate.
    if (kind === 'push') {
      const m = cmd.match(/auto\/[\w.\/-]+/);
      const ref = m ? m[0] : '';
      if (!ref || ref !== branch) return { ok: false, reason: `push ref '${ref}' != gate branch '${branch}'` };
    }

    const tokenPath = join(TOKEN_DIR, `${gateId}.json`);
    if (!existsSync(tokenPath)) return { ok: false, reason: 'no approval token for this gate' };
    const token = readJson(tokenPath)?.token;
    if (typeof token !== 'string' || !token) return { ok: false, reason: 'token file malformed' };

    if (!existsSync(PUBKEY_FILE)) return { ok: false, reason: 'approval public key missing' };
    const publicKeyPem = readFileSync(PUBKEY_FILE, 'utf8');

    const nowSec = Math.floor(Date.now() / 1000);
    const { set: consumedJtis } = loadConsumedJtis(NONCE_FILE, nowSec);
    const r = verifyGateToken({ token, publicKeyPem, expectedGateId: gateId, nowSec, consumedJtis });
    if (!r.ok) return { ok: false, reason: r.reason };
    if (r.decision !== 'approve') return { ok: false, reason: `token decision is '${r.decision}', not approve` };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'gate-approval error (fail-closed): ' + (e?.message || e) };
  }
}

try {
  const payload = await readPayload();
  const tool = payload.tool_name || '';
  const input = payload.tool_input || {};

  // ---- File-writing tools: protect the agent's own governance + deploy/secret surface (T4) ----
  if (tool === 'Write' || tool === 'Edit' || tool === 'MultiEdit') {
    const fp = String(input.file_path || '')
      .replace(/\\/g, '/')
      .toLowerCase();
    const GOVERNANCE = [
      { name: 'Claude Code settings', re: /\.claude\/settings(\.local)?\.json$/ },
      { name: 'a Claude Code hook', re: /\.claude\/hooks\// },
      { name: 'a skill (agent behaviour)', re: /\.claude\/skills\// },
      { name: 'the auto-pilot orchestrator', re: /\.claude\/scripts\// },
      { name: 'agent memory', re: /\.claude\/memory\// },
      { name: 'a CLAUDE.md rule file', re: /(^|\/)claude\.md$/ },
      { name: 'a CI/CD workflow', re: /\.github\/workflows\// },
      { name: 'git internals', re: /(^|\/)\.git\// },
      { name: 'an .env secret file', re: /(^|\/)\.env(\.|$)/ },
    ];
    for (const g of GOVERNANCE) {
      if (g.re.test(fp)) {
        block(
          `writing to ${g.name} (${input.file_path}) — the agent must never edit its own guardrails / deploy / secret surface unattended; propose the change for a human to commit`,
        );
      }
    }
    process.exit(0); // any other file (branch code, docs, plans, tests) is safe-zone T1/T2
  }

  // ---- Bash: deny irreversible / outward command classes ----
  if (tool === 'Bash') {
    const cmd = String(input.command || '');

    // (A) HARD denials — NEVER unlockable by any token (all T4 + dangerous T3). Checked FIRST.
    const HARD_DENY = [
      {
        name: 'force push / history rewrite',
        re: /\bgit\s+push\b.*?(?:\s|^)(?:-f|--force(?:-with-lease)?|--mirror|--all|--delete)(?:\s|=|$)|\bgit\s+rebase\b|\bgit\s+reset\s+--hard\b|\bgit\s+commit\s+--amend\b/,
      },
      { name: 'branch/merge mutation', re: /\bgit\s+merge\b|\bgit\s+branch\s+-D\b|\bgit\s+clean\s+-[a-z]*f/ },
      { name: 'PR merge', re: /\bgh\s+pr\s+merge\b/ },
      { name: 'release / publish', re: /\bgh\s+release\b|\bnpm\s+publish\b/ },
      { name: 'recursive/force file deletion', re: /\brm\s+-[a-z]*[rf]|\brm\s+--(force|recursive)/i },
      {
        name: 'docker mutation / deploy',
        re: /\bdocker(\s+compose|-compose)?\s+(up|down|stop|start|restart|rm|rmi|kill|prune)\b|\bdocker\s+(volume|system|image|container)\s+(rm|prune)\b/,
      },
      { name: 'remote access to the NUC (gated)', re: /\bssh\b/ },
      { name: 'watchtower / deploy trigger', re: /watchtower/i },
      {
        name: 'database drop/truncate',
        re: /\bdrop\s+(table|database|schema)\b|\bdropdb\b|\btruncate\s+table\b/i,
      },
      {
        name: 'destructive prisma (reset/deploy/force)',
        re: /\bprisma\s+migrate\s+(reset|deploy)\b|\bprisma\s+db\s+push\b.*--force/i,
      },
      {
        name: 'dependency install (T3 — needs the approval path)',
        re: /\b(npm|pnpm|yarn)\s+(i|install|add)\s+(?!-)\S|\bpip[3]?\s+install\s+(?!-)/i,
      },
      { name: 'system power/service control', re: /\b(shutdown|reboot|poweroff|halt|systemctl)\b/ },
    ];
    for (const d of HARD_DENY) {
      if (d.re.test(cmd)) block(`${d.name}: \`${cmd.slice(0, 120)}\``);
    }

    // (B) Token-UNLOCKABLE actions — a valid Approve token for the CURRENT gate turns exactly these from block→allow:
    //     (1) `git push <remote> auto/<branch>` (non-force; force is hard-denied above) and (2) `gh pr create`.
    //     STRICT default-deny: reject ANY shell metacharacter so a second command can't ride past the gate.
    const trimmed = cmd.trim();
    const hasMeta = /[\n\r;&|<>`]|\$[({]/.test(cmd);
    const isPushAuto =
      !hasMeta && /^git\s+push\s+(?:(?:-u|--set-upstream)\s+)?[\w.-]+\s+auto\/[\w.\/-]+$/.test(trimmed);
    const isPrCreate = !hasMeta && /^gh\s+pr\s+create\b/.test(trimmed);
    if (isPushAuto || isPrCreate) {
      const v = gateApproves(trimmed, isPushAuto ? 'push' : 'pr');
      if (v.ok) process.exit(0); // approved → allow EXACTLY this command
      block(
        `${isPushAuto ? "git push 'auto/' branch" : 'gh pr create'} is gate-controlled — ${v.reason}. ` +
          `PARK and await an Approve from the supervisor (Discord); do not retry blindly.`,
      );
    }

    // (C) Any other git push / gh pr create that did NOT qualify (non-auto branch, bare push, metachars, …) → blocked.
    if (/\bgit\s+push\b/.test(cmd)) {
      block(`git push — only a clean, token-approved \`git push <remote> auto/<branch>\` is allowed: \`${cmd.slice(0, 120)}\``);
    }
    if (/\bgh\s+pr\s+create\b/.test(cmd)) {
      block(`gh pr create — needs a clean, token-approved invocation (no shell metacharacters): \`${cmd.slice(0, 120)}\``);
    }

    process.exit(0); // git add/commit (local), tests, build, prettier, grep, ls → safe-zone
  }

  process.exit(0); // tool not in scope
} catch (e) {
  // Fail-CLOSED in autonomous mode.
  console.error(`[autonomy-gate] BLOCKED: gate error in autonomous mode (${e?.message || e}) — failing closed.`);
  process.exit(2);
}
