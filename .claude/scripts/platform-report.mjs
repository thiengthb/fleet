#!/usr/bin/env node
/**
 * platform-report.mjs — every metric the platform can produce, per file, written to a markdown report.
 *
 * WHY THIS EXISTS. The supervisor has to be able to audit the agent's judgement, not just receive it. That
 * needs the raw per-file numbers in a file he can open, sort and disagree with — not a summary in a chat
 * message that scrolls away. This is the "hai nguồn giám sát" arrangement: the tools measure, the agent
 * interprets, the supervisor overrules. None of the three can be the only one.
 *
 * IT NEVER DECIDES ANYTHING. It computes a verdict per file, and every verdict except PROTECTED is an
 * invitation to look, never an instruction to act. Deletion is `attic.mjs` + 30 days + a human.
 *
 * THE VERDICTS, and the evidence each one requires:
 *   ACTIVE     — used at least once in recorded history. Nothing to discuss.
 *   ANCHOR     — maybe unread, but ≥2 other files cite it by name. Deleting it breaks their references;
 *                that is what a closed plan is, and why 63 files broke the last time this was proposed.
 *   PROTECTED  — a class that may not be judged by these numbers at all (see PROTECTED below). Never a
 *                candidate, regardless of what the counters say.
 *   NEW        — younger than 30 days. Too early for absence of use to mean anything.
 *   WATCH      — no recorded use, ≤1 inbound link, older than 30 days. The ONLY class `attic.mjs` will
 *                accept, and even then it wants a supersession reason written by a human.
 *
 * Usage:
 *   node .claude/scripts/platform-report.mjs                 # write platform/reports/<date>-platform-report.md
 *   node .claude/scripts/platform-report.mjs --stdout        # print instead of writing
 *   node .claude/scripts/platform-report.mjs --json
 *   node .claude/scripts/platform-report.mjs --path <glob>   # only files whose path contains this string
 *
 * Exit code: always 0. A report that fails a build is a report people stop generating.
 */

import { execFileSync, spawnSync } from "node:child_process";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join, resolve, dirname, relative, basename } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const arg = (f) => {
  const i = process.argv.indexOf(f);
  return i > -1 ? process.argv[i + 1] : null;
};
const STDOUT = process.argv.includes("--stdout");
const JSON_OUT = process.argv.includes("--json");
const PATH_FILTER = arg("--path");

/* ─────────────────────────────────────────────────────── classes that these numbers cannot judge ── */

/**
 * PROTECTED is not a courtesy. Each entry names a measurement that is KNOWN to be blind to that class, so a
 * low number there is an artefact of the instrument rather than a fact about the file.
 */
const PROTECTED = [
  [
    /^\.claude\/memory\//,
    "memory content is injected by the harness, which is not a tool call and cannot be mined — a 0 here means nothing",
  ],
  [
    /^platform\/log\//,
    "the day-log is read as a TIER (93 reads vs 20 writes, measured 2026-07-29); reads land on recent days, so an old day reading 0 is the tier working",
  ],
  [
    /^platform\/ledger\//,
    "the archival record. Its whole purpose is to be rarely read and never lost",
  ],
  [
    /^platform\/inbox\/quarantine\//,
    "untrusted input awaiting human review — removing it is a governance action, not a cleanup",
  ],
  [
    /(^|\/)(README|MEMORY|_TEMPLATE)\.md$/,
    "an index or template: read by humans and by convention, not by a tool call",
  ],
  [/^platform\/inventory\.md$/, "the single source of truth for the fleet"],
  [/^CLAUDE\.md$/, "loaded every session by the harness itself"],
  [
    /^platform\/targets\/.*\/(setup-from-scratch|agent-rebuild-runbook|architecture-and-operations)\.md$/,
    "a runbook earns its keep on the day it is needed, not by being read",
  ],
  [
    /^platform\/backup\//,
    "restore documentation — the same argument, with worse consequences",
  ],
];
const protectedBy = (p) => PROTECTED.find(([re]) => re.test(p))?.[1] ?? null;

const MIN_AGE_DAYS = 30;

/* ───────────────────────────────────────────────────────────────────────────── gather the signals ── */

/** Signal 1-4: usage-census already mines reads/writes/runs/links + the hook counter. Reuse, never re-implement. */
function census() {
  const r = spawnSync(
    process.execPath,
    [join(REPO, ".claude/scripts/usage-census.mjs"), "--json"],
    {
      encoding: "utf8",
      maxBuffer: 1 << 26,
      cwd: REPO,
    },
  );
  try {
    return JSON.parse(r.stdout);
  } catch {
    console.error(
      "platform-report: usage-census --json failed; the report cannot be trusted without it",
    );
    process.exit(0);
  }
}

