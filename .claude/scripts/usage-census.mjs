#!/usr/bin/env node
/**
 * usage-census.mjs — how much is each part of the agent OS actually USED? Report-only.
 *
 * WHY THIS EXISTS. The platform accumulates: 53 skills, 14 hooks, 14 scripts, ~90 knowledge files, some over
 * 500 lines. Nothing measured whether any of it gets touched, so "this is dead, cut it" and "this is load-bearing,
 * keep it" were both guesses. On 2026-07-29 two such guesses were made and both were WRONG — the day-log tier
 * looked dead to grep (no script reads it) and turned out to be read 93 times; 30 closed plan files looked like
 * noise and turned out to be referenced by name in 63 other files.
 *
 * THE TWO NUMBERS, AND WHY BOTH. That failure is the design:
 *   1. USE   — did the agent actually open/run it? (mined from the session transcripts, which are the only
 *              honest record of what was read; free, retroactive to the first session in June)
 *   2. LINKS — how many other knowledge files cite it by name? A file nobody reads but 63 files point at is
 *              not dead weight, it is an anchor: deleting it breaks the links that prevent re-litigating it.
 * DELETE ONLY WHEN BOTH ARE ~0. A single number invites exactly the mistake this script was written after.
 *
 * WHAT IT CANNOT DO. It cannot tell you whether an unread file is VALUABLE (a restore runbook read zero times
 * is doing its job until the day it isn't). It reports; a human decides. Reads that happened before a
 * transcript existed, or inside a subagent, are invisible — see LIMITS at the bottom of the output.
 *
 * Usage:
 *   node .claude/scripts/usage-census.mjs                 # full census, grouped by kind
 *   node .claude/scripts/usage-census.mjs --days 30       # only count usage in the last 30 days
 *   node .claude/scripts/usage-census.mjs --unused        # only artefacts with zero recorded use
 *   node .claude/scripts/usage-census.mjs --kind skill     # knowledge | skill | hook | script
 *   node .claude/scripts/usage-census.mjs --json
 *
 * Exit code is always 0.
 */

import {
  readdirSync,
  readFileSync,
  createReadStream,
  existsSync,
  statSync,
} from "node:fs";
import { createInterface } from "node:readline";
import { join, resolve, dirname, relative, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const arg = (flag, dflt = null) => {
  const i = process.argv.indexOf(flag);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : dflt;
};
const JSON_OUT = process.argv.includes("--json");
const UNUSED_ONLY = process.argv.includes("--unused");
const DAYS = Number(arg("--days", "0")) || 0;
const KIND = arg("--kind");
const SINCE = DAYS ? Date.now() - DAYS * 86400_000 : 0;

/* ---------------------------------------------------------------- inventory */

const walk = (dir, out = []) => {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".git") continue;
    const p = join(dir, e.name);
    e.isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
};

/** Every artefact the platform could plausibly retire, keyed by its repo-relative path. */
function inventory() {
  const items = new Map();
  const add = (path, kind, extra = {}) =>
    items.set(path, {
      path,
      kind,
      reads: 0,
      writes: 0,
      runs: 0,
      links: 0,
      last: null,
      ...extra,
    });

  // knowledge: platform docs + the agent's own memory + path-scoped rules
  for (const f of [
    ...walk(join(REPO, "platform")),
    ...walk(join(REPO, ".claude", "memory")),
    ...walk(join(REPO, ".claude", "rules")),
  ])
    if (f.endsWith(".md")) add(relative(REPO, f), "knowledge");
  add("CLAUDE.md", "knowledge");

  // skills: one entry per skill directory (its SKILL.md is the thing that loads)
  const skillsDir = join(REPO, ".claude", "skills");
  if (existsSync(skillsDir))
    for (const e of readdirSync(skillsDir, { withFileTypes: true }))
      if (e.isDirectory())
        add(join(".claude/skills", e.name), "skill", { skill: e.name });

  // hooks + scripts: the executable layer
  for (const f of walk(join(REPO, ".claude", "hooks")))
    if (/\.mjs$/.test(f) && !/\.test\.mjs$/.test(f) && !/_util/.test(f))
      add(relative(REPO, f), "hook");
  for (const f of walk(join(REPO, ".claude", "scripts")))
    if (/\.(mjs|sh|ps1)$/.test(f)) add(relative(REPO, f), "script");

  return items;
}

