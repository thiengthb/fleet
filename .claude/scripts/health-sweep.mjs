#!/usr/bin/env node
// @vi WHAT: MỘT lệnh gọi hết mọi công cụ kiểm và trả về một dòng kết luận duy nhất: có gì vỡ không.
// @vi WHEN: Mỗi tuần một lần. Chỉ cần đọc dòng VERDICT.
// @vi WHY: Platform có 8 công cụ kiểm mà không có cách hỏi tất cả một lượt, nên thực tế chúng chỉ được chạy khi người ta đã
//   nghi ngờ — đúng lúc một kết quả xanh nói được ít nhất. Phần "drift" là danh sách ứng viên để xem, KHÔNG phải danh
//   sách việc phải làm.
//
/**
 * health-sweep.mjs — ONE command that asks every checker whether the second brain is working. Report-only.
 *
 * WHY THIS EXISTS. By 2026-07-30 the platform had eight checkers and no way to ask them all at once, so in
 * practice they were run when someone was already suspicious — the one moment a green result tells you
 * least. Worse, they answer different QUESTIONS, and a person reading them one at a time cannot tell which
 * silence is reassuring: `plan-audit` clean means the plans are well-SHAPED, not that they are being done;
 * `link-check` clean means the wires resolve, not that what they connect is worth keeping.
 *
 * So this prints one line per checker, each labelled with what its silence actually buys, and one verdict.
 *
 * THE TWO KINDS OF FINDING, kept apart on purpose:
 *   BROKEN  — something does not work: a dead wire, a failing test, a mistake that has come back. Fix now.
 *   DRIFT   — something works but is decaying: unused knowledge, untested tools, plans nobody has touched.
 *             NEVER auto-acted on. Drift is where a confident cleanup destroys work, so it produces a
 *             candidate list for a human to retire slowly — never a deletion.
 *
 * Usage:  node .claude/scripts/health-sweep.mjs [--quiet] [--json] [--no-log]
 * Exit code: 1 if anything is BROKEN, 0 otherwise. DRIFT never fails the run.
 *
 * Every run stamps one dated row into `platform/reports/health-sweep-log.md` — the evidence the standing
 * cadence reminder reads, and the only place the broken/drift TREND is visible. `--no-log` suppresses it.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const S = (p) => join(REPO, ".claude/scripts", p);
const JSON_OUT = process.argv.includes("--json");
const QUIET = process.argv.includes("--quiet");

const run = (args) => {
  const r = spawnSync(process.execPath, args, {
    encoding: "utf8",
    timeout: 180_000,
    cwd: REPO,
  });
  return { code: r.status ?? -1, out: (r.stdout || "") + (r.stderr || "") };
};
const num = (out, re) => {
  const m = re.exec(out);
  return m ? Number(m[1]) : null;
};

/**
 * Each entry states what a CLEAN result proves — the sentence that stops a green sweep from being read as
 * "everything is fine", which is the failure mode of every dashboard ever built.
 */
