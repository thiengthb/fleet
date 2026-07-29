#!/usr/bin/env node
/**
 * recurrence-check.mjs — is a mistake we already learned from happening AGAIN? Report-only.
 *
 * WHY THIS EXISTS. Measured 2026-07-30: the ledger holds **224 lessons and 29 of them (13%) name any
 * mechanical check**; `known-traps.md` holds 41 and names none. So the platform's answer to "how do we
 * not repeat this?" was, almost always, *write it down and remember harder* — against a body of evidence
 * (its own ledger) that remembering harder is exactly what fails. Rules warn you BEFORE; only a tool can
 * tell you the mistake is back.
 *
 * THE DIVISION OF LABOUR, so this file does not grow into a second copy of the hook layer:
 *   - a mistake catchable AT THE MOMENT OF THE WRITE belongs in a hook (secret-guard, invariant-warn,
 *     legibility-lint, plan-audit --hook). Those are listed below as COVERED and never re-implemented here.
 *   - a mistake only visible ACROSS the repo or ACROSS time — a citation that went stale, an index that
 *     drifted back into prose, a tool that quietly stopped finding things — has no single write to hook.
 *     That is what this script checks, and it is the reason it exists at all.
 *
 * EVERY DETECTOR HERE COMES FROM A MISTAKE THAT ACTUALLY HAPPENED. None are hypothetical, and each names
 * the day it was learned. A detector for a mistake nobody has made is how a checker becomes noise.
 *
 * Usage:
 *   node .claude/scripts/recurrence-check.mjs          # run the detectors, then report coverage
 *   node .claude/scripts/recurrence-check.mjs --quiet    # findings only
 *   node .claude/scripts/recurrence-check.mjs --json
 *
 * Exit code: 1 if any detector fires (so it can gate), 0 when clean. Coverage gaps never fail the run.
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, resolve, dirname, relative, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { projectRoots, gitRepos } from "./_layout.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const JSON_OUT = process.argv.includes("--json");
const QUIET = process.argv.includes("--quiet");

const walk = (dir, out = []) => {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".git") continue;
    const p = join(dir, e.name);
    e.isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
};

const docs = () =>
  [...walk(join(REPO, "platform")), ...walk(join(REPO, ".claude"))].filter(
    (f) => f.endsWith(".md"),
  );

/* ─────────────────────────────────────────────────────────────────────────────── the detectors ── */

const detectors = [];

/**
 * D1 — a document names a tool that no longer exists.
 * LEARNED 2026-07-30: five files (including the plan TEMPLATE, the autonomy contract and a memory file)
 * still told the reader to rely on `prior-art-check.mjs`, which had been folded into `plan-audit.mjs` in
 * June. Nothing was broken — which is the point: a stale instruction fails silently, by being followed.
 */
