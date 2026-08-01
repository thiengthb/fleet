// @vi WHAT: Khi phiên chạy mà không có người ngồi trước máy, nó CHẶN mọi hành động khó thu hồi: push lên main, deploy, xoá dữ
//   liệu, cài thêm thư viện, mở PR, ssh — và chặn cả việc agent tự sửa luật của chính nó.
// @vi WHY: Đây là cái gác DUY NHẤT cho phiên tự chạy. Riêng khoản "không cho agent sửa luật của chính nó" là bài học từ lỗ
//   bảo mật CVE-2025-53773: một agent sửa được file luật của nó thì mọi luật còn lại thành vô nghĩa. Nó fail-closed —
//   không đọc được dữ liệu vào thì coi như chặn, vì một cái gác không đọc được thì cũng không kiểm được.
//
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
// 2026-07-28 (later the same day) — TRIGGER WIDENED, from evidence.
// The gate used to fire only on CLAUDE_AUTONOMOUS=1, which the retired orchestrator set and nothing
// sets now. A probe run settled what the harness actually exposes:
//
//   interactive terminal (`claude`)  -> CLAUDE_CODE_ENTRYPOINT = "cli"
//   headless        (`claude -p`)    -> CLAUDE_CODE_ENTRYPOINT = "sdk-cli"
//
// So a non-interactive run IS self-identifying, and the gate no longer depends on someone remembering
// an env var. `sdk-cli` now triggers enforcement on its own.
//
// ⚠ RESIDUAL RISK, deliberately not papered over: this was verified for LOCAL headless only. What a
// scheduled/remote CLOUD agent reports is still unverified — it is not reachable from here. Rather than
// guess, an UNKNOWN entrypoint does NOT silently pass: it warns once per session (below), loudly, to both
// the user and the model. Blocking on unknown was rejected on purpose — an unrecognised *interactive*
// entrypoint (an IDE, the desktop app) would then break hands-on work, and a gate that gets in the way
// gets disabled. Explicitly set CLAUDE_AUTONOMOUS=1 in any scheduled/remote run's config.
//
// 2026-07-29 — PROPOSED (not installed). Three changes, all marked `PROPOSED 2026-07-29` below.
// Driver: platform/plans/2026-07-29-idea-0023-mcp-platform-server-build.md Step 2.2 / AC-5 — the
// `rulebook` MCP server now accepts lessons from other projects into platform/inbox/quarantine/,
// and quarantine is only a wall if PROMOTION out of it is blocked rather than merely discouraged.
//
//   1. platform/standards/** joins the governance write-block (durable law, incl. the autonomy
//      contract this hook enforces). This FLIPS an existing test case that asserted ALLOW.
//   2. platform/inbox/quarantine/** joins it too — the agent must not launder untrusted input by
//      editing it into shape.
//   3. Bash can no longer write to governance either. `cp evil.md .claude/hooks/x.mjs` was ALLOWED
//      before this change: the governance block lived only on Write/Edit, and a shell copy walked
//      straight around it. That hole predates quarantine; the promotion path is what exposed it.
//
// Rationale, alternatives and the residual risk (the Read tool is not gated by this matcher):
// platform/proposals/2026-07-29-quarantine-promotion-gate.md
//
// Tiers + full contract: platform/standards/autonomy-contract.md. This is enforcement, not policy.

import { existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { recordRun } from './_util.mjs';

// Deliberately NOT via readPayload (this hook parses stdin strictly, fail-closed — see below), so it
// records itself. The gate is the one hook whose firing rate must be readable: a gate nobody trips is
// either perfect or dead, and only the count tells you which.
recordRun();

const ENTRYPOINT = process.env.CLAUDE_CODE_ENTRYPOINT || '';
/** Verified non-interactive: nobody is watching, enforce. */
const NON_INTERACTIVE = new Set(['sdk-cli']);
/** Verified interactive: a human + the permission prompts are the gate; stand down. */
const INTERACTIVE = new Set(['cli']);

const AUTONOMOUS = process.env.CLAUDE_AUTONOMOUS === '1' || NON_INTERACTIVE.has(ENTRYPOINT);

if (!AUTONOMOUS) {
  // Unrecognised entrypoint → we cannot tell whether a human is present. Say so ONCE per session
  // instead of standing down quietly; a silent stand-down is how the gap stayed invisible.
  if (ENTRYPOINT && !INTERACTIVE.has(ENTRYPOINT)) {
    const marker = join(tmpdir(), `autonomy-gate-unknown-${process.env.CLAUDE_CODE_SESSION_ID || 'nosid'}`);
    if (!existsSync(marker)) {
      try {
        writeFileSync(marker, ENTRYPOINT);
      } catch {
        /* best effort — worst case the notice repeats */
      }
      const msg =
        `⚠ autonomy-gate: UNKNOWN entrypoint "${ENTRYPOINT}" — cannot tell if this run is supervised, so the ` +
        `gate is STANDING DOWN (T3/T4 actions are NOT blocked this session).\n` +
        `  • unattended run? stop and set CLAUDE_AUTONOMOUS=1 in its configuration.\n` +
        `  • interactive? add "${ENTRYPOINT}" to INTERACTIVE in .claude/hooks/autonomy-gate.mjs to silence this.`;
      console.log(
        JSON.stringify({
          systemMessage: msg,
          hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: msg },
        }),
      );
    }
  }
  process.exit(0);
}

