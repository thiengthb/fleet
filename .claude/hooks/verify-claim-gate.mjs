// @vi WHAT: Khi tôi nói "xong / done / đã kiểm chứng" ở cuối một lượt mà lượt đó CÓ sửa file nhưng KHÔNG chạy
//   một lệnh kiểm tra nào, hook này CHẶN lượt đó lại và buộc tôi hoặc chạy kiểm tra, hoặc nói rõ là "chưa xác minh".
// @vi WHEN: Mỗi lần tôi kết thúc một lượt trả lời (Stop). Chỉ chặn khi đủ CẢ NĂM điều kiện, nên lượt trò chuyện
//   thường và lượt đã chạy kiểm tra đều đi qua im lặng.
// @vi WHY: Đây là luật duy nhất trong platform này từng bị vi phạm theo cách đo được: memory
//   `verify-end-state-not-upload` sinh ra vì tôi tuyên bố xong từ một bước xanh trung gian. Văn bản đã không
//   chặn được nó; một hook thì chặn được. Anthropic gọi đây là "deterministic gate", và người chấm không được
//   là người làm.
//
// Stop hook — BLOCKING. Exit 2 when the turn made a completion claim it did not earn.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// WHAT THIS DOES *NOT* CATCH, stated first so nobody mistakes it for a completeness guarantee.
//
// It catches exactly one failure: *claimed done, edited something, ran no check*. It does NOT catch a
// reasoning failure. In the session that produced this hook (2026-07-31) five claims were wrong, and this
// hook would have caught NONE of them, because every one of them HAD run a tool and then misread it:
//   • "105 plan-audit errors" — a number recited from a memory file instead of the tool
//   • an exit code read through a shell pipe, which returns `tail`'s status, not the program's
//   • a design conflict inferred from a paraphrase of one line of someone else's skill
//   • "92 warnings are theatre" — 74 of them described closed plans
//   • `allowed-tools` believed to restrict tools when it GRANTS permission
// A gate can require that evidence exists. It cannot require that the evidence was read correctly. Treating
// this hook as coverage for that class would be worse than not having it.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
//
// FIVE gates, ALL required to block. Any one of them failing means silence:
//   1. not already in a continuation loop (`stop_hook_active`) — without this the hook can wedge the session
//   2. the last assistant message makes a completion claim (explicit list, EN + VI)
//   3. the claim is NOT hedged ("unverified" / "chưa xác minh" / "not verified" …)
//   4. this turn actually EDITED something — a chat turn that happens to say "xong" is not a claim about work
//   5. this turn ran NO evidence-producing tool (no Bash, no Skill)
//
// "This turn" = the transcript entries after the last REAL human message (see `isUserLine`).
//
// KNOWN LIMITATION, deliberately not fixed: the gate asks "did this turn produce evidence", NOT "was evidence
// produced after the LAST edit". So running the suite and then editing a typo and claiming done passes. The
// stricter rule was rejected because it false-blocks the ordinary fix-after-green loop, and for a blocking
// hook a false block costs more than a missed claim (the operator bypasses it once and it is dead).
//
// FAIL-OPEN ON ERROR, AND THAT IS DELIBERATE — named because this repo has a fail-open incident in its
// history (the invariant-A1 guard, 2026-07-31) and a silent repeat would be worse than the original.
// Detection here is transcript parsing, so a parse failure means "I cannot tell", not "the claim is bad".
// Blocking on "I cannot tell" would train the reader to bypass the gate, which is how a gate dies. The
// asymmetry is: a missed bad claim costs one unverified sentence; a false block costs trust in every block.
// The positive detection path DOES fail closed — once all five gates hold, it blocks.

import { readFileSync, existsSync } from 'node:fs';
import { readPayload } from './_util.mjs';

/** A claim that work is finished or proven. Deliberately narrow: an inflated list makes false blocks. */
const CLAIM = [
  /\bdone\b/i,
  /\bcomplete(d)?\b/i,
  /\ball (tests?|suites?|checks?) pass/i,
  /\bverified\b/i,
  /\bconfirmed\b/i,
  /\bgreen\b/i,
  /\bfixed\b/i,
  /\bworks now\b/i,
  /\bxong\b/i,
  /\bhoàn thành\b/i,
  /\bđã xác minh\b/i,
  /\bđã kiểm chứng\b/i,
  /\bđã sửa xong\b/i,
  /\d+\s*\/\s*\d+\s*(pass|ok|xanh)/i,
];

/** An explicit admission that the claim is not backed. If present, the turn is honest — stay silent. */
const HEDGE = [
  /\bunverified\b/i,
  /\bnot (yet )?verified\b/i,
  /\bcannot verify\b/i,
  /\bchưa xác minh\b/i,
  /\bchưa kiểm\b/i,
  /\bchưa chạy\b/i,
  /\bkhông kiểm chứng được\b/i,
  /\bassumed?\b/i,
  /\bchưa xong\b/i,
];