/**
 * Signal 5-7: git history — first seen, last touched, how many commits. One pass over the whole log, because
 * 200 individual `git log --follow` calls take minutes and a slow report is a report nobody runs.
 *
 * TWO TRAPS, both hit on the first two runs of this file, in opposite directions:
 *
 * 1. The record marker must not be able to appear in the data. `--format="C%at"` collided with `CLAUDE.md`,
 *    a path in most commits, so `Number("LAUDE.md")` = NaN and EVERY age became unknown. Unknown age then
 *    meant "cannot prove it is old" → files fell toward WATCH. The most important file in the repo was
 *    silently condemning the rest. Fixed with \x01, which no path contains.
 *
 * 2. Renames must be followed. On 2026-07-28 `nuc-platform/` became `platform/` and every skill was renamed;
 *    without rename tracking git reports the new path as CREATED that day, so the whole repo looked 2 days
 *    old and NOTHING could ever qualify as stale. That is the mirror failure of trap 1 — a mechanism that
 *    condemns nobody looks safe and is just as wrong, because it silently stops doing its job.
 *    `--name-status -M` emits `R<score>\told\tnew`; walking newest→oldest, an alias old→new lets the older
 *    commits keep accruing to the file's current path.
 *
 * 3. **No shell.** The marker used to be written as bash ANSI-C quoting (`--format=$'\x01%at'`) with
 *    `shell: "/bin/bash"`. There is no `/bin/bash` on Windows, so the spawn threw, the `catch` returned an
 *    empty map, and EVERY age in the repo was unknown on that machine — trap 1 all over again, arriving by a
 *    different door and just as silent. `execFileSync` with an argument array needs no shell and no quoting:
 *    the marker is a real \x01 byte written by JS, so it cannot be re-quoted by anyone's `sh`.
 */
function gitHistory() {
  const map = new Map();
  const alias = new Map(); // historical path → current path
  let out = "";
  try {
    out = execFileSync(
      "git",
      ["log", "--no-merges", "--format=\x01%at", "--name-status", "-M"],
      {
        cwd: REPO,
        encoding: "utf8",
        maxBuffer: 1 << 28,
      },
    );
  } catch {
    return map;
  }
  const current = (p) => {
    let seen = 0;
    while (alias.has(p) && seen++ < 20) p = alias.get(p);
    return p;
  };
  const record = (p, ts) => {
    const key = current(p);
    const e = map.get(key) || { commits: 0, first: ts, last: ts };
    e.commits++;
    e.first = Math.min(e.first, ts);
    e.last = Math.max(e.last, ts);
    map.set(key, e);
  };
  let ts = 0;
  for (const line of out.split("\n")) {
    if (line.startsWith("\x01")) {
      ts = Number(line.slice(1)) * 1000;
      continue;
    }
    if (!line.trim()) continue;
    const parts = line.split("\t");
    const status = parts[0];
    if (status.startsWith("R") && parts.length >= 3) {
      const [, from, to] = parts;
      alias.set(from, current(to)); // older commits naming `from` now accrue to the file's present path
      record(to, ts);
    } else if (parts.length >= 2) {
      record(parts[1], ts);
    }
  }
  return map;
}

/**
 * Signal 8: OUTBOUND references — what this file points at. The supervisor asked for "phụ thuộc bao nhiêu",
 * and it is the mirror of `links`: a file with many outbound refs is a hub whose deletion strands nothing,
 * but whose MOVE breaks many things. Counted against the known artefact set only, so prose is not noise.
 */
function outboundLinks(rows) {
  const names = new Map();
  for (const r of rows) names.set(basename(r.path), r.path);
  for (const r of rows) if (r.skill) names.set(`/${r.skill}`, r.path);
  for (const r of rows) {
    let text = "";
    try {
      const p = join(REPO, r.path);
      text = statSync(p).isDirectory()
        ? existsSync(join(p, "SKILL.md"))
          ? readFileSync(join(p, "SKILL.md"), "utf8")
          : ""
        : readFileSync(p, "utf8");
    } catch {
      /* unreadable — 0 outbound */
    }
    const hit = new Set();
    for (const [name, target] of names) {
      if (target === r.path) continue;
      if (name.length < 5) continue;
      if (text.includes(name)) hit.add(target);
    }
    r.linksOut = hit.size;
  }
}

/* ──────────────────────────────────────────────────────────────────────────────────── verdicts ── */

