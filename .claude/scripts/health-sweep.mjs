#!/usr/bin/env node
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
 * Usage:  node .claude/scripts/health-sweep.mjs [--quiet] [--json]
 * Exit code: 1 if anything is BROKEN, 0 otherwise. DRIFT never fails the run.
 */

import { spawnSync } from "node:child_process";
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
      const tested = /(\d+)\/(\d+) tools have a test/.exec(out);
      return {
        kind: "BROKEN",
        bad: failing || (code ? 1 : 0),
        drift: tested ? Number(tested[2]) - Number(tested[1]) : 0,
        driftWhat: "tool(s) with no test",
        line: (/\d+\/\d+ test file\(s\).*/.exec(out) || [""])[0],
      };
    },
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
          driftWhat: "plan file(s) with a shape ERROR",
          line: `${j.scanned} plan(s) scanned · ${j.errors} error · ${j.warns} warn`,
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
      "the memory index is inside its caps, with no orphan and no unindexed file",
    args: [S("memory-audit.mjs")],
    read: ({ code, out }) => ({
      kind: "BROKEN",
      bad: code ? 1 : 0,
      line: (/index: .*/.exec(out) || [/\bok\b.*/.exec(out) || [""]])[0],
    }),
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

const results = checkers.map((c) => {
  const r = c.read(run(c.args));
  return { id: c.id, proves: c.proves, ...r };
});
const broken = results.reduce((n, r) => n + (r.bad || 0), 0);
const drift = results.reduce((n, r) => n + (r.drift || 0), 0);

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
