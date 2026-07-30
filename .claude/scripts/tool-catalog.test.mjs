// Test for tool-catalog.mjs — the page that explains every hook and script to the human supervisor.
// Run: node .claude/scripts/tool-catalog.test.mjs
//
// WHY THIS EXISTS. This script is the supervisor's only readable entry point into 30 tools and 6.8k lines. If it
// is wrong it is wrong in the worst direction available: it does not crash, it produces a confident page that
// describes a platform which does not exist. Three claims on that page are load-bearing and none is human-typed:
//
//   "nổ khi nào"   — read from settings.json. If the parse silently yields nothing, every hook reads as
//                    "anh tự gọi" (you call it yourself), which is the exact opposite of what a hook is.
//   "CHẶN được"    — derived from the wired event × a real exit(2) in the source. A hook mislabelled as
//                    harmless is one the supervisor will not think to check when a write is refused.
//   "Test ✓/✗"     — the same pairing rule tool-check enforces. A false ✓ hides a gap this platform spent a
//                    whole campaign closing.
//
// And `--check` is a gate: it fails a run when the page has drifted or a tool has no `@vi WHAT`. So the suite
// must prove the gate can actually fail, not just that it can be silent.
//
// Per platform/standards/testing.md §2.7 this suite carries all four parts: a silent path (a fixture where
// everything is in order → exit 0, no complaint), the acting paths asserted BY MESSAGE, killed mutants, and no
// mutation of the real repo. Per the same section every mutant is proved to still RUN before its probe counts.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const SCRIPT = join(HERE, "tool-catalog.mjs");
const SOURCE = readFileSync(SCRIPT, "utf8");

const lab = mkdtempSync(join(tmpdir(), "tool-catalog-"));
let pass = 0;
const fails = [];

/**
 * The real repo's git state for the paths this script can write, captured BEFORE anything runs. Compared at the
 * end. A snapshot, not an "assert clean": on 2026-07-30 three suites that asserted cleanliness failed on a
 * parallel session's legitimate work, and a test that fails when someone else is working is a test that gets
 * skipped (standards/testing.md §2.7).
 */
const WATCHED = ["platform/registries/tool-catalog.md", ".claude/scripts/tool-catalog.mjs"];
const gitBefore = spawnSync("git", ["status", "--porcelain", "--", ...WATCHED], {
  cwd: REPO,
  encoding: "utf8",
}).stdout;

/**
 * Build a fake repo. This script derives REPO from its own path (`../..`), so the copy must live at
 * `<tmp>/.claude/scripts/` for the fixture to be the repo it sees — the first row of §2.7's sandbox table.
 */
function sandbox({ hooks = {}, scripts = {}, settings, page, source = SOURCE } = {}) {
  const dir = mkdtempSync(join(lab, "repo-"));
  mkdirSync(join(dir, ".claude", "hooks"), { recursive: true });
  mkdirSync(join(dir, ".claude", "scripts"), { recursive: true });
  mkdirSync(join(dir, "platform", "registries"), { recursive: true });
  for (const [name, body] of Object.entries(hooks)) writeFileSync(join(dir, ".claude", "hooks", name), body);
  for (const [name, body] of Object.entries(scripts)) writeFileSync(join(dir, ".claude", "scripts", name), body);
  writeFileSync(join(dir, ".claude", "settings.json"), JSON.stringify(settings ?? { hooks: {} }, null, 2));
  if (page !== undefined) writeFileSync(join(dir, "platform", "registries", "tool-catalog.md"), page);
  const copy = join(dir, ".claude", "scripts", "tool-catalog.mjs");
  writeFileSync(copy, source);
  return { dir, script: copy };
}