const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
/** Tools that can put evidence in the transcript. `Skill` counts: it can run a whole verification procedure. */
const EVIDENCE_TOOLS = new Set(['Bash', 'PowerShell', 'Skill', 'Task', 'Agent']);

/** Collect every tool_use in a parsed line, shape-agnostic (top level or nested in message.content[]). */
function collectToolUses(node, out) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const x of node) collectToolUses(x, out);
    return;
  }
  if (node.type === 'tool_use' && typeof node.name === 'string') out.push(node);
  for (const k of Object.keys(node)) collectToolUses(node[k], out);
}

/** Concatenate the text blocks of an assistant message. */
function assistantText(obj) {
  const parts = [];
  const walk = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (n.type === 'text' && typeof n.text === 'string') parts.push(n.text);
    for (const k of Object.keys(n)) walk(n[k]);
  };
  walk(obj);
  return parts.join('\n');
}

/**
 * A REAL human turn — not a tool result.
 *
 * THIS IS THE DEFECT THAT NEARLY SHIPPED (found 2026-07-31 by replaying a real 1105-line transcript; the
 * 17-case synthetic suite passed 100% with the bug present). Claude Code records **tool results as
 * `role: "user"`**: in this session's transcript, 247 entries were `user` + `tool_result` and only **19** were
 * actual human messages. So a naive `role === "user"` test put the turn boundary after the last TOOL RESULT,
 * which places every Bash call OUTSIDE the window — `ranEvidence` would be false almost always and the hook
 * would block constantly. A blocking hook that false-blocks is worse than no hook: the operator bypasses it
 * once and it is decorative forever.
 *
 * A real human turn carries a string `content`, or a content array with text and NO `tool_result` block.
 */
function isUserLine(obj) {
  const r = obj?.type ?? obj?.role ?? obj?.message?.role;
  if (r !== 'user' && r !== 'human') return false;
  const content = obj?.message?.content ?? obj?.content;
  if (typeof content === 'string') return true;
  if (Array.isArray(content)) return !content.some((b) => b?.type === 'tool_result');
  return true; // shape we do not recognise — treat as a boundary rather than swallow the whole transcript
}
function isAssistantLine(obj) {
  const r = obj?.type ?? obj?.role ?? obj?.message?.role;
  return r === 'assistant';
}

async function main() {
  const payload = await readPayload();

  // GATE 1 — never interfere with a continuation loop. Without this the hook can block itself forever.
  if (payload.stop_hook_active === true) process.exit(0);

  const transcriptPath = payload.transcript_path;
  if (!transcriptPath || !existsSync(transcriptPath)) process.exit(0);

  let raw;
  try {
    raw = readFileSync(transcriptPath, 'utf8');
  } catch {
    process.exit(0);
  }

  const objs = [];
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try {
      objs.push(JSON.parse(t));
    } catch {
      /* a partial trailing write is normal — skip it */
    }
  }
  if (!objs.length) process.exit(0);

  // "This turn" = everything after the LAST user message.
  let start = -1;
  for (let i = objs.length - 1; i >= 0; i--) {
    if (isUserLine(objs[i])) {
      start = i;
      break;
    }
  }
  const turn = objs.slice(start + 1);
  if (!turn.length) process.exit(0);

  let edited = false;
  let ranEvidence = false;
  for (const o of turn) {
    const tools = [];
    collectToolUses(o, tools);
    for (const tool of tools) {
      if (EDIT_TOOLS.has(tool.name)) edited = true;
      if (EVIDENCE_TOOLS.has(tool.name)) ranEvidence = true;
    }
  }

  // GATE 4 — a turn that changed nothing is not making a claim about work.
  if (!edited) process.exit(0);
  // GATE 5 — evidence was produced; whether it was read correctly is beyond a hook (see the header).
  if (ranEvidence) process.exit(0);

  // The final assistant message of the turn.
  const lastAssistant = [...turn].reverse().find(isAssistantLine);
  if (!lastAssistant) process.exit(0);
  const text = assistantText(lastAssistant);
  if (!text.trim()) process.exit(0);

  // GATE 3 — an admitted-unverified claim is honest reporting, which is the behaviour we want.
  if (HEDGE.some((re) => re.test(text))) process.exit(0);
  // GATE 2 — is there a completion claim at all?
  if (!CLAIM.some((re) => re.test(text))) process.exit(0);

  process.stderr.write(
    'verify-claim-gate: this turn edited files, ran no check, and then claimed the work was done.\n' +
      '\n' +
      'Do ONE of these before ending the turn:\n' +
      '  • run the check that proves it (the test suite, the build, the tool whose output you are claiming),\n' +
      '    read the output, and then state the claim; or\n' +
      '  • keep the claim but mark it honestly as unverified ("chưa xác minh" / "unverified").\n' +
      '\n' +
      'This gate cannot tell whether evidence was read CORRECTLY — only that some was produced.\n' +
      'Reference: memory `verify-end-state-not-upload`, `platform/standards/testing.md`.\n',
  );
  process.exit(2);
}

main().catch(() => process.exit(0)); // fail-open on the unexpected — see the header for why
