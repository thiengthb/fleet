// Test for usage-census.mjs — the measurement every retirement verdict on this platform is derived from.
// Run: node .claude/scripts/usage-census.test.mjs
//
// WHY THIS EXISTS. This script answers "is anything using this file?", and it has been WRONG in both
// directions, on the real repo, within hours of being written:
//
//   toward condemning — it reported 28 skills as never used, because a read of a file INSIDE a skill
//                       directory was dropped instead of folded onto the skill. It also scored a dead
//                       sandbox as an ANCHOR (6 inbound links, all six about two OTHER sandboxes'
//                       INSTALL.md) because a non-unique basename was matched bare.
//   toward protecting — the generated report lists every artefact by path, so on the day the first report
//                       was written every file in the repo gained an inbound link FROM THE INSTRUMENT.
//                       One sandbox went 6 → 7 links within a single run.
//
// Each of those three is a named case below, marked REGRESSION. They are the reason this file is long: a
// measurement that is confidently wrong is worse than no measurement, because the next step it invites is
// deletion, and "the counter says 0" reads as evidence.
//
// METHOD. A sandbox repo in a temp dir (the script derives its root from its own location) plus a sandbox
// HOME holding fake transcripts — `os.homedir()` honours $HOME on POSIX, so the transcript miner can be fed
// exactly the events a case needs. Fixture names are deliberately invented words (`zebra-standard.md`), so
// an inbound-link count can be asserted EXACTLY: a realistic name like `testing.md` also appears inside the
// copied script and would silently add a link.
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
  copyFileSync,
} from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const SCRIPT = join(HERE, "usage-census.mjs");

const write = (p, body) => {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, body);
};

const DAY = 86_400_000;
const iso = (ms) => new Date(ms).toISOString();

/** One transcript event carrying one tool_use block. */
const event = (name, input, atMs = Date.now()) =>
  JSON.stringify({
    timestamp: iso(atMs),
    message: { content: [{ type: "tool_use", name, input }] },
  });

/**
 * A sandbox repo + a sandbox HOME.
 * `files` are written verbatim; `events` become one transcript; `hookLog` becomes the hook-usage JSONL.
 */
function sandbox({ files = {}, events = [], hookLog = null, skills = [] } = {}) {
  const root = mkdtempSync(join(tmpdir(), "usage-census-"));
  const home = join(root, "__home__");
  const scripts = join(root, ".claude", "scripts");
  mkdirSync(scripts, { recursive: true });
  copyFileSync(SCRIPT, join(scripts, "usage-census.mjs"));

  for (const [rel, body] of Object.entries(files)) write(join(root, rel), body);
  for (const s of skills)
    write(join(root, ".claude", "skills", s, "SKILL.md"), `---\nname: ${s}\n---\nbody\n`);

  // The miner accepts either slug this repo has had; use the current one.
  const tdir = join(home, ".claude", "projects", "-home-thien-projects-fleet");
  mkdirSync(tdir, { recursive: true });
  writeFileSync(join(tdir, "session-1.jsonl"), events.join("\n") + (events.length ? "\n" : ""));

  let hookLogPath = join(root, "__nolog__.jsonl");
  if (hookLog) {
    hookLogPath = join(root, "hook-usage.jsonl");
    writeFileSync(hookLogPath, hookLog.join("\n") + "\n");
  }
  return { root, home, scripts, hookLogPath };
}

