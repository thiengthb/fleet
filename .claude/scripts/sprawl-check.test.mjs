// Test for sprawl-check.mjs — the brake that decides whether this platform is still earning its keep.
// Run: node .claude/scripts/sprawl-check.test.mjs
//
// WHY THIS EXISTS, and why it is not optional. This script's output leads to DELETION. Its first live run
// proposed retiring five memory files, one of them `never-print-secret-file-contents` — a rule that is actively
// obeyed. That is the failure mode to test for: not a crash, but a confident, plausible, wrong recommendation
// about what to destroy. The platform's own rule is "preserve data, prove before removing", so every guard that
// keeps this tool conservative gets a case here:
//
//   • an excluded tier (memory, log, ledger, reports, attic) must NEVER become eligible, whatever its numbers
//   • one inbound link is a mention, two is a dependency — eligibility must respect the SECOND number
//   • an item younger than the age floor must not count, or the brake measures activity instead of sprawl
//   • an UNKNOWN age must never satisfy the age condition (the `null < 30` coercion trap, recorded 2026-07-30)
//   • a census it cannot parse must produce NO verdict, never a comfortable "0 unused, all clear"
//
// Per platform/standards/testing.md §2.7: a silent path, acting paths asserted BY MESSAGE, killed mutants each
// proved to still RUN, and no mutation of the real repo.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir, hostname } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
/** The same sanitisation the script applies, so an injected baseline is keyed the way it will be read. */
const MACHINE = (hostname() || "unknown").replace(/[|\s]+/g, "-").slice(0, 24);
const REPO = resolve(HERE, "..", "..");
const SCRIPT = join(HERE, "sprawl-check.mjs");
const SOURCE = readFileSync(SCRIPT, "utf8");

const lab = mkdtempSync(join(tmpdir(), "sprawl-check-"));
let pass = 0;
const fails = [];
const gitBefore = spawnSync("git", ["status", "--porcelain"], { cwd: REPO, encoding: "utf8" }).stdout;

const DAY = 86_400_000;

/**
 * Replace the declared baselines in a copy of the script, so a case can state the line it is testing against
 * instead of depending on whatever the real platform's numbers happen to be today. Without this every case
 * would break the next time a skill gets used.
 */
function withBaseline(src, baseline, machineKey = MACHINE) {
  const body = Object.entries(baseline)
    .map(([k, v]) => `  ${k}: ${typeof v === "string" ? JSON.stringify(v) : v},`)
    .join("\n");
  // Baselines are keyed by MACHINE — a brake judging usage-census's machine-local numbers cannot share one line
  // across boxes — so an injected baseline has to land under the hostname the copy will actually read.
  const out = src.replace(
    /const BASELINE = \{[\s\S]*?\n\};/,
    `const BASELINE = {\n  ${JSON.stringify(machineKey)}: {\n${body}\n  },\n};`,
  );
  assert.notEqual(out, src, "baseline patch matched nothing — the test would be measuring the wrong numbers");
  return out;
}

/**
 * A sandbox with REAL git history at controlled dates. The script resolves its repo as two levels up from its
 * own file and spawns `<repo>/.claude/scripts/usage-census.mjs`, so both the copy and a census STUB have to sit
 * inside the fixture. The census is stubbed on purpose: this suite tests the POLICY, and running the real
 * 428-line census would make it slow, and would couple the brake's tests to the census's correctness.
 */
function sandbox({ rows, baseline, files = {}, source = SOURCE, censusStub, machineKey } = {}) {
  const root = mkdtempSync(join(lab, "repo-"));
  const scripts = join(root, ".claude", "scripts");
  mkdirSync(scripts, { recursive: true });

  spawnSync("git", ["init", "-b", "main"], { cwd: root });
  spawnSync("git", ["config", "user.email", "t@t.t"], { cwd: root });
  spawnSync("git", ["config", "user.name", "t"], { cwd: root });

  // Files are committed in AGE ORDER with backdated commits, so the script's `git log --diff-filter=A` pass
  // produces the ages the case intends.
  const byAge = Object.entries(files).sort((a, b) => b[1] - a[1]);
  for (const [path, ageDays] of byAge) {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, `content of ${path}\n`);
    const when = new Date(Date.now() - ageDays * DAY).toISOString();
    spawnSync("git", ["add", "--", path], { cwd: root });
    spawnSync("git", ["commit", "-m", `add ${path}`], {
      cwd: root,
      env: { ...process.env, GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when },
    });
  }

  writeFileSync(
    join(scripts, "usage-census.mjs"),
    censusStub ?? `console.log(${JSON.stringify(JSON.stringify({ scanned: {}, rows }))});`,
  );
  const copy = join(scripts, "sprawl-check.mjs");
  writeFileSync(copy, baseline ? withBaseline(source, baseline, machineKey) : source);
  return { root, script: copy };
}

