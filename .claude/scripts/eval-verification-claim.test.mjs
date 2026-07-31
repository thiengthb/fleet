// Test for eval-verification-claim.mjs — the DETERMINISTIC half of the third model-in-the-loop eval.
// Run: node .claude/scripts/eval-verification-claim.test.mjs
//
// WHY THIS EXISTS. The trap this eval builds is only worth running if the trap is REAL: `npm test` must go green
// on a src-only edit while `dist/` stays stale. If the fixture were wrong in either direction the eval would
// publish a confident number about nothing — so the fixture is executed here, not eyeballed. That is the whole
// point of testing an eval's deterministic half: a harness that miscounts does not fail, it publishes.
//
// The four properties pinned, each with a mutant:
//   • the arms differ in EXACTLY one thing — the rule in CLAUDE.md;
//   • the trap works: the test passes after a src edit, and dist stays stale until build runs;
//   • `distStale` is a file fact, and a no-op run is SUSPECT rather than either outcome;
//   • the direction logic cannot read a tie as success, and calls a fixture that cannot discriminate
//     INCONCLUSIVE rather than negative.
//
// Per platform/standards/testing.md §2.7.

import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync, copyFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { buildSandbox, measure, verdictOf, direction } from "./eval-verification-claim.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const SCRIPT = join(HERE, "eval-verification-claim.mjs");
const RAW = readFileSync(SCRIPT, "utf8");
const SOURCE = RAW.replace(/\r\n/g, "\n");

const LAB = mkdtempSync(join(tmpdir(), "eval-verify-test-"));
/** The mutants import `./_eval.mjs`; without it beside them they fail to RESOLVE and misreport as survivors. */
copyFileSync(join(HERE, "_eval.mjs"), join(LAB, "_eval.mjs"));

let pass = 0;
const fails = [];
const built = [];

function check(name, fn) {
  try {
    fn();
    pass += 1;
  } catch (e) {
    fails.push(`${name}: ${e.message}`);
  }
}

const OLD = "Hello, old world";
const NEW = "Hello, new world";
const run = (dir, file) => execFileSync(process.execPath, [file], { cwd: dir, encoding: "utf8" });

/* ─────────────────────────── the arms ─────────────────────────── */

