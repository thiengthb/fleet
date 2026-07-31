// Test for eval-plan-execution-gate.mjs — the DETERMINISTIC half of a model-in-the-loop eval.
// Run: node .claude/scripts/eval-plan-execution-gate.test.mjs
//
// WHY THIS EXISTS, and why the eval is not simply exempted from testing. `tool-check`'s exempt list is EMPTY,
// and it got that way because the platform's first eval was split: the model-calling arm stays untestable, and
// everything else — fixtures, measurement, verdicts — is ordinary code. On this platform that ordinary code has
// already produced two confident WRONG NUMBERS rather than errors, which is the failure mode that matters here:
// an eval whose harness miscounts does not fail, it publishes a result.
//
// The three properties worth pinning, each with a mutant:
//   • the two arms must differ in EXACTLY one thing — the block. A fixture bug that makes them identical would
//     produce a clean "no difference" and be read as a null result about the block.
//   • `createdNewCode` must be a fact about the filesystem, not about what the model said.
//   • the direction logic must not let a no-difference outcome read as success, and must call a fixture that
//     cannot show a difference INCONCLUSIVE rather than negative. Both directions are pre-committed in the
//     eval's header, so both are tested.
//
// Per platform/standards/testing.md §2.7: a silent path, acting paths asserted BY MESSAGE, killed mutants each
// proved to still RUN, and no mutation of the real repo.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, copyFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import {
  FIXTURES,
  buildSandbox,
  sourceFiles,
  measure,
  verdictOf,
  direction,
} from "./eval-plan-execution-gate.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const SCRIPT = join(HERE, "eval-plan-execution-gate.mjs");
/** RAW = bytes on disk (CRLF here); SOURCE = LF-normalised, which the mutation patches are written against. */
const RAW = readFileSync(SCRIPT, "utf8");
const SOURCE = RAW.replace(/\r\n/g, "\n");

const LAB = mkdtempSync(join(tmpdir(), "eval-gate-test-"));
/**
 * The mutants import `./_eval.mjs`, so the library has to sit beside them or every mutant dies of a module
 * resolution error and reports itself killed for the wrong reason. Exactly the fix recorded for
 * `secret-guard.test.mjs` on 2026-07-31 — and the reason mutants live in a temp dir at all is that the earlier
 * version of THAT suite wrote them into `.claude/hooks/` and leaked one on a timeout.
 */
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

const PLAN_REL = join("platform", "plans", "2026-07-20-notify-helper.md");
const planOf = (dir) => readFileSync(join(dir, PLAN_REL), "utf8");

/* ─────────────────────────── the fixtures ─────────────────────────── */

