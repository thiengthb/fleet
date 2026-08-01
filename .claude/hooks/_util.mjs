// @vi WHAT: Bộ hàm dùng chung của các hook: đọc dữ liệu Claude Code gửi vào, và ghi lại mỗi lần một hook chạy.
// @vi WHY: Việc ghi log đó là bằng chứng DUY NHẤT cho biết hook có chạy hay không — hook không phải một lệnh gọi công cụ nên
//   nó không xuất hiện trong bản ghi phiên. Nguyên tắc bất di bất dịch của file này: việc ghi chép không bao giờ được
//   làm thay đổi kết quả của hook, vì kết quả đó là toàn bộ hợp đồng giữa hook và Claude Code.
//
// Shared helpers for fleet Claude Code hooks (Node ESM — Windows-safe, no bash).
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
      /**
       * `spoke` — did this hook actually SAY anything? A correction of the note above, which claims "the exit
       * code is the finding". Measured 2026-08-01 over 2,874 real events: true for a fail-closed guard, false
       * for most. **7 of the 15 installed hooks have no `process.exit(2)` path at all** — `plan-checkin`,
       * `compact-recap`, `tree-moved-notice`, `git-sync-check`, `memory-wiring-check` and `harness-drift-check`
       * speak by printing `additionalContext` / `systemMessage` and exiting **0**; `prettier-on-edit` and
       * `suggest-session-wrap` work by side effect. For them `exit 0` means both "looked and spoke" and
       * "looked and said nothing", so `usage-census` can only print `n/a`, and the one question that decides
       * whether an advisory hook earns its keep had no answer.
       *
       * READ-ONLY, and that is the whole design. `bytesWritten` is a counter the stream already keeps, so this
       * observes the output without touching it. The first attempt wrapped `process.stdout.write` /
       * `process.stderr.write` instead, and was refused twice by the permission layer — correctly: a hook that
       * runs on every tool call and monkey-patches stdio is indistinguishable, from the outside, from one that
       * tampers with or exfiltrates what it sees. The refusal was a better reviewer than the author.
       *
       * ONE BOOLEAN, NEVER THE TEXT. The promise above — "a timestamp, the hook's filename, and its exit code.
       * No file path, no tool input, no line of source, no session id" — is kept exactly; this cannot see
       * content even in principle, only a byte count it does not record.
       *
       * A line written before this existed has no `spoke` key, and a reader must treat that as **UNKNOWN, never
       * `false`**: absence read as "never said a word" would fabricate a confident false verdict of death out of
       * a schema change. `usage-census` enforces that with two mutants, and prints `?` rather than `0`.
       *
       * Known limit, stated rather than hidden: a hook that writes ONLY whitespace counts as having spoken.
       * `> 0` is used instead of a threshold because a magic number would be a second thing to be wrong about,
       * and a hook printing a bare newline is a defect either way.
       */
      const spoke = (process.stdout.bytesWritten || 0) + (process.stderr.bytesWritten || 0) > 0;
      appendFileSync(
        path,
        JSON.stringify({ ts: new Date().toISOString(), hook, code, ms: Date.now() - started, spoke }) + '\n',
      );
    } catch {
      /* bookkeeping must never be the reason a hook fails */
    }
  });
}

/**
 * Declare what this hook does when its OWN logic throws — and make that a written choice, not an accident.
 *
 * WHY THIS EXISTS. Verified by experiment 2026-07-31: an exception anywhere in a hook's logic ends the process
 * with exit 1, and Claude Code reads any code that is neither 0 nor 2 as a *non-blocking error*. So a guard
 * whose regex throws does not block — it allows, quietly. `secret-guard` was measured doing exactly that: fed a
 * real token with a fault injected before its check, it exited 1 and the write would have gone through with the
 * secret in it. External statement of the same rule: "For a protection hook, an error should mean block, not
 * allow." (dev.to/redpa, found in the 2026-07-31 hook-practice sweep.)
 *
 * BUT NOT EVERY HOOK SHOULD FAIL CLOSED, and that is the part a blanket fix gets wrong. Blocking on error is
 * right only where the hook enforces a hard invariant. For an ADVISORY hook, exit 1 is already the correct
 * outcome — the tool call proceeds AND the failure shows in the transcript. Forcing those to exit 0 would be
 * worse than doing nothing: `recordRun` would log a clean 0 and the crash would become invisible, and forcing
 * them to exit 2 is the over-blocking that makes people switch guards off entirely.
 *
 * So this helper does not impose a policy. It makes each hook NAME its policy in one line, and replaces a raw
 * node stack trace with a sentence that says which mode was chosen and why.
 *
 * @param {0|1|2} code 2 = fail CLOSED (block; hard invariants only) · 1 = fail OPEN but VISIBLE (advisory) ·
 *                     0 = fail open and SILENT (almost never right — it hides the crash from the run log)
 * @param {string} why one short sentence, shown to Claude, saying what could not be checked
 */
export function declareFailMode(code, why) {
  const bail = (err) => {
    const hook = basename(process.argv[1] || 'unknown');
    const mode = code === 2 ? 'FAIL-CLOSED, blocking' : code === 1 ? 'fail-open, reported' : 'fail-open, silent';
    process.stderr.write(`${hook}: could not complete — ${err?.message || err}. ${why} [${mode}: exit ${code}]\n`);
    process.exit(code);
  };
  // Top-level `await` makes a throwing hook an unhandled REJECTION, not an uncaught exception. Handling only
  // the latter would have left every `await readPayload()` hook — which is all of them — still failing open.
  process.on('uncaughtException', bail);
  process.on('unhandledRejection', bail);
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
