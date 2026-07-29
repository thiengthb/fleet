// Test for memory-audit.mjs — the hygiene report for the agent's own memory.
// Run: node .claude/scripts/memory-audit.test.mjs
//
// WHY THIS EXISTS. Memory is the one tier whose failures are completely silent. Claude Code loads only the
// first 200 lines / 25KB of a memory index and drops the rest **without saying so**; a memory file the index
// does not point at never surfaces at all; and a second memory directory nobody wired up loads nothing —
// which is exactly how a machine-local note written 2026-07-24 was found on 2026-07-28 to have never loaded
// once. Nothing errors in any of those cases. The agent simply starts a session knowing less than it should
// and cannot tell.
//
// So this audit is the only mechanism that can say "your memory is not what you think it is", and the checks
// that matter are the MECHANICAL ones: caps, index drift, orphan pointers, entries past the cut-off, and
// whether the tier is wired at all. Those are asserted exactly below. Overlap and staleness are signals for a
// human, so they are asserted for shape and threshold behaviour rather than for a specific judgement.
//
// Method: the script takes the repo root as its first argument, so a sandbox needs no file copying — but
// `$HOME` is redirected too, because the wiring check reads the user's real settings.json to decide whether
// the shared tier is loaded at all.
//
// Per platform/standards/testing.md §2.5 the suite also MUTATES the script and asserts it notices.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const SCRIPT = join(HERE, "memory-audit.mjs");

/**
 * The real memory tier's git state BEFORE anything runs. Compared at the bottom of the file.
 *
 * Snapshotted rather than asserted-clean: the first version demanded that `.claude/memory/` be untouched full
 * stop, and it failed on a memory another session had just written — plus the `modified:` stamp the harness
 * adds on every memory write. A test that fails because someone else was working is a test that gets skipped.
 */
const memoryStateBefore = spawnSync("git", ["status", "--porcelain", "--", ".claude/memory"], {
  cwd: resolve(HERE, "..", ".."),
  encoding: "utf8",
}).stdout;

const write = (p, body) => {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, body);
};

/**
 * A sandbox repo with its own `.claude/memory/`, plus a sandbox HOME so the wiring check sees only the
 * settings this case wants it to see.
 *
 * `wiring` defaults to correctly pointing at the sandbox's own memory dir, so a case that is about caps or
 * drift is not also failing on a wiring problem it never asked about.
 */
function sandbox({ memory = {}, files = {}, wiring = "correct", scriptPath = SCRIPT } = {}) {
  const root = mkdtempSync(join(tmpdir(), "memory-audit-"));
  const home = join(root, "__home__");
  mkdirSync(join(home, ".claude"), { recursive: true });
  const memDir = join(root, ".claude", "memory");
  mkdirSync(memDir, { recursive: true });

  for (const [name, body] of Object.entries(memory)) write(join(memDir, name), body);
  for (const [rel, body] of Object.entries(files)) write(join(root, rel), body);

  const settings =
    wiring === "correct"
      ? { autoMemoryDirectory: memDir }
      : wiring === "elsewhere"
        ? { autoMemoryDirectory: join(root, "somewhere", "else") }
        : wiring === "disabled"
          ? { autoMemoryEnabled: false }
          : null; // "unset"
  if (settings) write(join(root, ".claude", "settings.local.json"), JSON.stringify(settings));

  return { root, home, memDir, scriptPath };
}