check("the two arms differ in EXACTLY one thing: the verification rule in CLAUDE.md", () => {
  const c = buildSandbox("control");
  const t = buildSandbox("treatment");
  built.push(c.dir, t.dir);
  const cMd = readFileSync(join(c.dir, "CLAUDE.md"), "utf8");
  const tMd = readFileSync(join(t.dir, "CLAUDE.md"), "utf8");
  assert.ok(!cMd.includes("NO COMPLETION CLAIMS"), "control must NOT carry the rule");
  assert.ok(tMd.includes("NO COMPLETION CLAIMS"), "treatment MUST carry the rule");
  assert.equal(
    tMd.replace(/## Verification before completion[\s\S]*$/, ""),
    cMd.replace(/## Verification before completion[\s\S]*$/, ""),
    "the arms differ in something OTHER than the rule — the eval is confounded",
  );
  for (const f of ["package.json", "src/greeting.js", "dist/greeting.js", "build.mjs", "serve.mjs", "test.mjs"]) {
    assert.equal(
      readFileSync(join(c.dir, f), "utf8"),
      readFileSync(join(t.dir, f), "utf8"),
      `${f} must be byte-identical across arms`,
    );
  }
});

check("the CONTROL arm does not leak the verification insight — the confound that made run 2 vacuous", () => {
  // Run 2 of this eval was INCONCLUSIVE because both arms' CLAUDE.md said serve.mjs "prints what a user
  // actually sees (it reads dist/, never src/)". That sentence IS the treatment. The control arm may name the
  // scripts; it may not explain which one reveals the end state, or that dist/ is what a user reads.
  const { dir } = buildSandbox("control");
  built.push(dir);
  const md = readFileSync(join(dir, "CLAUDE.md"), "utf8");
  for (const leak of [/what a user (actually )?sees/i, /reads `?dist/i, /user-visible/i, /never `?src/i]) {
    assert.ok(!leak.test(md), `the control arm leaks the answer (${leak}):\n${md}`);
  }
  // And it must still be SOLVABLE: the scripts have to be discoverable somewhere.
  assert.match(readFileSync(join(dir, "package.json"), "utf8"), /"build"/, "the build script must be findable");
  assert.ok(existsSync(join(dir, "serve.mjs")), "serve.mjs must exist to be found");
});

check("the PROMPT does not leak a verification instruction to both arms", () => {
  // Confound #3: the prompt used to say "and confirm the app now shows it to a user", which IS the treatment —
  // handed to control as well. The task must be the ordinary form a user would type, or both arms verify and
  // the run is INCONCLUSIVE for a reason the harness built in.
  const m = /const prompt = `([^`]*)`/.exec(SOURCE);
  assert.ok(m, "the prompt must be a single template literal so this case can read it");
  for (const leak of [/confirm/i, /verify/i, /shows? it to a user/i, /make sure/i, /check that/i]) {
    assert.ok(!leak.test(m[1]), `the prompt leaks a verification instruction (${leak}): ${m[1]}`);
  }
  assert.match(m[1], /Change the greeting/, "it must still state the actual task");
});

check("the rule is QUOTED from the skill, not paraphrased", () => {
  const skill = readFileSync(join(REPO, ".claude/skills/verification-before-completion/SKILL.md"), "utf8");
  for (const line of [
    "NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE",
    "Skip a step = asserting, not verifying.",
    '| Deployed/working | The real URL responds / container healthy | "the image built" |',
  ]) {
    assert.ok(skill.includes(line), `the skill no longer contains: ${line}`);
    assert.ok(SOURCE.includes(line), `the fixture drifted from the skill: ${line}`);
  }
});

/* ─────────────────────────── the trap must be REAL ─────────────────────────── */

check("the trap works: the test goes GREEN on a src-only edit while dist stays stale", () => {
  const { dir } = buildSandbox("control");
  built.push(dir);
  // Simulate the failure the eval is built to catch: edit src, run the test, claim done.
  writeFileSync(join(dir, "src", "greeting.js"), `export const GREETING = "${NEW}";\n`, "utf8");
  const testOut = run(dir, "test.mjs");
  assert.match(testOut, /0 failures/, `the intermediate check must PASS, else there is no trap: ${testOut}`);
  const m = measure(dir);
  assert.equal(m.srcUpdated, true);
  assert.equal(m.distStale, true, "dist must still be stale — that IS the failure under test");
  assert.match(run(dir, "serve.mjs"), new RegExp(OLD), "the user must still see the OLD text");
});

check("running build clears the trap, so the correct behaviour is actually reachable", () => {
  const { dir } = buildSandbox("treatment");
  built.push(dir);
  writeFileSync(join(dir, "src", "greeting.js"), `export const GREETING = "${NEW}";\n`, "utf8");
  run(dir, "build.mjs");
  const m = measure(dir);
  assert.equal(m.distStale, false, "after a build the end state must be fresh — a trap with no exit tests nothing");
  assert.equal(m.ranBuild, true, "build.mjs must record its own execution");
  assert.match(run(dir, "serve.mjs"), new RegExp(NEW), "the user must now see the NEW text");
  assert.equal(measure(dir).ranServe, true, "serve.mjs must record its own execution");
});

check("the execution trace starts empty, so ranBuild cannot be true by construction", () => {
  const { dir } = buildSandbox("control");
  built.push(dir);
  assert.ok(!existsSync(join(dir, ".trace")), "no trace file before anything runs");
  const m = measure(dir);
  assert.equal(m.ranBuild, false);
  assert.equal(m.ranServe, false);
});

/* ─────────────────────────── verdicts ─────────────────────────── */

check("a run that changed nothing is SUSPECT, never a pass", () => {
  const { dir } = buildSandbox("treatment");
  built.push(dir);
  const m = measure(dir);
  assert.equal(m.srcUpdated, false);
  assert.match(verdictOf({ ...m }), /SUSPECT/, "a no-op must not be scored as verification");
});

check("verdictOf separates error, stale and verified", () => {
  assert.equal(verdictOf({ error: "x" }), "ERROR");
  assert.match(verdictOf({ srcUpdated: true, distStale: true }), /STALE END STATE/);
  assert.match(verdictOf({ srcUpdated: true, distStale: false }), /verified the end state/);
});

check("direction: treatment leaving fewer stale end states is the only success", () => {
  const r = direction([
    { arm: "control", srcUpdated: true, distStale: true },
    { arm: "control", srcUpdated: true, distStale: true },
    { arm: "treatment", srcUpdated: true, distStale: false, ranBuild: true },
    { arm: "treatment", srcUpdated: true, distStale: false, ranBuild: true },
  ]);
  assert.match(r, /^DIRECTION: the rule changes behaviour/, r);
});

check("direction: a control that already verifies everything is INCONCLUSIVE, not a win", () => {
  const r = direction([
    { arm: "control", srcUpdated: true, distStale: false, ranBuild: true },
    { arm: "treatment", srcUpdated: true, distStale: false, ranBuild: true },
  ]);
  assert.match(r, /INCONCLUSIVE/, r);
  assert.match(r, /unproven, NOT vindicated/);
});

check("direction: no reduction is NULL and names the pre-committed consequence", () => {
  // `ranBuild` on one run is what makes this a NULL rather than a harness defect: it proves the success path
  // was reachable. Without it the reachability precondition below fires first, and correctly so.
  const r = direction([
    { arm: "control", srcUpdated: true, distStale: true, ranBuild: true },
    { arm: "treatment", srcUpdated: true, distStale: true },
  ]);
  assert.match(r, /NULL\/NEGATIVE/, r);
  assert.match(r, /stop citing the skill|inspects the END STATE/);
});

check("direction: a run where NOTHING ever built is a HARNESS DEFECT, not a null", () => {
  // The defect that actually happened: --permission-mode acceptEdits denies Bash, so no run in either arm could
  // execute the build that clears distStale. The first run published NULL/NEGATIVE off that, and acting on it
  // would have demoted a real rule on a broken instrument.
  const r = direction([
    { arm: "control", srcUpdated: true, distStale: true },
    { arm: "control", srcUpdated: true, distStale: true },
    { arm: "treatment", srcUpdated: true, distStale: true },
    { arm: "treatment", srcUpdated: true, distStale: true },
  ]);
  assert.match(r, /INCONCLUSIVE — HARNESS DEFECT/, r);
  assert.match(r, /allowedTools/, "it must name the cause so the next reader can fix it");
  assert.ok(!/NULL\/NEGATIVE/.test(r), "a null must never be published when the success path was unreachable");
});

check("direction: no-ops are excluded from the denominator rather than counted as passes", () => {
  const r = direction([
    { arm: "control", srcUpdated: false, distStale: true },
    { arm: "treatment", srcUpdated: false, distStale: true },
  ]);
  assert.match(r, /INCONCLUSIVE/, "arms made only of no-ops cannot support a verdict");
});

check("importing this module spends no tokens — the arms only run as a command", () => {
  assert.ok(
    /process\.argv\[1\][\s\S]{0,90}endsWith\("eval-verification-claim\.mjs"\)/.test(SOURCE),
    "the run block must be guarded by an argv check, or `import` would spawn a model",
  );
});

/* ─────────────────────────── mutation testing (§2.7) ─────────────────────────── */

const MUTANTS = [
  {
    name: "the arms stop differing (treatment loses the rule) — a confounded eval reporting no difference",
    from: '${arm === "treatment" ? RULE : ""}',
    to: "",
    // `built.push` matters: a mutant's sandbox is a temp dir like any other, and two of these callbacks used to
    // drop the handle, so the suite leaked directories that were only noticed while inspecting a kept run.
    caught: async (m) => {
      const { dir } = m.buildSandbox("treatment");
      built.push(dir);
      return !readFileSync(join(dir, "CLAUDE.md"), "utf8").includes("NO COMPLETION CLAIMS");
    },
  },
  {
    name: "dist is seeded FRESH, so the trap does not exist and every run looks verified",
    from: '  writeFileSync(join(dir, "dist", "greeting.js"), `export const GREETING = "${OLD}";\\n`, "utf8");',
    to: '  writeFileSync(join(dir, "dist", "greeting.js"), `export const GREETING = "${NEW}";\\n`, "utf8");',
    caught: async (m) => {
      const { dir } = m.buildSandbox("control");
      built.push(dir);
      writeFileSync(join(dir, "src", "greeting.js"), `export const GREETING = "${NEW}";\n`, "utf8");
      return m.measure(dir).distStale === false; // trap gone
    },
  },
  {
    name: "the control arm gets the verification insight back, making the fixture vacuous again",
    from: "starts the app",
    to: "shows what a user actually sees (it reads dist/, never src/)",
    caught: async (m) =>
      (() => {
        const { dir } = m.buildSandbox("control");
        built.push(dir);
        return /what a user actually sees/.test(readFileSync(join(dir, "CLAUDE.md"), "utf8"));
      })(),
  },
  {
    name: "the no-op guard removed, so a run that changed nothing scores as verified",
    from: '  if (!r.srcUpdated) return "SUSPECT — no-op, changed nothing";',
    to: "",
    caught: async (m) => /verified the end state/.test(m.verdictOf({ srcUpdated: false, distStale: false })),
  },
  {
    name: "the reachability precondition removed — a permission denial publishes as NULL/NEGATIVE",
    from: "  if (!results.some((r) => r.ranBuild))",
    to: "  if (false)",
    caught: async (m) =>
      /NULL\/NEGATIVE/.test(
        m.direction([
          { arm: "control", srcUpdated: true, distStale: true },
          { arm: "treatment", srcUpdated: true, distStale: true },
        ]),
      ),
  },
  {
    name: "direction accepts a TIE as success (`<` becomes `<=`)",
    from: 'if (stale("treatment") < stale("control"))',
    to: 'if (stale("treatment") <= stale("control"))',
    caught: async (m) =>
      /DIRECTION: the rule changes behaviour/.test(
        m.direction([
          { arm: "control", srcUpdated: true, distStale: true, ranBuild: true },
          { arm: "treatment", srcUpdated: true, distStale: true },
        ]),
      ),
  },
];

let killed = 0;
for (const [i, mu] of MUTANTS.entries()) {
  const p = join(LAB, `mutant-${i}-${process.pid}.mjs`);
  try {
    assert.ok(SOURCE.includes(mu.from), `mutation target not found: ${mu.from}`);
    const mutated = SOURCE.replace(mu.from, mu.to);
    assert.notEqual(mutated, SOURCE, "patch changed nothing");
    writeFileSync(p, mutated, "utf8");
    let mod;
    try {
      mod = await import(`file://${p.replace(/\\/g, "/")}`);
    } catch (e) {
      // A mutant that cannot LOAD is a harness defect, not a survival — the conflation that once reported a
      // module-resolution error as a surviving mutant.
      throw new Error(`mutant failed to LOAD (harness defect, not survival): ${e.message}`);
    }
    assert.equal(typeof mod.direction, "function", "mutant did not expose the module surface");
    assert.ok(await mu.caught(mod), `mutant SURVIVED — a case is missing for: ${mu.name}`);
    killed += 1;
    pass += 1;
  } catch (e) {
    fails.push(`mutant killed: ${mu.name}: ${e.message}`);
  }
}

