// PreToolUse hook (Bash|Write|Edit|MultiEdit) — THE AUTONOMY GATE.
//
// The SOLE deterministic safety gate for unattended (headless) runs. When CLAUDE_AUTONOMOUS=1 it
// HARD-BLOCKS (exit 2) every irreversible / high-blast-radius action (T4) and every outward action
// that needs human approval (T3) — including any attempt to edit the agent's OWN governance
// (settings / hooks / skills / CLAUDE.md / CI). That last class is the CVE-2025-53773 lesson:
// a Copilot agent rewrote its own approval settings and gained unrestricted shell. Never again.
//
// Modes:
//   - Interactive / supervised (marker UNSET): exit 0 — the human + Claude Code's own permission
//     prompts are the gate; this hook stands down so it never disrupts hands-on work.
//   - Autonomous (CLAUDE_AUTONOMOUS=1): enforce the tiers below. FAIL-CLOSED — any error blocks
//     (a halted run is safe; an ungated one is not).
//
// 2026-07-28 — SIMPLIFIED when the home-grown auto-pilot was retired (superseded by Claude Code's
// native scheduled/remote agents). The signed-token release path is gone with it: there is no longer
// a Discord control plane to mint an Approve token, so `git push` and `gh pr create` are now plainly
// blocked in autonomous mode rather than conditionally unlockable. Roughly 90 lines of crypto
// plumbing removed; the tier enforcement below is untouched.
//
// ⚠ OPEN RISK — READ BEFORE RELYING ON THIS GATE.
// The trigger is the env var CLAUDE_AUTONOMOUS=1, which was set by the retired local orchestrator.
// Nothing sets it today. A Claude Code **scheduled or remote (cloud) agent** is just as unattended,
// but is NOT known to set this var — so this gate may stand down for exactly the runs that need it
// most. This has NOT been verified empirically either way. Before running an unattended remote agent
// against this repo, confirm what the environment looks like and re-scope the trigger accordingly.
// Tracked in nuc-platform/09-autonomy-contract.md.
//
// Tiers + full contract: nuc-platform/09-autonomy-contract.md. This is enforcement, not policy.

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

// Deliberately NOT using _util.readPayload(): it returns {} on unparseable input, which the other
// (advisory) hooks want but this one must not — a payload the gate cannot read is a payload it
// cannot check, and "allow because we couldn't tell" is the opposite of fail-closed. Caught by the
// `malformed payload → BLOCK` case in autonomy-gate.test.mjs.
async function readPayloadStrict() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) throw new Error('empty payload');
  return JSON.parse(raw); // throws → caught below → block
}

try {
  const payload = await readPayloadStrict();
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
      { name: 'a path-scoped rule (agent behaviour)', re: /\.claude\/rules\// },
      { name: 'an agent script', re: /\.claude\/scripts\// },
      { name: 'agent memory', re: /\.claude\/memory\// },
      { name: 'a CLAUDE.md rule file', re: /(^|\/)claude(\.local)?\.md$/ },
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

    const HARD_DENY = [
      {
        name: 'force push / history rewrite',
        re: /\bgit\s+push\b.*?(?:\s|^)(?:-f|--force(?:-with-lease)?|--mirror|--all|--delete)(?:\s|=|$)|\bgit\s+rebase\b|\bgit\s+reset\s+--hard\b|\bgit\s+commit\s+--amend\b/,
      },
      { name: 'branch/merge mutation', re: /\bgit\s+merge\b|\bgit\s+branch\s+-D\b|\bgit\s+clean\s+-[a-z]*f/ },
      { name: 'any git push (outward — T3)', re: /\bgit\s+push\b/ },
      { name: 'PR create/merge (outward — T3)', re: /\bgh\s+pr\s+(create|merge)\b/ },
      { name: 'release / publish', re: /\bgh\s+release\b|\bnpm\s+publish\b/ },
      { name: 'recursive/force file deletion', re: /\brm\s+-[a-z]*[rf]|\brm\s+--(force|recursive)/i },
      {
        name: 'docker mutation / deploy',
        re: /\bdocker(\s+compose|-compose)?\s+(up|down|stop|start|restart|rm|rmi|kill|prune)\b|\bdocker\s+(volume|system|image|container)\s+(rm|prune)\b/,
      },
      { name: 'remote access to another host (gated)', re: /\bssh\b/ },
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
        name: 'dependency install (T3 — needs human approval)',
        re: /\b(npm|pnpm|yarn)\s+(i|install|add)\s+(?!-)\S|\bpip[3]?\s+install\s+(?!-)/i,
      },
      { name: 'system power/service control', re: /\b(shutdown|reboot|poweroff|halt|systemctl)\b/ },
    ];
    for (const d of HARD_DENY) {
      if (d.re.test(cmd)) block(`${d.name}: \`${cmd.slice(0, 120)}\``);
    }

    process.exit(0); // git add/commit (local), tests, build, prettier, grep, ls → safe-zone
  }

  process.exit(0); // tool not in scope
} catch (e) {
  // Fail-CLOSED in autonomous mode.
  console.error(`[autonomy-gate] BLOCKED: gate error in autonomous mode (${e?.message || e}) — failing closed.`);
  process.exit(2);
}