function run(script, args = [], env = {}) {
  const r = spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8",
    timeout: 30_000,
    env: { ...process.env, HOOK_USAGE_LOG: "off", ...env },
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

/* A minimal tool that introduces itself, in the shape the parser expects. */
const tagged = (what, extra = "") =>
  `// @vi WHAT: ${what}\n//\n/** a fixture tool */\nprocess.exit(0);\n${extra}`;

const WIRED = {
  hooks: {
    PreToolUse: [
      {
        matcher: "Edit|Write|MultiEdit",
        hooks: [{ type: "command", command: 'node "${CLAUDE_PROJECT_DIR}/.claude/hooks/blocker.mjs"' }],
      },
    ],
  },
};

/* ═══════════════════ 1. the silent path: everything in order ⇒ exit 0, nothing to complain about ═══════════════════ */

check("--check is silent and exits 0 when the page matches and every tool introduces itself", () => {
  const files = {
    hooks: { "blocker.mjs": tagged("chặn thử", "// process.exit(2)\n") },
    scripts: {},
    settings: WIRED,
  };
  const a = sandbox(files);
  const written = run(a.script, ["--write"]);
  assert.equal(written.code, 0, `--write should succeed, got ${written.code}: ${written.out}`);
  const page = readFileSync(join(a.dir, "platform", "registries", "tool-catalog.md"), "utf8");

  const b = sandbox({ ...files, page });
  const r = run(b.script, ["--check"]);
  assert.equal(r.code, 0, `expected exit 0, got ${r.code}: ${r.out}`);
  assert.match(r.out, /khớp thực tế/, "should say the page matches reality");
  assert.doesNotMatch(r.out, /✗/, `nothing should be reported as wrong: ${r.out}`);
});

/* ═══════════════════ 2. the acting paths, asserted BY MESSAGE ═══════════════════ */

check("a tool with no @vi WHAT fails --check and is named", () => {
  const { script } = sandbox({
    hooks: { "blocker.mjs": tagged("có thẻ"), "silent.mjs": "/** no tags at all */\n" },
    settings: WIRED,
  });
  const r = run(script, ["--check"]);
  assert.equal(r.code, 1, "a tool that never introduces itself must fail the gate");
  assert.match(r.out, /chưa tự giới thiệu/, "must say what is wrong, not just exit non-zero");
  assert.match(r.out, /silent\.mjs/, "must name the offender");
});

check("a page that has drifted from disk fails --check with the fix in the message", () => {
  const { script } = sandbox({
    hooks: { "blocker.mjs": tagged("có thẻ") },
    settings: WIRED,
    page: "# một trang cũ, không còn khớp\n",
  });
  const r = run(script, ["--check"]);
  assert.equal(r.code, 1);
  assert.match(r.out, /đã lệch so với thực tế/, "must say the page is stale");
  assert.match(r.out, /--write/, "must say how to fix it");
});

check("a hook file wired nowhere is reported as dead code that looks alive", () => {
  const { script } = sandbox({
    hooks: { "blocker.mjs": tagged("được cắm"), "orphan.mjs": tagged("không được cắm") },
    settings: WIRED,
  });
  const r = run(script, ["--check"]);
  assert.match(r.out, /KHÔNG được cắm|mã chết/, `should flag the unwired hook: ${r.out}`);
  assert.match(r.out, /orphan\.mjs/, "must name it");
});

check("wiring drives 'nổ khi nào' and the blocking verdict — both read from settings.json + source", () => {
  const { script } = sandbox({
    hooks: {
      "blocker.mjs": `// @vi WHAT: chặn thật\n//\nif (false) process.exit(2);\n`,
      "quiet.mjs": tagged("chỉ nhắc thôi"),
    },
    settings: {
      hooks: {
        PreToolUse: [
          {
            matcher: "Edit|Write|MultiEdit",
            hooks: [{ type: "command", command: 'node "${CLAUDE_PROJECT_DIR}/.claude/hooks/blocker.mjs"' }],
          },
        ],
        SessionStart: [
          { hooks: [{ type: "command", command: 'node "${CLAUDE_PROJECT_DIR}/.claude/hooks/quiet.mjs"' }] },
        ],
      },
    },
  });
  const r = run(script);
  assert.equal(r.code, 0);
  assert.match(r.out, /blocker\.mjs.*TRƯỚC mỗi lần ghi\/sửa file.*CHẶN được/s, "PreToolUse + exit(2) ⇒ blocking");
  assert.match(r.out, /quiet\.mjs.*đầu mỗi phiên/s, "SessionStart must translate to the session-start phrase");
  const quietRow = r.out.split("\n").find((l) => l.includes("quiet.mjs") && l.includes("|"));
  assert.doesNotMatch(quietRow || "", /CHẶN được/, "a SessionStart hook must never be labelled as blocking");
});

check("an unmapped event/matcher prints its raw form instead of an empty cell", () => {
  const { script } = sandbox({
    hooks: { "odd.mjs": tagged("cắm ở chỗ lạ") },
    settings: {
      hooks: {
        PreToolUse: [
          {
            matcher: "WebFetch",
            hooks: [{ type: "command", command: 'node "${CLAUDE_PROJECT_DIR}/.claude/hooks/odd.mjs"' }],
          },
        ],
      },
    },
  });
  const r = run(script, ["--check"]);
  assert.match(r.out, /chưa có bản dịch/, "an unmapped pair must be reported, not silently blanked");
  assert.match(run(script).out, /WebFetch/, "and the page must still show the raw matcher");
});

check("an unparseable settings.json warns instead of quietly reporting nothing is wired", () => {
  const { dir, script } = sandbox({ hooks: { "blocker.mjs": tagged("có thẻ") }, settings: WIRED });
  writeFileSync(join(dir, ".claude", "settings.json"), "{ this is not json");
  const r = run(script);
  assert.match(r.out, /không parse được/, "must say the wiring table cannot be trusted");
  assert.match(r.out, /đừng tin/, "and must say so in words, not by omission");
});

check("the test column follows the same pairing rule tool-check enforces", () => {
  const { script } = sandbox({
    hooks: { "blocker.mjs": tagged("có test"), "bare.mjs": tagged("không test") },
    scripts: { "blocker.test.mjs": "// not the hook's test\n" },
    settings: {
      hooks: {
        PreToolUse: [
          {
            matcher: "Edit|Write|MultiEdit",
            hooks: [
              { type: "command", command: 'node "${CLAUDE_PROJECT_DIR}/.claude/hooks/blocker.mjs"' },
              { type: "command", command: 'node "${CLAUDE_PROJECT_DIR}/.claude/hooks/bare.mjs"' },
            ],
          },
        ],
      },
    },
  });
  const out = run(script).out;
  // The sibling `.test.mjs` sits in scripts/, not next to the hook — so BOTH hooks must read as untested.
  const row = (n) => out.split("\n").find((l) => l.includes(n) && l.startsWith("|"));
  assert.match(row("blocker.mjs"), /✗ \|$/, "a test file in the wrong directory must not count");
  assert.match(row("bare.mjs"), /✗ \|$/, "a hook with no test at all must read ✗");
});

check("a script that is ALSO wired as a hook stays in the script section and shows its trigger", () => {
  const { script } = sandbox({
    scripts: { "auditor.mjs": tagged("vừa gọi tay vừa tự chạy") },
    settings: {
      hooks: {
        PostToolUse: [
          {
            matcher: "Edit|Write|MultiEdit",
            hooks: [
              { type: "command", command: 'node "${CLAUDE_PROJECT_DIR}/.claude/scripts/auditor.mjs" --hook' },
            ],
          },
        ],
      },
    },
  });
  const out = run(script).out;
  const scriptSection = out.slice(out.indexOf("## 2."), out.indexOf("## 3.") + 1 || undefined);
  assert.match(scriptSection, /auditor\.mjs/, "a wired script must be listed where it lives on disk");
  assert.match(out, /auditor\.mjs.*NGAY SAU mỗi lần ghi/s, "and its automatic trigger must be visible");
  assert.match(out, /--hook/, "the argument it is wired with is part of when it fires");
});

check("the page is deterministic: no clock, no local log, so --check cannot flap", () => {
  const files = { hooks: { "blocker.mjs": tagged("có thẻ") }, settings: WIRED };
  const a = sandbox(files);
  run(a.script, ["--write"]);
  const first = readFileSync(join(a.dir, "platform", "registries", "tool-catalog.md"), "utf8");
  const b = sandbox(files);
  run(b.script, ["--write"]);
  const second = readFileSync(join(b.dir, "platform", "registries", "tool-catalog.md"), "utf8");
  assert.equal(first, second, "two runs over identical input must produce byte-identical pages");
  assert.doesNotMatch(first, /202\d-\d\d-\d\d/, "a generated date would make every regeneration a diff");
});

check("--counts reads the LOCAL log via HOME and never writes it into the page", () => {
  const files = { hooks: { "blocker.mjs": tagged("có thẻ") }, settings: WIRED };
  const { dir, script } = sandbox(files);
  const home = join(dir, "fake-home");
  mkdirSync(join(home, ".claude"), { recursive: true });
  writeFileSync(
    join(home, ".claude", "hook-usage.jsonl"),
    [
      JSON.stringify({ hook: "blocker.mjs", code: 0 }),
      JSON.stringify({ hook: "blocker.mjs", code: 2 }),
      "{ broken json",
      "",
    ].join("\n"),
  );
  const r = run(script, ["--write", "--counts"], { HOME: home, USERPROFILE: home });
  assert.match(r.out, /2 lần chạy/, `should count both lines: ${r.out}`);
  assert.match(r.out, /1 lần nổ/, "an exit code of 2 is a firing");
  assert.match(r.out, /1 dòng log không đọc được/, "an unreadable line must be declared, not averaged away");
  assert.match(r.out, /SÀN/, "and the total must be called a floor once a line was lost");
  const page = readFileSync(join(dir, "platform", "registries", "tool-catalog.md"), "utf8");
  // The page is allowed to SAY that counts live elsewhere; what it must never contain is a count. The first
  // version of this assertion matched the page's own explanatory sentence and failed on correct behaviour.
  assert.doesNotMatch(page, /\d+ lần chạy/, "local counts must never reach the committed page");
});

/* ═══════════════════ 3. mutants — each proved to still RUN before its probe counts ═══════════════════ */

/**
 * Base fixture: one PreToolUse hook that really can exit 2, one PreToolUse hook that cannot, one SessionStart
 * hook, and none of them with a test file. Each mutant may extend it — a mutant needs a fixture that actually
 * exercises the branch it removes, or it "survives" for the boring reason that nothing reached the code.
 */
const mutantFiles = {
  hooks: {
    "blocker.mjs": `// @vi WHAT: chặn thật\n//\nif (false) process.exit(2);\n`,
    "noexit-pre.mjs": tagged("cắm ở chỗ chặn nhưng không có exit 2"),
    "bare-untested.mjs": tagged("cắm ở đầu phiên, không có test"),
  },
  settings: {
    hooks: {
      SessionStart: [
        { hooks: [{ type: "command", command: 'node "${CLAUDE_PROJECT_DIR}/.claude/hooks/bare-untested.mjs"' }] },
      ],
      PreToolUse: [
        {
          matcher: "Edit|Write|MultiEdit",
          hooks: [
            { type: "command", command: 'node "${CLAUDE_PROJECT_DIR}/.claude/hooks/blocker.mjs"' },
            { type: "command", command: 'node "${CLAUDE_PROJECT_DIR}/.claude/hooks/noexit-pre.mjs"' },
          ],
        },
      ],
    },
  },
};

/**
 * Each probe names WHICH output it reads — `page` (stdout of a plain run) or `gate` (stdout of `--check`).
 * The first version of this suite OR-ed a probe across both outputs, which made every *negative* probe
 * ("the page no longer says X") true against the `--check` output, where X never appears. Four mutants then
 * reported "the probe is not specific" — correctly. A probe that can match the wrong stream is not a probe.
 */
const mutants = [
  {
    name: "wiring parse returns nothing (every hook would read as 'anh tự gọi')",
    patch: (s) => s.replace("if (!wired.has(m[2])) wired.set(m[2], []);", "if (true) continue;"),
    // Anchored on the ROW, not the page. A page-wide `/CHẶN được/` reported this mutant as surviving, because
    // the sandbox catalogues its own copy of tool-catalog.mjs and that tool's `@vi WHY` sentence contains the
    // phrase verbatim. Third instance today of "the token appears in the prose that explains it" (§2.7).
    probe: ({ page }) => !/blocker\.mjs[^\n]*CHẶN được/.test(page),
  },
  {
    name: "blocking verdict ignores whether the source really has exit(2)",
    patch: (s) => s.replace("const canExit2 = /exit\\(2\\)/.test(src);", "const canExit2 = true;"),
    probe: ({ page }) => /noexit-pre\.mjs[^\n]*CHẶN được/.test(page),
  },
  {
    name: "the missing-@vi gate stops failing the run",
    files: { hooks: { ...mutantFiles.hooks, "untagged.mjs": "/** introduces itself to nobody */\n" } },
    patch: (s) => s.replace("const noWhat = tools.filter((t) => !t.vi.WHAT);", "const noWhat = [];"),
    probe: ({ gate }) => !/chưa tự giới thiệu/.test(gate),
  },
  {
    name: "the drift comparison always agrees with whatever is on disk",
    files: { page: "# một trang cũ đã lạc hậu\n" },
    patch: (s) => s.replace("} else if (onDisk !== page) {", "} else if (false) {"),
    probe: ({ gate }) => !/đã lệch/.test(gate),
  },
  {
    name: "the test column reports ✓ for a tool with no test file",
    patch: (s) => s.replace('hasTest: existsSync(f.replace(/\\.mjs$/, ".test.mjs")),', "hasTest: true,"),
    probe: ({ page }) => /bare-untested\.mjs[^\n]*✓ \|/.test(page),
  },
];

for (const m of mutants) {
  check(`mutant killed — ${m.name}`, () => {
    const mutated = m.patch(SOURCE);
    assert.notEqual(mutated, SOURCE, "the patch matched nothing — it would prove nothing (§2.7)");
    const files = { ...mutantFiles, ...(m.files || {}) };

    // SANITY FIRST. A mutant that only crashes proves the suite notices a broken file and nothing about the
    // behaviour it claims to remove. This was the campaign's most repeated defect: five suites, three
    // mechanisms, every one green having tested nothing (standards/testing.md §2.7).
    const bad = sandbox({ ...files, source: mutated });
    const badPage = run(bad.script);
    assert.equal(badPage.code, 0, `mutant crashed instead of running (exit ${badPage.code}): ${badPage.out.slice(0, 300)}`);
    assert.match(badPage.out, /Danh mục công cụ/, "the mutant must still produce a normal-looking page");
    const badGate = run(bad.script, ["--check"]);

    assert.ok(
      m.probe({ page: badPage.out, gate: badGate.out, code: badGate.code }),
      "the mutant survived — the suite does not actually assert this behaviour",
    );

    // And the real script must NOT show the mutant's symptom, or the probe is measuring something else.
    const good = sandbox(files);
    const goodPage = run(good.script);
    const goodGate = run(good.script, ["--check"]);
    assert.ok(
      !m.probe({ page: goodPage.out, gate: goodGate.out, code: goodGate.code }),
      "the unmutated script shows the same symptom — the probe is not specific",
    );
  });
}

/* ═══════════════════ 4. no repo mutation ═══════════════════ */

check("the suite left the real repo's watched paths exactly as it found them", () => {
  const after = spawnSync("git", ["status", "--porcelain", "--", ...WATCHED], {
    cwd: REPO,
    encoding: "utf8",
  }).stdout;
  assert.equal(after, gitBefore, "this suite changed a tracked file it only meant to read");
  assert.ok(existsSync(SCRIPT), "the script under test must still be there");
});

rmSync(lab, { recursive: true, force: true });

console.log(
  `\ntool-catalog.test.mjs — ${pass} passed, ${fails.length} failed (${mutants.length} mutants, each proved to still run)`,
);
if (fails.length) {
  for (const f of fails) console.log(`  ✗ ${f}`);
  process.exit(1);
}