check("the two arms differ in EXACTLY one thing: the execute-half block", () => {
  const c = buildSandbox("control", "same-path");
  const t = buildSandbox("treatment", "same-path");
  built.push(c.dir, t.dir);

  assert.deepEqual(sourceFiles(c.dir), sourceFiles(t.dir), "the code in both arms must be identical");
  const cPlan = planOf(c.dir);
  const tPlan = planOf(t.dir);
  assert.ok(!cPlan.includes("## Before executing a batch"), "control must NOT carry the block");
  assert.ok(tPlan.includes("## Before executing a batch"), "treatment MUST carry the block");
  // And nothing else may differ: removing the block from treatment must reproduce control byte-for-byte.
  const stripped = tPlan.replace(/## Before executing a batch[\s\S]*?\n\n(?=## Out of scope)/, "");
  assert.equal(stripped, cPlan, "the arms differ in something OTHER than the block — the eval is confounded");
});

check("the thing the step asks for is ALREADY BUILT, at the fixture's path", () => {
  for (const [fixture, rel] of Object.entries(FIXTURES)) {
    const { dir, impl } = buildSandbox("treatment", fixture);
    built.push(dir);
    assert.equal(impl, rel, `fixture ${fixture} should report its own path`);
    assert.ok(existsSync(join(dir, rel)), `${fixture}: the existing implementation must be on disk at ${rel}`);
    assert.match(readFileSync(join(dir, rel), "utf8"), /notifyUser/, "it must export the function the step names");
    assert.match(planOf(dir), /create `src\/notify\.ts`/, "the step must still ask for src/notify.ts");
  }
});

check("the `moved` fixture is genuinely harder — the existing file is NOT where the step points", () => {
  const { dir, impl } = buildSandbox("treatment", "moved");
  built.push(dir);
  assert.notEqual(impl, "src/notify.ts", "if it sat at the named path this fixture would test nothing");
  assert.ok(!existsSync(join(dir, "src", "notify.ts")), "src/notify.ts must be absent in the moved fixture");
});

check("unknown fixture names are rejected rather than silently building an empty repo", () => {
  assert.throws(() => buildSandbox("control", "no-such-fixture"), /unknown fixture/);
});

/* ─────────────────────────── measurement ─────────────────────────── */

check("createdNewCode is a fact about the filesystem, and false when nothing was written", () => {
  const { dir, impl } = buildSandbox("treatment", "same-path");
  built.push(dir);
  const before = sourceFiles(dir);
  const planBefore = planOf(dir);
  const m = measure({ dir, impl, before, planBefore, transcript: "" });
  assert.equal(m.createdNewCode, false, "a session that wrote nothing must not read as having built something");
  assert.deepEqual(m.createdFiles, []);
  assert.equal(m.planEdited, false);
});

check("createdNewCode fires when a new source file appears, and names it", () => {
  const { dir, impl } = buildSandbox("control", "moved");
  built.push(dir);
  const before = sourceFiles(dir);
  const planBefore = planOf(dir);
  writeFileSync(join(dir, "src", "notify.ts"), "export function notifyUser(){}\n", "utf8");
  const m = measure({ dir, impl, before, planBefore, transcript: "" });
  assert.equal(m.createdNewCode, true, "the duplicate build must be detected");
  assert.deepEqual(m.createdFiles, ["src/notify.ts"]);
});

check("editing an EXISTING file is not counted as building a duplicate", () => {
  const { dir, impl } = buildSandbox("treatment", "same-path");
  built.push(dir);
  const before = sourceFiles(dir);
  const planBefore = planOf(dir);
  writeFileSync(join(dir, impl), `${readFileSync(join(dir, impl), "utf8")}\n// touched\n`, "utf8");
  const m = measure({ dir, impl, before, planBefore, transcript: "" });
  assert.equal(m.createdNewCode, false, "improving the file that already exists is the CORRECT outcome");
});

check("planEdited notices a dated answer written into the plan", () => {
  const { dir, impl } = buildSandbox("treatment", "moved");
  built.push(dir);
  const before = sourceFiles(dir);
  const planBefore = planOf(dir);
  writeFileSync(join(dir, PLAN_REL), `${planBefore}\n2026-08-01 — already built at ${impl}.\n`, "utf8");
  const m = measure({ dir, impl, before, planBefore, transcript: "" });
  assert.equal(m.planEdited, true);
  assert.equal(m.namedExisting, true, "naming the existing path is the weak secondary signal");
});

check("node_modules is never walked, so a dependency cannot fake a duplicate build", () => {
  const { dir } = buildSandbox("control", "same-path");
  built.push(dir);
  mkdirSync(join(dir, "node_modules", "pkg"), { recursive: true });
  writeFileSync(join(dir, "node_modules", "pkg", "index.ts"), "export const x=1;\n", "utf8");
  assert.ok(!sourceFiles(dir).some((f) => f.includes("node_modules")), "vendored code must be invisible here");
});

/* ─────────────────────────── verdicts ─────────────────────────── */

check("verdictOf separates an error from a result", () => {
  assert.equal(verdictOf({ error: "spawn failed" }), "ERROR");
  assert.match(verdictOf({ createdNewCode: true }), /BUILT THE DUPLICATE/);
  assert.match(verdictOf({ createdNewCode: false }), /detected/);
});

check("direction: treatment building fewer duplicates is the only success", () => {
  const r = direction([
    { arm: "control", createdNewCode: true },
    { arm: "control", createdNewCode: true },
    { arm: "treatment", createdNewCode: false },
    { arm: "treatment", createdNewCode: false },
  ]);
  assert.match(r, /^DIRECTION: the block changes behaviour/, r);
});

check("direction: a control arm that already detects everything is INCONCLUSIVE, not a win", () => {
  const r = direction([
    { arm: "control", createdNewCode: false },
    { arm: "treatment", createdNewCode: false },
  ]);
  assert.match(r, /INCONCLUSIVE/, r);
  assert.match(r, /unproven, NOT vindicated/, "the wording must refuse to claim a win from a vacuous fixture");
});

check("direction: no reduction is reported as NULL and names the pre-committed consequence", () => {
  const r = direction([
    { arm: "control", createdNewCode: true },
    { arm: "treatment", createdNewCode: true },
  ]);
  assert.match(r, /NULL\/NEGATIVE/, r);
  assert.match(r, /PostToolUse gate|delete the block/, "a null must point at the pre-commitment, not trail off");
});

check("direction: an arm with no usable run is inconclusive rather than a verdict", () => {
  assert.match(direction([{ arm: "control", createdNewCode: true }]), /INCONCLUSIVE/);
  assert.match(direction([{ arm: "treatment", error: "x" }, { arm: "control", error: "x" }]), /INCONCLUSIVE/);
});

check("importing this module spends no tokens — the arms only run as a command", () => {
  assert.ok(
    /process\.argv\[1\][\s\S]{0,80}endsWith\("eval-plan-execution-gate\.mjs"\)/.test(SOURCE),
    "the run block must be guarded by an argv check, or `import` would spawn a model",
  );
});

/* ─────────────────────────── mutation testing (§2.7) ─────────────────────────── */

const MUTANTS = [
  {
    name: "the arms stop differing (treatment loses the block) — a confounded eval reporting no difference",
    from: '${arm === "treatment" ? EXEC_BLOCK : ""}',
    to: "",
    caught: async (mod) => {
      const t = mod.buildSandbox("treatment", "same-path");
      built.push(t.dir);
      return !readFileSync(join(t.dir, PLAN_REL), "utf8").includes("## Before executing a batch");
    },
  },
  {
    name: "createdNewCode hardcoded false — every duplicate build reads as a detection",
    from: "    createdNewCode: created.length > 0,",
    to: "    createdNewCode: false,",
    caught: async (mod) => {
      const { dir, impl } = mod.buildSandbox("control", "moved");
      built.push(dir);
      const before = mod.sourceFiles(dir);
      const planBefore = readFileSync(join(dir, PLAN_REL), "utf8");
      writeFileSync(join(dir, "src", "notify.ts"), "export function notifyUser(){}\n", "utf8");
      return mod.measure({ dir, impl, before, planBefore }).createdNewCode === false;
    },
  },
  {
    name: "direction accepts a TIE as success (`<` becomes `<=`)",
    from: 'if (dup("treatment") < dup("control"))',
    to: 'if (dup("treatment") <= dup("control"))',
    caught: async (mod) =>
      /DIRECTION: the block changes behaviour/.test(
        mod.direction([
          { arm: "control", createdNewCode: true },
          { arm: "treatment", createdNewCode: true },
        ]),
      ),
  },
  {
    name: "the INCONCLUSIVE branch removed — a fixture that cannot show a difference reads as NULL",
    from: '  if (dup("control") === 0)',
    to: "  if (false)",
    caught: async (mod) =>
      /NULL\/NEGATIVE/.test(
        mod.direction([
          { arm: "control", createdNewCode: false },
          { arm: "treatment", createdNewCode: false },
        ]),
      ),
  },
];

let killed = 0;
for (const [i, m] of MUTANTS.entries()) {
  /**
   * Mutants live in an OS temp dir, never beside the real script. A sibling suite once wrote them into
   * `.claude/hooks/`, a timeout leaked one, and an unrelated suite then failed blaming itself.
   */
  const p = join(LAB, `mutant-${i}-${process.pid}.mjs`);
  try {
    assert.ok(SOURCE.includes(m.from), `mutation target not found: ${m.from}`);
    const mutated = SOURCE.replace(m.from, m.to);
    assert.notEqual(mutated, SOURCE, "patch changed nothing");
    writeFileSync(p, mutated, "utf8");

    // The mutant must still RUN — one killed by a syntax error proves nothing about the assertion.
    const mod = await import(`file://${p.replace(/\\/g, "/")}`);
    assert.ok(typeof mod.direction === "function", "mutant did not load as a module");

    const dead = await m.caught(mod);
    assert.ok(dead, `mutant SURVIVED — a case is missing for: ${m.name}`);
    killed += 1;
    pass += 1;
  } catch (e) {
    fails.push(`mutant killed: ${m.name}: ${e.message}`);
  }
}

/* ─────────────────────────── the real repo must be untouched ─────────────────────────── */

check("the suite did not mutate the script it reads, and wrote nothing into the repo", () => {
  assert.equal(readFileSync(SCRIPT, "utf8"), RAW, "eval-plan-execution-gate.mjs changed on disk during this run");
  assert.ok(!LAB.startsWith(REPO), "sandboxes must live outside the repo");
  const dirty = spawnSync("git", ["status", "--porcelain", "--", "src", "platform/plans"], {
    cwd: REPO,
    encoding: "utf8",
  }).stdout;
  assert.ok(!/notify-helper|src\/notify/.test(dirty), `the suite leaked a fixture into the real repo:\n${dirty}`);
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
    ? `✗ eval-plan-execution-gate.test — ${pass}/${total} passing, ${fails.length} FAILING · ${killed}/${MUTANTS.length} mutants killed`
    : `ok eval-plan-execution-gate.test — ${pass}/${total} passing · ${killed}/${MUTANTS.length} mutants killed`,
);
for (const f of fails) console.log(`   ✗ ${f}`);
process.exit(fails.length ? 1 : 0);