detectors.push({
  id: "stale-tool-citation",
  learned: "2026-07-30",
  what: "a document tells the reader to use a script that is not on disk",
  run() {
    const onDisk = new Set(walk(REPO).map((f) => basename(f)));
    // Only citations that look like an instruction: a path, or a name in backticks. Bare prose like
    // "test.mjs" in an example is not a claim about this repo.
    const cite =
      /[`(]([a-z0-9][a-z0-9._-]*\.(?:mjs|sh|ps1))[`)]|((?:\.claude|platform)\/[\w./-]+\.(?:mjs|sh|ps1))/g;
    const hits = [];
    for (const f of docs()) {
      const rel = relative(REPO, f);
      // A record of the past is not an instruction, and neither is a proposal for something not built yet.
      // First cut of this detector reported 38 hits, of which 34 were closed plans faithfully describing the
      // auto-pilot control plane that was DELETED on 2026-07-28 — correct documents, flagged as rot. The
      // filter is the same one the July rename used for `sed`: history and proposals are out of scope.
      if (rel.startsWith("platform/ledger/") || rel.startsWith("platform/log/"))
        continue;
      if (
        rel.startsWith("platform/proposals/") ||
        rel.startsWith("platform/skill-proposals/")
      )
        continue;
      const text = readFileSync(f, "utf8");
      if (/^status:\s*(done|abandoned|superseded|rejected)\b/im.test(text))
        continue; // a closed plan is a record
      for (const m of text.matchAll(cite)) {
        const raw = m[1] || m[2];
        const name = basename(raw);
        if (onDisk.has(name)) continue;
        if (/^(test|util|config|index|evil|y|www)\.(mjs|sh)$/.test(name))
          continue; // generic example names
        // A proposal file is `<name>.mjs.proposed`: the `.mjs` inside it is not a claim that `<name>.mjs`
        // exists. The detector's own first run reported this as drift — a checker gets audited too.
        if (text.slice(m.index + m[0].length - 1).startsWith(".proposed"))
          continue;
        if (onDisk.has(`${name}.proposed`)) continue;
        // A document that names the tool IN ORDER TO SAY it is gone is the fix, not the defect. Without
        // this, repairing a stale citation by explaining the supersession makes the detector fire forever
        // — and a check that cannot be satisfied gets muted. Scoped to the sentence, not the file, so a
        // page can retire one tool and still be caught recommending another.
        const lineStart = text.lastIndexOf("\n", m.index) + 1;
        const lineEnd = text.indexOf("\n", m.index);
        const line = text.slice(
          lineStart,
          lineEnd === -1 ? undefined : lineEnd,
        );
        if (
          /supersed|retired|no longer|not installed|replaced by|removed|deleted|folded in/i.test(
            line,
          )
        )
          continue;
        hits.push({ file: rel, name });
      }
    }
    // One row per (file, tool) pair, deduped.
    const seen = new Set();
    return hits.filter((h) => {
      const k = `${h.file}|${h.name}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  },
  format: (h) => `${h.file} → ${h.name}`,
});

/**
 * D2 — the ledger INDEX is carrying detail again.
 * LEARNED 2026-07-28: the rule "the index is one scannable row, the detail lives in the month file" held
 * from day one and eroded anyway — the index reached 421KB (~105K tokens) with single rows over 2,500
 * characters, and had to be split by a script. Prose rules erode; this is the measurement that says so.
 */
detectors.push({
  id: "ledger-index-carrying-detail",
  learned: "2026-07-28",
  what: "a knowledge-ledger index row has grown past a scannable headline",
  run() {
    const p = join(REPO, "platform/registries/knowledge-ledger.md");
    if (!existsSync(p)) return [];
    /*
     * LIMIT is set from the file's own measured state, not from the written rule, and the difference is
     * itself a finding. The standard says "headline ≤120 chars"; after the 2026-07-28 mechanical split the
     * 224 accepted rows run 70–246 chars (median 222). A detector at 220 would have fired on 108 of them
     * on the day it was written — the fastest way to make a check ignored. So it fires at 400, which no
     * healthy row approaches and every pre-split row (2,500+) blew past, and it reports the gap between
     * the rule and reality separately instead of pretending one of them does not exist.
     */
    const LIMIT = 400;
    const DOCUMENTED = 120 + 100; // headline cap + a generous allowance for the date cell and the link
    const rows = readFileSync(p, "utf8")
      .split("\n")
      .map((line, i) => ({ line, n: i + 1 }))
      .filter(({ line }) => /^\|\s*20\d\d-/.test(line));
    const over = rows.filter((r) => r.line.length > DOCUMENTED).length;
    const hits = rows
      .filter((r) => r.line.length > LIMIT)
      .map(({ line, n }) => ({ n, len: line.length, head: line.slice(0, 70) }));
    if (over && !hits.length)
      hits.note = `${over}/${rows.length} rows exceed the documented ${DOCUMENTED}-char shape but none is prose — drift from the rule, not a return of the 2026-07 blow-up`;
    return hits;
  },
  format: (h) => `line ${h.n}: ${h.len} chars — ${h.head}…`,
});

/**
 * D3 — a discovery tool has quietly stopped finding things.
 * LEARNED 2026-07-30: moving nine repos into `projects/` made four tools return smaller, true-LOOKING
 * answers with no error at all (13 git repos → 4; 63 plans → 0; 22 duplicate groups → 0). The check is
 * deliberately not a stored baseline, which would go stale: it counts the same thing a second, independent
 * way and asserts the two agree. A number that only one method produces cannot be wrong out loud.
 */
detectors.push({
  id: "discovery-regression",
  learned: "2026-07-30",
  what: "a tool that enumerates the fleet disagrees with a direct filesystem count",
  run() {
    const out = [];
    // git repos: walk the tree ourselves (2 levels) vs what _layout reports
    const direct = [];
    const scan = (dir, depth) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (
          !e.isDirectory() ||
          e.name.startsWith(".") ||
          e.name === "node_modules"
        )
          continue;
        const full = join(dir, e.name);
        if (existsSync(join(full, ".git"))) direct.push(full);
        else if (depth < 2) scan(full, depth + 1);
      }
    };
    scan(REPO, 1);
    if (existsSync(join(REPO, ".git"))) direct.push(REPO);
    const viaLayout = gitRepos(REPO).length;
    if (direct.length !== viaLayout)
      out.push({
        what: "git repos",
        direct: direct.length,
        tool: viaLayout,
        tip: "_layout.mjs projectRoots()",
      });

    // plan files: find them directly vs what plan-audit reports it scanned
    const directPlans = [
      ...(existsSync(join(REPO, "platform/plans"))
        ? readdirSync(join(REPO, "platform/plans")).filter((f) =>
            f.endsWith(".md"),
          )
        : []),
      ...projectRoots(REPO).flatMap((p) => {
        const d = join(p.dir, "docs", "plans");
        return existsSync(d)
          ? readdirSync(d).filter(
              (f) => f.endsWith(".md") && !f.startsWith("_"),
            )
          : [];
      }),
    ].length;
    let auditPlans = null;
    try {
      const r = execSyncQuiet(
        `node ${JSON.stringify(join(REPO, ".claude/scripts/plan-audit.mjs"))} --json`,
      );
      auditPlans = JSON.parse(r).scanned ?? null;
    } catch {
      /* the audit failing is its own problem, reported by tool-check */
    }
    if (auditPlans !== null && auditPlans !== directPlans)
      out.push({
        what: "plan files",
        direct: directPlans,
        tool: auditPlans,
        tip: "plan-audit.mjs findPlanFiles()",
      });
    return out;
  },
  format: (h) =>
    `${h.what}: filesystem says ${h.direct}, ${h.tip} says ${h.tool}`,
});

const execSyncQuiet = (cmd) =>
  execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });

/* ───────────────────────────────────────────────── what is already enforced somewhere else ── */

/**
 * Lesson classes that DO have a mechanical guard, so this script stays out of their way. Kept here rather
 * than in a fourth registry: the point of the list is to be read next to the detectors, and a separate
 * file would drift from both.
 */
const COVERED = [
  [
    "a hardcoded secret outside .env",
    "secret-guard.mjs (+ its test, 2026-07-30)",
  ],
  [
    "certbot / self-hosted runner / published host ports",
    "invariant-warn.mjs (+ its test, 2026-07-30)",
  ],
  ["the agent editing its own governance unattended", "autonomy-gate.mjs"],
  ["a plan with a check-in date but no runbook", "plan-checkin.mjs"],
  [
    "a plan missing prior art, acceptance criteria, or the verbatim ask",
    "plan-audit.mjs --hook",
  ],
  [
    "jargon with no plain gloss; an option list with no recommendation",
    "legibility-lint.mjs",
  ],
  ["memory index drift, orphans, cap breach", "memory-audit.mjs"],
  ["the same artefact built in three projects", "reuse-scan.mjs"],
  ["deleting something on one number instead of two", "usage-census.mjs"],
  [
    "a guard that was never proved able to fail",
    "tool-check.mjs + §2.5 mutation testing",
  ],
];

/* ──────────────────────────────────────────────────────────────────────────────────── report ── */

const results = detectors.map((d) => ({
  id: d.id,
  learned: d.learned,
  what: d.what,
  hits: d.run(),
  format: d.format,
}));
const fired = results.filter((r) => r.hits.length);

if (JSON_OUT) {
  console.log(
    JSON.stringify(
      {
        detectors: results.map(({ id, learned, what, hits }) => ({
          id,
          learned,
          what,
          hits,
        })),
        covered: COVERED,
      },
      null,
      2,
    ),
  );
  process.exit(fired.length ? 1 : 0);
}

console.log(
  `recurrence-check — ${detectors.length} detector(s), ${fired.length} firing\n`,
);
for (const r of results) {
  const tag = r.hits.length ? `${r.hits.length} HIT` : "clean";
  console.log(`── ${r.id}  [${tag}]  (learned ${r.learned})`);
  if (!QUIET) console.log(`   ${r.what}`);
  for (const h of r.hits) console.log(`   • ${r.format(h)}`);
  if (r.hits.note) console.log(`   note: ${r.hits.note}`);
  console.log("");
}

if (!QUIET) {
  console.log(`── already guarded elsewhere (not re-checked here):`);
  for (const [lesson, by] of COVERED)
    console.log(`   ${lesson}\n      → ${by}`);
  console.log(`
THE RULE THIS SCRIPT SERVES. A lesson written down twice has already proved that writing it down does not
work. The second time, it gets a guard — a hook if there is a write to catch it at, a detector here if the
evidence only shows up across the repo or across time — or the plan says out loud why it cannot have one.
Measured 2026-07-30: 29 of 224 ledger lessons named any check at all. That ratio is the backlog.`);
}

process.exit(fired.length ? 1 : 0);
