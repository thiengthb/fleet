// @vi WHAT: Lần đầu trong phiên mà tôi sửa một trang giao diện hoặc danh mục MCP của sakubun, nó chặn lại một nhịp để nhắc:
//   thêm màn hình mới thì phải cập nhật trang /guide trong cùng lần sửa đó.
// @vi WHY: Anh chọn phương án nghiêm nhất (2026-07-23). Lần thử thứ hai thì cho qua — nên nó tốn một nhịp, không phải một
//   cuộc chiến. Phần cưỡng chế thật nằm ở test của sakubun; đây là lời nhắc ngay trong lúc làm.
//
// PreToolUse hook (Edit|Write|MultiEdit) — sakubun /guide coverage reminder (invariant #10).
// Fires ONCE per session, the first time a sakubun ROUTE page (app/.../page.tsx) or the MCP catalog/server
// is edited, to remind that a new user-facing surface MUST be reflected in the in-app /guide in the same
// change. The HARD enforcement is sakubun/lib/guide-coverage.test.ts (fails `npm test`); this is the
// in-loop nudge the user asked for (strictest option, 2026-07-23). It blocks the first such call (exit 2,
// stderr shown to Claude) then lets the immediate retry through — same "remind before the first write"
// shape as the ui-pattern-lock hook. Never fires for non-sakubun projects or unrelated files.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readPayload } from './_util.mjs';

const payload = await readPayload();
if (!['Edit', 'Write', 'MultiEdit'].includes(payload?.tool_name || '')) process.exit(0);

const filePath = (payload?.tool_input?.file_path || '').replace(/\\/g, '/');
if (!filePath.includes('/sakubun/')) process.exit(0);

// Only the surfaces that introduce a new user-facing route or MCP prompt — editing the guide itself,
// or ordinary code, needs no nudge.
const isRoutePage = /\/sakubun\/app\/(.*\/)?page\.tsx$/.test(filePath);
const isMcpSurface = /\/sakubun\/lib\/mcp\/(catalog|server)\.ts$/.test(filePath);
if (!isRoutePage && !isMcpSurface) process.exit(0);

// Once per session (keyed by session_id so it doesn't nag on every route edit).
const marker = join(tmpdir(), `sakubun-guide-reminder-${payload?.session_id || 'nosid'}`);
if (existsSync(marker)) process.exit(0);
try {
  writeFileSync(marker, '1');
} catch {
  /* best-effort marker; if it fails the worst case is one extra reminder */
}

// Make the nudge concrete with the current registry size.
let counts = '';
try {
  const root = filePath.slice(0, filePath.indexOf('/sakubun/') + '/sakubun/'.length);
  const m = JSON.parse(readFileSync(join(root, 'docs/guide-coverage.json'), 'utf8'));
  counts = ` (registry: ${Object.keys(m.routes).length} routes, ${Object.keys(m.prompts).length} prompts, ${Object.keys(m.capabilities).length} capabilities)`;
} catch {
  /* registry unreadable — still worth the generic reminder */
}

console.error(
  `guide-coverage reminder — sakubun invariant #10${counts}:\n` +
    `- Editing a route page or the MCP catalog: a NEW user-facing feature/mechanism must be documented in /guide in the SAME change.\n` +
    `- If you added a route or an MCP prompt: narrate it in /guide (Tính năng or Theo việc) AND add it to docs/guide-coverage.json (or exempt it with a reason). The reference tool table alone is not narration.\n` +
    `- lib/guide-coverage.test.ts fails otherwise. This fires once per session — re-issue the same edit to proceed.`,
);
process.exit(2);