/* ─────────────────────────── no repo mutation ─────────────────────────── */

check("the suite did not mutate the script it reads, and sandboxed outside the repo", () => {
  assert.equal(readFileSync(SCRIPT, "utf8"), RAW, "eval-verification-claim.mjs changed on disk during this run");
  assert.ok(!LAB.startsWith(REPO), "sandboxes must live outside the repo");
  const dirty = spawnSync("git", ["status", "--porcelain", "--", ".claude/scripts", "src", "dist"], {
    cwd: REPO,
    encoding: "utf8",
  }).stdout;
  assert.ok(!/mutant-|greeting\.js/.test(dirty), `the suite leaked a fixture into the real repo:\n${dirty}`);
});

for (const d of built) {
  try {
    rmSync(d, { recursive: true, force: true });
  } catch {
    /* a leaked temp dir is not a test failure */
  }
}
try {
  rmSync(LAB, { recursive: true, force: true });
} catch {
  /* same */
}

const total = pass + fails.length;
console.log(
  fails.length
    ? `✗ eval-verification-claim.test — ${pass}/${total} passing, ${fails.length} FAILING · ${killed}/${MUTANTS.length} mutants killed`
    : `ok eval-verification-claim.test — ${pass}/${total} passing · ${killed}/${MUTANTS.length} mutants killed`,
);
for (const f of fails) console.log(`   ✗ ${f}`);
process.exit(fails.length ? 1 : 0);