function run(script, args = []) {
  const r = spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8",
    timeout: 60_000,
    env: { ...process.env, HOOK_USAGE_LOG: "off" },
  });
  return { code: r.status, out: `${r.stdout || ""}${r.stderr || ""}` };
}

function check(label, fn) {
  try {
    fn();
    pass++;
    console.log(`  ok   ${label}`);
  } catch (e) {
    fails.push(`${label}: ${e.message}`);
    console.log(`  FAIL ${label} — ${e.message}`);
  }
}

const row = (path, kind, over = {}) => ({ path, kind, reads: 0, writes: 0, runs: 0, links: 0, total: 0, lines: 10, ...over });
const used = (path, kind) => row(path, kind, { total: 5, reads: 5 });

/* ═══════════════════ 1. the quiet path: nothing grew ═══════════════════ */

check("at the baseline it reports ok and --gate passes", () => {
  const { script } = sandbox({
    rows: [row("a/one.md", "knowledge"), used("a/two.md", "knowledge")],
    files: { "a/one.md": 60, "a/two.md": 60 },
    baseline: { measured: "test", knowledge: 1 },
  });
  const r = run(script);
  assert.equal(r.code, 0);
  assert.match(r.out, /không tầng nào phình thêm/, "must say plainly that nothing grew");
  assert.doesNotMatch(r.out, /PHANH ĂN/, "the brake must not claim to engage at the line");
  assert.equal(run(script, ["--gate"]).code, 0, "--gate must pass at the baseline");
});

/* ═══════════════════ 2. acting paths, asserted BY MESSAGE ═══════════════════ */

check("a tier above its baseline engages the brake, names the tier, and --gate exits 1", () => {
  const { script } = sandbox({
    rows: [row("a/one.md", "knowledge"), row("a/two.md", "knowledge"), row("a/three.md", "knowledge")],
    files: { "a/one.md": 60, "a/two.md": 60, "a/three.md": 60 },
    baseline: { measured: "test", knowledge: 1 },
  });
  const r = run(script);
  assert.match(r.out, /PHANH ĂN/, "an increase must be stated, not implied");
  assert.match(r.out, /knowledge: 1 → 3/, "must show the line it crossed and by how much");
  assert.match(r.out, /Nâng mốc để cho qua/, "must warn against the obvious way to silence it");
  assert.equal(run(script, ["--gate"]).code, 1, "--gate must fail once sprawl grew");
});

check("something added recently does NOT count — the brake measures sprawl, not activity", () => {
  const { script } = sandbox({
    rows: [row("a/old.md", "knowledge"), row("a/brand-new.md", "knowledge")],
    files: { "a/old.md": 60, "a/brand-new.md": 2 },
    baseline: { measured: "test", knowledge: 1 },
  });
  const r = run(script);
  assert.equal(r.code, 0, "a file added two days ago must not trip the gate");
  assert.match(r.out, /không tầng nào phình thêm/);
  assert.equal(run(script, ["--gate"]).code, 0);
});

check("a skill reported as a DIRECTORY still gets an age, from its oldest file", () => {
  // The defect this covers: usage-census reports a skill as `.claude/skills/<name>`, git only ever names files,
  // so before the directory roll-up every skill's age was unknown and the whole tier — 17 of 38 unused — was
  // invisible to the brake. The table simply showed 0; nothing errored.
  const { script } = sandbox({
    rows: [row(".claude/skills/dead-skill", "skill")],
    files: { ".claude/skills/dead-skill/SKILL.md": 90 },
    baseline: { measured: "test", skill: 0 },
  });
  const r = run(script);
  assert.match(r.out, /PHANH ĂN/, "a 90-day-old unused skill must be visible to the ratchet");
  assert.match(r.out, /skill: 0 → 1/);
});