function census(s, args = []) {
  const r = spawnSync(process.execPath, [join(s.scripts, "usage-census.mjs"), ...args], {
    encoding: "utf8",
    timeout: 120_000,
    // HOME redirects os.homedir() on POSIX only — on Windows it reads USERPROFILE, so without this the
    // sandbox is ignored and every case silently measures the REAL transcript store instead of its fixtures.
    env: {
      ...process.env,
      HOME: s.home,
      USERPROFILE: s.home,
      HOOK_USAGE_LOG: s.hookLogPath,
    },
  });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

/** The rows as a path→row map, for exact assertions. */
function rows(s, args = []) {
  const { out, code } = census(s, ["--json", ...args]);
  assert.equal(code, 0, `census exited ${code}:\n${out.slice(0, 600)}`);
  const j = JSON.parse(out);
  return { map: Object.fromEntries(j.rows.map((r) => [r.path, r])), scanned: j.scanned };
}

/* ═════════════════════════════════ 1. WHAT IS INVENTORIED, and what must never be ═══════════
 * The exclusions are load-bearing: `attic/` holds files already staged for retirement (re-measuring them
 * as if they were in service defeats the whole quarantine), and `reports/` is this tool's own output.
 */
{
  const s = sandbox({
    skills: ["zebra-skill"],
    files: {
      "platform/standards/zebra-standard.md": "# a standard\n",
      "platform/registries/quokka-registry.md": "# a registry\n",
      "platform/proposals/narwhal-hook.mjs.proposed": "// a draft\n",
      "platform/scripts/ocelot-helper.mjs": "// a live non-md artefact\n",
      "platform/attic/MANIFEST.md": "# staged\n",
      "platform/attic/evidence/axolotl.json": "{}\n",
      "platform/reports/2026-07-30-platform-report.md": "# generated\n",
      ".claude/memory/tapir-memory.md": "# a memory\n",
      ".claude/rules/lemur-rules.md": "# a scoped rule\n",
      "CLAUDE.md": "# the constitution\n",
      ".claude/hooks/dingo-hook.mjs": "// a hook\n",
      ".claude/hooks/dingo-hook.test.mjs": "// its test\n",
      ".claude/hooks/_util.mjs": "// a library\n",
      ".claude/scripts/ibis-script.mjs": "// a script\n",
      ".claude/scripts/heron-script.sh": "# a shell script\n",
    },
  });

  const { map } = rows(s);
  const kind = (p) => map[p]?.kind ?? "(absent)";

  assert.equal(kind("platform/standards/zebra-standard.md"), "knowledge");
  assert.equal(kind(".claude/memory/tapir-memory.md"), "knowledge", "memory is knowledge");
  assert.equal(kind(".claude/rules/lemur-rules.md"), "knowledge", "path-scoped rules are knowledge");
  assert.equal(kind("CLAUDE.md"), "knowledge");
  assert.equal(kind(".claude/skills/zebra-skill"), "skill", "a skill is inventoried as its DIRECTORY");
  assert.equal(kind(".claude/hooks/dingo-hook.mjs"), "hook");
  assert.equal(kind(".claude/scripts/ibis-script.mjs"), "script");
  assert.equal(kind(".claude/scripts/heron-script.sh"), "script", "shell scripts count too");
  assert.equal(
    kind("platform/proposals/narwhal-hook.mjs.proposed"),
    "other",
    "non-.md artefacts under platform/ were invisible until 2026-07-30 — the six obsolete drafts found by " +
      "hand that day all lived in this blind spot",
  );
  assert.equal(kind("platform/scripts/ocelot-helper.mjs"), "other");

  for (const absent of [
    "platform/attic/MANIFEST.md",
    "platform/attic/evidence/axolotl.json",
    "platform/reports/2026-07-30-platform-report.md",
    ".claude/hooks/dingo-hook.test.mjs",
    ".claude/hooks/_util.mjs",
  ])
    assert.equal(kind(absent), "(absent)", `must NOT be inventoried: ${absent}`);

  rmSync(s.root, { recursive: true, force: true });
}

/* ═══════════════════ 2. REGRESSION: a read INSIDE a skill directory counts for the skill ═══════
 * The first cut of this script dropped these on the floor and reported 28 skills as never used. A skill is
 * inventoried as a directory, but nobody ever "reads a directory" — they read its SKILL.md, a reference or
 * a template.
 */
{
  const s = sandbox({
    skills: ["zebra-skill", "quokka-skill"],
    files: { "platform/standards/zebra-standard.md": "x\n" },
    events: [
      event("Read", { file_path: ".claude/skills/zebra-skill/SKILL.md" }),
      event("Read", { file_path: ".claude/skills/zebra-skill/references/naming.md" }),
      event("Read", { file_path: ".claude/skills/zebra-skill/templates/plan.md" }),
      event("Skill", { skill: "quokka-skill" }),
    ],
  });

  const { map } = rows(s);
  assert.equal(
    map[".claude/skills/zebra-skill"].reads,
    3,
    "three reads INSIDE the skill directory must all fold onto the skill (the 28-false-dead defect)",
  );
  assert.equal(
    map[".claude/skills/quokka-skill"].runs,
    1,
    "an explicit Skill invocation is a RUN, not a read",
  );
  rmSync(s.root, { recursive: true, force: true });
}

/* ─────────────────── 3. path normalisation: absolute, relative and pre-rename forms are one file ── */
{
  const s = sandbox({
    files: { "platform/standards/zebra-standard.md": "x\n", "CLAUDE.md": "x\n" },
    events: [
      event("Read", { file_path: "platform/standards/zebra-standard.md" }),
      event("Read", { file_path: "/home/thien/projects/fleet/platform/standards/zebra-standard.md" }),
      // The repo was renamed in July; a read recorded under the OLD absolute path is the same file, and
      // splitting the count would make everything look half as used as it is.
      event("Read", {
        file_path: "/home/thien/projects/miniserver-platform/platform/standards/zebra-standard.md",
      }),
      event("Read", { file_path: "C:\\work\\fleet\\platform\\standards\\zebra-standard.md" }),
      event("Edit", { file_path: "platform/standards/zebra-standard.md" }),
      event("Read", { file_path: "/somewhere/else/CLAUDE.md" }),
      event("Read", { file_path: "/tmp/unrelated/file.md" }),
    ],
  });

  const { map } = rows(s);
  assert.equal(
    map["platform/standards/zebra-standard.md"].reads,
    4,
    "relative, absolute, pre-rename and Windows-separator forms are ONE file",
  );
  assert.equal(map["platform/standards/zebra-standard.md"].writes, 1, "an Edit is a write, not a read");
  assert.equal(map["CLAUDE.md"].reads, 1, "CLAUDE.md is matched by basename wherever it is read from");
  rmSync(s.root, { recursive: true, force: true });
}

/* ═════════════════ 4. a Bash command RUNS a script or merely MENTIONS it — never the same ═════
 * `runs` is the number that says a tool is alive. Counting a grep over its source as a run would make
 * every script look used the moment anyone audited it.
 */
{
  const s = sandbox({
    files: {
      ".claude/scripts/ibis-script.mjs": "// x\n",
      ".claude/hooks/dingo-hook.mjs": "// x\n",
      "platform/standards/zebra-standard.md": "x\n",
    },
    events: [
      event("Bash", { command: "node .claude/scripts/ibis-script.mjs --json" }),
      event("Bash", { command: "grep -n 'foo' .claude/scripts/ibis-script.mjs" }),
      event("Bash", { command: "wc -l .claude/hooks/dingo-hook.mjs" }),
      // A knowledge file named inside a `node` command is still only being READ — the runner heuristic
      // must be gated on the artefact's kind, not on the presence of the word "node".
      event("Bash", { command: "node -e \"x\" && cat platform/standards/zebra-standard.md" }),
    ],
  });

  const { map } = rows(s);
  assert.equal(map[".claude/scripts/ibis-script.mjs"].runs, 1, "`node <script>` is a run");
  assert.equal(map[".claude/scripts/ibis-script.mjs"].reads, 1, "grep over the same file is a read");
  assert.equal(map[".claude/hooks/dingo-hook.mjs"].runs, 0, "`wc -l` does not run anything");
  assert.equal(map[".claude/hooks/dingo-hook.mjs"].reads, 1);
  assert.equal(
    map["platform/standards/zebra-standard.md"].runs,
    0,
    "a knowledge file cannot be 'run', whatever the command line looked like",
  );
  assert.equal(map["platform/standards/zebra-standard.md"].reads, 1);
  rmSync(s.root, { recursive: true, force: true });
}

/* ─────────────────────────────── 5. the --days window must actually exclude old events ── */
{
  const now = Date.now();
  const s = sandbox({
    files: { "platform/standards/zebra-standard.md": "x\n" },
    events: [
      event("Read", { file_path: "platform/standards/zebra-standard.md" }, now - 60 * DAY),
      event("Read", { file_path: "platform/standards/zebra-standard.md" }, now - 2 * DAY),
    ],
  });
  assert.equal(rows(s).map["platform/standards/zebra-standard.md"].reads, 2, "all history by default");
  assert.equal(
    rows(s, ["--days", "30"]).map["platform/standards/zebra-standard.md"].reads,
    1,
    "a 60-day-old read must fall outside a 30-day window",
  );
  rmSync(s.root, { recursive: true, force: true });
}

/* ═══════════════ 6. REGRESSION: the generated report must not be in its own link corpus ═══════ */
{
  const s = sandbox({
    files: {
      "platform/standards/zebra-standard.md": "# the measured file\n",
      "platform/registries/quokka-registry.md": "see zebra-standard.md for the rule\n",
      // Exactly what platform-report writes: a table naming every artefact by path.
      "platform/reports/2026-07-30-platform-report.md":
        "| platform/standards/zebra-standard.md | 0 | 0 |\nzebra-standard.md\n",
      "platform/attic/MANIFEST.md": "staged: zebra-standard.md\n",
    },
  });
  assert.equal(
    rows(s).map["platform/standards/zebra-standard.md"].links,
    1,
    "ONE real citation. The generated report and the attic manifest must not add links — the instrument " +
      "must not manufacture the signal it measures (a sandbox went 6 → 7 links within one run on 2026-07-30)",
  );
  rmSync(s.root, { recursive: true, force: true });
}

/* ═══════════════ 7. REGRESSION: a non-unique basename cannot identify a file ═══════════════
 * The nuc-set-env sandbox scored 6 inbound links and was therefore ANCHOR — protected from retirement —
 * when all six citations were about two OTHER sandboxes' INSTALL.md.
 */
{
  const s = sandbox({
    files: {
      "platform/sandboxes/alpha/INSTALL.md": "# alpha\n",
      "platform/sandboxes/beta/INSTALL.md": "# beta\n",
      "platform/registries/quokka-registry.md":
        "follow INSTALL.md to set it up, and see alpha/INSTALL.md specifically\n",
    },
  });
  const { map } = rows(s);
  assert.equal(
    map["platform/sandboxes/alpha/INSTALL.md"].links,
    1,
    "only the citation carrying the parent directory counts",
  );
  assert.equal(
    map["platform/sandboxes/beta/INSTALL.md"].links,
    0,
    "beta is never cited by path — a bare `INSTALL.md` mention must not protect it",
  );
  rmSync(s.root, { recursive: true, force: true });
}

/* ─────────── 7b. …and a name that is generic BY NATURE is disambiguated even when unique today ──
 * `INSTALL.md` is unique now only because two sibling sandboxes were deleted in June, while the documents
 * discussing THEM remain. So the rule cannot depend on today's inventory alone.
 */
{
  const s = sandbox({
    files: {
      "platform/sandboxes/alpha/INSTALL.md": "# the only one left\n",
      "platform/registries/quokka-registry.md": "the old INSTALL.md said to run it by hand\n",
    },
  });
  assert.equal(
    rows(s).map["platform/sandboxes/alpha/INSTALL.md"].links,
    0,
    "a bare mention of a generically-named file must not count even when the name is currently unique",
  );
  rmSync(s.root, { recursive: true, force: true });
}

/* ─────────────────────────── 8. a file citing itself is not an inbound link ── */
{
  const s = sandbox({
    files: {
      "platform/standards/zebra-standard.md": "this file, zebra-standard.md, is self-referential\n",
      "platform/registries/quokka-registry.md": "zebra-standard.md\n",
    },
  });
  assert.equal(
    rows(s).map["platform/standards/zebra-standard.md"].links,
    1,
    "self-citation must not inflate the anchor count",
  );
  rmSync(s.root, { recursive: true, force: true });
}

/* ═════════ 9. hooks are invisible to transcripts — ran/fired come from the hook's own log ═════ */
{
  const s = sandbox({
    files: {
      // dingo CAN block, so `fired` is a number worth reading. The fixture must carry a real exit-2 path:
      // after 2026-08-01 a hook without one reports `fired: null`, and a fixture logging `code: 2` for a hook
      // that cannot produce a 2 is not a scenario the tool should have to explain.
      ".claude/hooks/dingo-hook.mjs": "if (bad) process.exit(2);\n",
      ".claude/hooks/emu-hook.mjs": "// x\n",
    },
    hookLog: [
      JSON.stringify({ ts: iso(Date.now()), hook: "dingo-hook.mjs", code: 0, ms: 4 }),
      JSON.stringify({ ts: iso(Date.now()), hook: "dingo-hook.mjs", code: 2, ms: 6 }),
      JSON.stringify({ ts: iso(Date.now()), hook: "dingo-hook.mjs", code: 0, ms: 3 }),
      JSON.stringify({ ts: iso(Date.now()), hook: "unknown-hook.mjs", code: 0, ms: 1 }),
      "not json at all",
      "",
    ],
  });
  const { map } = rows(s);
  assert.equal(map[".claude/hooks/dingo-hook.mjs"].ran, 3, "every logged run counts");
  assert.equal(
    map[".claude/hooks/dingo-hook.mjs"].fired,
    1,
    "only exit 2 counts as FIRED — for a hook that CAN exit 2, conflating the two would hide a guard that " +
      "runs constantly and never actually blocks anything",
  );
  assert.equal(map[".claude/hooks/emu-hook.mjs"].ran ?? 0, 0, "a hook with no log lines stays at zero");
  rmSync(s.root, { recursive: true, force: true });
}

/* ═════════ 9b. `fired` is n/a, never 0, for a hook that has NO exit-2 path ═════════════════════
 *
 * Measured 2026-08-01 on the live log: 7 of 15 hooks cannot exit 2 at all — they speak by printing
 * `hookSpecificOutput.additionalContext` / `systemMessage` and exiting 0, or they work by side effect. For
 * those, `fired = 0` is true by construction and forever, and the audit plan's row "≥1 firing each, or
 * justify the hook" read it as seven dead guards. A metric that cannot move must not be printed as though
 * it had stayed still. */
{
  const s = sandbox({
    files: {
      // Speaks at exit 0 — the majority shape, and the one that was being condemned.
      ".claude/hooks/tapir-hook.mjs":
        'process.stdout.write(JSON.stringify({ hookSpecificOutput: { additionalContext: "hi" } }));\nprocess.exit(0);\n',
      // Only *discusses* exit 2, in a line comment and a block comment. Must NOT count as able to block:
      // `tree-moved-notice.mjs` really does this in its header, and it is one of the seven.
      ".claude/hooks/quokka-hook.mjs":
        "// the docs say its exit 2 is ignored for FileChanged\n/* process.exit(2) would be wrong here */\nprocess.exit(0);\n",
      // The other spelling of blocking, via the shared helper.
      ".claude/hooks/ibis-hook.mjs": "declareFailMode(2, 'a hard invariant');\n",
    },
    hookLog: [
      JSON.stringify({ ts: iso(Date.now()), hook: "tapir-hook.mjs", code: 0, ms: 2 }),
      JSON.stringify({ ts: iso(Date.now()), hook: "quokka-hook.mjs", code: 0, ms: 2 }),
      JSON.stringify({ ts: iso(Date.now()), hook: "ibis-hook.mjs", code: 0, ms: 2 }),
    ],
  });
  const { map } = rows(s);
  assert.equal(
    map[".claude/hooks/tapir-hook.mjs"].fired,
    null,
    "a hook that speaks at exit 0 must report fired: null — printing 0 invites retiring a working hook",
  );
  assert.equal(map[".claude/hooks/tapir-hook.mjs"].ran, 1, "…while `ran` still counts, because it did run");
  assert.equal(
    map[".claude/hooks/quokka-hook.mjs"].fired,
    null,
    "mentioning exit 2 in a comment is not having an exit-2 path — comments must be stripped before the test",
  );
  assert.equal(
    map[".claude/hooks/ibis-hook.mjs"].fired,
    0,
    "declareFailMode(2, …) IS a blocking path, so 0 here is a real measurement and must stay a number",
  );

  // …and the human table must show it, not just the JSON: `n/a` is what a reader actually sees.
  const human = census(s, ["--kind", "hook"]);
  assert.match(
    human.out,
    /n\/a.*tapir-hook\.mjs/,
    `the hook table must print n/a for a hook that cannot exit 2:\n${human.out}`,
  );
  assert.doesNotMatch(human.out, /n\/a.*ibis-hook\.mjs/, "…and must NOT print n/a for one that can");
  rmSync(s.root, { recursive: true, force: true });
}

/* ═════════ 9c. `spoke` — three states, and ABSENCE is not `false` ═══════════════════════════════
 *
 * `spoke` was added to the log on 2026-08-01 to answer the question `fired` cannot: did an advisory hook, which
 * exits 0 whether or not it printed, actually say anything? Almost every existing line predates the key, so the
 * dangerous case is the boring one — a missing field must read as UNKNOWN. Counting absence as `false` would
 * report "never said a word" about a hook that has been printing for a week, which is a confident false verdict
 * of death produced by a schema change rather than by a bug. Written BEFORE the producing patch is applied,
 * because after real data arrives this case can no longer be constructed by accident. */
{
  const now = Date.now();
  const line = (hook, extra) => JSON.stringify({ ts: iso(now), hook, code: 0, ms: 1, ...extra });
  const s = sandbox({
    files: {
      ".claude/hooks/tapir-hook.mjs": "process.exit(0);\n", // speaks: two of three runs printed
      ".claude/hooks/quokka-hook.mjs": "process.exit(0);\n", // measured silent: ran, printed nothing
      ".claude/hooks/emu-hook.mjs": "process.exit(0);\n", // legacy only: no line carries the key
      ".claude/hooks/ibis-hook.mjs": "process.exit(0);\n", // the transition: some lines have it, some do not
    },
    hookLog: [
      line("tapir-hook.mjs", { spoke: true }),
      line("tapir-hook.mjs", { spoke: true }),
      line("tapir-hook.mjs", { spoke: false }),
      line("quokka-hook.mjs", { spoke: false }),
      line("quokka-hook.mjs", { spoke: false }),
      line("emu-hook.mjs", {}),
      line("emu-hook.mjs", {}),
      line("ibis-hook.mjs", {}), // written before the patch
      line("ibis-hook.mjs", { spoke: true }), // written after it
    ],
  });
  const { map } = rows(s);
  const h = (n) => map[`.claude/hooks/${n}-hook.mjs`];

  assert.deepEqual(h("tapir").spoke, { yes: 2, known: 3 }, "counts printed runs over the runs that recorded it");
  assert.deepEqual(
    h("quokka").spoke,
    { yes: 0, known: 2 },
    "`spoke: false` is a MEASUREMENT — it must land in `known` and read 0/2, never `?`",
  );
  assert.equal(
    h("emu").spoke,
    null,
    "no line carries the key ⇒ null (UNKNOWN). Reporting 0 here is the fabrication this case exists to stop",
  );
  assert.deepEqual(
    h("ibis").spoke,
    { yes: 1, known: 1 },
    "mid-transition, the denominator counts ONLY the lines that carry the flag — 1/1, not 1/2",
  );
  assert.equal(h("ibis").ran, 2, "…while `ran` still counts every line, because both runs happened");

  // What a reader actually sees.
  const human = census(s, ["--kind", "hook"]);
  assert.match(human.out, /2\/3\s+.*tapir-hook\.mjs/, `2/3 for the speaker:\n${human.out}`);
  assert.match(human.out, /0\/2\s+.*quokka-hook\.mjs/, "0/2 for the measured-silent one");
  assert.match(human.out, /\?\s+.*emu-hook\.mjs/, "`?` for the unknown one, not 0");
  // …and the guidance must be present, or `?` reads as a bug rather than as a pending patch.
  assert.match(human.out, /"spoke" = yes\/known/, "the LIMITS block must explain the pair");
  rmSync(s.root, { recursive: true, force: true });
}

/* ─────────────────── 10. the human-readable report must carry its own caveats ──
 * These sentences are the difference between a measurement and a deletion order. On 2026-07-30 an earlier
 * version of this report was read as a dead-weight list; 34 of 34 candidates were kept on review.
 */
{
  const s = sandbox({
    files: { "platform/standards/zebra-standard.md": "x\n", ".claude/memory/tapir-memory.md": "x\n" },
  });
  const { out, code } = census(s);
  assert.equal(code, 0, "report-only: always exit 0");
  assert.match(out, /retirement candidates: \d+ \(zero recorded use AND ≤1 file linking to it\)/, out);
  assert.match(out, /LIMITS — read before cutting anything/, "the limits block must be printed");
  assert.match(out, /Zero use ≠ worthless/, "the runbook caveat");
  assert.match(
    out,
    /MEMORY FILES: 0 here means "never explicitly opened", NOT "never used"/,
    "the memory caveat is the one that stops the worst possible deletion — the harness injects memory, " +
      "which is not a tool call and cannot be mined",
  );
  assert.match(out, /counts are a floor, never a ceiling/, "the subagent caveat");
  rmSync(s.root, { recursive: true, force: true });
}

/* ─────────────────────────────────── 11. the filters do what they say ── */
{
  const s = sandbox({
    skills: ["zebra-skill"],
    files: {
      "platform/standards/zebra-standard.md": "x\n",
      "platform/registries/quokka-registry.md": "x\n",
      ".claude/scripts/ibis-script.mjs": "// x\n",
    },
    events: [event("Read", { file_path: "platform/standards/zebra-standard.md" })],
  });
  const unused = rows(s, ["--unused"]).map;
  assert.ok(!unused["platform/standards/zebra-standard.md"], "--unused must drop what was used");
  assert.ok(unused["platform/registries/quokka-registry.md"], "…and keep what was not");

  const onlyScripts = rows(s, ["--kind", "script"]).map;
  assert.deepEqual(
    Object.keys(onlyScripts).sort(),
    [".claude/scripts/ibis-script.mjs", ".claude/scripts/usage-census.mjs"].sort(),
    "--kind script must return exactly the scripts (including the copy under test)",
  );
  rmSync(s.root, { recursive: true, force: true });
}

/* ───────────────────── 12. the suite must NOTICE a broken census (mutation) ── */
// Counted from the array below rather than typed into the summary line, because the summary was still
// claiming "8 mutants" after the 9th and 10th were added — a tool reciting a remembered number about itself.
let MUTANTS_RUN = 0;
{
  const src = readFileSync(SCRIPT, "utf8");

  const mutants = [
    {
      name: "skill-internal reads dropped again (THE 28-FALSE-DEAD DEFECT)",
      spec: {
        skills: ["zebra-skill"],
        events: [event("Read", { file_path: ".claude/skills/zebra-skill/SKILL.md" })],
      },
      apply: (s) => s.replace("return skill ? `.claude/skills/${skill[1]}` : m[1];", "return m[1];"),
      probe: (s) => rows(s).map[".claude/skills/zebra-skill"].reads === 0,
    },
    {
      name: "the generated report back inside its own link corpus",
      spec: {
        files: {
          "platform/standards/zebra-standard.md": "x\n",
          "platform/reports/r.md": "zebra-standard.md\n",
        },
      },
      apply: (s) => s.replace("const GENERATED = /^platform\\/(reports|attic)\\//;", "const GENERATED = /NEVERMATCHXYZ/;"),
      probe: (s) => rows(s).map["platform/standards/zebra-standard.md"].links === 1,
    },
    {
      name: "generic basenames matched bare again (the false ANCHOR)",
      spec: {
        files: {
          "platform/sandboxes/alpha/INSTALL.md": "x\n",
          "platform/registries/quokka-registry.md": "run INSTALL.md by hand\n",
        },
      },
      apply: (s) =>
        s.replace(
          /const GENERIC =\s*\n?\s*\/\^\(README[^;]*;/,
          "const GENERIC = /NEVERMATCHXYZ/;",
        ),
      // `>= 1`, not `=== 1`: the sandbox's own copy of the script is part of the link corpus, and its
      // COMMENTS discuss `INSTALL.md` by name. Once the disambiguation is neutered, that prose counts as a
      // citation too — which is a neat miniature of the bug itself, a document about a file being mistaken
      // for a dependency on it.
      probe: (s) => rows(s).map["platform/sandboxes/alpha/INSTALL.md"].links >= 1,
    },
    {
      name: "every mention of a script counted as a run",
      spec: {
        files: { ".claude/scripts/ibis-script.mjs": "// x\n" },
        events: [event("Bash", { command: "grep -n foo .claude/scripts/ibis-script.mjs" })],
      },
      apply: (s) => s.replace("const isRun = RUNNER.test(cmd);", "const isRun = true;"),
      probe: (s) => rows(s).map[".claude/scripts/ibis-script.mjs"].runs === 1,
    },
    {
      name: "staged and generated files back in the inventory",
      spec: { files: { "platform/attic/MANIFEST.md": "x\n" } },
      apply: (s) =>
        s.replace(
          '!/^platform\\/(attic|reports)\\//.test(posix(relative(REPO, f)))',
          "true",
        ),
      probe: (s) => Boolean(rows(s).map["platform/attic/MANIFEST.md"]),
    },
    {
      name: "any exit code counted as FIRED",
      spec: {
        files: { ".claude/hooks/dingo-hook.mjs": "if (bad) process.exit(2);\n" },
        hookLog: [JSON.stringify({ ts: iso(Date.now()), hook: "dingo-hook.mjs", code: 0, ms: 1 })],
      },
      apply: (s) => s.replace("if (e.code === 2)", "if (e.code >= 0)"),
      probe: (s) => rows(s).map[".claude/hooks/dingo-hook.mjs"].fired === 1,
    },
    {
      // The defect this section fixes, re-introduced: every hook classified as able to block, so the
      // structural zero comes back and seven working hooks look like guards that catch nothing.
      name: "canBlock always true (a structural zero printed as a measurement)",
      spec: {
        files: { ".claude/hooks/tapir-hook.mjs": "process.exit(0);\n" },
        hookLog: [JSON.stringify({ ts: iso(Date.now()), hook: "tapir-hook.mjs", code: 0, ms: 1 })],
      },
      apply: (s) => s.replace("return BLOCKING_EXIT.test(code);", "return true;"),
      probe: (s) => rows(s).map[".claude/hooks/tapir-hook.mjs"].fired === 0,
    },
    {
      // Comments not stripped ⇒ a hook that merely DISCUSSES exit 2 is called a blocking hook, which is the
      // false-ANCHOR mistake from case 3 arriving through a different door: prose read as behaviour.
      name: "comments not stripped before the exit-2 test",
      spec: {
        files: { ".claude/hooks/quokka-hook.mjs": "// process.exit(2) is wrong here\nprocess.exit(0);\n" },
        hookLog: [JSON.stringify({ ts: iso(Date.now()), hook: "quokka-hook.mjs", code: 0, ms: 1 })],
      },
      apply: (s) => s.replace("const code = stripComments(src);", "const code = src;"),
      probe: (s) => rows(s).map[".claude/hooks/quokka-hook.mjs"].fired === 0,
    },
    {
      // Truthiness instead of a type check: `spoke: false` — a hook that RAN and said nothing — stops counting
      // as known, so a measured silence becomes indistinguishable from no data. The two states this column
      // exists to separate collapse back into one.
      name: "`spoke: false` no longer counted as a measurement",
      spec: {
        files: { ".claude/hooks/quokka-hook.mjs": "process.exit(0);\n" },
        hookLog: [
          JSON.stringify({ ts: iso(Date.now()), hook: "quokka-hook.mjs", code: 0, ms: 1, spoke: false }),
        ],
      },
      apply: (s) => s.replace('if (typeof e.spoke === "boolean") {', "if (e.spoke) {"),
      probe: (s) => rows(s).map[".claude/hooks/quokka-hook.mjs"].spoke === null,
    },
    {
      // Absence reported as a measured zero — the exact fabrication case 9c is written against. A hook that has
      // been printing for a week would be published as having never said anything.
      name: "no `spoke` data reported as 0/0 instead of UNKNOWN",
      spec: {
        files: { ".claude/hooks/emu-hook.mjs": "process.exit(0);\n" },
        hookLog: [JSON.stringify({ ts: iso(Date.now()), hook: "emu-hook.mjs", code: 0, ms: 1 })],
      },
      apply: (s) => s.replace("it.kind === \"hook\" && it.spokeKnown", "it.kind === \"hook\""),
      // Probes on `!== null`, not on `known === 0`: without the guard, `known` is `undefined` rather than 0
      // (there were no lines to count), so the first cut of this probe reported a live mutant as a survivor.
      // A probe must assert what the mutation actually changes — here, that UNKNOWN stops being null at all.
      probe: (s) => rows(s).map[".claude/hooks/emu-hook.mjs"].spoke !== null,
    },
    {
      name: "the --days window ignored",
      spec: {
        files: { "platform/standards/zebra-standard.md": "x\n" },
        events: [
          event("Read", { file_path: "platform/standards/zebra-standard.md" }, Date.now() - 60 * DAY),
        ],
      },
      apply: (s) => s.replace("if (SINCE && ts && ts < SINCE) continue;", ""),
      probe: (s) => rows(s, ["--days", "30"]).map["platform/standards/zebra-standard.md"].reads === 1,
    },
    {
      name: "the LIMITS block deleted (the report becomes a deletion order)",
      spec: { files: { "platform/standards/zebra-standard.md": "x\n" } },
      apply: (s) => s.replace("LIMITS — read before cutting anything:", "Notes:"),
      probe: (s) => !/LIMITS — read before cutting anything/.test(census(s).out),
    },
  ];

  for (const m of mutants) {
    const s = sandbox(m.spec);
    const mutated = m.apply(src);
    assert.notEqual(mutated, src, `mutation "${m.name}" changed nothing — the patch is stale`);
    writeFileSync(join(s.scripts, "usage-census.mjs"), mutated);

    // A mutant must still RUN — one that only crashes proves the suite notices a broken file, not the
    // behaviour claimed. (This trap was hit twice on 2026-07-30, in two different suites.)
    const sanity = census(s, ["--json"]);
    let ran = false;
    try {
      ran = Array.isArray(JSON.parse(sanity.out).rows);
    } catch {
      ran = false;
    }
    assert.ok(
      ran,
      `mutant "${m.name}" did not run — it is a syntax error, not a behavioural change:\n${sanity.out.slice(0, 400)}`,
    );

    const killed = m.probe(s);
    rmSync(s.root, { recursive: true, force: true });
    assert.ok(killed, `SURVIVING MUTANT — "${m.name}" and the suite still passed. Add a case for it.`);
    MUTANTS_RUN++;
  }
}

/* ─────────────── the real repo and the real HOME must be untouched by all of the above ── */
{
  const dirty = spawnSync("git", ["status", "--porcelain"], { cwd: REPO, encoding: "utf8" }).stdout;
  assert.ok(
    !/zebra|quokka|dingo|ibis|tapir/.test(dirty),
    `the suite leaked fixtures into the real repo:\n${dirty}`,
  );
}

console.log(
  "usage-census.test.mjs — inventory scope + 5 exclusions, the 3 measured regressions (skill folding, " +
    "self-corpus, generic basenames), run-vs-mention, the --days window, hook ran/fired, `fired: n/a` for a " +
    "hook with no exit-2 path, `spoke` in all three states (absence is NOT false), the LIMITS block, " +
    `${MUTANTS_RUN} mutants all killed  ✅`,
);