/* ------------------------------------------------- axis 1: recorded USE */

/** Transcript stores for this repo, including the slug it had before the rename to `fleet`. */
function transcriptDirs() {
  const root = join(homedir(), ".claude", "projects");
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((d) => /-home-thien-projects-(fleet|miniserver-platform)$/.test(d))
    .map((d) => join(root, d));
}

const PATH_IN_TEXT = /(?:^|[\s"'`(=:])((?:platform|\.claude|docs)\/[\w./@-]+)/g;
/** A bash command that RUNS a script, vs merely mentions it. */
const RUNNER = /\b(?:node|bash|sh|zsh|pwsh|powershell)\b/;

function normalise(p) {
  if (!p) return null;
  const s = String(p).replace(/\\/g, "/");
  // absolute or ../ paths → cut at the first platform/ | .claude/ segment so the 2026-07 rename doesn't split counts
  const m = s.match(/(?:^|\/)((?:platform|\.claude)\/.*)$/);
  if (!m) return /(?:^|\/)CLAUDE\.md$/.test(s) ? "CLAUDE.md" : null;
  // A skill is inventoried as its DIRECTORY, but it is used by reading a file inside it (SKILL.md, a
  // reference, a template). Fold any path under .claude/skills/<name>/ onto the skill itself — the first
  // cut of this script dropped those reads on the floor and reported 28 skills as "never used".
  const skill = m[1].match(/^\.claude\/skills\/([^/]+)\//);
  return skill ? `.claude/skills/${skill[1]}` : m[1];
}

async function countUse(items) {
  const sessions = { files: 0, events: 0 };
  const bySkillName = new Map();
  for (const [p, it] of items) if (it.skill) bySkillName.set(it.skill, it);

  const touch = (key, field, ts) => {
    const it = items.get(key);
    if (!it) return;
    it[field]++;
    if (!it.last || ts > it.last) it.last = ts;
  };

  for (const dir of transcriptDirs()) {
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".jsonl"))) {
      sessions.files++;
      const rl = createInterface({
        input: createReadStream(join(dir, f)),
        crlfDelay: Infinity,
      });
      for await (const line of rl) {
        if (!line.includes("tool_use")) continue;
        let e;
        try {
          e = JSON.parse(line);
        } catch {
          continue;
        }
        const content = e?.message?.content;
        if (!Array.isArray(content)) continue;
        const ts = Date.parse(e.timestamp || "") || 0;
        if (SINCE && ts && ts < SINCE) continue;
        for (const b of content) {
          if (b?.type !== "tool_use") continue;
          sessions.events++;
          const inp = b.input || {};
          switch (b.name) {
            case "Read":
            case "NotebookEdit": {
              const k = normalise(inp.file_path);
              if (k) touch(k, "reads", ts);
              break;
            }
            case "Write":
            case "Edit":
            case "MultiEdit": {
              const k = normalise(inp.file_path);
              if (k) touch(k, "writes", ts);
              break;
            }
            case "Grep":
            case "Glob": {
              const k = normalise(inp.path);
              if (k) touch(k, "reads", ts);
              break;
            }
            case "Skill": {
              const it = bySkillName.get(inp.skill);
              if (it) {
                it.runs++;
                if (!it.last || ts > it.last) it.last = ts;
              }
              break;
            }
            case "Bash": {
              const cmd = String(inp.command || "");
              const isRun = RUNNER.test(cmd);
              for (const m of cmd.matchAll(PATH_IN_TEXT)) {
                const k = normalise(m[1]);
                if (!k) continue;
                const it = items.get(k);
                if (!it) continue;
                // a script named in `node …/x.mjs` is a RUN; the same path in grep/cat is a READ
                touch(
                  k,
                  isRun && (it.kind === "script" || it.kind === "hook")
                    ? "runs"
                    : "reads",
                  ts,
                );
              }
              break;
            }
          }
        }
      }
    }
  }
  return sessions;
}

/* ------------------------------------------- axis 2: how many files LINK to it */

