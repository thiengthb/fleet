// Test for ledger-split.mjs — one of the two tools on this platform that REWRITES a knowledge file in place.
// Run: node .claude/scripts/ledger-split.test.mjs
//
// WHY THIS EXISTS, and why it is the highest-stakes suite in the campaign. This script has run exactly once,
// on a 421KB file holding ~200 accumulated cross-project lessons, and it rewrote that file. If it had dropped
// a row, nothing would have complained: the output would have looked like a clean, scannable index, and the
// lost lesson would only be missed the day it was needed again — which is the day it cannot be recovered from
// anything but git. "The repo IS the accumulated work" (memory: preserve-data-prove-before-removing).
//
// So the centre of this suite is not "does it produce a nice index". It is:
//
//     does every byte of every entry body survive the relocation, verbatim?
//
// Asserted per-entry by exact substring, not by a size ratio — a size check passes happily while two entries
// are swapped, truncated at the same total length, or merged.
//
// The refusals matter equally, because this tool's failure mode is silent: it aborts on an unparsed row, on
// missing section headings, and (under --apply) on a file with uncommitted changes. Each is a case.
//
// Per platform/standards/testing.md §2.5 the suite also MUTATES the script and asserts it notices.

import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const SCRIPT = join(HERE, "ledger-split.mjs");

/**
 * The real ledger's git state BEFORE anything runs, compared at the bottom of the file.
 *
 * Snapshotted, not asserted-clean. The first version demanded the ledger be untouched full stop, and it failed
 * the moment a `/session-wrap` wrote two entries into it — the suite reporting "THE SUITE TOUCHED THE REAL
 * LEDGER" about a change it had not made. A test that fails because someone else did legitimate work is a test
 * that gets skipped, and the same mistake had already been made and fixed in `memory-audit.test.mjs`.
 */
const LEDGER_PATHS = ["platform/registries/knowledge-ledger.md", "platform/ledger"];
const ledgerStateBefore = spawnSync("git", ["status", "--porcelain", "--", ...LEDGER_PATHS], {
  cwd: resolve(HERE, "..", ".."),
  encoding: "utf8",
}).stdout;

const HEADING_A = "## A. Cross-project lessons (content here)";
const HEADING_B = "## B. Pointers to each project's knowledge log";

const PREAMBLE = [
  "# Knowledge ledger — index",
  "",
  "Some preamble prose that must survive untouched.",
  "",
];

const SECTION_B = [
  HEADING_B,
  "",
  "| Project | Log |",
  "|---|---|",
  "| todo | `todo/docs/decisions.md` |",
  "",
];

/**
 * Entry bodies deliberately contain the things a naive rewrite mangles: a pipe inside inline code, a link,
 * backticks, emphasis, and a very long headline that must be clipped in the INDEX while staying whole in the
 * DETAIL file.
 */
const ENTRIES = [
  {
    date: "2026-06-12",
    body:
      "**A short lesson headline** — the reasoning, at length, with `a | pipe` inside code and " +
      "[a link](https://example.org/x) and *emphasis* that must all arrive intact.",
  },
  {
    date: "2026-06-20",
    body: "**Another June lesson** — more reasoning, on a different subject entirely.",
  },
  {
    date: "2026-07-03",
    body:
      `**${"A deliberately long headline that runs well past the hundred-and-twenty character index limit so the clipping path is exercised"}** — ` +
      "and the body itself is never clipped, only the index row is.",
  },
  {
    date: "2026-07-09",
    body: "No bold span at all, so the headline must fall back to the first sentence. And a second sentence.",
  },
];

const ledgerText = (entries = ENTRIES) =>
  [
    ...PREAMBLE,
    HEADING_A,
    "",
    "| Date | Lesson |",
    "| ---------- | --- |",
    ...entries.map((e) => `| ${e.date} | ${e.body} |`),
    "",
    ...SECTION_B,
  ].join("\n");

/** A sandbox repo (a real git repo — the --apply guard reads `git status`). */
function sandbox({ ledger = ledgerText(), commit = true, scriptPath = SCRIPT } = {}) {
  const root = mkdtempSync(join(tmpdir(), "ledger-split-"));
  const p = join(root, "platform", "registries", "knowledge-ledger.md");
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, ledger);

  const env = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" };
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", env });
  git("init", "-q", "-b", "main");
  git("config", "user.email", "t@example.invalid");
  git("config", "user.name", "Fixture");
  if (commit) {
    git("add", "-A");
    execFileSync("git", ["commit", "-q", "-m", "ledger"], { cwd: root, encoding: "utf8", env });
  }
  return { root, ledgerPath: p, scriptPath, git };
}