const checkers = [
  {
    id: "link-check",
    proves:
      "every wire between files resolves (hooks↔settings, INVENTORY paths, ledger anchors, catalog paths)",
    args: [S("link-check.mjs"), "--quiet"],
    read: ({ code, out }) => ({
      kind: "BROKEN",
      bad: num(out, /(\d+) broken/) ?? (code ? 1 : 0),
      line: (/link-check — .*/.exec(out) || [""])[0],
    }),
  },
  {
    id: "recurrence-check",
    proves: "no mistake we already learned from has come back",
    args: [S("recurrence-check.mjs"), "--quiet"],
    read: ({ code, out }) => ({
      kind: "BROKEN",
      bad: num(out, /(\d+) firing/) ?? (code ? 1 : 0),
      line: (/recurrence-check — .*/.exec(out) || [""])[0],
    }),
  },
  {
    id: "tool-check",
    proves:
      "every checker that HAS a test still passes it — and names the ones with none",
    args: [S("tool-check.mjs"), "--quiet"],
    read: ({ code, out }) => {
      const failing = num(out, /— (\d+) FAILING/) ?? 0;
      // Read the UNTESTED count that tool-check prints explicitly, rather than subtracting the tested
      // fraction. Those differ once a tool is EXEMPT with a written reason: on 2026-07-30 the derived form
      // reported "1 tool(s) with no test" when the only gap was a declared, reasoned exemption — drift that
      // has already been argued through, counted as drift again.
      return {
        kind: "BROKEN",
        bad: failing || (code ? 1 : 0),
        drift: num(out, /· (\d+) UNTESTED/) ?? 0,
        driftWhat: "tool(s) with no test",
        line: (/\d+\/\d+ test file\(s\).*/.exec(out) || [""])[0],
      };
    },
  },
  {
    id: "tool-catalog",
    proves:
      "the human-readable page describing every hook and script still matches the tools on disk, and every tool introduces itself",
    args: [S("tool-catalog.mjs"), "--check"],
    // BROKEN, not drift: the page is the supervisor's only entry point into the executable layer, and a page
    // that has silently stopped matching reality is worse than no page — it is read and believed. The
    // hand-written table it replaced drifted 3 of 13 hooks in one day, two of them able to block a write.
    read: ({ code, out }) => ({
      kind: "BROKEN",
      bad: code ? 1 : 0,
      line: (/(ok  platform\/registries\/tool-catalog\.md.*|✗ .*)/.exec(out) || [""])[0],
    }),
  },
  {
    id: "plan-audit",
    proves: "plans are well-SHAPED — not that anyone is working on them",
    args: [S("plan-audit.mjs"), "--json"],
    read: ({ out }) => {
      try {
        const j = JSON.parse(out);
        return {
          kind: "DRIFT",
          bad: 0,
          drift: j.errors ?? 0,
          driftWhat: "LIVE plan file(s) with a shape ERROR",
          // `legacy` is the same shape gap on an already-closed plan (plan-audit Batch D2). Printed, never
          // counted as drift: it was 80 of the 105 that used to be reported, and a number nobody can act on
          // is a number that gets skimmed past — which is how the live ones stayed invisible.
          line:
            `${j.scanned} plan(s) scanned · ${j.errors} error (live) · ${j.warns} warn` +
            (j.legacy ? ` · ${j.legacy} legacy (closed plans)` : ""),
        };
      } catch {
        return {
          kind: "BROKEN",
          bad: 1,
          line: "plan-audit --json did not return JSON",
        };
      }
    },
  },
  {
    id: "memory-audit",
    proves:
      "the shared memory tier actually LOADS on this machine, and its index is inside its caps with no orphan or unindexed file",
    // `--json`, not the text report, and not the exit code. memory-audit exits 0 even when memory is
    // completely unwired — deliberately, so a human decides (case 9 of its own test). This check used to
    // infer health from that exit code and therefore printed `memory-audit  ok` on 2026-07-30 while
    // autoMemoryDirectory was UNSET on this box and all 32 memories had been silently not loading. Read the
    // structured `wiring.loads` flag instead: a summariser must not turn "did not fail" into "is fine".
    args: [S("memory-audit.mjs"), "--json"],
    read: ({ code, out }) => {
      let j;
      try {
        j = JSON.parse(out);
      } catch {
        return {
          kind: "BROKEN",
          bad: 1,
          line: `memory-audit --json did not return JSON (exit ${code})`,
        };
      }
      const w = j.wiring || {};
      const idx = j.tiers?.[0]?.index;
      const caps = idx?.overLineCap || idx?.overByteCap ? " — OVER CAP" : "";
      const summary = idx
        ? `index: ${idx.lines} lines / ${(idx.bytes / 1024).toFixed(1)}KB${caps}`
        : "no index";
      if (w.loads === false)
        return {
          kind: "BROKEN",
          bad: w.fatal?.length || 1,
          line: `MEMORY DOES NOT LOAD HERE — ${(w.fatal || ["wiring problem"])[0]}`,
        };
      return {
        kind: "BROKEN",
        bad: code ? 1 : 0,
        line: `${summary} · wired -> ${w.effective?.dir ?? "?"}`,
      };
    },
  },
  {
    id: "skill-audit",
    proves: "every installed skill still has something in the repo to act on",
    args: [S("skill-audit.mjs")],
    read: ({ out }) => ({
      kind: "DRIFT",
      bad: 0,
      // The heading reads "── NO SUBSTRATE (14) —". The first cut of this parser looked for `NO-SUBSTRATE`
      // (the hyphenated form used in the CLOSING advisory line) and silently reported 0, i.e. a green light
      // over 14 findings. A summariser that mis-parses is worse than no summariser: it manufactures calm.
      drift: num(out, /NO[ -]SUBSTRATE\s*\((\d+)\)/) ?? 0,
      driftWhat: "skill(s) with nothing in this repo to act on",
      line: (/\d+ skills installed.*/.exec(out) || [""])[0],
    }),
  },
  {
    id: "reuse-scan",
    proves: "nothing has been built a third time in a third project",
    args: [S("reuse-scan.mjs")],
    read: ({ out }) => ({
      kind: "DRIFT",
      bad: 0,
      drift: num(out, /(\d+) EXTRACT/) ?? 0,
      driftWhat: "artifact(s) duplicated past the rule of three",
      line: (/\d+ group\(s\):.*/.exec(out) || [""])[0],
    }),
  },
  {
    id: "usage-census",
    proves:
      "nothing here — it MEASURES what is used, and never says anything is safe to delete",
    args: [S("usage-census.mjs"), "--json"],
    read: ({ out }) => {
      try {
        const j = JSON.parse(out);
        const dead = j.rows.filter(
          (r) => r.reads + r.runs === 0 && !r.ran && r.links <= 1,
        );
        return {
          kind: "DRIFT",
          bad: 0,
          drift: dead.length,
          driftWhat:
            "artefact(s) with no recorded use AND ≤1 inbound link — CANDIDATES ONLY",
          line: `${j.rows.length} artefacts inventoried · ${dead.length} retirement candidate(s)`,
        };
      } catch {
        return {
          kind: "BROKEN",
          bad: 1,
          line: "usage-census --json did not return JSON",
        };
      }
    },
  },
];