function block(reason) {
  console.error(
    `[autonomy-gate] BLOCKED (autonomous mode): ${reason}\n` +
      `This is a T3/T4 action — irreversible, outward, or governance-altering — and must NOT run unattended.\n` +
      `PARK it: record the intent in the plan as a step needing human approval, post a digest, continue safe-zone work.\n` +
      `Contract: platform/standards/autonomy-contract.md`,
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
      // INSTALLED 2026-08-01 (proposal `platform/proposals/2026-08-01-agents-governance-gate.md`).
      // `.claude/agents/**` is a subagent's SYSTEM PROMPT: the same class as a skill or a path-scoped
      // rule (it tells a model how to behave), and the only member of that class missing here. Measured
      // against this gate before the change: Write, Edit, MultiEdit, `cp`, `>>`, `sed -i` and the
      // Windows-separator spelling into `.claude/agents/` were ALL allowed unattended — 8 open doors,
      // while `skills/`, `rules/` and `hooks/` were blocked. Worse than editing a skill, because a
      // subagent's prompt shapes a SECOND model's output that the main loop then trusts as an
      // independent opinion, and no diff of the reviewed code shows why the review came back clean.
      { name: 'a subagent definition (agent behaviour)', re: /\.claude\/agents\// },
      // INSTALLED 2026-08-01 (proposal `platform/proposals/2026-08-01-governance-workflows-and-statusline.md`),
      // and found the same way as the entry above: by trying to obey the list and noticing what it omits. The
      // list already named `.github/workflows/` — the CI directory — which reads as covering "workflows" and
      // does not. `.claude/workflows/**` holds JavaScript the runtime EXECUTES to spawn subagents (capped at 16
      // concurrent / 1,000 per run) with a tool set, a model and an `agentType` the script itself chooses. That
      // is a larger capability grant than several entries here, and the directory is not hypothetical:
      // `deep-research.js` already lives there and fans out web agents. Two omissions of the same kind mean the
      // original list was built by enumerating what had been EDITED, not what confers capability.
      { name: 'a workflow script (spawns subagents with a tool set of its choosing)', re: /\.claude\/workflows\// },
      { name: 'a CLAUDE.md rule file', re: /(^|\/)claude(\.local)?\.md$/ },
      { name: 'a CI/CD workflow', re: /\.github\/workflows\// },
      { name: 'git internals', re: /(^|\/)\.git\// },
      { name: 'an .env secret file', re: /(^|\/)\.env(\.|$)/ },
      // PROPOSED 2026-07-29 (1) — the durable law layer. `standards/autonomy-contract.md` is the
      // policy THIS hook enforces; an agent that can edit it unattended can rewrite its own tiers.
      { name: 'a platform standard (durable law)', re: /platform\/standards\// },
      // PROPOSED 2026-07-29 (2) — untrusted input. Editing a quarantined lesson is how it gets
      // laundered into something that looks reviewed. Only a human touches these.
      { name: 'the quarantine inbox (untrusted input)', re: /platform\/inbox\/quarantine\// },
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
    // Windows-style separators normalised for the path checks ONLY — rewriting `cmd` itself would
    // quietly change what every pre-existing HARD_DENY regex below sees.
    const cmdPaths = cmd.replace(/\\/g, '/');

    // PROPOSED 2026-07-29 (3) — close the shell bypass of the governance write-block above.
    // The file-tool branch protects governance from Write/Edit; nothing protected it from
    // `cp`, `tee`, `sed -i` or a redirect, so the CVE-2025-53773 class was reachable by shell.
    const GOV_PATH =
      /(?:\.claude\/(?:settings|hooks|skills|rules|scripts|memory|agents|workflows)|\.github\/workflows|(?:^|[\s"'/=])claude(?:\.local)?\.md|platform\/standards\/|platform\/inbox\/quarantine\/)/i;
    // Verbs that can put bytes into a file. `grep`/`cat`/`ls` are absent on purpose: reading
    // governance is not the threat, and a gate that blocks reading gets disabled.
    const WRITE_VERB =
      /(?:^|[\s|&;(])(?:cp|mv|ln|install|rsync|tee|dd|truncate|shred|sed\s+-i|perl\s+-[a-z]*i|python3?\s+-c|node\s+-e|awk\s+-i)\b/i;
    if (WRITE_VERB.test(cmdPaths) && GOV_PATH.test(cmdPaths)) {
      block(
        `writing to governance from a shell command — the Write/Edit gate does not see this path: \`${cmd.slice(0, 120)}\``,
      );
    }
    // A redirect is judged by its TARGET, not by the command: `grep -r x .claude/skills > /tmp/o`
    // must stay allowed, `cat lesson.md >> CLAUDE.md` must not.
    for (const m of cmdPaths.matchAll(/>>?\s*("[^"]*"|'[^']*'|[^\s|&;<>]+)/g)) {
      const target = m[1].replace(/^["']|["']$/g, '');
      if (GOV_PATH.test(target)) {
        block(`redirecting output into governance (${target}) — propose the change for a human to commit`);
      }
    }

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