function verdict(r, now) {
  const prot = protectedBy(r.path);
  if (prot) return { v: "PROTECTED", why: prot };
  const used = r.reads + r.runs + (r.ran || 0);
  if (used > 0) return { v: "ACTIVE", why: `${used} recorded use(s)` };
  if (r.links > 1)
    return {
      v: "ANCHOR",
      why: `${r.links} file(s) cite it by name — deleting it breaks their references`,
    };
  const ageDays = Number.isFinite(r.first)
    ? Math.round((now - r.first) / 86400_000)
    : null;
  // UNKNOWN AGE IS NOT EVIDENCE OF AGE. An uncommitted or unparseable file gets the benefit of the doubt and
  // lands in NEW, never WATCH. The first run of this script did the opposite and nominated itself, 30
  // seconds old, for retirement — the exact wrongful-condemnation the supervisor asked to be designed out.
  if (ageDays === null)
    return {
      v: "NEW",
      why: "no git history yet (uncommitted or newly added) — age unknown, so it cannot be judged",
    };
  if (ageDays < MIN_AGE_DAYS)
    return {
      v: "NEW",
      why: `${ageDays}d old — too early for silence to mean anything`,
    };
  return {
    v: "WATCH",
    why: `no recorded use, ${r.links} inbound link(s), ${ageDays ?? "?"}d old — eligible for the attic, NOT for deletion`,
  };
}

/* ────────────────────────────────────────────────────────────────────────────────────── render ── */

const j = census();
let rows = j.rows.map((r) => ({ ...r }));
const git = gitHistory();
for (const r of rows) {
  const g = git.get(r.path) || null;
  r.commits = g?.commits ?? 0;
  r.first = g?.first ?? null;
  r.last_touched = g?.last ?? null;
}
outboundLinks(rows);
const now = Date.now();
for (const r of rows) Object.assign(r, verdict(r, now));
if (PATH_FILTER) rows = rows.filter((r) => r.path.includes(PATH_FILTER));

if (JSON_OUT) {
  console.log(
    JSON.stringify({ generated: new Date().toISOString(), rows }, null, 2),
  );
  process.exit(0);
}

const d = (ts) => (ts ? new Date(ts).toISOString().slice(0, 10) : "—");
const ago = (ts) => (ts ? `${Math.round((now - ts) / 86400_000)}d` : "—");
const ORDER = { WATCH: 0, NEW: 1, ANCHOR: 2, ACTIVE: 3, PROTECTED: 4 };
const KINDS = ["knowledge", "skill", "hook", "script", "other"];
// LOCAL date, not UTC: the supervisor is at +07, so a UTC filename is a day behind his evening work.
const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
  .toISOString()
  .slice(0, 10);
const count = (v) => rows.filter((r) => r.v === v).length;

const L = [];
const p = (s = "") => L.push(s);

p(`# Platform file report — ${today}`);
p();
p(
  `<!-- GENERATED by .claude/scripts/platform-report.mjs. Do not hand-edit: regenerate it.`,
);
p(
  `     Every number here is a measurement, not a judgement. The verdict column is a suggestion to LOOK. -->`,
);
p();
p(
  `**Ai giám sát cái gì.** Công cụ *đo*; tôi (agent) *diễn giải*; bạn *quyết*. Ba nguồn, không nguồn nào được`,
);
p(
  `phép đứng một mình — đó là lý do file này tồn tại: để bạn kiểm tra lại kết luận của tôi bằng số liệu thô.`,
);
p();
p(
  `**Không có gì trong file này là lệnh xoá.** Kể cả \`WATCH\`. Muốn xoá phải qua \`attic.mjs\`: dời vào kho →`,
);
p(`ghi bằng chứng → chờ ≥30 ngày → đo lại → **bạn** quyết.`);
p();
p(`## Summary`);
p();
p(`| Verdict | n | Meaning |`);
p(`|---|---|---|`);
p(
  `| \`ACTIVE\` | ${count("ACTIVE")} | used at least once in recorded history |`,
);
p(
  `| \`ANCHOR\` | ${count("ANCHOR")} | maybe unread, but ≥2 files cite it — deleting it breaks references |`,
);
p(
  `| \`PROTECTED\` | ${count("PROTECTED")} | a class these counters are known to be blind to — never a candidate |`,
);
p(
  `| \`NEW\` | ${count("NEW")} | younger than ${MIN_AGE_DAYS} days — silence means nothing yet |`,
);
p(
  `| \`WATCH\` | ${count("WATCH")} | **the only class the attic will accept**, and only with a written reason |`,
);
p();
p(
  `Total ${rows.length} artefacts · ${j.scanned?.files ?? "?"} sessions and ${j.scanned?.events ?? "?"} tool calls mined.`,
);
p();
p(`## What each column means`);
p();
p(`| Column | Source | What it can and cannot see |`);
p(`|---|---|---|`);
p(
  `| \`read\` | session transcripts | every Read/Grep + any \`cat\`/\`grep\` naming the path. **Blind to** harness-injected memory, and to subagent sessions. |`,
);
p(
  `| \`write\` | session transcripts | Write/Edit/MultiEdit. High write + zero read = something written and never consulted. |`,
);
p(
  `| \`run\` | session transcripts | \`node <path>\` invocations — scripts and hooks only. |`,
);
p(
  `| \`ran\`/\`fired\` | \`~/.claude/hook-usage.jsonl\` | hooks record their own exit; \`fired\` = exit 2, i.e. it actually said something. **Starts 2026-07-30**, no history before that. |`,
);
p(
  `| \`in\` | this repo | how many other files cite it by name — its inbound links. |`,
);
p(
  `| \`out\` | this repo | how many known artefacts IT cites — its dependencies. High \`out\` = moving it breaks things. |`,
);
p(
  `| \`commits\` | git log | how often it has been changed. 1 commit + old = written once, never revisited. |`,
);
p(`| \`age\` / \`touched\` | git log | first commit / last commit. |`);
p(
  `| \`lines\` | filesystem | size. A 500-line file with 0 reads costs context every time it IS opened. |`,
);
p();

