#!/usr/bin/env node
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
} else if (setting.dir !== MEMORY_DIR) {
  problems.push(
    `\`autoMemoryDirectory\` points at ${setting.dir} (set in ${setting.from}), not this repo's` +
      ` ${MEMORY_DIR}. The git-synced shared tier is not being loaded or written to; anything the agent` +
      " saves this session stays on this machine and will not travel.",
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
