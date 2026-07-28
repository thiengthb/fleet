#!/usr/bin/env node
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

function globAll(pattern) {
  const segs = pattern.split("/").filter(Boolean);
  let frontier = [REPO];
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

let catalogBytes = 0;
const rows = [];
for (const name of installed) {
  const file = join(SKILLS_DIR, name, "SKILL.md");
  const raw = readFileSync(file, "utf8");
  const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const fmBytes = fm ? Buffer.byteLength(fm[1]) : 0;
  catalogBytes += fmBytes;

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
p("Removing a skill is a governance change: propose it, let a human commit it.");
p("NO-SUBSTRATE is a strong signal, not a verdict — a skill may be installed ahead of a planned need.");

console.log(out.join("\n"));
