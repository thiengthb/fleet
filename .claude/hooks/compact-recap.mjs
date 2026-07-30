// @vi WHAT: Ngay sau mỗi lần nén ngữ cảnh (compact), nó nói lại cho tôi trạng thái thật của cây làm việc: đang ở
//   nhánh nào, còn bao nhiêu file sửa chưa commit, kế hoạch nào đang mở, và phiên này đã ghi lại tri thức chưa.
// @vi WHY: Nén ngữ cảnh là lúc tôi mất chi tiết và chỉ còn bản tóm tắt — đúng lúc dễ quên rằng còn việc chưa
//   commit hoặc đang làm dở theo một kế hoạch nào. Bốn hook đầu-phiên hiện có đều CỐ Ý bỏ qua lần khởi động do
//   nén, nên trước đây khoảnh khắc đó hoàn toàn im lặng. Nó không mang thông tin mới — mọi thứ đều tra lại được —
//   nó mang thông tin ĐÚNG LÚC, và chỉ lên tiếng với anh khi có việc chưa được ghi lại.
//
/**
 * compact-recap.mjs — SessionStart, and ONLY when `source: compact`. Advisory, non-blocking, silent by default.
 *
 * WHY THIS SHAPE, and what was ruled out first. The obvious design was a `PreCompact` hook that pushes the
 * important state INTO the surviving context. That is not possible: verified against the official hook contract
 * on 2026-07-31, `additionalContext` is **not honoured for PreCompact** — the only documented way a PreCompact
 * hook can influence what survives is to BLOCK compaction (exit 2), which trades a whole compaction for a
 * reminder. `SessionStart` *is* on the documented list of events whose `additionalContext` reaches the model, and
 * it carries `source: "compact"`. So the recap belongs AFTER the cut, not before it.
 *   Docs: https://code.claude.com/docs/en/hooks.md (#precompact, #add-context-for-claude)
 *
 * WHY IT IS NOT DUPLICATION of the other four SessionStart hooks. They all deliberately `return` on
 * `source: compact`, because a git fetch across every repo and a plan-checkin sweep are startup-priced and
 * compaction is frequent. This one is the inverse: it runs ONLY on compaction, does NO network I/O, and is
 * budgeted in milliseconds. `git-sync-check` costs ~3.1s and must keep skipping compaction; this must not.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It does not try to reconstruct intent — a hook cannot know what I was in
 * the middle of. It reports only facts a command could re-derive, on the grounds that the failure after a
 * compaction is not ignorance, it is *not thinking to look*.
 */

import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { readPayload, declareFailMode } from "./_util.mjs";

// Fail-open and REPORTED. A recap that breaks must never stand between me and the resumed session; exit 1 lets
// the session start and still shows the fault, where exit 0 would erase it from the run log.
declareFailMode(1, "The post-compaction recap did not run — check `git status` and the open plans by hand.");

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const payload = await readPayload();

// ONLY on a compaction restart. A plain session start is already covered by four other hooks, and firing here
// too would make this the fifth thing to read before any work begins.
if (payload?.source !== "compact") process.exit(0);

const git = (...args) => {
  const r = spawnSync("git", args, { cwd: REPO, encoding: "utf8", timeout: 5000 });
  return r.status === 0 ? (r.stdout || "").trim() : null;
};

const branch = git("rev-parse", "--abbrev-ref", "HEAD");
// `-uall` matters and is not cosmetic: plain `--porcelain` COLLAPSES an untracked directory into a single line
// (`?? platform/`), so a brand-new knowledge file inside a brand-new directory would be invisible to the
// knowledge-tier test below and the hook would report "nothing recorded" about a session that had just recorded
// something — or the reverse. Found by this hook's own suite, 2026-07-31.
const porcelain = git("status", "--porcelain", "-uall");
const changed = porcelain === null ? null : porcelain.split("\n").filter((l) => l.trim()).length;
const unpushed = (() => {
  const n = git("rev-list", "--count", "@{u}..HEAD");
  return n === null ? null : Number(n);
})();

/** Plans still open, newest first. Cheap: frontmatter only, no walk beyond the two plan directories. */
function openPlans() {
  const out = [];
  for (const dir of [join(REPO, "platform", "plans"), join(REPO, "docs", "plans")]) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".md")) continue;
      const p = join(dir, name);
      try {
        const head = readFileSync(p, "utf8").slice(0, 600);
        if (/^status:\s*active\b/im.test(head)) out.push({ p, mtime: statSync(p).mtimeMs });
      } catch {
        /* an unreadable plan is not this hook's problem to report */
      }
    }
  }
  return out.sort((a, b) => b.mtime - a.mtime).map((x) => relative(REPO, x.p).replace(/\\/g, "/"));
}

/**
 * Has this session's learning been written down yet? Uses the SAME file set `suggest-session-wrap` treats as
 * "wrapped", so the two hooks cannot disagree about what counts as recorded.
 */
const KNOWLEDGE = /(decisions\.md|00-map\.md|knowledge-ledger\.md|ledger\/|platform\/log\/|MEMORY\.md|\.claude\/memory\/|known-traps\.md)/;
const recorded = porcelain === null ? null : porcelain.split("\n").some((l) => KNOWLEDGE.test(l));

const plans = openPlans();
const facts = [
  branch ? `branch ${branch}` : null,
  changed === null ? "git state unreadable" : `${changed} uncommitted file(s)`,
  unpushed === null ? null : `${unpushed} unpushed commit(s)`,
  plans.length ? `open plan(s): ${plans.slice(0, 3).join(", ")}${plans.length > 3 ? ` (+${plans.length - 3})` : ""}` : "no active plan",
  recorded === null ? null : recorded ? "knowledge tier already touched this session" : "NOTHING recorded to the knowledge tier yet",
].filter(Boolean);

// The model always gets the facts — it is a few dozen tokens at the one moment they stop being remembered.
const additionalContext =
  `Context was just compacted. Re-derived working state (do not trust recollection over this): ${facts.join(" · ")}. ` +
  `Read the open plan before continuing multi-session work, and prefer re-reading a file over recalling it.`;

// The USER only hears about it when there is something unrecorded to lose — otherwise this hook is silent.
const atRisk = changed !== null && changed > 0 && recorded === false;
const out = {
  hookSpecificOutput: { hookEventName: "SessionStart", additionalContext },
};
if (atRisk) {
  out.systemMessage =
    `Vừa nén ngữ cảnh. Đang có ${changed} file sửa chưa commit và phiên này CHƯA ghi gì vào tầng tri thức` +
    `${plans.length ? ` (kế hoạch đang mở: ${plans[0]})` : ""} — nếu dừng ở đây thì phần "vì sao" sẽ mất, chỉ còn code.`;
}

process.stdout.write(JSON.stringify(out));
process.exit(0);
