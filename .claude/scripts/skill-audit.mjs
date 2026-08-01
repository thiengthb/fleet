#!/usr/bin/env node
// @vi WHAT: Xem từng skill đã cài có còn đáng chỗ của nó không.
// @vi WHEN: Khi số skill phình lên, hoặc khi nghi có skill đã chết.
// @vi WHY: Tên và mô tả của MỌI skill đã cài được nhồi vào đầu mỗi phiên dù có gọi hay không — phần thân mới nạp theo yêu
//   cầu, phần danh mục thì không. CHỈ báo cáo: gỡ một skill là thay đổi luật, và đó là việc của người.
//
/**
 * skill-audit.mjs — is every installed skill still earning its keep?
 *
 * REPORT-ONLY. Never uninstalls anything; uninstalling a skill is a governance change and a human move.
 *
 * Why this exists. Every installed skill's name + description is injected into the system prompt on EVERY
 * session, whether or not the skill is ever invoked (the BODY loads on demand; the CATALOG does not). At 37
 * skills that catalog is roughly the size of CLAUDE.md itself — the largest always-loaded cost nobody counts.
 * A skill with nothing to act on is therefore not free: it is a permanent tax buying nothing.
 *
 * Why a file check and not "has it been used?". Usage is not observable: a skill's whole job is to fire
 * quietly, and the day-log records outcomes, not which skill ran. Counting mentions would have declared
 * /coding-convention dead — it fires constantly. The fair, falsifiable question is instead:
 *
 *     does the thing this skill acts on EXIST in this repo?
 *
 * A skill whose substrate is absent cannot help, no matter how good it is (`/dependabot-review` triaging
 * PRs from a bot that was never enabled). That is a defensible removal case. Everything else is a judgement
 * call left to the human.
 *
 * Precedent: on 2026-07-28 the `/auto-pilot` skill pair was retired after Claude Code shipped the capability
 * natively. This script exists so the next one is found by measurement rather than by noticing.
 *
 * Usage
 *   node .claude/scripts/skill-audit.mjs
 *   node .claude/scripts/skill-audit.mjs --json
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { projectRoots } from "./_layout.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SKILLS_DIR = join(REPO, ".claude", "skills");
const MAP_FILE = join(REPO, ".claude", "scripts", "skill-substrate.json");
const JSON_OUT = process.argv.includes("--json");

const IGNORE_DIRS = new Set([".git", "node_modules", ".next", "dist", "build", ".venv", "__pycache__"]);

// ------------------------------------------------------------- tiny globber --

/** Supports `*` within a path segment (never across `/`). Enough for the substrate patterns. */
function segToRegex(seg) {
  const body = seg.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*");
  return new RegExp(`^${body}$`);
}

/**
 * A substrate spec is either a glob ("*​/Dockerfile"), or "grep:<regex>:<glob>" when mere existence of the
 * file proves nothing and the CONTENT is what matters (every project has a package.json; only some declare
 * an external-API client). An array means "any of these counts".
 */
function substrateHit(spec) {
  if (Array.isArray(spec)) {
    for (const s of spec) {
      const hit = substrateHit(s);
      if (hit) return hit;
    }
    return null;
  }
  if (typeof spec === "string" && spec.startsWith("grep:")) {
    const idx = spec.indexOf(":", 5);
    const re = new RegExp(spec.slice(5, idx));
    const glob = spec.slice(idx + 1);
    for (const rel of globAll(glob)) {
      try {
        if (re.test(readFileSync(join(REPO, rel), "utf8"))) return `${rel} (matched /${re.source}/)`;
      } catch {
        /* unreadable — not a hit */
      }
    }
    return null;
  }
  return globExists(spec);
}

function globExists(pattern) {
  const all = globAll(pattern);
  return all.length ? all[0] : null;
}

/**
 * Where a `*​/X` pattern starts looking. NOT just the repo root: the substrate patterns were written when
 * every project was an immediate child of it, and on 2026-07-30 the nine app repos moved into `projects/`.
 * The globber kept working and kept finding nothing, so skill-audit reported **14 skills as NO-SUBSTRATE**
 * — /docker-expert with 12 Dockerfiles in the tree, /prisma-expert with four schemas. A "this is dead"
 * verdict produced by a path assumption is the most expensive kind of wrong answer this repo can produce,
 * because the next step it invites is deletion.
 *
 * Seeded from `_layout.projectRoots()` so the root and every container that holds projects are both
 * searched, and a future reorganisation costs no edit here.
 */
