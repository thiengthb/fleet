// Test for decisions-split.mjs — the second of the two tools that REWRITE a knowledge file in place.
// Run: node .claude/scripts/decisions-split.test.mjs
//
// WHY THIS EXISTS. `docs/decisions.md` is the most valuable file a project has: it is the only record of WHY
// things are the way they are, and it is append-only precisely because a lost entry cannot be reconstructed
// from the code. This script rewrote sakubun's — 382KB, 4874 lines, 203 entries — and if it had dropped one,
// the output would still have looked like a tidy index.
//
// The script already knows that about itself: it reassembles its own output, digests the entry bodies, and
// REFUSES TO WRITE if the digests disagree. So this suite's job is not only "did it preserve the entries"
// but "does that self-check actually fire" — a verification that cannot fail is decoration, and this one
// stands between a rewrite and 203 irreplaceable entries.
//
// ONE FINDING, recorded here because it changes what a reader should conclude: unlike `ledger-split`, this
// script has NO git-dirty guard. That looked like an inconsistency until the two were compared properly.
// `ledger-split` rebuilds its section A from the rows it parsed, so any NON-row line there is destroyed —
// hence its refusal to touch a dirty file. `decisions-split` classifies every input line as either header or
// entry body and carries both through, so there is no line it can silently drop. The asymmetry is justified,
// and case 6 pins the property that justifies it rather than the guard that is absent.
//
// Per platform/standards/testing.md §2.5 the suite also MUTATES the script and asserts it notices.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
const SCRIPT = join(HERE, "decisions-split.mjs");

/** The real decision logs' git state before anything runs — see the closing check for why it is a snapshot. */
const DECISION_PATHS = ["projects", "commons", "docgen", "rulebook"];
const decisionsStateBefore = spawnSync("git", ["status", "--porcelain", "--", ...DECISION_PATHS], {
  cwd: resolve(HERE, "..", ".."),
  encoding: "utf8",
}).stdout;

const HEADER = ["# todo — decisions", "", "Append-only. Newest on top.", ""];

/**
 * Entry bodies carry the things a naive rewrite mangles: a pipe in inline code, a fenced block containing a
 * line that looks like a heading, a link, and a `---` separator between entries that belongs to neither.
 */
const ENTRIES = [
  {
    date: "2026-07-20",
    title: "Chose a named volume over a bind mount",
    body: [
      "",
      "**Context** — the container had to survive a rebuild.",
      "**Decision** — a named volume `todo_data`, with `a | pipe` inside code.",
      "",
      "```md",
      "## 2026-01-01 — a heading inside a fence, which is NOT an entry",
      "```",
      "",
      "**Related** — [the standard](https://example.org/x)",
      "",
    ],
  },
  {
    date: "2026-07-05",
    title: "Rejected hand-rolled auth",
    body: ["", "**Why** — never self-code auth; an established library only.", ""],
  },
  {
    date: "2026-06-11",
    title: `A very long decision title that runs well past the hundred and twenty character clipping limit so the index path is exercised properly`,
    body: ["", "The body of a long-titled decision is never clipped, only its index row is.", ""],
  },
];

const decisionsText = (entries = ENTRIES) =>
  [
    ...HEADER,
    ...entries.flatMap((e, i) => [
      `## ${e.date} — ${e.title}`,
      ...e.body,
      ...(i < entries.length - 1 ? ["---", ""] : []),
    ]),
  ].join("\n");

function sandbox({ text = decisionsText(), project = "todo", scriptPath = SCRIPT, create = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), "decisions-split-"));
  const src = join(root, project, "docs", "decisions.md");
  if (create) {
    mkdirSync(dirname(src), { recursive: true });
    writeFileSync(src, text);
  }
  return { root, src, project, scriptPath, outDir: join(root, project, "docs", "decisions") };
}