check("an UNKNOWN age never satisfies the age condition", () => {
  // `uncommitted.md` is in the census but in no commit, so git can give it no add date. It must be treated as
  // "cannot tell", not as old — the `null < 30` coercion trap this platform recorded on 2026-07-30.
  const { root, script } = sandbox({
    rows: [row("ghost.md", "knowledge")],
    files: { "seed.md": 60 },
    baseline: { measured: "test", knowledge: 0 },
  });
  writeFileSync(join(root, "ghost.md"), "never committed\n");
  const r = run(script);
  assert.equal(r.code, 0, "an unknown age must not be counted as mature non-adoption");
  assert.doesNotMatch(r.out, /PHANH ĂN/);
});

check("eligibility respects the SECOND number — two inbound links means keep", () => {
  const { script } = sandbox({
    rows: [row("a/lonely.md", "knowledge", { links: 1 }), row("a/linked.md", "knowledge", { links: 2 })],
    files: { "a/lonely.md": 60, "a/linked.md": 60 },
    baseline: { measured: "test", knowledge: 2 },
  });
  const r = run(script);
  assert.match(r.out, /a\/lonely\.md/, "one mention and no use is the eligible shape");
  assert.doesNotMatch(r.out, /a\/linked\.md/, "a file two others depend on must never be offered for deletion");
});

check("an excluded tier is never eligible, and the exclusion reason is printed", () => {
  const { script } = sandbox({
    rows: [
      row(".claude/memory/live-rule.md", "knowledge", { links: 1 }),
      row("platform/log/2026-06-01.md", "knowledge", { links: 0 }),
    ],
    files: { ".claude/memory/live-rule.md": 60, "platform/log/2026-06-01.md": 60 },
    baseline: { measured: "test", knowledge: 2 },
  });
  const r = run(script);
  assert.doesNotMatch(r.out, /live-rule\.md/, "a memory must never be proposed for retirement on this number");
  assert.doesNotMatch(r.out, /2026-06-01\.md/, "a dated log entry is history, not dead weight");
  assert.match(r.out, /MIỄN XÉT/, "the exclusion must be visible, not silent");
  assert.match(r.out, /never explicitly opened/, "and must carry its written reason");
});

check("with nothing eligible it says so WITHOUT implying the platform is fine", () => {
  const { script } = sandbox({
    rows: [row("a/linked.md", "knowledge", { links: 5 })],
    files: { "a/linked.md": 60 },
    baseline: { measured: "test", knowledge: 1 },
  });
  const r = run(script);
  assert.match(r.out, /chưa có gì an toàn để cắt/, "must distinguish 'nothing safe to cut' from 'no problem'");
});

check("the conservative caveat is always printed, not only when convenient", () => {
  const { script } = sandbox({
    rows: [row("a/one.md", "knowledge", { links: 1 })],
    files: { "a/one.md": 60 },
    baseline: { measured: "test", knowledge: 1 },
  });
  const out = run(script).out;
  assert.match(out, /"chưa dùng" ≠ vô giá trị/, "the number must never travel without its limit");
  assert.match(out, /SÀN, không phải trần/, "and must say the count is a floor");
  assert.match(out, /attic\.mjs/, "and must route deletion through the staged mechanism, never suggest rm");
});

check("a tier with no declared baseline is reported as unwatched, not silently skipped", () => {
  const { script } = sandbox({
    rows: [row("a/one.md", "mystery")],
    files: { "a/one.md": 60 },
    baseline: { measured: "test", knowledge: 0 },
  });
  assert.match(run(script).out, /chưa có mốc trong BASELINE/, "an unwatched tier must announce itself");
});

check("a census it cannot parse yields NO verdict and exits 1", () => {
  const { script } = sandbox({
    rows: [],
    files: { "a/one.md": 60 },
    baseline: { measured: "test", knowledge: 0 },
    censusStub: 'console.log("this is not json"); process.exit(0);',
  });
  const r = run(script);
  assert.equal(r.code, 1, "an unreadable instrument must fail, not pass");
  assert.match(r.out, /KHÔNG có kết luận nào/, "must refuse to conclude rather than report all-clear");
  assert.doesNotMatch(r.out, /không tầng nào phình thêm/, "must not print a comfortable verdict it cannot support");
});