for (const kind of KINDS) {
  const group = rows
    .filter((r) => r.kind === kind)
    .sort((a, b) => ORDER[a.v] - ORDER[b.v] || a.path.localeCompare(b.path));
  if (!group.length) continue;
  p(`## ${kind} (${group.length})`);
  p();
  p(
    `| verdict | file | read | write | run | ran/fired | in | out | commits | age | touched | lines |`,
  );
  p(`|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|`);
  for (const r of group) {
    const hook = r.kind === "hook" ? `${r.ran ?? 0}/${r.fired ?? 0}` : "—";
    p(
      `| \`${r.v}\` | \`${r.path}\` | ${r.reads} | ${r.writes} | ${r.runs} | ${hook} | ${r.links} | ${r.linksOut} | ${r.commits} | ${ago(r.first)} | ${d(r.last_touched)} | ${r.lines} |`,
    );
  }
  p();
}

const watch = rows.filter((r) => r.v === "WATCH");
p(`## The only actionable list: ${watch.length} \`WATCH\` file(s)`);
p();
if (!watch.length) {
  p(`None. Every artefact is used, anchored, protected or too new to judge.`);
} else {
  p(
    `Each needs a written reason before it may enter the attic — "the counter says 0" is not a reason.`,
  );
  p();
  p(`| file | why it qualifies | what must be established before staging |`);
  p(`|---|---|---|`);
  for (const r of watch)
    p(
      `| \`${r.path}\` | ${r.why} | what supersedes it, or why it will never be needed |`,
    );
}
p();
p(`## How to disagree with this report`);
p();
p(
  `1. **A \`WATCH\` you believe is alive** — say so; it is exonerated with no argument needed. Absence of`,
);
p(
  `   evidence is what put it there, and your memory is evidence the tools do not have.`,
);
p(
  `2. **An \`ACTIVE\` you believe is dead** — likely right: one read by the agent while auditing counts as use.`,
);
p(
  `   This report cannot distinguish "consulted while working" from "opened while being audited".`,
);
p(
  `3. **A \`PROTECTED\` you want reviewed** — that class is a rule in this script, not a fact. Change the rule`,
);
p(`   deliberately, in a commit, with the reason.`);
p();
p(
  `*Generated ${new Date().toISOString()} · regenerate with \`node .claude/scripts/platform-report.mjs\`*`,
);

const text = L.join("\n") + "\n";
if (STDOUT) {
  console.log(text);
  process.exit(0);
}
const dir = join(REPO, "platform", "reports");
mkdirSync(dir, { recursive: true });
const out = join(dir, `${today}-platform-report.md`);
writeFileSync(out, text);
console.log(
  // POSIX-shaped, like every other path this report emits (see usage-census.mjs) — the written-to line is
  // quoted into plans and compared between machines, so it must not change shape with the OS.
  `written: ${relative(REPO, out).replace(/\\/g, "/")}  (${rows.length} artefacts · ${watch.length} WATCH)`,
);