function globRoots() {
  const roots = new Set([REPO]);
  for (const p of projectRoots(REPO)) roots.add(dirname(p.dir));
  return [...roots];
}

function globAll(pattern) {
  const segs = pattern.split("/").filter(Boolean);
  let frontier = globRoots();
  const found = [];
  for (let i = 0; i < segs.length; i++) {
    const re = segToRegex(segs[i]);
    const isLast = i === segs.length - 1;
    const next = [];
    for (const dir of frontier) {
      let entries;
      try {
        entries = readdirSync(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const e of entries) {
        if (!re.test(e.name)) continue;
        if (e.isDirectory() && IGNORE_DIRS.has(e.name)) continue;
        const full = join(dir, e.name);
        if (isLast) found.push(full.slice(REPO.length + 1));
        else if (e.isDirectory()) next.push(full);
      }
    }
    if (isLast) break;
    frontier = next;
    if (!frontier.length) return [];
  }
  return found;
}

// ----------------------------------------------------------------- gather ----

if (!existsSync(MAP_FILE)) {
  console.error(`substrate map missing: ${MAP_FILE}`);
  process.exit(1);
}
const map = JSON.parse(readFileSync(MAP_FILE, "utf8")).skills;

const installed = readdirSync(SKILLS_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(join(SKILLS_DIR, e.name, "SKILL.md")))
  .map((e) => e.name)
  .sort();

// Drift both ways — the map must never look authoritative while being stale.
const missingFromMap = installed.filter((s) => !(s in map));
const staleInMap = Object.keys(map).filter((s) => !installed.includes(s));

/**
 * The frontmatter keys Claude Code actually READS, fetched from the vendor's field table on 2026-08-01
 * (https://code.claude.com/docs/en/skills). A key outside this set is INERT: the loader ignores it, so it is
 * documentation pretending to be configuration.
 *
 * WHY THIS LIST EXISTS — this platform has now proposed a non-existent frontmatter field three times:
 *   1. `category:` (L2, 2026-07-31) — a plan step asked for it across all 38 skills; discovery reads
 *      `description`, so the field would have done nothing. Caught by measuring the keys in use.
 *   2. `allowed-tools` used as a RESTRICTION (A5, 2026-07-31) — the field exists but GRANTS permission. That
 *      one was worse than inert: it would have pre-approved the skills that touch auth and secrets.
 *   3. `version:` (C5, refused 2026-08-01) — proposed for all 38 as "the field that decides whether a consumer
 *      receives an update". That is PLUGIN semantics (`plugin.json`), and it is real there; SKILL.md has no
 *      such field. Refused before writing, by fetching the table.
 *
 * All three were caught by reading the docs before typing. This is the cheaper backstop for the time nobody
 * reads them. Deliberately a REPORT and not a failure: `skill-audit` is a reporter, its callers rely on that,
 * and `health-sweep` runs it weekly, so an inert key surfaces long before it could reach a consumer. The
 * escalation ladder (memory: enforce-rules-with-gates) is restructure → measure → gate; this is the measure
 * rung. If a key is ever reported here and shipped anyway, that is the evidence for a PreToolUse gate.
 *
 * KEEP DATED. The vendor adds fields (`background` and boolean-alias parsing arrived in 2.1.218); a stale
 * allowlist would report a real, working field as inert, which is the failure direction that teaches people to
 * ignore the check.
 */
const KNOWN_FRONTMATTER_KEYS = new Set([
  "name",
  "description",
  "arguments",
  "disable-model-invocation",
  "user-invocable",
  "allowed-tools",
  "disallowed-tools",
  "model",
  "effort",
  "context",
  "background",
  "hooks",
]);

let catalogBytes = 0;
const inertKeys = [];
const rows = [];
for (const name of installed) {
  const file = join(SKILLS_DIR, name, "SKILL.md");
  const raw = readFileSync(file, "utf8");
  const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const fmBytes = fm ? Buffer.byteLength(fm[1]) : 0;
  catalogBytes += fmBytes;

  // Top-level keys only: column 0 inside the block. An indented key is a nested value (`hooks:` has children),
  // not a frontmatter field, and treating one as a field would report every structured value as inert.
  if (fm) {
    for (const m of fm[1].matchAll(/^([A-Za-z_][A-Za-z0-9_-]*):/gm)) {
      if (!KNOWN_FRONTMATTER_KEYS.has(m[1])) inertKeys.push({ skill: name, key: m[1] });
    }
  }

  const bodyBytes = Buffer.byteLength(raw) - fmBytes;
  let refBytes = 0;
  const refDir = join(SKILLS_DIR, name, "references");
  if (existsSync(refDir)) {
    for (const f of readdirSync(refDir)) {
      try {
        refBytes += statSync(join(refDir, f)).size;
      } catch {
        /* ignore */
      }
    }
  }

  const pattern = name in map ? map[name] : undefined;
  let verdict;
  let hit = null;
  if (pattern === undefined) verdict = "UNMAPPED";
  else if (pattern === null) verdict = "BEHAVIOURAL";
  else {
    hit = substrateHit(pattern);
    verdict = hit ? "HAS-SUBSTRATE" : "NO-SUBSTRATE";
  }

  rows.push({ name, pattern: pattern ?? null, verdict, hit, catalogBytes: fmBytes, bodyBytes, refBytes });
}

const report = {
  repo: REPO,
  generatedAt: new Date().toISOString(),
  skillCount: installed.length,
  catalogBytes,
  catalogTokensEst: Math.round(catalogBytes / 4),
  drift: { missingFromMap, staleInMap },
  inertKeys,
  skills: rows,
};

if (JSON_OUT) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

const kb = (n) => `${(n / 1024).toFixed(1)}KB`;
const out = [];
const p = (s = "") => out.push(s);

p("SKILL AUDIT — report only, nothing was uninstalled");
p(`${installed.length} skills installed`);
p(
  `catalog cost: ${kb(catalogBytes)} ≈ ${report.catalogTokensEst} tokens, injected into EVERY session ` +
    "(bodies load on demand; this does not)",
);
p("");

if (missingFromMap.length || staleInMap.length) {
  p("── MAP DRIFT (fix this first — the verdicts below are incomplete until you do) ──");
  for (const s of missingFromMap) p(`  !! installed but not in skill-substrate.json: ${s}`);
  for (const s of staleInMap) p(`  !! in skill-substrate.json but not installed: ${s}`);
  p("");
}

const group = (v) => rows.filter((r) => r.verdict === v);

const dead = group("NO-SUBSTRATE");
p(`── NO SUBSTRATE (${dead.length}) — nothing in this repo for these to act on ──`);
if (!dead.length) p("  none");
for (const r of dead) p(`  ${r.name.padEnd(30)} expected: ${r.pattern}`);
p("");

const behavioural = group("BEHAVIOURAL");
p(`── BEHAVIOURAL (${behavioural.length}) — no artifact can prove or disprove these ──`);
p("  A file check cannot judge a discipline. If one of these is suspect, the honest test is a");
p("  behavioural eval (/behavioural-eval), not a glob: does the rule get followed more often with it?");
for (const r of behavioural) p(`  ${r.name}`);
p("");

const alive = group("HAS-SUBSTRATE");
p(`── HAS SUBSTRATE (${alive.length}) ──`);
for (const r of alive) p(`  ${r.name.padEnd(30)} → ${r.hit}`);
p("");

const heaviest = [...rows].sort((a, b) => b.catalogBytes - a.catalogBytes).slice(0, 5);
p("── HEAVIEST CATALOG ENTRIES (shorten the description, keep the skill) ──");
for (const r of heaviest) p(`  ${String(r.catalogBytes).padStart(4)}B  ${r.name}`);
p("");
p(
  inertKeys.length
    ? `── INERT FRONTMATTER KEYS (${inertKeys.length}) — written, but the loader does not read them ──`
    : `── FRONTMATTER KEYS — all ${installed.length} skills use only keys Claude Code reads (allowlist dated 2026-08-01) ──`,
);
for (const k of inertKeys) p(`  ${k.skill.padEnd(30)} → \`${k.key}:\` is not a documented field, so it does nothing`);
if (inertKeys.length)
  p(
    "  Either delete the key or check the field table — https://code.claude.com/docs/en/skills. A field written\n" +
      "  from memory of what ought to exist has been proposed here three times (`category:`, `version:`, and\n" +
      "  `allowed-tools` read as a restriction when it is a GRANT). If the vendor has added it, update the\n" +
      "  allowlist in this file and date it, rather than silencing the row.",
  );
p("");
p("Removing a skill is a governance change: propose it, let a human commit it.");
p("NO-SUBSTRATE is a strong signal, not a verdict — a skill may be installed ahead of a planned need.");

console.log(out.join("\n"));