function audit(s, args = []) {
  const r = spawnSync(process.execPath, [s.scriptPath, s.root, ...args], {
    encoding: "utf8",
    timeout: 60_000,
    cwd: s.root,
    env: { ...process.env, HOME: s.home },
  });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

function json(s, args = []) {
  const { out, code } = audit(s, ["--json", ...args]);
  assert.equal(code, 0, `memory-audit exited ${code}:\n${out.slice(0, 600)}`);
  return JSON.parse(out);
}

const tier = (s, args = []) => json(s, args).tiers[0];

/** A memory file with the harness's `modified:` stamp. */
const mem = (name, body, modified = new Date().toISOString()) =>
  `---\nname: ${name}\ndescription: a fixture memory\nmetadata:\n  type: feedback\n  modified: ${modified}\n---\n\n${body}\n`;

const indexOf = (lines) => `# Agent memory — shared index\n\n${lines.join("\n")}\n`;

/* ═══════════ 1. THE CAP: content past 200 lines / 25KB is dropped on load, silently ═══════════ */
{
  const rows = [];
  for (let i = 1; i <= 260; i++) rows.push(`- [Entry ${i}](entry-${i}.md) — hook ${i}`);
  const s = sandbox({ memory: { "MEMORY.md": indexOf(rows) } });

  const t = tier(s);
  assert.equal(t.index.overLineCap, true, "260 index lines is past the 200-line load cap");
  assert.ok(
    t.index.cutoffLine !== null && t.index.cutoffLine <= 205,
    `the cut-off LINE must be identified, not just the fact of a breach — got ${t.index.cutoffLine}`,
  );
  assert.ok(
    t.belowCutoff.length > 0,
    "the entries that will never load must be listed by name; 'you are over the cap' alone does not say what was lost",
  );
  assert.match(
    audit(s).out,
    /OVER CAP, content past line \d+ is dropped on load/,
    "the human-readable report must state the CONSEQUENCE, not just the measurement",
  );
  rmSync(s.root, { recursive: true, force: true });
}

/* ─────────── 1b. the byte cap bites independently of the line cap ── */
{
  // 40 lines, but each one long: well under 200 lines and well over 25KB.
  const rows = [];
  for (let i = 1; i <= 40; i++) rows.push(`- [E${i}](e-${i}.md) — ${"x".repeat(800)}`);
  const s = sandbox({ memory: { "MEMORY.md": indexOf(rows) } });
  const t = tier(s);
  assert.equal(t.index.overLineCap, false, "only 43 lines");
  assert.equal(t.index.overByteCap, true, "…but past 25KB, which drops content just as silently");
  rmSync(s.root, { recursive: true, force: true });
}

/* ─────────── 1c. a healthy index must be reported as healthy, with its numbers ── */
{
  const s = sandbox({
    memory: {
      "MEMORY.md": indexOf(["- [One](one.md) — a hook", "- [Two](two.md) — another"]),
      "one.md": mem("one", "The first fact."),
      "two.md": mem("two", "A completely different second fact about unrelated matters."),
    },
  });
  const t = tier(s);
  assert.equal(t.index.overLineCap, false);
  assert.equal(t.index.overByteCap, false);
  assert.equal(t.index.cutoffLine, null, "no cut-off when nothing is dropped");
  assert.deepEqual(t.unindexed, [], "both files are indexed");
  assert.deepEqual(t.orphanPointers, [], "both pointers resolve");
  assert.equal(t.fileCount, 2, "the index itself is not counted as a memory");
  // The size unit adapts (B / KB / MB), so the assertion must not pin one — a tiny fixture index prints "88B".
  assert.match(
    audit(s).out,
    /index: \d+ lines \/ [\d.]+(?:B|KB|MB) \(cap 200 lines \/ 25KB\)/,
    "the numbers must be shown",
  );
  rmSync(s.root, { recursive: true, force: true });
}

/* ═══════════ 2. INDEX DRIFT, both directions — the failure that is invisible at runtime ═══════ */
{
  const s = sandbox({
    memory: {
      "MEMORY.md": indexOf([
        "- [Linked](linked.md) — a hook",
        "- [Gone](deleted-long-ago.md) — points at nothing",
        "Related: [[wikilinked]]",
      ]),
      "linked.md": mem("linked", "A fact that is reachable."),
      "wikilinked.md": mem("wikilinked", "Reachable only through a double-bracket link."),
      "invisible.md": mem("invisible", "A fact nothing points at, so it never surfaces at all."),
    },
  });
  const t = tier(s);
  assert.deepEqual(
    t.unindexed,
    ["invisible.md"],
    "a file the index does not point at NEVER loads — and the wikilink form must count as a pointer",
  );
  assert.deepEqual(
    t.orphanPointers,
    ["deleted-long-ago.md"],
    "an index line pointing at a deleted file is a promise the index cannot keep",
  );
  const { out } = audit(s);
  assert.match(out, /not in the index \(never surfaced\): invisible\.md/);
  assert.match(out, /index points at missing files: deleted-long-ago\.md/);
  rmSync(s.root, { recursive: true, force: true });
}

/* ─────────── 2b. no index at all is the worst case, and must be said loudest ── */
{
  const s = sandbox({ memory: { "orphan.md": mem("orphan", "A fact with no index above it.") } });
  const t = tier(s);
  assert.equal(t.hasIndex, false);
  assert.match(
    audit(s).out,
    /NO MEMORY\.md INDEX — every file here is invisible at session start/,
    "this exact failure hid a memory for four days in July 2026",
  );
  rmSync(s.root, { recursive: true, force: true });
}

/* ═══════════ 3. WIRING — a memory directory nothing points at loads nothing ═══════════ */
{
  const base = {
    "MEMORY.md": indexOf(["- [One](one.md) — a hook"]),
    "one.md": mem("one", "A fact."),
  };

  const ok = sandbox({ memory: base, wiring: "correct" });
  assert.deepEqual(json(ok).wiring.problems, [], "a correctly wired tier must report no problem");
  assert.match(audit(ok).out, /ok — autoMemoryDirectory ->/, "…and say so, with the path");
  rmSync(ok.root, { recursive: true, force: true });

  const unset = sandbox({ memory: base, wiring: "unset" });
  const unsetProblems = json(unset).wiring.problems.join(" ");
  assert.match(
    unsetProblems,
    /autoMemoryDirectory is UNSET on this machine/,
    "an unwired tier is the silent failure this check exists for",
  );
  assert.match(unsetProblems, /settings\.local\.json/, "…and the fix must be spelled out, not implied");
  rmSync(unset.root, { recursive: true, force: true });

  const elsewhere = sandbox({ memory: base, wiring: "elsewhere" });
  assert.match(
    json(elsewhere).wiring.problems.join(" "),
    /points at .*, not /,
    "pointing at the WRONG directory loads someone else's memory and silently drops this repo's",
  );
  rmSync(elsewhere.root, { recursive: true, force: true });

  const disabled = sandbox({ memory: base, wiring: "disabled" });
  assert.match(
    json(disabled).wiring.problems.join(" "),
    /auto memory DISABLED/,
    "disabled must be distinguished from unset — the fixes are different",
  );
  rmSync(disabled.root, { recursive: true, force: true });
}

/* ═══════════ 4. what "always loaded" really costs, including the part nobody counts ═══════════ */
{
  const bigClaudeMd = `# rules\n${Array.from({ length: 260 }, (_, i) => `line ${i}`).join("\n")}\n`;
  const s = sandbox({
    memory: { "MEMORY.md": indexOf(["- [One](one.md) — a hook"]), "one.md": mem("one", "A fact.") },
    files: {
      "CLAUDE.md": `${bigClaudeMd}\n@platform/standards/imported.md\n@platform/standards/missing.md\n`,
      "platform/standards/imported.md": "# imported in full, no cap\n",
      "CLAUDE.local.md": "# machine-local, loaded in full\nA local note.\n",
      ".claude/skills/alpha/SKILL.md": "---\nname: alpha\ndescription: a fixture skill\n---\n\nbody\n",
      ".claude/skills/beta/SKILL.md": "---\nname: beta\ndescription: another fixture skill\n---\n\nbody\n",
      ".claude/skills/not-a-skill/README.md": "no SKILL.md here\n",
    },
  });

  const al = json(s).alwaysLoaded;
  const byName = (re) => al.items.find((i) => re.test(i.name));

  assert.equal(byName(/^CLAUDE\.md$/).overAdvisory, true, "260 lines is past the 200-line advisory");
  assert.ok(byName(/@platform\/standards\/imported\.md/), "@imports load in FULL and must be counted");
  assert.equal(
    byName(/missing\.md/)?.missing,
    true,
    "an @import that does not exist is a broken instruction file, and must be named",
  );
  assert.ok(byName(/machine-local/), "CLAUDE.local.md is gitignored but loaded every session");
  assert.ok(byName(/auto-memory index/), "the memory index is part of the per-session bill");

  const catalog = byName(/skill catalog/);
  assert.ok(catalog, "the skill catalog is usually the largest always-loaded item nobody counts");
  assert.match(catalog.name, /\(2 skills/, "a directory without SKILL.md is not a skill");
  assert.match(
    catalog.note,
    /loaded every session whether invoked or not/,
    "the note is the whole point — availability is not free",
  );

  assert.match(audit(s).out, /TOTAL: [\d.]+KB ≈ \d+ tokens per session/, "one number for the session tax");
  assert.match(audit(s).out, /imported but MISSING on disk/);
  rmSync(s.root, { recursive: true, force: true });
}

/* ═══════════ 5. frontmatter and HTML comments are NOT loaded, so they must not be counted ═══════ */
{
  const heavyMeta =
    "---\n" +
    `description: ${"m".repeat(4000)}\n` +
    "---\n\n" +
    "<!--\n" +
    "x".repeat(4000) +
    "\n-->\n\n" +
    "One short fact.\n";
  const s = sandbox({
    memory: { "MEMORY.md": indexOf(["- [Heavy](heavy.md) — a hook"]), "heavy.md": heavyMeta },
  });
  const f = tier(s).files.find((x) => x.name === "heavy.md");
  assert.ok(f.lines < 10, `the body is one fact; frontmatter + comments must not inflate it (got ${f.lines})`);
  rmSync(s.root, { recursive: true, force: true });
}

/* ═══════════ 6. OVERLAP is a signal for a human, and must not cry wolf ═══════════ */
{
  const shared =
    "The supervisor requires that every option list flags the recommended choice in plain language " +
    "so the decision surface stays legible and the gate is named at every approval point.\n";
  const s = sandbox({
    memory: {
      "MEMORY.md": indexOf([
        "- [A](a.md) — one",
        "- [B](b.md) — two",
        "- [C](c.md) — three",
      ]),
      "a.md": mem("a", shared),
      "b.md": mem("b", shared), // near-verbatim duplicate
      "c.md": mem(
        "c",
        "Docker Desktop runs a separate daemon from the native engine; containers and volumes are not shared.\n",
      ),
    },
  });
  const t = tier(s);
  const pair = t.overlaps.find(
    (o) => (o.a === "a.md" && o.b === "b.md") || (o.a === "b.md" && o.b === "a.md"),
  );
  assert.ok(pair, `two near-identical memories must surface as an overlap:\n${JSON.stringify(t.overlaps)}`);
  assert.equal(pair.verdict, "likely-duplicate", `score ${pair.score} should clear the duplicate threshold`);
  assert.ok(
    !t.overlaps.some((o) => o.a === "c.md" || o.b === "c.md"),
    "an unrelated memory must not be dragged in — a checker that pairs everything gets ignored",
  );
  assert.ok(
    t.repeated.some((r) => r.files.includes("a.md") && r.files.includes("b.md")),
    "a content line repeated across files is reported separately from the whole-file score",
  );
  assert.match(audit(s).out, /overlap candidates \(merge or split — human decides\)/, "the verdict stays human");
  rmSync(s.root, { recursive: true, force: true });
}

/* ─────────── 6b. when nothing overlaps, show the closest pairs anyway ──
 * Otherwise "no overlap" is unfalsifiable: the reader cannot tell a healthy set from a broken comparator.
 */
{
  const s = sandbox({
    memory: {
      "MEMORY.md": indexOf(["- [A](a.md) — one", "- [B](b.md) — two"]),
      "a.md": mem("a", "Prefers extending existing infrastructure over building parallel systems.\n"),
      "b.md": mem("b", "Docker Desktop and the native engine do not share volumes on this machine.\n"),
    },
  });
  const t = tier(s);
  assert.deepEqual(t.overlaps, [], "unrelated memories must not overlap");
  assert.ok(t.closestPairs.length >= 1, "…but the closest pair must still be shown");
  assert.match(audit(s).out, /overlap: none above 0\.1\. Closest pairs, for reference:/, "and labelled as such");
  rmSync(s.root, { recursive: true, force: true });
}

/* ═══════════ 7. staleness uses the recorded stamp, not a guess ═══════════ */
{
  const old = new Date(Date.now() - 200 * 86400000).toISOString();
  const s = sandbox({
    memory: {
      "MEMORY.md": indexOf(["- [Old](old.md) — one", "- [Fresh](fresh.md) — two"]),
      "old.md": mem("old", "A fact recorded long ago and never re-confirmed.", old),
      "fresh.md": mem("fresh", "Something written today about a different subject entirely."),
    },
  });

  const t = tier(s);
  assert.deepEqual(
    t.stale.map((x) => x.name),
    ["old.md"],
    "the `modified:` stamp the harness writes is a recorded fact and beats inferring from git",
  );
  assert.ok(t.stale[0].ageDays >= 195, `age must come from the stamp (got ${t.stale[0].ageDays})`);

  // The threshold is an argument, and a report that cannot be re-scoped gets argued with instead of used.
  assert.deepEqual(tier(s, ["--stale", "365"]).stale, [], "--stale 365 must exonerate a 200-day-old file");
  assert.equal(
    tier(s, ["--stale", "30"]).stale.length,
    1,
    "--stale 30 must still catch it, and not the file written today",
  );
  assert.match(audit(s).out, /untouched ≥90d \(re-confirm or drop\)/, "the default threshold is stated");
  rmSync(s.root, { recursive: true, force: true });
}

/* ─────────── 8. one memory = one fact: an oversized file is probably several ── */
{
  const many = Array.from({ length: 80 }, (_, i) => `Fact number ${i}, about a different subject.`).join("\n");
  const s = sandbox({
    memory: { "MEMORY.md": indexOf(["- [Big](big.md) — one"]), "big.md": mem("big", many) },
  });
  const t = tier(s);
  assert.deepEqual(
    t.oversized.map((x) => x.name),
    ["big.md"],
    "past ~60 lines a memory is several facts wearing one filename",
  );
  assert.match(audit(s).out, /over 60 lines \(probably more than one fact\)/);
  rmSync(s.root, { recursive: true, force: true });
}

/* ─────────── 9. report-only, always exit 0, and say so ── */
{
  const s = sandbox({ memory: { "unindexed.md": mem("x", "a fact") }, wiring: "unset" });
  const { code, out } = audit(s);
  assert.equal(code, 0, "even with a missing index AND broken wiring it must exit 0 — a human decides");
  assert.match(out, /report only, nothing was changed/, "the framing must be in the output");
  assert.match(
    out,
    /Nothing here is applied automatically/,
    "…and the closing line must separate the exact facts from the human-judgement signals",
  );
  assert.equal(json(s).tiers.length, 1, "--json must carry the same content");
  rmSync(s.root, { recursive: true, force: true });
}

/* ═══════════ 10. the suite must NOTICE a broken audit (mutation) ═══════════ */
{
  const src = readFileSync(SCRIPT, "utf8");
  const lab = mkdtempSync(join(tmpdir(), "memory-audit-mutants-"));

  const OVER_CAP = {
    memory: {
      "MEMORY.md": indexOf(Array.from({ length: 260 }, (_, i) => `- [E${i}](e-${i}.md) — hook`)),
    },
  };

  const mutants = [
    {
      name: "the index line cap raised out of reach (a silent truncation goes unreported)",
      spec: OVER_CAP,
      apply: (s) => s.replace("const INDEX_LINE_CAP = 200;", "const INDEX_LINE_CAP = 100000;"),
      probe: (t) => t.index.overLineCap === false,
    },
    {
      name: "the byte cap raised out of reach",
      spec: {
        memory: {
          "MEMORY.md": indexOf(Array.from({ length: 40 }, (_, i) => `- [E${i}](e-${i}.md) — ${"x".repeat(800)}`)),
        },
      },
      apply: (s) => s.replace("const INDEX_BYTE_CAP = 25 * 1024;", "const INDEX_BYTE_CAP = 25 * 1024 * 1024;"),
      probe: (t) => t.index.overByteCap === false,
    },
    {
      name: "unindexed files no longer reported (a memory that never surfaces)",
      spec: {
        memory: {
          "MEMORY.md": indexOf(["- [One](one.md) — a hook"]),
          "one.md": mem("one", "A fact."),
          "invisible.md": mem("invisible", "Nothing points at this."),
        },
      },
      apply: (s) =>
        s.replace(
          "const unindexed = entries.filter((f) => !linked.has(f.name)).map((f) => f.name);",
          "const unindexed = [];",
        ),
      probe: (t) => t.unindexed.length === 0,
    },
    {
      name: "orphan pointers no longer reported",
      spec: {
        memory: {
          "MEMORY.md": indexOf(["- [Gone](gone.md) — points at nothing"]),
        },
      },
      apply: (s) =>
        s.replace(
          "const orphanPointers = [...linked].filter((n) => !entries.some((f) => f.name === n));",
          "const orphanPointers = [];",
        ),
      probe: (t) => t.orphanPointers.length === 0,
    },
    {
      name: "the [[wikilink]] form no longer counts as a pointer (false 'never surfaces')",
      spec: {
        memory: {
          "MEMORY.md": indexOf(["Related: [[wikilinked]]"]),
          "wikilinked.md": mem("wikilinked", "Reachable only by a double-bracket link."),
        },
      },
      apply: (s) =>
        s.replace(
          'for (const m of line.matchAll(/\\[\\[([^\\]]+)\\]\\]/g)) linked.add(`${m[1]}.md`);',
          "",
        ),
      probe: (t) => t.unindexed.includes("wikilinked.md"),
    },
    {
      name: "the duplicate threshold raised (two identical memories read as fine)",
      spec: {
        memory: {
          "MEMORY.md": indexOf(["- [A](a.md) — one", "- [B](b.md) — two"]),
          // NEAR-duplicates, not clones. Byte-identical bodies score a Jaccard of exactly 1.0 and clear even
          // a 0.99 threshold, so the first version of this mutant survived on the fixture rather than on the
          // behaviour. Two memories that genuinely overlap are the real risk, and they score well under 1.
          "a.md": mem(
            "a",
            "The supervisor requires every option list to flag the recommended choice in plain language.\n" +
              "This one also covers routing a question through Discord when he is away from the machine.\n",
          ),
          "b.md": mem(
            "b",
            "The supervisor requires every option list to flag the recommended choice in plain language.\n" +
              "This one also covers rebuilding the container so he sees the running result.\n",
          ),
        },
      },
      apply: (s) => s.replace("const OVERLAP_REVIEW = 0.1;", "const OVERLAP_REVIEW = 0.99;"),
      probe: (t) => t.overlaps.length === 0,
    },
    {
      name: "the `modified:` stamp ignored (staleness falls back to a git history that is not there)",
      spec: {
        memory: {
          "MEMORY.md": indexOf(["- [Old](old.md) — one"]),
          "old.md": mem("old", "An old fact.", new Date(Date.now() - 200 * 86400000).toISOString()),
        },
      },
      apply: (s) => s.replace("const iso = f.modified ?? touched.get(rel) ?? null;", "const iso = touched.get(rel) ?? null;"),
      probe: (t) => t.stale.length === 0,
    },
    {
      name: "frontmatter counted as loaded content (every file looks oversized)",
      spec: {
        memory: {
          "MEMORY.md": indexOf(["- [Heavy](heavy.md) — one"]),
          "heavy.md": `---\n${Array.from({ length: 80 }, (_, i) => `k${i}: v`).join("\n")}\n---\n\nOne fact.\n`,
        },
      },
      apply: (s) =>
        s.replace(
          'let body = text.replace(/^---\\r?\\n[\\s\\S]*?\\r?\\n---\\r?\\n?/, "");',
          "let body = text;",
        ),
      probe: (t) => t.oversized.some((f) => f.name === "heavy.md"),
    },
    {
      name: "the wiring check accepts any directory (memory silently not loaded)",
      spec: {
        memory: { "MEMORY.md": indexOf(["- [One](one.md) — a hook"]), "one.md": mem("one", "A fact.") },
        wiring: "elsewhere",
      },
      apply: (s) => s.replace("} else if (w.dir !== SHARED_DIR) {", "} else if (false) {"),
      probe: (t, j) => j.wiring.problems.length === 0,
    },
  ];

  for (const m of mutants) {
    const mutated = m.apply(src);
    assert.notEqual(mutated, src, `mutation "${m.name}" changed nothing — the patch is stale`);
    const path = join(lab, `mutant-${Math.random().toString(36).slice(2)}.mjs`);
    writeFileSync(path, mutated);
    const s = sandbox({ ...m.spec, scriptPath: path });

    const sanity = audit(s, ["--json"]);
    let parsed = null;
    try {
      parsed = JSON.parse(sanity.out);
    } catch {
      parsed = null;
    }
    assert.ok(
      parsed,
      `mutant "${m.name}" did not run — syntax error, not behaviour:\n${sanity.out.slice(0, 300)}`,
    );

    const killed = m.probe(parsed.tiers[0], parsed);
    rmSync(s.root, { recursive: true, force: true });
    assert.ok(killed, `SURVIVING MUTANT — "${m.name}" and the suite still passed. Add a case for it.`);
  }
  rmSync(lab, { recursive: true, force: true });
}

/* ─────────── the real memory tier must be exactly as this suite found it ──
 * The one thing an audit's test must never do is edit the thing being audited. Compared against the snapshot
 * taken at the top, so a concurrent edit by another session is not mistaken for damage by this one.
 */
{
  const after = spawnSync("git", ["status", "--porcelain", "--", ".claude/memory"], {
    cwd: REPO,
    encoding: "utf8",
  }).stdout;
  assert.equal(
    after,
    memoryStateBefore,
    `THE SUITE CHANGED THE REAL MEMORY TIER.\nbefore:\n${memoryStateBefore}\nafter:\n${after}`,
  );
}

console.log(
  "memory-audit.test.mjs — both load caps + the cut-off line and what falls past it, index drift in both " +
    "directions, no-index, 4 wiring states, the always-loaded bill incl. the skill catalog and a broken " +
    "@import, stripped metadata, overlap that does not cry wolf, stamp-based staleness with --stale, " +
    "one-fact-per-file, 9 mutants all killed  ✅",
);
