#!/usr/bin/env node
// @vi WHAT: Đầu phiên, nó kiểm tôi có thật sự nạp được ký ức về anh không: đường dẫn ký ức có trỏ đúng, MEMORY.md có nằm
//   trong giới hạn nạp, có file ký ức nào chưa được ghi vào mục lục.
// @vi WHY: Kiểu hỏng này vô hình. Một ký ức viết ngày 2026-07-24 đến 2026-07-28 mới phát hiện là chưa bao giờ được nạp.
//   Không có nó thì tôi vào phiên mà không nhớ gì về anh, và cũng không biết là mình đang không nhớ.
//
/**
 * memory-wiring-check.mjs — SessionStart. Advisory, non-blocking. Silent when correct.
 *
 * The shared memory tier (`.claude/memory/`) is git-synced, but the setting that makes Claude Code load it —
 * `autoMemoryDirectory` — is an ABSOLUTE path, so it cannot be committed. It lives in each machine's gitignored
 * `.claude/settings.local.json`. A fresh clone therefore has the memories but no wiring, and the failure is SILENT:
 * the agent simply starts every session with no memory of the user and never says so.
 *
 * That is not hypothetical. On 2026-07-28 a machine-local memory written on 2026-07-24 was found to have never loaded
 * once, because the directory holding it had no index. Same class of bug: memory that exists but is invisible.
 * A rule that can fail silently has to be checked by code, not remembered.
 *
 * Exit code is always 0 — SessionStart cannot block, and this must never be the reason a session won't start.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { recordRun } from "./_util.mjs";

recordRun(); // reads no stdin, so it must count itself (see _util.mjs — usage recording)

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MEMORY_DIR = join(REPO, ".claude", "memory");

/**
 * INSIDE A LINKED WORKTREE, pointing at the MAIN tree's memory directory is CORRECT — and this hook used to
 * call it a problem.
 *
 * Found 2026-08-01 by running `claude --worktree` for the first time (which only became usable that day, when
 * `.worktreeinclude` started copying `settings.local.json` into new worktrees). The warning read: *"the
 * git-synced shared tier is not being loaded or written to"* — and it was false. `autoMemoryDirectory` is an
 * absolute path; a worktree that inherits it points at the main tree's `.claude/memory`, which is exactly the
 * one shared tier this whole mechanism exists to keep. Left unfixed, every worktree session would open by
 * telling the agent it has no memory of the user, and this hook instructs the agent to surface that to them.
 *
 * That makes this the FIFTH checker to give a false answer inside a worktree — `_layout.mjs`'s `worktreeInfo`
 * was written on 2026-07-31 for the other four. It is reused here rather than re-derived (memory:
 * extend-dont-rebuild), and the import is dynamic and swallowed: a SessionStart hook must never be the reason
 * a session will not start, which is the same rule the exit code obeys.
 */
let worktreeInfo = null;
try {
  ({ worktreeInfo } = await import("../scripts/_layout.mjs"));
} catch {
  /* discovery library unavailable ⇒ fall back to main-tree-only behaviour, never crash the session */
}
const wt = worktreeInfo ? worktreeInfo(REPO) : { known: false, isWorktree: false };
/** `--git-common-dir` is `<main tree>/.git`, so its parent is the main tree's root. */
const MAIN_MEMORY_DIR =
  wt.isWorktree && wt.commonDir ? join(dirname(wt.commonDir), ".claude", "memory") : null;
const samePath = (a, b) =>
  !!a && !!b && a.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase() === b.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
/** Either this tree's memory directory, or — in a worktree — the main tree's. Nothing else. */
const wiredCorrectly = (dir) => samePath(dir, MEMORY_DIR) || samePath(dir, MAIN_MEMORY_DIR);

const INDEX = join(MEMORY_DIR, "MEMORY.md");

/** Settings sources, lowest precedence first — the last one that sets the key wins. */
const SETTINGS_FILES = [
  join(homedir(), ".claude", "settings.json"),
  join(REPO, ".claude", "settings.json"),
  join(REPO, ".claude", "settings.local.json"),
];