function countLinks(items) {
  const corpus = [
    ...walk(join(REPO, "platform")),
    ...walk(join(REPO, ".claude")),
  ].filter((f) => /\.(md|mjs|json)$/.test(f));
  const texts = corpus.map((f) => ({
    path: relative(REPO, f),
    text: readFileSync(f, "utf8"),
  }));
  for (const it of items.values()) {
    const name = it.skill ? `/${it.skill}` : basename(it.path);
    if (!name || name.length < 4) continue;
    const needle = it.skill ? new RegExp(`(?:/|\`)${it.skill}\\b`) : null;
    for (const c of texts) {
      if (c.path === it.path || c.path.startsWith(it.path + "/")) continue; // a file citing itself is not a link
      const hit = needle ? needle.test(c.text) : c.text.includes(name);
      if (hit) it.links++;
    }
  }
}

/* ------------------------------------------------------------------ report */

const items = inventory();
const stats = await countUse(items);
countLinks(items);

let rows = [...items.values()].map((it) => ({
  ...it,
  total: it.reads + it.runs,
  lines: (() => {
    const p = join(REPO, it.path);
    try {
      return statSync(p).isDirectory()
        ? existsSync(join(p, "SKILL.md"))
          ? readFileSync(join(p, "SKILL.md"), "utf8").split("\n").length
          : 0
        : readFileSync(p, "utf8").split("\n").length;
    } catch {
      return 0;
    }
  })(),
}));
if (KIND) rows = rows.filter((r) => r.kind === KIND);
if (UNUSED_ONLY) rows = rows.filter((r) => r.total === 0);

if (JSON_OUT) {
  console.log(
    JSON.stringify({ scanned: stats, days: DAYS || "all", rows }, null, 2),
  );
  process.exit(0);
}

const ago = (ts) =>
  ts ? `${Math.max(0, Math.round((Date.now() - ts) / 86400_000))}d` : "—";
const KINDS = ["knowledge", "skill", "hook", "script"];
console.log(
  `usage census — ${stats.files} sessions, ${stats.events} tool calls scanned` +
    (DAYS ? ` (last ${DAYS} days)` : " (all history)") +
    `\n`,
);
for (const kind of KINDS) {
  const group = rows
    .filter((r) => r.kind === kind)
    .sort((a, b) => b.total - a.total || b.links - a.links);
  if (!group.length) continue;
  const used = group.filter((r) => r.total > 0).length;
  console.log(
    `── ${kind}  (${group.length} items, ${used} used, ${group.length - used} never)`,
  );
  console.log(
    `   ${"use".padStart(5)} ${"links".padStart(5)} ${"lines".padStart(5)} ${"last".padStart(5)}  path`,
  );
  for (const r of group)
    console.log(
      `   ${String(r.total).padStart(5)} ${String(r.links).padStart(5)} ${String(r.lines).padStart(5)} ${ago(r.last).padStart(5)}  ${r.path}`,
    );
  console.log("");
}
const dead = rows.filter((r) => r.total === 0 && r.links <= 1);
console.log(
  `── retirement candidates: ${dead.length} (zero recorded use AND ≤1 file linking to it)`,
);
for (const r of dead) console.log(`   ${r.kind.padEnd(9)} ${r.path}`);
console.log(`
LIMITS — read before cutting anything:
  • Zero use ≠ worthless. A runbook or a restore drill earns its keep on the day it is needed, not by being read.
  • Hooks do NOT appear in transcripts (they are not tool calls) — a hook's "use" here counts only the times it was
    read or run by hand. Hook firing needs live instrumentation, not mining.
  • Subagent tool calls live in their own transcripts and may be missed; counts are a floor, never a ceiling.
  • MEMORY FILES: 0 here means "never explicitly opened", NOT "never used". The index line loads every session and
    the harness can inject a memory's content as a system-reminder, which is not a tool call and is not mined.
    Never retire a memory on this number alone. (Probed 2026-07-30: only 21 transcript lines carry a reminder at all.)
  • LINKS counts files that cite the name — it does not prove the citation is current (five files still cite
    prior-art-check.mjs, which was superseded by plan-audit.mjs in June).`);
