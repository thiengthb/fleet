#!/usr/bin/env node
// @vi WHAT: Báo cáo sức khoẻ ký ức của tôi: có vượt giới hạn nạp không, có file mồ côi nằm ngoài mục lục không, có hai ký ức
//   trùng nội dung không.
// @vi WHEN: Khi nghi ký ức đang phình hoặc trùng lặp; và tự động trong health-sweep.
// @vi WHY: CHỈ báo cáo — không bao giờ tự sửa, tự chuyển hay tự xoá. Đo kích thước và tìm trùng lặp là việc của máy; quyết
//   định bỏ cái nào là việc của người.
//
/**
 * memory-audit.mjs — deterministic hygiene report for the agent's memory tiers.
 *
 * REPORT-ONLY. Never writes, moves, or deletes a file. Every finding is a
 * suggestion for a human to act on (same rule as /host-audit).
 *
 * Why a script and not the agent's judgement: measuring size, finding an
 * orphaned index line, or computing text overlap is mechanical work. Paying
 * model tokens to eyeball 30 files every session is the exact waste this
 * replaces. The agent only gets involved for the semantic call ("do these two
 * memories actually say the same thing?") — never for the mechanical one.
 *
 * Checks
 *   1. BUDGET   — bytes + estimated tokens of the always-loaded set, measured
 *                 against Claude Code's native auto-memory limits (200 lines /
 *                 25KB for MEMORY.md; ~200 lines advisory for CLAUDE.md).
 *   2. DRIFT    — index vs disk: orphan pointers, unindexed files, and entries
 *                 that fall past the load cut-off (silently never loaded).
 *   3. OVERLAP  — near-duplicate memories via word-shingle Jaccard, plus lines
 *                 repeated near-verbatim across files.
 *   4. STALE    — days since the file was last touched (from git history),
 *                 flagged against a threshold.
 *   5. TIERS    — scans both the shared repo tier and the machine-local native
 *                 auto-memory tier, and reports files that live in neither index.
 *
 * Usage
 *   node .claude/scripts/memory-audit.mjs            # human-readable report
 *   node .claude/scripts/memory-audit.mjs --json     # machine-readable
 *   node .claude/scripts/memory-audit.mjs --stale 60 # override stale threshold
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";

// ---------------------------------------------------------------- config ----

const REPO = resolve(process.argv[2]?.startsWith("--") ? "." : (process.argv[2] ?? "."));
const ARGS = process.argv.slice(2);
const JSON_OUT = ARGS.includes("--json");
const STALE_DAYS = Number(ARGS[ARGS.indexOf("--stale") + 1]) || 90;

/** Claude Code loads only the first 200 lines / 25KB of a memory index. */
const INDEX_LINE_CAP = 200;
const INDEX_BYTE_CAP = 25 * 1024;
/** Advisory ceiling for an always-loaded instruction file (Anthropic guidance). */
const CLAUDE_MD_LINE_ADVISORY = 200;
/** A single memory should be one fact; past this it is really several. */
const MEMORY_FILE_LINE_ADVISORY = 60;
/** Jaccard over 4-word shingles. Two unrelated memories score near 0. */
const OVERLAP_REVIEW = 0.1;
const OVERLAP_LIKELY_DUP = 0.2;
/** A line repeated across files is only interesting if it carries content. */
const REPEATED_LINE_MIN_WORDS = 8;

const SHARED_DIR = join(REPO, ".claude", "memory");
const LOCAL_FILE = join(REPO, "CLAUDE.local.md");
/** Where Claude Code would put auto memory if `autoMemoryDirectory` were unset. */
const DEFAULT_AUTO_DIR = join(homedir(), ".claude", "projects", REPO.replace(/[/\\:]/g, "-"), "memory");

const expandHome = (p) => (p.startsWith("~/") ? join(homedir(), p.slice(2)) : p);

/** The tier only loads if `autoMemoryDirectory` actually points at it — check, don't assume. */
function effectiveAutoMemoryDir() {
  const sources = [
    join(homedir(), ".claude", "settings.json"),
    join(REPO, ".claude", "settings.json"),
    join(REPO, ".claude", "settings.local.json"),
  ];
  let found = null;
  for (const file of sources) {
    if (!existsSync(file)) continue;
    try {
      const json = JSON.parse(readFileSync(file, "utf8"));
      if (json.autoMemoryEnabled === false) return { disabled: true, from: file };
      if (typeof json.autoMemoryDirectory === "string" && json.autoMemoryDirectory.trim()) {
        found = { dir: resolve(expandHome(json.autoMemoryDirectory.trim())), from: file };
      }
    } catch {
      /* malformed settings — reported by the wiring hook, not here */
    }
  }
  return found;
}