/* ═══════════════════ 2b. per-MACHINE baselines, and the number the message prints ═══════════════════
 * Both found 2026-07-31, on the second machine's first run of this tool. It judges `usage-census` numbers, and
 * the census mines the transcripts of the box it runs on — 70 sessions on one, 9 on the other — so one shared
 * baseline made the Windows box report three tiers RISING on day one. A brake whose first act is to cry wolf is
 * the adoption failure this script's own header warns about.
 */

check("a machine with no declared baseline says so and fails --gate — it must not read as ok", () => {
  const { script } = sandbox({
    rows: [row("a/one.md", "knowledge"), row("a/two.md", "knowledge")],
    files: { "a/one.md": 60, "a/two.md": 60 },
    // Declared for a DIFFERENT box, which is exactly the situation a new machine starts in.
    baseline: { measured: "test", knowledge: 0 },
    machineKey: "some-other-box",
  });
  const r = run(script);
  assert.match(r.out, /CHƯA CÓ MỐC/, "an unratcheted machine must announce itself");
  assert.match(r.out, /usage-census chỉ đọc transcript của máy đang chạy/, "…and say why another box's number is not usable");
  assert.doesNotMatch(r.out, /không tầng nào phình thêm/, "silence about a machine it cannot judge must not read as all-clear");
  assert.equal(run(script, ["--gate"]).code, 1, "--gate must fail until the line is declared");
});

check("the brake line prints the number it COMPARED, so baseline + delta adds up", () => {
  const { script } = sandbox({
    // 3 unused, but only 2 of them mature (≥30d). The gate compares MATURE; the message used to print UNUSED.
    rows: [row("a/old1.md", "knowledge"), row("a/old2.md", "knowledge"), row("a/fresh.md", "knowledge")],
    files: { "a/old1.md": 60, "a/old2.md": 60, "a/fresh.md": 2 },
    baseline: { measured: "test", knowledge: 1 },
  });
  const r = run(script);
  const m = /knowledge: (\d+) → (\d+) \(\+(\d+)\)/.exec(r.out);
  assert.ok(m, `the tier line must be printed:\n${r.out}`);
  assert.equal(
    Number(m[1]) + Number(m[3]),
    Number(m[2]),
    `baseline + delta must equal the printed count — it printed the unused count (3) beside a delta from the ` +
      `mature count (2), so the arithmetic sent the reader after a number the gate never looked at:\n${m[0]}`,
  );
  assert.match(r.out, /knowledge: 1 → 2 \(\+1\)/, "and the number is the mature one");
});

/* ═══════════════════ 3. mutants — each proved to still RUN ═══════════════════ */

