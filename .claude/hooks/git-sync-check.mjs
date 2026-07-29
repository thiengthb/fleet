// SessionStart hook — MULTI-MACHINE git-sync guard.
// Best-effort `git fetch` + ahead/behind/dirty scan across every repo under the MiniServer root,
// surfaced as a non-blocking warning to the user (`systemMessage`) AND a compact note to the model
// (`additionalContext`) so stale-local / unpushed work is caught the moment you sit down at a machine.
//
// Why SessionStart: this is the ONE moment a multi-machine workflow needs the check — you may have
// pushed from another box (local now BEHIND origin) or left work unpushed here last time (local AHEAD).
// Runs on startup/resume/clear; SKIPS 'compact' (automatic + frequent → would be noise, and the repos
// have not changed mid-session since they were last scanned at startup).
//
// Output contract (SessionStart, exit 0 only): top-level `systemMessage` shows to the user;
// `hookSpecificOutput.additionalContext` is injected into Claude's context. Exit 2 / non-zero is
// IGNORED here (cannot block a session start) — so this hook always exits 0.
//
// Fail-safe: every git call is guarded and never throws; a repo that errors is silently skipped.
// If nothing is out of sync the hook stays completely silent (exit 0, no output), matching the
// platform's no-noise hook style (cf. suggest-session-wrap.mjs).

import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPayload } from './_util.mjs';
import { gitRepos } from '../scripts/_layout.mjs';

const FETCH_TIMEOUT_MS = 8000; // per-repo network budget; the fetch process is killed if exceeded
const LOCAL_TIMEOUT_MS = 5000; // local-only git calls (status / rev-list)

// Root = two levels up from this file (.claude/hooks/ → MiniServer/). Derived from the script path,
// NOT cwd, so it is correct no matter which subdir the session was launched from.
const HOOK_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HOOK_DIR, '..', '..');

// Non-interactive git: never prompt for credentials or host-key confirmation (either would HANG the
// hook until its timeout). Offline / no-auth simply makes `fetch` fail → handled as best-effort.
const GIT_ENV = {
  ...process.env,
  GIT_TERMINAL_PROMPT: '0',
  GIT_SSH_COMMAND: 'ssh -o BatchMode=yes -o ConnectTimeout=8',
};

/** Run a git command in `repo`; resolves {ok, out} and NEVER rejects. */
function git(repo, args, timeout) {
  return new Promise((resolve) => {
    execFile(
      'git',
      ['-C', repo, ...args],
      { timeout, env: GIT_ENV, windowsHide: true, maxBuffer: 1 << 20 },
      (err, stdout) => resolve({ ok: !err, out: (stdout || '').toString().trim() }),
    );
  });
}

/**
 * The fleet root repo (if it is one) + every project repo, wherever it lives in the tree.
 * Delegated to `_layout.mjs`: this used to look only at immediate children, so when the nine app repos moved
 * into `projects/` on 2026-07-30 it went from watching 13 repos to 4 — without reporting anything wrong.
 */
const findRepos = (root) => gitRepos(root);

async function scan(repo) {
  const name = path.basename(repo);
  // Best-effort fetch: refresh @{u}. If it fails (offline / no auth) we still report local-accurate
  // ahead + dirty, and behind against the last-known remote.
  await git(repo, ['fetch', '--quiet', '--no-tags'], FETCH_TIMEOUT_MS);

  const dirtyR = await git(repo, ['status', '--porcelain'], LOCAL_TIMEOUT_MS);
  const dirty = dirtyR.ok && dirtyR.out.length > 0;
  const dirtyCount = dirty ? dirtyR.out.split('\n').length : 0;

  // `A...B` left/right counts: left = commits on HEAD not upstream (ahead), right = on upstream not
  // HEAD (behind). Fails (ok=false) when there is no tracking branch → treated as no-signal.
  let ahead = 0;
  let behind = 0;
  const counts = await git(repo, ['rev-list', '--left-right', '--count', 'HEAD...@{u}'], LOCAL_TIMEOUT_MS);
  if (counts.ok && /^\d+\s+\d+$/.test(counts.out)) {
    const [a, b] = counts.out.split(/\s+/).map(Number);
    ahead = a;
    behind = b;
  }
  return { name, dirty, dirtyCount, ahead, behind };
}

async function main() {
  const payload = await readPayload();
  // 'compact' is automatic + frequent and the repos haven't changed since startup → stay silent.
  if (String(payload.source || '') === 'compact') process.exit(0);

  const repos = findRepos(ROOT);
  if (!repos.length) process.exit(0);

  const results = await Promise.all(repos.map((r) => scan(r).catch(() => null)));
  const flagged = results.filter((r) => r && (r.behind > 0 || r.ahead > 0 || r.dirty));
  if (!flagged.length) process.exit(0); // everything synced & clean → completely silent

  // User-facing summary (Vietnamese — agent↔user chat language).
  const lines = flagged.map((r) => {
    const bits = [];
    if (r.behind > 0) bits.push(`↓${r.behind} sau remote (nên pull)`);
    if (r.ahead > 0) bits.push(`↑${r.ahead} chưa push`);
    if (r.dirty) bits.push(`✎${r.dirtyCount} chưa commit`);
    return `• ${r.name}: ${bits.join(', ')}`;
  });
  const systemMessage =
    `🔄 Git-sync (đa máy) — ${flagged.length} repo cần chú ý:\n${lines.join('\n')}\n` +
    `→ Repo "↓ sau remote" nên \`git pull --ff-only\` trước khi sửa để khỏi build trên code cũ.`;

  // Model-facing context (English — dev artifact) so the agent itself pulls stale repos before editing.
  const ctx = ['GIT SYNC STATUS (multi-machine guard, checked at session start):'];
  for (const r of flagged) {
    const s = [];
    if (r.behind) s.push(`behind ${r.behind}`);
    if (r.ahead) s.push(`ahead ${r.ahead}`);
    if (r.dirty) s.push(`${r.dirtyCount} uncommitted`);
    ctx.push(`- ${r.name}: ${s.join(', ')}`);
  }
  const behindNames = flagged.filter((r) => r.behind > 0).map((r) => r.name);
  if (behindNames.length) {
    ctx.push(
      `ACTION: ${behindNames.join(', ')} are BEHIND origin — local code is stale. Run ` +
        `\`git pull --ff-only\` there before editing (the user works across multiple machines).`,
    );
  }

  process.stdout.write(
    JSON.stringify({
      systemMessage,
      suppressOutput: true,
      hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: ctx.join('\n') },
    }),
  );
  process.exit(0);
}

main().catch(() => process.exit(0));
