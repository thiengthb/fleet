// @vi WHAT: Khi tôi tạo một file mới mà tên trùng với thứ commons đã có sẵn, nó chặn lần đầu và nói nên `shadcn add` cái nào.
//   Lần thứ hai thì cho qua.
// @vi WHY: /code-reuse đã dặn "xem trước khi xây" từ tháng 6 mà bốn app vẫn mọc ra bốn cái theme toggle khác nhau. Một công
//   cụ chỉ chạy khi tôi chọn gọi nó thì không đáng tin; hook thì luôn chạy. Nó chỉ đọc một bảng có sẵn nên nhanh —
//   bản quét đầy đủ mất ~1.9 giây, quá chậm để đứng trước mỗi lần ghi file.
//
// PreToolUse hook (Write) — "commons already ships this."
//
// WHAT IT DOES. When a new file is written into a project and its name matches something the commons
// registry already publishes, it blocks the first attempt and says which item to `shadcn add` instead.
// Second attempt goes through — so a deliberate local variant costs one extra beat, not a fight.
//
// WHY A HOOK AND NOT A REMINDER. The parallel lesson is already recorded in
// platform/plans/2026-07-29-idea-0023-mcp-platform-server-build.md: an MCP tool only runs when the model
// chooses to call it, a hook always does. Availability is not usage. `/code-reuse` has said "look before
// you build" since 2026-06 and four apps still grew four different theme toggles.
//
// WHY IT ONLY READS A TABLE. The full cross-project duplication scan
// (`node .claude/scripts/reuse-scan.mjs`) takes ~1.9s over 715 files — measured, and far too slow to sit
// in front of every write. This hook answers the cheap half of the question ("does a canonical already
// exist for this exact thing?") by reading one JSON file, in single-digit milliseconds. The expensive
// half — "is this shape being built a second or third time under a different name?" — is the script's
// job, run by hand or on a schedule, not per keystroke.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readPayload, declareFailMode } from './_util.mjs';

// Fail-open and REPORTED. It enforces a PREFERENCE (reach for commons first), not a safety invariant, so a crash
// must not stand between me and a legitimate new file. Exit 1 allows the write and still surfaces the fault.
declareFailMode(1, 'The commons duplication check did not run, so check platform/registries/shared-assets.md by hand before building this.');

const payload = await readPayload();
// Write only. Editing a file that already exists means the choice was made long ago; nagging then is
// noise, and Edit is by far the more common call.
if (payload?.tool_name !== 'Write') process.exit(0);

const filePath = (payload?.tool_input?.file_path || '').replace(/\\/g, '/');
if (!/\.(ts|tsx|js|jsx|mjs)$/.test(filePath)) process.exit(0);

// Never fire inside commons itself (that IS the canonical), or in platform/ (docs and tooling).
if (/\/(commons|platform)\//.test(filePath)) process.exit(0);
// Nor on a file that already exists — Write overwrites, which is an edit in practice.
if (existsSync(filePath)) process.exit(0);

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const registryPath = join(projectDir, 'commons', 'public', 'r', 'registry.json');
if (!existsSync(registryPath)) process.exit(0);

let items;
try {
  items = JSON.parse(readFileSync(registryPath, 'utf8')).items ?? [];
} catch {
  process.exit(0); // a malformed registry must never block someone's work
}

const base = filePath.split('/').pop();

// Match on the install target's basename, not the item name: the item `test-no-emoji` installs
// `lib/no-emoji.test.ts`, and it is the FILE the author is about to create that we recognise.
const hit = items.find((item) =>
  (item.files ?? []).some((f) => (f.target || '').replace(/^~\//, '').split('/').pop() === base),
);
if (!hit) process.exit(0);

// A scaffold is meant to be copied and then owned, so re-creating one of its files is normal.
if ((hit.categories ?? []).includes('starter')) process.exit(0);

// Once per session per item — enough to inform, not enough to nag.
const marker = join(tmpdir(), `reuse-guard-${payload?.session_id || 'nosid'}-${hit.name}`);
if (existsSync(marker)) process.exit(0);
try {
  writeFileSync(marker, '1');
} catch {
  /* best-effort: worst case is one extra reminder */
}

const target = (hit.files ?? [])
  .map((f) => (f.target || '').replace(/^~\//, ''))
  .filter(Boolean)
  .join(', ');

process.stderr.write(
  `commons already ships this: @thiengthb/${hit.name} -> ${target}\n` +
    `  ${hit.description || ''}\n\n` +
    `Install it instead of writing a new copy:\n` +
    `  npx shadcn@latest add @thiengthb/${hit.name}\n\n` +
    `If this project genuinely needs a different thing, write it and say why in one line — then add a\n` +
    `row to commons/docs/divergences.json so the drift audit reports it as DELIBERATE, not FORKED.\n` +
    `Retry the same Write to proceed.\n`,
);
process.exit(2);

/*
INSTALLED 2026-07-30 — the supervisor copied this file in and asked for the registration, which is the
"explicit human approval" a T4 governance change requires (platform/standards/autonomy-contract.md §51).
Registered in .claude/settings.json under the PreToolUse matcher "Edit|Write|MultiEdit"; the hook filters
down to Write itself. Origin and rationale: platform/proposals/2026-07-29-reuse-guard-hook.mjs.proposed

SELF-TEST (from the repo root — copy out first, because the hook imports ./_util.mjs relative to itself):

  mkdir -p /tmp/hooktest && cp .claude/hooks/_util.mjs .claude/hooks/reuse-guard.mjs /tmp/hooktest/
  echo '{"tool_name":"Write","tool_input":{"file_path":"'$PWD'/projects/nuc-monitor/components/empty-state.tsx"},"session_id":"t1"}' \
    | CLAUDE_PROJECT_DIR="$PWD" node /tmp/hooktest/reuse-guard.mjs ; echo "exit=$?"

The path must NOT already exist — a Write over an existing file is an edit, and this stays silent for
those on purpose. Verified from the installed location 2026-07-30:
   new file matching an item      -> exit 2 + the @thiengthb/<item> message
   same session, same item again  -> exit 0 (once per session per item)
   new session                    -> exit 2 again
   a gate item by its TARGET name -> exit 2 (lib/no-emoji.test.ts finds test-no-emoji)
   a `starter` scaffold file      -> exit 0 (meant to be copied and owned)
   Edit, or an unrelated new file -> exit 0

WHAT IT DELIBERATELY DOES NOT DO
  - It does not block Edit, so ordinary work is untouched.
  - It does not run the similarity scan, so it cannot tell you about a copy under a different name. That
    is `.claude/scripts/reuse-scan.mjs` (~1.9s) — a separate, slower, on-demand tool by design.
  - It does not fail closed: an unreadable or missing registry exits 0, so it can never wedge a session.

TO REMOVE: delete this file and its entry in .claude/settings.json.
*/