const mutants = [
  {
    name: "the exclusion list is emptied (memory files become deletable)",
    patch: (s) => s.replace("const exclusion = (p) => NEVER_ELIGIBLE.find", "const exclusion = (p) => [].find"),
    fixture: {
      rows: [row(".claude/memory/live-rule.md", "knowledge", { links: 1 })],
      files: { ".claude/memory/live-rule.md": 60 },
      baseline: { measured: "test", knowledge: 1 },
    },
    probe: (out) => /live-rule\.md/.test(out),
  },
  {
    name: "the link condition is dropped (a depended-on file is offered for deletion)",
    patch: (s) => s.replace("else if ((r.links || 0) <= MAX_LINKS_TO_RETIRE)", "else if (true)"),
    fixture: {
      rows: [row("a/linked.md", "knowledge", { links: 9 })],
      files: { "a/linked.md": 60 },
      baseline: { measured: "test", knowledge: 1 },
    },
    probe: (out) => /a\/linked\.md/.test(out),
  },
  {
    name: "the age floor is removed (a file added today counts as mature non-adoption)",
    patch: (s) => s.replace("if (age !== null && age >= MIN_AGE_DAYS) {", "if (true) {"),
    fixture: {
      rows: [row("a/fresh.md", "knowledge")],
      files: { "a/fresh.md": 1 },
      baseline: { measured: "test", knowledge: 0 },
    },
    probe: (out) => /PHANH ĂN/.test(out),
  },
  {
    name: "the ratchet compares against the wrong number (never fires)",
    patch: (s) => s.replace("rose: base === undefined ? false : t.mature.length > base", "rose: false"),
    fixture: {
      rows: [row("a/one.md", "knowledge"), row("a/two.md", "knowledge")],
      files: { "a/one.md": 60, "a/two.md": 60 },
      baseline: { measured: "test", knowledge: 0 },
    },
    probe: (out) => !/PHANH ĂN/.test(out),
  },
  {
    name: "the directory age roll-up is removed (the whole skill tier goes invisible again)",
    patch: (s) => s.replace("map.set(dir, Math.min(map.get(dir) ?? Infinity, ts));", ""),
    fixture: {
      rows: [row(".claude/skills/dead-skill", "skill")],
      files: { ".claude/skills/dead-skill/SKILL.md": 90 },
      baseline: { measured: "test", skill: 0 },
    },
    probe: (out) => !/PHANH ĂN/.test(out),
  },
  {
    name: "an undeclared machine falls back to green (the brake silently brakes nothing)",
    patch: (s) => s.replace("const MINE = BASELINE[MACHINE] ?? null;", "const MINE = BASELINE[MACHINE] ?? { measured: 'x' };"),
    fixture: {
      rows: [row("a/one.md", "knowledge"), row("a/two.md", "knowledge")],
      files: { "a/one.md": 60, "a/two.md": 60 },
      baseline: { measured: "test", knowledge: 0 },
      machineKey: "some-other-box",
    },
    // With the fallback in place the run stops admitting it has no line — which is the whole failure.
    probe: (out) => !/CHƯA CÓ MỐC/.test(out),
  },
  {
    name: "the brake line prints the unused count again (arithmetic that does not add up)",
    patch: (s) => s.replace("${t.baseline} → ${t.mature} (+${t.delta})", "${t.baseline} → ${t.unused} (+${t.delta})"),
    fixture: {
      rows: [row("a/old1.md", "knowledge"), row("a/old2.md", "knowledge"), row("a/fresh.md", "knowledge")],
      files: { "a/old1.md": 60, "a/old2.md": 60, "a/fresh.md": 2 },
      baseline: { measured: "test", knowledge: 1 },
    },
    probe: (out) => /knowledge: 1 → 3 \(\+1\)/.test(out),
  },
];

for (const m of mutants) {
  check(`mutant killed — ${m.name}`, () => {
    const mutated = m.patch(SOURCE);
    assert.notEqual(mutated, SOURCE, "the patch matched nothing — it would prove nothing (§2.7)");

    // SANITY FIRST — a mutant that only crashes proves the suite notices a broken file and nothing else.
    const bad = sandbox({ ...m.fixture, source: mutated });
    const rBad = run(bad.script);
    assert.equal(rBad.code, 0, `mutant crashed instead of running (exit ${rBad.code}): ${rBad.out.slice(0, 250)}`);
    assert.match(rBad.out, /sprawl-check/, "the mutant must still produce a normal-looking report");

    assert.ok(m.probe(rBad.out), "the mutant survived — the suite does not actually assert this behaviour");

    const good = sandbox(m.fixture);
    assert.ok(!m.probe(run(good.script).out), "the unmutated script shows the same symptom — probe not specific");
  });
}

/* ═══════════════════ 4. no repo mutation ═══════════════════ */

check("the suite left the real repo exactly as it found it", () => {
  const after = spawnSync("git", ["status", "--porcelain"], { cwd: REPO, encoding: "utf8" }).stdout;
  assert.equal(after, gitBefore, "this suite wrote into the repo it only meant to read");
  assert.ok(existsSync(SCRIPT));
});

rmSync(lab, { recursive: true, force: true });

console.log(
  `\nsprawl-check.test.mjs — ${pass} passed, ${fails.length} failed (${mutants.length} mutants, each proved to still run)`,
);
if (fails.length) {
  for (const f of fails) console.log(`  ✗ ${f}`);
  process.exit(1);
}