function run(s, args = []) {
  const r = spawnSync(process.execPath, [s.scriptPath, ...args], {
    encoding: "utf8",
    timeout: 60_000,
    cwd: s.root, // the script derives the repo root from cwd
  });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

const monthDir = (s) => join(s.root, "platform", "ledger");
const readMonth = (s, m) => readFileSync(join(monthDir(s), `${m}.md`), "utf8");

/* ═══════════ 1. THE PROPERTY THAT MATTERS: every entry body survives verbatim ═══════════ */
{
  const s = sandbox();
  const { code, out } = run(s, ["--apply"]);
  assert.equal(code, 0, `apply failed:\n${out}`);

  const months = readdirSync(monthDir(s)).sort();
  assert.deepEqual(months, ["2026-06.md", "2026-07.md"], "entries must be grouped by their own month");

  const all = months.map((m) => readFileSync(join(monthDir(s), m), "utf8")).join("\n");
  for (const e of ENTRIES) {
    assert.ok(
      all.includes(e.body),
      `ENTRY BODY LOST OR ALTERED — ${e.date}. This is the failure the suite exists for; a size-ratio check ` +
        `would not have noticed.\nexpected verbatim:\n${e.body}`,
    );
  }
  assert.equal(readMonth(s, "2026-06").match(/^### /gm).length, 2, "June holds exactly its two entries");
  assert.equal(readMonth(s, "2026-07").match(/^### /gm).length, 2, "July holds exactly its two");
  rmSync(s.root, { recursive: true, force: true });
}

/* ═══════════ 2. every index row must resolve to an anchor that actually exists ═══════════
 * A pointer that 404s is the same loss as a deleted entry, arriving later and harder to diagnose.
 */
{
  const s = sandbox();
  run(s, ["--apply"]);
  const index = readFileSync(s.ledgerPath, "utf8");
  const rows = [...index.matchAll(/\| (\d{4}-\d{2}-\d{2}) \| (.*?) \| \[→\]\(ledger\/(\d{4}-\d{2})\.md#([^)]+)\) \|/g)];

  assert.equal(rows.length, ENTRIES.length, `one row per lesson, got ${rows.length}`);
  const anchors = new Set();
  for (const [, date, headline, month, slug] of rows) {
    const detail = readMonth(s, month);
    assert.ok(
      detail.includes(`<a id="${slug}"></a>`),
      `index row ${date} points at #${slug} in ${month}.md, which has no such anchor`,
    );
    assert.ok(!anchors.has(slug), `duplicate anchor ${slug} — two rows would land on one entry`);
    anchors.add(slug);
    assert.ok(headline.length <= 130, `index headline is ${headline.length} chars — the index is carrying detail again`);
  }
  rmSync(s.root, { recursive: true, force: true });
}

/* ─────────── 2b. duplicate date+headline pairs must still get distinct anchors ── */
{
  const twin = { date: "2026-06-12", body: "**A short lesson headline** — but a different body entirely." };
  const s = sandbox({ ledger: ledgerText([ENTRIES[0], twin]) });
  run(s, ["--apply"]);
  const index = readFileSync(s.ledgerPath, "utf8");
  const slugs = [...index.matchAll(/#([a-z0-9-]+)\) \|/g)].map((m) => m[1]);
  assert.equal(new Set(slugs).size, 2, `two identical headlines must not share one anchor: ${slugs.join(", ")}`);
  const detail = readMonth(s, "2026-06");
  for (const slug of slugs)
    assert.ok(detail.includes(`<a id="${slug}"></a>`), `anchor ${slug} must exist in the detail file`);
  rmSync(s.root, { recursive: true, force: true });
}

/* ─────────── 3. the parts that are NOT lessons are carried over untouched ── */
{
  const s = sandbox();
  run(s, ["--apply"]);
  const index = readFileSync(s.ledgerPath, "utf8");
  assert.ok(index.startsWith(PREAMBLE.join("\n")), "the preamble must survive verbatim");
  assert.ok(index.includes(SECTION_B.join("\n").trimEnd()), "section B is already thin and must be copied as-is");
  assert.ok(
    index.includes("Do not paste detail back into this table"),
    "the rule that keeps the index an index must be written INTO the index — that is the only place it gets read",
  );
  rmSync(s.root, { recursive: true, force: true });
}

/* ─────────── 4. headline extraction is deterministic — the entry's own bold span, no model ── */
{
  const s = sandbox();
  run(s, ["--apply"]);
  const index = readFileSync(s.ledgerPath, "utf8");
  assert.match(index, /\| 2026-06-12 \| A short lesson headline \|/, "the leading bold span, with markup stripped");
  assert.match(
    index,
    /\| 2026-07-09 \| No bold span at all, so the headline must fall back to the first sentence\. \|/,
    "…and a fallback to the first sentence when there is no bold span",
  );
  const long = index.split("\n").find((l) => l.startsWith("| 2026-07-03 "));
  assert.match(long, /…/, "an over-long headline must be clipped, visibly");
  assert.ok(
    readMonth(s, "2026-07").includes(ENTRIES[2].body),
    "…and clipping must touch the INDEX only, never the stored lesson",
  );
  rmSync(s.root, { recursive: true, force: true });
}

/* ═══════════ 5. THE REFUSALS — this tool's mistakes would be silent, so it must abort loudly ═══════ */
{
  // (a) a row that does not parse ⇒ abort, write nothing. Silently skipping it would delete a lesson.
  const broken = sandbox({
    ledger: ledgerText().replace(
      "| 2026-06-20 | **Another June lesson**",
      "| not-a-date | **Another June lesson**",
    ),
  });
  const a = run(broken, ["--apply"]);
  assert.equal(a.code, 1, `an unparsed row must abort:\n${a.out}`);
  assert.match(a.out, /did not parse — aborting to avoid data loss/, "and say why, naming the row");
  assert.ok(!existsSync(monthDir(broken)), "nothing may be written when it aborts");
  assert.equal(
    readFileSync(broken.ledgerPath, "utf8"),
    ledgerText().replace(
      "| 2026-06-20 | **Another June lesson**",
      "| not-a-date | **Another June lesson**",
    ),
    "the source file must be byte-identical after a refusal",
  );
  rmSync(broken.root, { recursive: true, force: true });

  // (b) missing section headings ⇒ abort rather than guess at the structure
  const noHeadings = sandbox({ ledger: "# just a file\n\nwith no sections at all\n" });
  const b = run(noHeadings, ["--apply"]);
  assert.equal(b.code, 1, "no section A/B ⇒ abort");
  assert.match(b.out, /could not locate section A \/ section B headings/, b.out);
  rmSync(noHeadings.root, { recursive: true, force: true });

  // (c) uncommitted changes ⇒ refuse, so a parallel session's work is never overwritten
  const dirty = sandbox();
  writeFileSync(dirty.ledgerPath, `${readFileSync(dirty.ledgerPath, "utf8")}\n<!-- someone is editing -->\n`);
  const before = readFileSync(dirty.ledgerPath, "utf8");
  const c = run(dirty, ["--apply"]);
  assert.equal(c.code, 1, `a dirty ledger must not be rewritten:\n${c.out}`);
  assert.match(c.out, /refusing to rewrite: .* has uncommitted changes/, c.out);
  assert.equal(readFileSync(dirty.ledgerPath, "utf8"), before, "the in-flight edit must be untouched");
  rmSync(dirty.root, { recursive: true, force: true });

  // (d) a missing ledger ⇒ exit 1, not a stack trace
  const none = mkdtempSync(join(tmpdir(), "ledger-split-none-"));
  const d = spawnSync(process.execPath, [SCRIPT], { cwd: none, encoding: "utf8" });
  assert.equal(d.status, 1);
  assert.match((d.stdout || "") + (d.stderr || ""), /ledger not found/);
  rmSync(none, { recursive: true, force: true });
}

/* ═══════════ 6. DRY RUN IS THE DEFAULT — a destructive tool must be opt-in ═══════════ */
{
  const s = sandbox();
  const before = readFileSync(s.ledgerPath, "utf8");
  const { code, out } = run(s);
  assert.equal(code, 0);
  assert.match(out, /DRY RUN — nothing written/, "the default must announce that it changed nothing");
  assert.equal(readFileSync(s.ledgerPath, "utf8"), before, "the ledger must be untouched without --apply");
  assert.ok(!existsSync(monthDir(s)), "and no month files may appear");
  assert.match(out, /entries parsed:\s+4/, "the dry run must still report what it WOULD do");
  assert.match(out, /content preserved:\s+yes/, "including its own preservation check");
  rmSync(s.root, { recursive: true, force: true });
}

/* ═══════════ 7. the suite must NOTICE a data-losing rewrite (mutation) ═══════════ */
{
  const src = readFileSync(SCRIPT, "utf8");
  const lab = mkdtempSync(join(tmpdir(), "ledger-split-mutants-"));

  const mutants = [
    {
      name: "the CLIPPED HEADLINE stored instead of the body (silent data loss)",
      apply: (s) => s.replace('"", e.body, "");', '"", e.headline, "");'),
      probe: (s) => {
        run(s, ["--apply"]);
        const all = readdirSync(monthDir(s))
          .map((m) => readFileSync(join(monthDir(s), m), "utf8"))
          .join("\n");
        return !all.includes(ENTRIES[0].body);
      },
    },
    {
      name: "the unparsed-row abort removed (a lesson vanishes quietly)",
      ledger: ledgerText().replace("| 2026-06-20 | **Another", "| not-a-date | **Another"),
      apply: (s) => s.replace("if (unparsed.length) {", "if (false) {"),
      probe: (s) => {
        const r = run(s, ["--apply"]);
        if (r.code !== 0) return false;
        const all = readdirSync(monthDir(s))
          .map((m) => readFileSync(join(monthDir(s), m), "utf8"))
          .join("\n");
        return !all.includes("Another June lesson");
      },
    },
    {
      name: "the git-dirty guard removed (a parallel session's edit is overwritten)",
      apply: (s) => s.replace("if (dirty) {", "if (false) {"),
      // The in-flight edit goes INSIDE section A, which is the part that is rebuilt from the parsed rows —
      // so a non-row line there is genuinely destroyed. Appending at the end of the file proves nothing:
      // `sectionB` is "everything from heading B onward", so trailing content is copied through and the
      // first version of this probe reported a kill that had not happened.
      probe: (s) => {
        writeFileSync(
          s.ledgerPath,
          readFileSync(s.ledgerPath, "utf8").replace(HEADING_A, `${HEADING_A}\n\n<!-- in flight note -->`),
        );
        run(s, ["--apply"]);
        return !readFileSync(s.ledgerPath, "utf8").includes("<!-- in flight note -->");
      },
    },
    {
      name: "slug de-duplication removed (two lessons share one anchor)",
      ledger: ledgerText([
        ENTRIES[0],
        { date: "2026-06-12", body: "**A short lesson headline** — a different body." },
      ]),
      apply: (s) => s.replace("return n === 1 ? base : `${base}-${n}`;", "return base;"),
      probe: (s) => {
        run(s, ["--apply"]);
        const slugs = [...readFileSync(s.ledgerPath, "utf8").matchAll(/#([a-z0-9-]+)\) \|/g)].map((m) => m[1]);
        return new Set(slugs).size < slugs.length;
      },
    },
    {
      name: "the index headline cap raised (the index starts carrying detail again)",
      apply: (s) => s.replace("const HEADLINE_MAX = 120;", "const HEADLINE_MAX = 5000;"),
      probe: (s) => {
        run(s, ["--apply"]);
        const long = readFileSync(s.ledgerPath, "utf8")
          .split("\n")
          .find((l) => l.startsWith("| 2026-07-03 "));
        return long.length > 200;
      },
    },
    {
      name: "--apply no longer required (a dry run writes)",
      apply: (s) => s.replace('const APPLY = process.argv.includes("--apply");', "const APPLY = true;"),
      probe: (s) => {
        run(s); // no --apply
        return existsSync(monthDir(s));
      },
    },
  ];

  for (const m of mutants) {
    const mutated = m.apply(src);
    assert.notEqual(mutated, src, `mutation "${m.name}" changed nothing — the patch is stale`);
    const path = join(lab, `mutant-${Math.random().toString(36).slice(2)}.mjs`);
    writeFileSync(path, mutated);
    const s = sandbox({ ledger: m.ledger ?? ledgerText(), scriptPath: path });
    const killed = m.probe(s);
    rmSync(s.root, { recursive: true, force: true });
    assert.ok(killed, `SURVIVING MUTANT — "${m.name}" and the suite still passed. Add a case for it.`);
  }
  rmSync(lab, { recursive: true, force: true });
}

/* ─────────── the real ledger must be exactly as this suite found it ──
 * It is the file this tool exists to rewrite, so the one thing the suite must never do is rewrite it.
 * Compared against the snapshot from the top, so a concurrent `/session-wrap` writing entries is not mistaken
 * for damage done here.
 */
{
  const after = spawnSync("git", ["status", "--porcelain", "--", ...LEDGER_PATHS], {
    cwd: REPO,
    encoding: "utf8",
  }).stdout;
  assert.equal(
    after,
    ledgerStateBefore,
    `THE SUITE CHANGED THE REAL LEDGER.\nbefore:\n${ledgerStateBefore}\nafter:\n${after}`,
  );
}

console.log(
  "ledger-split.test.mjs — every entry body verbatim across the split, all anchors resolve and are unique, " +
    "preamble + section B carried, deterministic headlines with index-only clipping, 4 refusals leaving the " +
    "source byte-identical, dry-run by default, 6 mutants all killed  ✅",
);