const expandHome = (p) => (p.startsWith("~/") ? join(homedir(), p.slice(2)) : p);

function effectiveAutoMemoryDir() {
  let found = null;
  for (const file of SETTINGS_FILES) {
    if (!existsSync(file)) continue;
    try {
      const json = JSON.parse(readFileSync(file, "utf8"));
      if (typeof json.autoMemoryDirectory === "string" && json.autoMemoryDirectory.trim()) {
        found = { dir: resolve(expandHome(json.autoMemoryDirectory.trim())), from: file };
      }
      if (json.autoMemoryEnabled === false) return { disabled: true, from: file };
    } catch {
      /* malformed settings are someone else's problem to report */
    }
  }
  return found;
}

const problems = [];
const setting = effectiveAutoMemoryDir();

if (setting?.disabled) {
  problems.push(
    `auto memory is DISABLED (\`autoMemoryEnabled: false\` in ${setting.from}) — the shared memory tier in` +
      ` .claude/memory/ will not load, and nothing will be written to it this session.`,
  );
} else if (!setting) {
  problems.push(
    "`autoMemoryDirectory` is not set on this machine, so `.claude/memory/` is NOT loaded — this session starts" +
      " with no memory of the user, silently.\n" +
      `    Fix: create ${join(REPO, ".claude", "settings.local.json")} (gitignored) containing\n` +
      `      { "autoMemoryDirectory": "${MEMORY_DIR}" }\n` +
      "    then restart the session. Nothing else needs setting up — the memories themselves came with `git pull`.",
  );
} else if (!wiredCorrectly(setting.dir)) {
  const alsoAccepted = MAIN_MEMORY_DIR
    ? ` (nor the main tree's ${MAIN_MEMORY_DIR}, which would also be correct from inside this worktree)`
    : "";
  problems.push(
    `\`autoMemoryDirectory\` points at ${setting.dir} (set in ${setting.from}), not this repo's` +
      ` ${MEMORY_DIR}${alsoAccepted}. The git-synced shared tier is not being loaded or written to; anything` +
      " the agent saves this session stays on this machine and will not travel.",
  );
}

// The index is the whole loading mechanism — a memory file it doesn't point at is invisible.
if (existsSync(MEMORY_DIR)) {
  if (!existsSync(INDEX)) {
    problems.push(`${MEMORY_DIR} has no MEMORY.md index — every memory file in it is invisible at session start.`);
  } else {
    const body = readFileSync(INDEX, "utf8")
      .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "")
      .replace(/<!--[\s\S]*?-->/g, "");
    const lines = body.split(/\r?\n/).length;
    const bytes = Buffer.byteLength(body);
    if (lines > 200 || bytes > 25 * 1024) {
      problems.push(
        `MEMORY.md is ${lines} lines / ${(bytes / 1024).toFixed(1)}KB — past the 200-line / 25KB load cap.` +
          " Everything beyond the cap is dropped on load. Shorten it: one line per entry, detail into topic files.",
      );
    }
    const linked = new Set();
    for (const m of body.matchAll(/\]\(([^)]+\.md)\)/g)) linked.add(m[1].split("/").pop());
    for (const m of body.matchAll(/\[\[([^\]]+)\]\]/g)) linked.add(`${m[1]}.md`);
    const unindexed = readdirSync(MEMORY_DIR).filter(
      (f) => f.endsWith(".md") && f !== "MEMORY.md" && !linked.has(f),
    );
    if (unindexed.length) {
      problems.push(
        `${unindexed.length} memory file(s) are not referenced by MEMORY.md and will never surface: ` +
          `${unindexed.join(", ")}. Add an index line, or delete the file.`,
      );
    }
  }
}

if (!problems.length) process.exit(0);

const message = ["⚠ memory wiring", ...problems.map((p) => `  • ${p}`)].join("\n");

console.log(
  JSON.stringify({
    systemMessage: message,
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext:
        `MEMORY WIRING PROBLEM — do not assume you have the user's memory this session:\n${message}\n` +
        "Surface this to the user before doing work that depends on remembered preferences.",
    },
  }),
);
process.exit(0);