// ----------------------------------------------------------------- utils ----

const estTokens = (bytes) => Math.round(bytes / 4);

const fmtBytes = (n) =>
  n >= 1024 * 1024 ? `${(n / 1048576).toFixed(1)}MB` : n >= 1024 ? `${(n / 1024).toFixed(1)}KB` : `${n}B`;

/** Strip YAML frontmatter and HTML comments — neither is loaded into context. */
function stripMeta(text) {
  let body = text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
  body = body.replace(/<!--[\s\S]*?-->/g, "");
  return body;
}

function readMemoryDir(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((name) => {
      const path = join(dir, name);
      const raw = readFileSync(path, "utf8");
      const body = stripMeta(raw);
      // The harness stamps `modified:` on every write — a recorded fact, not an inferred one.
      const stamped = raw.match(/^\s*modified:\s*['"]?(\d{4}-\d{2}-\d{2}T[^'"\s]*)/m);
      return {
        name,
        path,
        raw,
        body,
        modified: stamped ? stamped[1] : null,
        bytes: Buffer.byteLength(raw),
        loadedBytes: Buffer.byteLength(body),
        lines: body.split(/\r?\n/).length,
        isIndex: name === "MEMORY.md",
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Last commit date per file, in one git pass. Untracked files come back null. */
function lastTouched(dir) {
  const map = new Map();
  try {
    const out = execFileSync(
      "git",
      ["log", "--format=@%cI", "--name-only", "--", dir],
      { cwd: REPO, encoding: "utf8", maxBuffer: 32 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] },
    );
    let current = null;
    for (const line of out.split("\n")) {
      if (line.startsWith("@")) current = line.slice(1).trim();
      else if (line.trim() && current && !map.has(line.trim())) map.set(line.trim(), current);
    }
  } catch {
    /* not a git repo, or dir untracked — staleness check degrades to null */
  }
  return map;
}

const daysSince = (iso) =>
  iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null;

// ------------------------------------------------------------- similarity ---

function shingles(text, n = 4) {
  const words = text
    .toLowerCase()
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const set = new Set();
  for (let i = 0; i + n <= words.length; i++) set.add(words.slice(i, i + n).join(" "));
  return set;
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const s of small) if (large.has(s)) shared++;
  return shared / (a.size + b.size - shared);
}

/** Content lines that appear near-verbatim in two or more files. */
function repeatedLines(files) {
  const seen = new Map();
  for (const f of files) {
    const uniq = new Set();
    for (const rawLine of f.body.split(/\r?\n/)) {
      const norm = rawLine
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (norm.split(" ").length < REPEATED_LINE_MIN_WORDS) continue;
      uniq.add(norm);
    }
    for (const norm of uniq) {
      if (!seen.has(norm)) seen.set(norm, []);
      seen.get(norm).push(f.name);
    }
  }
  return [...seen.entries()]
    .filter(([, files_]) => files_.length > 1)
    .map(([line, files_]) => ({ line, files: files_ }))
    .sort((a, b) => b.files.length - a.files.length);
}

// ----------------------------------------------------------------- checks ---

function auditTier(label, dir, { indexRequired }) {
  const files = readMemoryDir(dir);
  if (!files.length) return { label, dir, present: false, files: [] };

  const index = files.find((f) => f.isIndex) ?? null;
  const entries = files.filter((f) => !f.isIndex);
  const touched = lastTouched(dir);

  // --- index drift -----------------------------------------------------
  const linked = new Set();
  let indexCutoffLine = null;
  if (index) {
    const lines = index.body.split(/\r?\n/);
    let bytes = 0;
    lines.forEach((line, i) => {
      bytes += Buffer.byteLength(line) + 1;
      if (indexCutoffLine === null && (i + 1 > INDEX_LINE_CAP || bytes > INDEX_BYTE_CAP)) {
        indexCutoffLine = i + 1;
      }
      for (const m of line.matchAll(/\]\(([^)]+\.md)\)/g)) linked.add(basename(m[1]));
      for (const m of line.matchAll(/\[\[([^\]]+)\]\]/g)) linked.add(`${m[1]}.md`);
    });
  }

  const unindexed = entries.filter((f) => !linked.has(f.name)).map((f) => f.name);
  const orphanPointers = [...linked].filter((n) => !entries.some((f) => f.name === n));

  // --- entries past the load cut-off ------------------------------------
  const belowCutoff = [];
  if (index && indexCutoffLine !== null) {
    index.body.split(/\r?\n/).forEach((line, i) => {
      if (i + 1 >= indexCutoffLine && /\]\([^)]+\.md\)/.test(line)) belowCutoff.push(line.trim());
    });
  }

  // --- overlap ----------------------------------------------------------
  const shingled = entries.map((f) => ({ ...f, sh: shingles(f.body) }));
  const allPairs = [];
  for (let i = 0; i < shingled.length; i++) {
    for (let j = i + 1; j < shingled.length; j++) {
      const score = jaccard(shingled[i].sh, shingled[j].sh);
      allPairs.push({
        a: shingled[i].name,
        b: shingled[j].name,
        score: Number(score.toFixed(3)),
        verdict:
          score >= OVERLAP_LIKELY_DUP ? "likely-duplicate" : score >= OVERLAP_REVIEW ? "overlap" : "distinct",
      });
    }
  }
  allPairs.sort((a, b) => b.score - a.score);
  const overlaps = allPairs.filter((o) => o.score >= OVERLAP_REVIEW);
  const closestPairs = allPairs.slice(0, 3);

  // --- staleness + size -------------------------------------------------
  // Prefer the recorded `modified:` stamp; fall back to git for files written before stamping existed.
  const annotated = entries.map((f) => {
    const rel = f.path.startsWith(REPO) ? f.path.slice(REPO.length + 1) : f.path;
    const iso = f.modified ?? touched.get(rel) ?? null;
    return { ...f, lastTouched: iso, ageSource: f.modified ? "modified" : "git", ageDays: daysSince(iso) };
  });

  const stale = annotated
    .filter((f) => f.ageDays !== null && f.ageDays >= STALE_DAYS)
    .map((f) => ({ name: f.name, ageDays: f.ageDays }))
    .sort((a, b) => b.ageDays - a.ageDays);

  const oversized = annotated
    .filter((f) => f.lines > MEMORY_FILE_LINE_ADVISORY)
    .map((f) => ({ name: f.name, lines: f.lines }))
    .sort((a, b) => b.lines - a.lines);

  const totalBytes = files.reduce((n, f) => n + f.bytes, 0);

  return {
    label,
    dir,
    present: true,
    indexRequired,
    hasIndex: Boolean(index),
    fileCount: entries.length,
    totalBytes,
    totalTokensEst: estTokens(totalBytes),
    index: index
      ? {
          lines: index.lines,
          bytes: index.loadedBytes,
          overLineCap: index.lines > INDEX_LINE_CAP,
          overByteCap: index.loadedBytes > INDEX_BYTE_CAP,
          cutoffLine: indexCutoffLine,
        }
      : null,
    unindexed,
    orphanPointers,
    belowCutoff,
    overlaps,
    closestPairs,
    repeated: repeatedLines(entries).slice(0, 8),
    stale,
    oversized,
    files: annotated.map((f) => ({
      name: f.name,
      lines: f.lines,
      bytes: f.bytes,
      ageDays: f.ageDays,
    })),
  };
}