/**
 * Leave dated evidence that the sweep actually RAN — one row per calendar day, the last run of the day wins.
 *
 * WHY. The weekly cadence reminder (`platform/plans/2026-07-30-standing-cadence.md`) needs to know when this
 * was last run, and the cheap way — a `last_run:` field someone edits by hand — is precisely the erosion this
 * platform keeps documenting: a self-reported clock reads "on schedule" the moment anyone forgets. Measuring
 * it from an artefact the tool writes itself cannot drift. The row doubles as the broken/drift TREND, which is
 * the one thing a single sweep cannot show: 3 drift items is meaningless, 3 → 40 over a month is a finding.
 *
 * Never fatal: this is bookkeeping, and a sweep that dies while reporting health would be its own punchline.
 * Off with `--no-log` or `HEALTH_SWEEP_LOG=off` (a dry run, or a test that must not touch the tree).
 */
function stampRunLog(broken, drift) {
  if (process.argv.includes("--no-log")) return;
  if (/^(0|off|false|no)$/i.test((process.env.HEALTH_SWEEP_LOG || "").trim()))
    return;

  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  // LOCAL calendar day — the supervisor's week, not UTC's (same choice as plan-checkin.mjs).
  const day = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  const file = join(REPO, "platform", "reports", "health-sweep-log.md");
  const HEADER = `# health-sweep — run log

One row per DAY (the last run of that day wins). Written by \`.claude/scripts/health-sweep.mjs\` on every run —
**this is the evidence the standing-cadence reminder reads, so it is never edited by hand.** Two things live
here that a single sweep cannot tell you: *whether the weekly cadence is actually being kept*, and *which
direction the numbers are moving.*

| date | broken | drift | verdict |
| --- | --- | --- | --- |
`;
  const row = `| ${day} | ${broken} | ${drift} | ${broken ? `${broken} BROKEN` : "clean"} |`;

  try {
    mkdirSync(dirname(file), { recursive: true });
    let text = existsSync(file) ? readFileSync(file, "utf8") : HEADER;
    if (!text.endsWith("\n")) text += "\n";
    const rowRe = new RegExp(`^\\| ${day} \\|.*$`, "m");
    text = rowRe.test(text) ? text.replace(rowRe, row) : `${text}${row}\n`;
    writeFileSync(file, text);
  } catch {
    /* bookkeeping is best-effort — never the reason a health report fails */
  }
}

const results = checkers.map((c) => {
  const r = c.read(run(c.args));
  return { id: c.id, proves: c.proves, ...r };
});
const broken = results.reduce((n, r) => n + (r.bad || 0), 0);
const drift = results.reduce((n, r) => n + (r.drift || 0), 0);

stampRunLog(broken, drift);

if (JSON_OUT) {
  console.log(JSON.stringify({ broken, drift, results }, null, 2));
  process.exit(broken ? 1 : 0);
}

const when = new Date().toISOString().slice(0, 16).replace("T", " ");
console.log(`health-sweep — ${when}\n`);
for (const r of results) {
  const tag = r.bad ? `BROKEN ${r.bad}` : r.drift ? `drift ${r.drift}` : "ok";
  console.log(`  ${tag.padEnd(10)} ${r.id.padEnd(18)} ${r.line || ""}`);
  if (!QUIET)
    console.log(`             ${" ".repeat(18)} clean means: ${r.proves}`);
  if (r.drift && r.driftWhat)
    console.log(`             ${" ".repeat(18)} → ${r.drift} ${r.driftWhat}`);
}

console.log(
  `\n  VERDICT: ${broken ? `${broken} BROKEN thing(s) — fix before building anything else` : "nothing broken"}` +
    ` · ${drift} drift item(s) — a candidate list, not a to-do list`,
);
if (!QUIET)
  console.log(`
  Drift is never acted on by a tool and never in one pass. The retirement procedure — quarantine, wait,
  then delete, with the reason recorded — is in platform/plans/2026-07-30-second-brain-audit.md. A wrong
  deletion costs more than any amount of dead weight: this repo IS the accumulated work.`);

process.exit(broken ? 1 : 0);
