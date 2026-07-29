// Shared helpers for MiniServer Claude Code hooks (Node ESM — Windows-safe, no bash).
// Each hook reads a JSON payload from stdin and decides via exit code:
//   PreToolUse:  exit 2 = block the tool call, stderr is shown to Claude.
//   PostToolUse: exit 2 = feedback to Claude (write already happened, cannot block).
//   exit 0 = silent success.

import { appendFileSync, statSync, mkdirSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { homedir } from 'node:os';

/* ─────────────────────────────────────────────────────────────────────── usage recording ──
 * WHY. A hook is invisible to every other measurement on this platform. It is not a tool call, so it
 * never appears in a session transcript, so `usage-census.mjs` — which mines transcripts — can count how
 * often a hook was READ or EDITED but not once how often it actually RAN. That left the most important
 * question about the enforcement layer unanswerable: which of these guards has never fired, and which
 * fires so often it has become wallpaper?
 *
 * WHERE IT IS. Here, in the one module nearly every hook already imports, keyed off `process.argv[1]` and
 * the process exit code. That buys the whole layer with no per-hook edit and no per-hook drift: a new hook
 * that calls `readPayload()` is counted the day it is written, and a hook that stops calling it stops
 * lying rather than silently reporting stale numbers.
 *
 * WHAT IS RECORDED, and nothing more: a timestamp, the hook's filename, and its exit code. No file path,
 * no tool input, no line of source, no session id. The exit code is the finding — 0 means the guard looked
 * and stayed silent, 2 means it fired — and it is enough to answer both questions above.
 *
 * Local only, never committed (`~/.claude/hook-usage.jsonl`), capped, and switchable off with
 * `HOOK_USAGE_LOG=off`. A hook must never fail because its bookkeeping failed, so every write is
 * best-effort and every error is swallowed.
 */

const USAGE_CAP_BYTES = 4 * 1024 * 1024;

function usageLogPath() {
  const override = process.env.HOOK_USAGE_LOG;
  if (override !== undefined) return /^(0|off|false|no)$/i.test(override.trim()) ? null : override;
  return join(homedir(), '.claude', 'hook-usage.jsonl');
}

let recording = false;

/**
 * Record that THIS hook ran, and with what exit code. Idempotent — safe to call more than once.
 * Called automatically by `readPayload()`; SessionStart hooks that read no stdin call it directly.
 */
export function recordRun() {
  if (recording) return;
  recording = true;
  const path = usageLogPath();
  if (!path) return;
  const hook = basename(process.argv[1] || 'unknown');
  const started = Date.now();
  process.on('exit', (code) => {
    try {
      let size = 0;
      try {
        size = statSync(path).size;
      } catch {
        mkdirSync(dirname(path), { recursive: true });
      }
      if (size > USAGE_CAP_BYTES) return; // stop growing rather than rotate — this is a counter, not an audit trail
      appendFileSync(path, JSON.stringify({ ts: new Date().toISOString(), hook, code, ms: Date.now() - started }) + '\n');
    } catch {
      /* bookkeeping must never be the reason a hook fails */
    }
  });
}

/** Read and parse the hook JSON payload from stdin. Returns {} on any error. */
export async function readPayload() {
  recordRun();
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Extract the text being written from a tool_input (Write/Edit/MultiEdit). */
export function getWriteText(input = {}) {
  if (typeof input.content === 'string') return input.content; // Write
  if (typeof input.new_string === 'string') return input.new_string; // Edit
  if (Array.isArray(input.edits)) return input.edits.map((e) => e?.new_string || '').join('\n'); // MultiEdit
  return '';
}
