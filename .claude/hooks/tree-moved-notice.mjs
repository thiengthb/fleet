// @vi WHAT: Ghi lại "dấu tay" của cây git khi tôi kết thúc một lượt, rồi so lại khi anh gửi lượt tiếp theo.
//   Nếu có gì đổi trong lúc tôi KHÔNG chạy — anh sửa file, hay một phiên Claude song song commit/pull — nó nói
//   cho tôi biết chính xác cái gì đã đổi, ngay đầu lượt.
// @vi WHEN: Hai chỗ. Ở `Stop` nó chỉ lưu dấu tay (im lặng). Ở `UserPromptSubmit` nó so và báo nếu lệch.
// @vi WHY: `memory: user-edits-files-concurrently` là một lỗi đã tái diễn: tôi build/commit đè lên việc của
//   người khác trong cùng cây. Trong phiên 2026-07-31 nó xảy ra BA lần — `sprawl-check.mjs` bẩn rồi sạch,
//   `health-sweep-log.md` tự đổi 1→2 BROKEN, và `main` tự nhảy 4 commit từ origin. Cả ba lần tôi chỉ phát hiện
//   nhờ tình cờ chạy `git status`. Đây là cơ chế đúng cho việc đó, và nó KHÔNG BAO GIỜ chặn.
//
// UserPromptSubmit + Stop hook — a notice, never a gate.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// WHY NOT `FileChanged`, which is what the plan (A6) asked for.
//
// Verified against the hooks reference before building: `FileChanged` **cannot surface anything to Claude** —
// "Cannot use `systemMessage` or `additionalContext` — these have no effect for `FileChanged`", and its exit 2
// blocks nothing and only prints stderr to the user. A hook the agent cannot hear does not solve "the agent
// overwrote someone else's work". Same shape as the `PreCompact` finding earlier in this plan: the event exists,
// the injection path does not. So A6 moved to `UserPromptSubmit`, which the same reference documents as
// injecting `hookSpecificOutput.additionalContext` "alongside the submitted prompt".
//
// WHY THE Stop/UserPromptSubmit PAIR IS MORE PRECISE THAN EITHER ALONE.
// Snapshot at Stop = the tree as I left it. Compare at the next prompt = the tree as I find it. The delta is
// exactly what changed while I was NOT running, which is the thing worth reporting. Comparing prompt-to-prompt
// instead would fold in all of my own edits and drown the signal.
//
// IT MUST NEVER BLOCK. `UserPromptSubmit` exit 2 "blocks prompt processing and ERASES the prompt" — losing what
// the user typed would be far worse than the problem this solves. Every path here exits 0.
//
// COST, measured 2026-07-31 on this repo before choosing the design: 91–231ms for `git status --porcelain` +
// `git rev-parse HEAD`. That is once per user prompt, not per tool call — the distinction F4 (hook spam adds
// latency to every tool call) turns on.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────

import os from 'node:os';
import path from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { readPayload } from './_util.mjs';

const MAX_LISTED = 12; // a notice longer than this stops being read

function git(args, cwd) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 10_000 });
  if (r.status !== 0) return null;
  return (r.stdout || '').trim();
}

/** HEAD plus the porcelain status — the two things that move when someone else works in this tree. */
function fingerprint(cwd) {
  const head = git(['rev-parse', 'HEAD'], cwd);
  const status = git(['status', '--porcelain'], cwd);
  if (head === null || status === null) return null; // not a repo, or git unavailable → stay silent
  return { head, status };
}

function markerPath(sessionId) {
  const dir = path.join(os.tmpdir(), 'claude-tree-moved');
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    /* fall through — write will fail and we exit 0 */
  }
  return path.join(dir, `${sessionId}.json`);
}

/** Parse porcelain into a path→code map so a diff can name what changed and how. */
function toMap(status) {
  const m = new Map();
  for (const line of String(status).split('\n')) {
    if (!line.trim()) continue;
    const code = line.slice(0, 2);
    const p = line.slice(3).trim();
    if (p) m.set(p, code);
  }
  return m;
}

function describeDelta(before, after) {
  const b = toMap(before.status);
  const a = toMap(after.status);
  const appeared = [];
  const vanished = [];
  const changed = [];
  for (const [p, code] of a) {
    if (!b.has(p)) appeared.push(`${code} ${p}`);
    else if (b.get(p) !== code) changed.push(`${b.get(p)}→${code} ${p}`);
  }
  for (const [p, code] of b) if (!a.has(p)) vanished.push(`${code} ${p}`);

  const lines = [];
  if (before.head !== after.head) {
    // The most consequential case and the easiest to miss: someone else committed or pulled under you.
    const range = `${before.head.slice(0, 7)}..${after.head.slice(0, 7)}`;
    const subjects = git(['log', '--oneline', range], process.cwd());
    lines.push(`HEAD moved ${range} while you were not running:`);
    if (subjects) for (const s of subjects.split('\n').slice(0, MAX_LISTED)) lines.push(`    ${s}`);
  }
  const section = (label, arr) => {
    if (!arr.length) return;
    lines.push(`${label} (${arr.length}):`);
    for (const x of arr.slice(0, MAX_LISTED)) lines.push(`    ${x}`);
    if (arr.length > MAX_LISTED) lines.push(`    …and ${arr.length - MAX_LISTED} more`);
  };
  section('appeared', appeared);
  section('vanished', vanished);
  section('changed', changed);
  return lines;
}

async function main() {
  const payload = await readPayload();
  const event = payload.hook_event_name || '';
  const sessionId = String(payload.session_id || '').replace(/[^A-Za-z0-9_-]/g, '');
  if (!sessionId) process.exit(0);

  const cwd = payload.cwd || process.cwd();
  const marker = markerPath(sessionId);

  const now = fingerprint(cwd);
  if (!now) process.exit(0);

  // ── Stop: record only. Never speaks.
  if (event === 'Stop') {
    try {
      writeFileSync(marker, JSON.stringify(now));
    } catch {
      /* a lost snapshot costs one missed notice, never a failure */
    }
    process.exit(0);
  }

  // ── UserPromptSubmit: compare, report, re-baseline.
  let before = null;
  if (existsSync(marker)) {
    try {
      before = JSON.parse(readFileSync(marker, 'utf8'));
    } catch {
      before = null;
    }
  }
  // Re-baseline unconditionally, so one notice is never repeated on the next prompt.
  try {
    writeFileSync(marker, JSON.stringify(now));
  } catch {
    /* ignore */
  }

  // First prompt of a session has nothing to compare against — that is not a finding.
  if (!before || typeof before.head !== 'string' || typeof before.status !== 'string') process.exit(0);
  if (before.head === now.head && before.status === now.status) process.exit(0);

  const lines = describeDelta(before, now);
  if (!lines.length) process.exit(0);

  const text =
    'The working tree changed while you were not running (another session, the user, or a pull).\n' +
    lines.join('\n') +
    '\nRe-read anything you are about to build on, and stage only your own files.\n' +
    '(memory: user-edits-files-concurrently)';

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: text },
    }),
  );
  process.exit(0);
}

main().catch(() => process.exit(0)); // a notice must never cost the user their prompt