function run(s, args = []) {
  const r = spawnSync(process.execPath, [s.scriptPath, ...args], {
    encoding: "utf8",
    timeout: 60_000,
    cwd: s.root,
  });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

const detail = (s) =>
  readdirSync(s.outDir)
    .sort()
    .map((f) => readFileSync(join(s.outDir, f), "utf8"))
    .join("\n");

/* ═══════════ 1. every entry body survives verbatim, fences and pipes included ═══════════ */
{
  const s = sandbox();
  const { code, out } = run(s, [s.project, "--apply"]);
  assert.equal(code, 0, `apply failed:\n${out}`);

  assert.deepEqual(
    readdirSync(s.outDir).sort(),
    ["2026-06.md", "2026-07.md"],
    "entries must be grouped by their own month",
  );

  const all = detail(s);
  for (const e of ENTRIES) {
    const body = e.body.join("\n").trim();
    assert.ok(
      all.includes(body),
      `ENTRY BODY LOST OR ALTERED — ${e.date} ${e.title}\nexpected verbatim:\n${body}`,
    );
  }
  assert.ok(
    all.includes("## 2026-01-01 — a heading inside a fence, which is NOT an entry"),
    "a heading-shaped line inside a fenced block must travel with its entry, not become one",
  );
  assert.equal(
    (all.match(/^## 2026-01-01 /gm) || []).length,
    1,
    "…and must not be promoted into a fourth entry",
  );
  assert.match(out, /verbatim check\s+PASS — every entry body relocated intact/, "the self-check must report");
  rmSync(s.root, { recursive: true, force: true });
}

/* ═══════════ 2. the index: one row per decision, newest first, every anchor resolving ═══════════ */
{
  const s = sandbox();
  run(s, [s.project, "--apply"]);
  const index = readFileSync(s.src, "utf8");
  const rows = [...index.matchAll(/\| (\d{4}-\d{2}-\d{2}) \| (.*?) \| \[→\]\(decisions\/(\d{4}-\d{2})\.md#([^)]+)\) \|/g)];

  assert.equal(rows.length, ENTRIES.length, `one row per decision, got ${rows.length}`);
  assert.deepEqual(
    rows.map((r) => r[1]),
    ["2026-07-20", "2026-07-05", "2026-06-11"],
    "newest first — the order a reader scans",
  );
  for (const [, date, title, month, slug] of rows) {
    const file = join(s.outDir, `${month}.md`);
    assert.ok(existsSync(file), `row ${date} points at ${month}.md, which does not exist`);
    assert.ok(
      readFileSync(file, "utf8").includes(`<a id="${slug}"></a>`),
      `row ${date} points at #${slug}, which has no anchor in ${month}.md`,
    );
    assert.ok(title.length <= 125, `index title is ${title.length} chars — the index is carrying detail again`);
  }
  assert.ok(index.startsWith(HEADER.join("\n")), "the original header must survive verbatim");
  assert.match(index, /\*\*3 decisions\*\*, 2026-06-11 → 2026-07-20, newest first/, "the span must be stated");
  assert.match(
    index,
    /detail in the index is how an index dies/,
    "the rule that keeps this file an index belongs IN the file — that is where it gets read",
  );
  rmSync(s.root, { recursive: true, force: true });
}

/* ─────────── 3. the long title is clipped in the index and whole in the detail ── */
{
  const s = sandbox();
  run(s, [s.project, "--apply"]);
  const row = readFileSync(s.src, "utf8")
    .split("\n")
    .find((l) => l.startsWith("| 2026-06-11 "));
  assert.match(row, /…/, "an over-long title must be visibly clipped in the index");
  assert.ok(
    readFileSync(join(s.outDir, "2026-06.md"), "utf8").includes(`— ${ENTRIES[2].title}`),
    "…and the detail file must keep the whole title",
  );
  rmSync(s.root, { recursive: true, force: true });
}

/* ─────────── 4. a `---` that only separated two entries belongs to neither ── */
{
  const s = sandbox();
  run(s, [s.project, "--apply"]);
  const july = readFileSync(join(s.outDir, "2026-07.md"), "utf8");
  // Two entries in July ⇒ exactly two closing rules, one per entry, and no doubled `---\n\n---`.
  assert.ok(!/---\s*\n\s*\n\s*---/.test(july), `a separator was carried into an entry body:\n${july}`);
  assert.ok(
    july.includes("never self-code auth"),
    "…while the body it separated is intact",
  );
  rmSync(s.root, { recursive: true, force: true });
}

/* ═══════════ 5. THE REFUSALS — including the self-check that stands in front of the rewrite ═══════ */
{
  // (a) no project argument ⇒ usage, exit 2
  const s0 = sandbox();
  const a = run(s0);
  assert.equal(a.code, 2, "a missing project argument must not be guessed at");
  assert.match(a.out, /usage: node \.claude\/scripts\/decisions-split\.mjs <project>/);
  rmSync(s0.root, { recursive: true, force: true });

  // (b) no decisions.md ⇒ exit 2, not a stack trace
  const none = sandbox({ create: false });
  const b = run(none, ["todo", "--apply"]);
  assert.equal(b.code, 2);
  assert.match(b.out, /todo\/docs\/decisions\.md does not exist/);
  rmSync(none.root, { recursive: true, force: true });

  // (c) a file with no parseable entries ⇒ refuse and write NOTHING. Writing an empty index over a file
  //     whose headings simply use a different dash would be the worst outcome available to this tool.
  const unparseable = sandbox({ text: "# todo — decisions\n\n## Some decision without a date\n\nbody\n" });
  const before = readFileSync(unparseable.src, "utf8");
  const c = run(unparseable, ["todo", "--apply"]);
  assert.equal(c.code, 2, `0 entries must abort:\n${c.out}`);
  assert.match(c.out, /parsed 0 entries/, "…and say so");
  assert.match(c.out, /Refusing to write anything/, "…in those words");
  assert.equal(readFileSync(unparseable.src, "utf8"), before, "the source must be byte-identical");
  assert.ok(!existsSync(unparseable.outDir), "and no detail directory may appear");
  rmSync(unparseable.root, { recursive: true, force: true });
}

/* ═══════════ 6. the property that makes the missing git-dirty guard acceptable ═══════════
 * Every input line is classified as header or entry body, and both are carried through — so unlike
 * `ledger-split` (which rebuilds its table from parsed rows and would drop a stray prose line), there is no
 * content this script can silently lose. An uncommitted edit is relocated, not destroyed.
 */
{
  const s = sandbox({
    text: decisionsText().replace(
      "## 2026-07-05 —",
      "<!-- an uncommitted note somebody was in the middle of writing -->\n\n## 2026-07-05 —",
    ),
  });
  const { code } = run(s, [s.project, "--apply"]);
  assert.equal(code, 0);
  assert.ok(
    detail(s).includes("<!-- an uncommitted note somebody was in the middle of writing -->"),
    "an in-flight line between entries must be RELOCATED, not dropped — this is why this script needs no " +
      "git-dirty guard while ledger-split does",
  );
  rmSync(s.root, { recursive: true, force: true });
}

/* ═══════════ 7. dry run is the default ═══════════ */
{
  const s = sandbox();
  const before = readFileSync(s.src, "utf8");
  const { code, out } = run(s, [s.project]);
  assert.equal(code, 0);
  assert.match(out, /dry run — nothing written/, "the default must announce that it changed nothing");
  assert.equal(readFileSync(s.src, "utf8"), before, "the source must be untouched without --apply");
  assert.ok(!existsSync(s.outDir), "and no detail files may appear");
  assert.match(out, /3 entries/, "…while still reporting what it WOULD do");
  assert.match(out, /entry-body digest\s+before=\w+\s+after=\w+/, "including the digests it compares");
  rmSync(s.root, { recursive: true, force: true });
}

/* ═══════════ 8. the suite must NOTICE a data-losing rewrite (mutation) ═══════════ */
{
  // LF-normalized: on a CRLF working tree (Windows) every multi-line mutation patch below would go stale.
  const src = readFileSync(SCRIPT, "utf8").replace(/\r\n/g, "\n");
  const lab = mkdtempSync(join(tmpdir(), "decisions-split-mutants-"));

  const mutants = [
    {
      name: "entry bodies dropped from the detail files (the catastrophic case)",
      apply: (s) => s.replace("...e.body,\n        '',\n        '---',", "'',\n        '---',"),
      probe: (s) => {
        const r = run(s, [s.project, "--apply"]);
        // The script's own digest check should catch this and refuse — either outcome is a kill, but the
        // refusal is the one that protects the file, so both are asserted.
        return r.code !== 0 || !existsSync(s.outDir) || !detail(s).includes("never self-code auth");
      },
    },
    {
      name: "the byte-faithfulness refusal removed (a bad split gets written)",
      apply: (s) =>
        s
          .replace("...e.body,\n        '',\n        '---',", "'',\n        '---',")
          .replace("if (mismatches > 0 || bodyDigestBefore !== bodyDigestAfter) {", "if (false) {"),
      probe: (s) => {
        run(s, [s.project, "--apply"]);
        return existsSync(s.outDir) && !detail(s).includes("never self-code auth");
      },
    },
    {
      // WHAT THIS ABORT ACTUALLY PROTECTS, established by the mutant surviving a first, wrong probe: not the
      // content. With no parseable entries every line falls into `header`, and the header is carried through
      // verbatim — so nothing is lost even without the guard. What it prevents is a GARBAGE INDEX: a
      // "## Index" section with zero rows and an undefined date span, written over a real decision log,
      // plus an empty detail directory. The file would still hold its text while announcing it holds nothing.
      name: "the 0-entry abort removed (a garbage index written over a real log)",
      spec: { text: "# todo — decisions\n\n## Some decision without a date\n\nbody\n" },
      apply: (s) => s.replace("if (entries.length === 0) {", "if (false) {"),
      probe: (s) => {
        run(s, [s.project, "--apply"]);
        const after = readFileSync(s.src, "utf8");
        return existsSync(s.outDir) || /\*\*0 decisions\*\*/.test(after);
      },
    },
    {
      name: "--apply no longer required (a dry run writes)",
      apply: (s) => s.replace("const APPLY = args.includes('--apply');", "const APPLY = true;"),
      probe: (s) => {
        run(s, [s.project]);
        return existsSync(s.outDir);
      },
    },
    {
      name: "the index title cap raised (the index carries detail again)",
      apply: (s) => s.replace("const TITLE_MAX = 120;", "const TITLE_MAX = 5000;"),
      probe: (s) => {
        run(s, [s.project, "--apply"]);
        const row = readFileSync(s.src, "utf8")
          .split("\n")
          .find((l) => l.startsWith("| 2026-06-11 "));
        return row.length > 160;
      },
    },
    {
      // The defect this suite FOUND, as a standing mutant: drop the fence tracking and a heading-shaped line
      // inside a ``` block becomes an entry of its own — one decision cut in two, filed under whatever date
      // the quoted line carried. The digest self-check cannot see it, because both halves are still present.
      name: "fence tracking removed (a quoted heading splits an entry in two)",
      apply: (s) => s.replace("const m = inFence ? null : line.match(ENTRY);", "const m = line.match(ENTRY);"),
      probe: (s) => {
        run(s, [s.project, "--apply"]);
        if (!existsSync(s.outDir)) return true; // it refused outright — also a kill
        return readdirSync(s.outDir).includes("2026-01.md");
      },
    },
  ];

  for (const m of mutants) {
    const mutated = m.apply(src);
    assert.notEqual(mutated, src, `mutation "${m.name}" changed nothing — the patch is stale`);
    const path = join(lab, `mutant-${Math.random().toString(36).slice(2)}.mjs`);
    writeFileSync(path, mutated);
    const s = sandbox({ ...(m.spec ?? {}), scriptPath: path });
    const killed = m.probe(s);
    rmSync(s.root, { recursive: true, force: true });
    assert.ok(killed, `SURVIVING MUTANT — "${m.name}" and the suite still passed. Add a case for it.`);
  }
  rmSync(lab, { recursive: true, force: true });
}

/* ─────────── no real project's decision log may be CHANGED BY THIS SUITE ──
 * Compared against a snapshot rather than asserted clean: a `/session-wrap` or a parallel session writing a
 * real decisions.md is legitimate work, and a guard that fails on it is a guard that gets skipped. The same
 * mistake was made and fixed in `memory-audit.test.mjs` and `ledger-split.test.mjs` the same day.
 */
{
  const after = spawnSync("git", ["status", "--porcelain", "--", ...DECISION_PATHS], {
    cwd: REPO,
    encoding: "utf8",
  }).stdout;
  assert.equal(
    after,
    decisionsStateBefore,
    `THE SUITE CHANGED A REAL DECISION LOG.\nbefore:\n${decisionsStateBefore}\nafter:\n${after}`,
  );
}

console.log(
  "decisions-split.test.mjs — every entry body verbatim (fences, pipes, links), newest-first index with all " +
    "anchors resolving, index-only title clipping, separators belonging to neither entry, 3 refusals leaving " +
    "the source byte-identical, in-flight lines relocated not dropped, dry-run by default, 6 mutants all killed  ✅",
);