function auditAlwaysLoaded() {
  const items = [];
  const claudeMd = join(REPO, "CLAUDE.md");
  if (existsSync(claudeMd)) {
    const body = stripMeta(readFileSync(claudeMd, "utf8"));
    items.push({
      name: "CLAUDE.md",
      lines: body.split(/\r?\n/).length,
      bytes: Buffer.byteLength(body),
      overAdvisory: body.split(/\r?\n/).length > CLAUDE_MD_LINE_ADVISORY,
    });
  }
  // Files pulled in by @import — these load in full, no cap.
  if (existsSync(claudeMd)) {
    const src = readFileSync(claudeMd, "utf8");
    for (const m of src.matchAll(/^@([^\s`]+\.md)\s*$/gm)) {
      const p = join(REPO, m[1]);
      if (!existsSync(p)) {
        items.push({ name: m[1], missing: true });
        continue;
      }
      const body = stripMeta(readFileSync(p, "utf8"));
      items.push({
        name: `@${m[1]}`,
        lines: body.split(/\r?\n/).length,
        bytes: Buffer.byteLength(body),
        imported: true,
      });
    }
  }
  // CLAUDE.local.md is the machine-local tier — gitignored, but loaded in full every session.
  if (existsSync(LOCAL_FILE)) {
    const body = stripMeta(readFileSync(LOCAL_FILE, "utf8"));
    items.push({
      name: "CLAUDE.local.md (machine-local)",
      lines: body.split(/\r?\n/).length,
      bytes: Buffer.byteLength(body),
      overAdvisory: body.split(/\r?\n/).length > CLAUDE_MD_LINE_ADVISORY,
    });
  }
  // The shared index only loads if autoMemoryDirectory points at it.
  const wiring = effectiveAutoMemoryDir();
  if (wiring?.dir === SHARED_DIR) {
    const idx = join(SHARED_DIR, "MEMORY.md");
    if (existsSync(idx)) {
      const body = stripMeta(readFileSync(idx, "utf8"));
      items.push({
        name: ".claude/memory/MEMORY.md (auto-memory index)",
        lines: body.split(/\r?\n/).length,
        bytes: Buffer.byteLength(body),
      });
    }
  }
  // Every installed skill's name + description is injected into the system prompt on EVERY session,
  // whether or not the skill is ever invoked. The bodies load on demand; the catalog does not.
  // This is usually the largest always-loaded item nobody is counting.
  const skillsDir = join(REPO, ".claude", "skills");
  if (existsSync(skillsDir)) {
    let catalogBytes = 0;
    let count = 0;
    for (const name of readdirSync(skillsDir)) {
      const f = join(skillsDir, name, "SKILL.md");
      if (!existsSync(f)) continue;
      count++;
      const fm = readFileSync(f, "utf8").match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (fm) catalogBytes += Buffer.byteLength(fm[1]);
    }
    if (count) {
      items.push({
        name: `skill catalog (${count} skills — descriptions only)`,
        lines: count,
        bytes: catalogBytes,
        note: "loaded every session whether invoked or not; skill BODIES load on demand",
      });
    }
  }
  const bytes = items.reduce((n, i) => n + (i.bytes ?? 0), 0);
  return { items, bytes, tokensEst: estTokens(bytes), wiring };
}

/** A memory directory that nothing points at is memory that never loads. */
/**
 * `loads` answers ONE question a consumer must not have to infer from prose: does the shared tier actually
 * load on this machine? Everything in `problems` is worth a human's eye, but only the first three conditions
 * mean the 32 memories are not there at all — the rest (files stranded in the old default dir) is untidiness.
 *
 * It exists because `health-sweep` summarised this check by exit code, and this script exits 0 by DESIGN
 * (case 9 of its test: "a human decides"). So the sweep printed `memory-audit ok` on 2026-07-30 while
 * `autoMemoryDirectory` was UNSET on the Windows box and not one memory had loaded for weeks. Report-only
 * must still be machine-readable, or a summariser will read "did not fail" as "is fine".
 */
function auditWiring() {
  const w = effectiveAutoMemoryDir();
  const problems = [];
  const fatal = [];
  if (w?.disabled) {
    fatal.push(`auto memory DISABLED in ${w.from} — the shared tier neither loads nor accepts writes.`);
  } else if (!w) {
    fatal.push(
      "autoMemoryDirectory is UNSET on this machine — .claude/memory/ does not load. " +
        `Create .claude/settings.local.json with { "autoMemoryDirectory": "${SHARED_DIR}" }.`,
    );
  } else if (w.dir !== SHARED_DIR) {
    fatal.push(`autoMemoryDirectory points at ${w.dir} (from ${w.from}), not ${SHARED_DIR}.`);
  }
  // Content left behind in the default location after re-pointing is invisible, not deleted.
  if (existsSync(DEFAULT_AUTO_DIR) && w?.dir && w.dir !== DEFAULT_AUTO_DIR) {
    const left = readdirSync(DEFAULT_AUTO_DIR).filter((f) => f.endsWith(".md"));
    if (left.length) {
      problems.push(
        `${left.length} file(s) remain in the now-unused default auto-memory dir ${DEFAULT_AUTO_DIR} ` +
          `(${left.join(", ")}). They are not loaded any more — move anything still true, then delete.`,
      );
    }
  }
  // `problems` keeps EVERY finding, fatal first, so the text report and its existing test are unchanged.
  return { effective: w, loads: fatal.length === 0, fatal, problems: [...fatal, ...problems] };
}

// ------------------------------------------------------------------ main ----

const report = {
  repo: REPO,
  generatedAt: new Date().toISOString(),
  staleThresholdDays: STALE_DAYS,
  alwaysLoaded: auditAlwaysLoaded(),
  wiring: auditWiring(),
  tiers: [auditTier("shared (repo, git-synced, native auto-memory)", SHARED_DIR, { indexRequired: true })],
};

if (JSON_OUT) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

const out = [];
const p = (s = "") => out.push(s);

p("MEMORY AUDIT — report only, nothing was changed");
p(`repo: ${report.repo}`);
p(`stale threshold: ${STALE_DAYS} days`);
p("");

p("── ALWAYS-LOADED CONTEXT (paid every single session) ──");
for (const i of report.alwaysLoaded.items) {
  if (i.missing) {
    p(`  !! ${i.name} — imported but MISSING on disk`);
    continue;
  }
  const flag = i.overAdvisory ? `  <-- over ${CLAUDE_MD_LINE_ADVISORY}-line advisory` : "";
  p(`  ${i.name.padEnd(34)} ${String(i.lines).padStart(5)} lines  ${fmtBytes(i.bytes).padStart(8)}${flag}`);
}
p(`  TOTAL: ${fmtBytes(report.alwaysLoaded.bytes)} ≈ ${report.alwaysLoaded.tokensEst} tokens per session`);
p("");

p("── WIRING (does the agent actually HAVE its memory?) ──");
if (report.wiring.problems.length) {
  for (const x of report.wiring.problems) p(`  !! ${x}`);
} else {
  p(`  ok — autoMemoryDirectory -> ${report.wiring.effective.dir}`);
  p(`       set in ${report.wiring.effective.from}`);
}
p("");

for (const t of report.tiers) {
  p(`── TIER: ${t.label} ──`);
  p(`  ${t.dir}`);
  if (!t.present) {
    p("  (empty or absent)");
    p("");
    continue;
  }
  p(`  ${t.fileCount} memories, ${fmtBytes(t.totalBytes)} ≈ ${t.totalTokensEst} tokens total`);

  if (!t.hasIndex) {
    p(`  !! NO MEMORY.md INDEX — every file here is invisible at session start`);
  } else {
    const idx = t.index;
    const capFlag =
      idx.overLineCap || idx.overByteCap
        ? `  <-- OVER CAP, content past line ${idx.cutoffLine} is dropped on load`
        : "";
    p(`  index: ${idx.lines} lines / ${fmtBytes(idx.bytes)} (cap ${INDEX_LINE_CAP} lines / 25KB)${capFlag}`);
  }

  if (t.unindexed.length) p(`  !! not in the index (never surfaced): ${t.unindexed.join(", ")}`);
  if (t.orphanPointers.length) p(`  !! index points at missing files: ${t.orphanPointers.join(", ")}`);
  if (t.belowCutoff.length) {
    p(`  !! ${t.belowCutoff.length} index entries fall past the load cut-off:`);
    for (const l of t.belowCutoff.slice(0, 5)) p(`       ${l.slice(0, 90)}`);
  }

  if (t.overlaps.length) {
    p(`  overlap candidates (merge or split — human decides):`);
    for (const o of t.overlaps.slice(0, 8)) {
      p(`    ${o.score.toFixed(3)}  ${o.verdict.padEnd(16)} ${o.a}  <->  ${o.b}`);
    }
  } else {
    p(`  overlap: none above ${OVERLAP_REVIEW}. Closest pairs, for reference:`);
    for (const o of t.closestPairs) p(`    ${o.score.toFixed(3)}  ${o.a}  <->  ${o.b}`);
  }

  if (t.repeated.length) {
    p(`  lines repeated across files (${t.repeated.length}):`);
    for (const r of t.repeated.slice(0, 4)) {
      p(`    [${r.files.join(", ")}]`);
      p(`      "${r.line.slice(0, 88)}${r.line.length > 88 ? "…" : ""}"`);
    }
  }

  if (t.oversized.length) {
    p(`  over ${MEMORY_FILE_LINE_ADVISORY} lines (probably more than one fact):`);
    for (const f of t.oversized) p(`    ${String(f.lines).padStart(4)} lines  ${f.name}`);
  }

  if (t.stale.length) {
    p(`  untouched ≥${STALE_DAYS}d (re-confirm or drop):`);
    for (const f of t.stale) p(`    ${String(f.ageDays).padStart(4)}d  ${f.name}`);
  } else {
    p(`  staleness: nothing older than ${STALE_DAYS}d`);
  }
  p("");
}

p("Nothing here is applied automatically. Overlap and staleness are signals for");
p("a human review pass; the mechanical facts (caps, drift, orphans) are exact.");

console.log(out.join("\n"));
