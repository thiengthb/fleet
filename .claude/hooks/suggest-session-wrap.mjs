// Stop hook — SMART, non-blocking nudge to run /session-wrap when the session did substantial,
// un-recorded work. Fires AT MOST once per session, never blocks, never nags.
//
// Why Stop (not SessionEnd): SessionEnd runs after teardown and CANNOT surface a user-visible message;
// a Stop hook returns a `systemMessage` that shows to the user while they're still present and able to act.
//
// "Smart" = two transcript-derived gates + a once-per-session marker:
//   Gate 1 — substantial work : >= WORK_FILE_THRESHOLD distinct non-knowledge files edited,
//                               OR >= TOTAL_EDIT_THRESHOLD total Edit/Write/MultiEdit calls.
//   Gate 2 — not already wrapped : the session has NOT edited a knowledge file (decisions.md / 00-map.md /
//                               registries/knowledge-ledger.md / MEMORY.md / a personal-memory file / registries/known-traps.md).
//                               If it has, the user already recorded — stay silent.
//   Marker — a per-session_id file in the OS temp dir so the nudge speaks only once.
//
// Fail-safe: any error / missing data => exit 0 silently. This hook must NEVER disrupt the session.

import os from 'node:os';
import path from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { readPayload } from './_util.mjs';

const WORK_FILE_THRESHOLD = 3; // distinct non-knowledge files edited
const TOTAL_EDIT_THRESHOLD = 5; // total Edit/Write/MultiEdit calls
const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit']);

// Editing one of these means "knowledge was recorded this session" → suppress the nudge (Gate 2).
function isKnowledgeFile(p) {
  const n = p.replace(/\\/g, '/').toLowerCase();
  const base = n.split('/').pop() || '';
  return (
    base === 'decisions.md' ||
    base === '00-map.md' ||
    base === 'memory.md' ||
    n.includes('registries/knowledge-ledger.md') ||
    n.includes('registries/known-traps.md') ||
    n.includes('/memory/') // personal-memory files live under .../memory/
  );
}

// Recursively collect every tool_use object in a parsed transcript line (shape-agnostic: a tool_use block
// may sit at top level or nested inside message.content[]).
function collectToolUses(node, out) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const x of node) collectToolUses(x, out);
    return;
  }
  if (node.type === 'tool_use' && typeof node.name === 'string') out.push(node);
  for (const k of Object.keys(node)) collectToolUses(node[k], out);
}

async function main() {
  const payload = await readPayload();

  // Never interfere with a continuation loop.
  if (payload.stop_hook_active === true) process.exit(0);

  const sessionId = String(payload.session_id || '').replace(/[^A-Za-z0-9_-]/g, '');
  const transcriptPath = payload.transcript_path;
  if (!sessionId || !transcriptPath || !existsSync(transcriptPath)) process.exit(0);

  // Once-per-session marker. Temp dir: a stale clear at worst causes one duplicate nudge (harmless) and
  // keeps the repo clean of state files.
  const marker = path.join(os.tmpdir(), `claude-wrap-reminded-${sessionId}`);
  if (existsSync(marker)) process.exit(0);

  let raw;
  try {
    raw = readFileSync(transcriptPath, 'utf8');
  } catch {
    process.exit(0);
  }

  const workFiles = new Set();
  let totalEdits = 0;
  let wrapped = false;

  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    let obj;
    try {
      obj = JSON.parse(t);
    } catch {
      continue;
    }
    const tools = [];
    collectToolUses(obj, tools);
    for (const tool of tools) {
      if (!EDIT_TOOLS.has(tool.name)) continue;
      const fp = tool.input?.file_path;
      if (typeof fp !== 'string') continue;
      if (isKnowledgeFile(fp)) {
        wrapped = true; // Gate 2 signal
      } else {
        totalEdits++;
        workFiles.add(fp.replace(/\\/g, '/').toLowerCase());
      }
    }
  }

  // Gate 2 — knowledge already recorded this session → stay silent.
  if (wrapped) process.exit(0);

  // Gate 1 — substantial work?
  const substantial = workFiles.size >= WORK_FILE_THRESHOLD || totalEdits >= TOTAL_EDIT_THRESHOLD;
  if (!substantial) process.exit(0);

  // Fire once: write the marker, then surface the nudge.
  try {
    writeFileSync(marker, 'reminded');
  } catch {
    // best effort — still show the nudge even if the marker can't be written.
  }

  const msg =
    `📝 Session này đã sửa ${workFiles.size} file nhưng chưa ghi lại tri thức (decisions.md / memory). ` +
    `Cân nhắc chạy /session-wrap khi tới điểm dừng để lưu quyết định + bài học trước khi mất context.`;

  process.stdout.write(JSON.stringify({ systemMessage: msg, suppressOutput: true }));
  process.exit(0);
}

main().catch(() => process.exit(0));
