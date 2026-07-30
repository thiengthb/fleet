// Test for eval-ledger-rule.mjs — the deterministic half of a model-in-the-loop eval.
// Run: node .claude/scripts/eval-ledger-rule.test.mjs
//
// WHY THIS EXISTS, and why it stops short of the model. This script was the platform's ONE tool with no test,
// exempted because `runArm` spawns `claude -p` twice: non-deterministic and billable, so a standing test
// would spend money re-deriving a number already recorded. But the exemption covered the whole file, and the
// rest of it is ordinary deterministic code that had already shipped THREE defects — every one of which
// produced a confident wrong number rather than an error:
//
//   #1  `ledger/` was created for BOTH arms, leaking the structure under test into the control fixture.
//   #2  detail was counted only in `2026-07.md`, so a control run that named the file differently scored
//       detailWritten=false — a false negative that flattered the treatment arm.
//   #3  found 2026-07-30, by writing this suite: `buildSandbox` never created `platform/registries/`, so
//       EVERY arm died with ENOENT before the model was asked anything. The eval could not have run at all.
//
// That is the case for testing a measurement harness: a broken experiment does not report "broken", it
// reports a result. So the fixtures, the measurement and the pre-committed verdicts are all pinned here, and
// the one thing this suite must never do is call a model. Cases 8-9 assert exactly that.

import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  rmSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildSandbox, measure, verdictOf, direction } from "./eval-ledger-rule.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "eval-ledger-rule.mjs");

const INDEX = (dir) => join(dir, "platform", "registries", "knowledge-ledger.md");
const LEDGER_DIR = (dir) => join(dir, "platform", "ledger");
const trash = [];
const sandbox = (arm) => {
  const dir = buildSandbox(arm);
  trash.push(dir);
  return dir;
};

/** What a compliant model does: one short index row + the detail appended to the month file. */
const writeCompliant = (dir, { rowChars = 90, detailFile = "2026-07.md" } = {}) => {
  const headline = "a short scannable headline".padEnd(rowChars - 60, "x");
  appendFileSync(INDEX(dir), `| 2026-07-30 | ${headline} | [→](ledger/2026-07.md#2026-07-30-x) |\n`);
  mkdirSync(LEDGER_DIR(dir), { recursive: true });
  appendFileSync(join(LEDGER_DIR(dir), detailFile), `\n### 2026-07-30 — x\n\nfull reasoning, at length.\n`);
};

/* ═══════════════════ 1. the two fixtures are DIFFERENT WORLDS — defect #1 ═══════════════════
 * The control arm must be the pre-2026-07-28 world exactly: a monolithic index and no `ledger/` directory at
 * all. An empty `ledger/` is an instruction — one control run duly split its entry into it, which is the
 * treatment leaking into the control and the whole comparison becoming meaningless.
 */
{
  const control = sandbox("control");
  const treatment = sandbox("treatment");

  assert.ok(existsSync(INDEX(control)), "control needs an index to edit");
  assert.ok(!existsSync(LEDGER_DIR(control)), "control must NOT have a ledger/ directory — that is the leak");

  assert.ok(existsSync(LEDGER_DIR(treatment)), "treatment is the split world: the directory exists");
  assert.ok(
    existsSync(join(LEDGER_DIR(treatment), "2026-07.md")),
    "…with a seeded month file the model can append to",
  );

  const step4 = (dir) => readFileSync(join(dir, "SESSION-WRAP-STEP-4.md"), "utf8");
  assert.match(step4(control), /add one line to section A/, "control gets the old prose");
  assert.ok(
    !/two writes, not one/i.test(step4(control)),
    "…and must not be told the procedure under test",
  );
  assert.match(step4(treatment), /two writes, not one/i, "treatment gets the restated procedure");

  // The control index is deliberately FAT — it has to reproduce the failure, or there is nothing to beat.
  const fatRows = readFileSync(INDEX(control), "utf8")
    .split("\n")
    .filter((l) => /^\|\s*\d{4}-\d{2}-\d{2}/.test(l));
  assert.equal(fatRows.length, 2, "both arms are seeded with exactly 2 rows (measure() slices on that)");
  assert.ok(
    fatRows.some((l) => l.length > 200),
    "the control fixture must contain the failure mode it is meant to reproduce",
  );
}

/* ═══════════════════ 2. an untouched sandbox measures as NO EDIT, never as a violation ═══════════
 * `measure` falls back to the last SEEDED row when nothing was added, and in the control arm that row is fat
 * on purpose. Without the no-op guard, a harness that did nothing renders as "the model broke the rule" —
 * a fabricated result, in the direction the experimenter is hoping for.
 */
{
  for (const arm of ["control", "treatment"]) {
    const dir = sandbox(arm);
    const m = measure(dir, arm);
    assert.equal(m.rowsAdded, 0, `${arm}: nothing was added`);
    assert.equal(m.detailWritten, false, `${arm}: no detail either`);
    assert.match(
      verdictOf({ arm, ...m }),
      /NO EDIT/,
      `${arm}: an absent measurement must not render as a real one`,
    );
  }
}

/* ═══════════════════ 3. a compliant treatment run reads as compliant ═══════════════════ */
{
  const dir = sandbox("treatment");
  writeCompliant(dir);
  const m = measure(dir, "treatment");
  assert.equal(m.rowsAdded, 1, "one row added");
  assert.ok(m.indexRowChars <= 200, `the row must be inside the budget, got ${m.indexRowChars}`);
  assert.equal(m.detailWritten, true, "and the detail must be seen");
  assert.ok(m.detailGrewBy > 0, "…measured as growth against the seeded bytes, not as presence");
  assert.equal(verdictOf({ arm: "treatment", ...m }), "compliant");
}

/* ═══════════════════ 4. a fat row is a violation even when the detail was written ═══════════════ */
{
  const dir = sandbox("treatment");
  appendFileSync(
    INDEX(dir),
    `| 2026-07-30 | ${"the whole reasoning pasted into the index ".repeat(30)} | x |\n`,
  );
  mkdirSync(LEDGER_DIR(dir), { recursive: true });
  appendFileSync(join(LEDGER_DIR(dir), "2026-07.md"), "\n### 2026-07-30 — x\n\ndetail\n");
  const m = measure(dir, "treatment");
  assert.ok(m.indexRowChars > 200, "the fixture is the failure mode: an over-budget row");
  assert.equal(verdictOf({ arm: "treatment", ...m }), "VIOLATES the rule");
}

/* ═══════════════════ 5. a short row with NO detail is a violation in the treatment arm ══════════
 * This is the failure that would otherwise look like success: the index stays scannable because the lesson
 * was never written down anywhere.
 */
{
  const dir = sandbox("treatment");
  appendFileSync(INDEX(dir), `| 2026-07-30 | a short headline and nothing else | x |\n`);
  const m = measure(dir, "treatment");
  assert.ok(m.indexRowChars <= 200, "the row itself is fine");
  assert.equal(m.detailWritten, false, "but nothing was recorded");
  assert.equal(verdictOf({ arm: "treatment", ...m }), "VIOLATES the rule");

  // The same measurement in the CONTROL arm is compliant: that arm has no detail file to write to, so
  // demanding one would charge it with breaking a rule it was never given.
  assert.equal(verdictOf({ arm: "control", ...m }), "compliant");
}

/* ═══════════════════ 6. detail under ANY filename counts — defect #2 ═══════════════════ */
{
  const dir = sandbox("treatment");
  writeCompliant(dir, { detailFile: "2026-07-30-green-ci-not-deployed.md" });
  const m = measure(dir, "treatment");
  assert.equal(
    m.detailWritten,
    true,
    "a detail file the model named itself must still count — measuring only `2026-07.md` was a false negative",
  );
}

/* ═══════════════════ 7. the pre-committed reading of a whole run ═══════════════════
 * Written as code so a null result cannot be re-narrated afterwards. All three branches are pinned,
 * including the one that says the fixture proved nothing.
 */
{
  const compliant = { arm: "treatment", rowsAdded: 1, indexRowChars: 100, detailWritten: true };
  const fatControl = { arm: "control", rowsAdded: 1, indexRowChars: 900, detailWritten: false };
  const cleanControl = { arm: "control", rowsAdded: 1, indexRowChars: 100, detailWritten: false };
  const violating = { arm: "treatment", rowsAdded: 1, indexRowChars: 900, detailWritten: true };

  assert.match(
    direction([compliant, fatControl]).verdict,
    /DIRECTION: the restated rule changes behaviour/,
    "treatment clean + control reproducing the failure = the rule works",
  );
  assert.match(
    direction([violating, fatControl]).verdict,
    /NULL\/NEGATIVE/,
    "a treatment violation must escalate to a gate, per the pre-commitment",
  );
  assert.match(
    direction([compliant, cleanControl]).verdict,
    /INCONCLUSIVE/,
    "if control never failed, the treatment had nothing to beat — that is not a win",
  );
  assert.match(
    direction([]).verdict,
    /INCONCLUSIVE/,
    "and a run with no data at all must never read as a win",
  );
  // An errored arm is excluded from both denominators rather than counted as a pass.
  const withError = direction([compliant, fatControl, { arm: "treatment", error: "timeout" }]);
  assert.equal(withError.treatment, 1, "an errored arm is not a treatment observation");
  assert.equal(verdictOf({ arm: "treatment", error: "boom" }), "ERROR");
}

/* ═══════════════════ 8. importing this module must not spend a token ═══════════════════
 * The whole reason the eval was exempt from testing is that it spawns a model. A test that pays per run gets
 * deleted; a module that runs the arms on import makes every test of it billable.
 */
{
  const src = readFileSync(SCRIPT, "utf8").replace(/\r\n/g, "\n");
  assert.match(
    src,
    /import\.meta\.url === pathToFileURL\(process\.argv\[1\]\)\.href\) main\(\)/,
    "the arms must be behind a main-guard",
  );
  assert.ok(
    /export function buildSandbox/.test(src) &&
      /export function measure/.test(src) &&
      /export function verdictOf/.test(src) &&
      /export function direction/.test(src),
    "the deterministic half must be exported, or it cannot be tested without the model",
  );
  assert.ok(
    !/^\s*runArm\(/m.test(src.replace(/function main\(\)[\s\S]*$/, "")),
    "nothing above main() may call runArm",
  );
}

/* ═══════════════════ 9. the suite must NOTICE a broken harness (mutation) ═══════════════════
 * Each mutant is one of the ways this file has already been wrong, or could be, and the probe reads the
 * mutated module rather than the real one.
 */
{
  // OUTSIDE the repo. The first version wrote mutants into `.claude/scripts/__eval-mutants__/` and removed them
  // at the end, which is fine alone and wrong in company: while they exist the repo is dirty, so any suite
  // comparing `git status` before/after — `attic.test.mjs` does, by design — fails with a message about the
  // wrong thing. Two sessions running the runner at once turned that into an intermittent, misleading failure.
  // The module under test imports only node builtins, so a temp dir needs nothing copied beside it.
  const lab = mkdtempSync(join(tmpdir(), "eval-ledger-mutants-"));
  // LF-normalized: on a CRLF working tree (Windows) every multi-line mutation patch below would go stale.
  const src = readFileSync(SCRIPT, "utf8").replace(/\r\n/g, "\n");

  const mutants = [
    {
      name: "the no-op guard removed (a harness that did nothing scores as a violation)",
      apply: (s) => s.replace('if (r.rowsAdded === 0) return "NO EDIT', 'if (false) return "NO EDIT'),
      probe: (m) => {
        const dir = sandbox("control");
        return /NO EDIT/.test(m.verdictOf({ arm: "control", ...m.measure(dir, "control") })) === false;
      },
    },
    {
      name: "control gets a ledger/ directory too (DEFECT #1 — the treatment leaks into the control)",
      apply: (s) =>
        s.replace(
          'if (arm === "control") {',
          'mkdirSync(join(dir, "platform", "ledger"), { recursive: true });\n  if (arm === "control") {',
        ),
      probe: (m) => {
        const dir = m.buildSandbox("control");
        trash.push(dir);
        return existsSync(join(dir, "platform", "ledger"));
      },
    },
    {
      name: "detail counted only in 2026-07.md (DEFECT #2 — a false negative that flatters treatment)",
      apply: (s) =>
        s.replace(
          "? readdirSync(ledgerDir).reduce((n, f) => n + readFileSync(join(ledgerDir, f), \"utf8\").length, 0)",
          "? readFileSync(join(ledgerDir, \"2026-07.md\"), \"utf8\").length",
        ),
      probe: (m) => {
        const dir = m.buildSandbox("treatment");
        trash.push(dir);
        writeCompliant(dir, { detailFile: "2026-07-30-named-by-the-model.md" });
        return m.measure(dir, "treatment").detailWritten === false;
      },
    },
    {
      name: "registries/ no longer created (DEFECT #3 — every arm dies before the model is asked)",
      apply: (s) =>
        s.replace('mkdirSync(join(dir, "platform", "registries"), { recursive: true });', ""),
      probe: (m) => {
        try {
          trash.push(m.buildSandbox("treatment"));
          return false;
        } catch {
          return true; // the fixture cannot be built at all — exactly the defect found on 2026-07-30
        }
      },
      mayCrash: true,
    },
    {
      name: "the row budget raised past the failure mode (nothing can ever violate)",
      apply: (s) => s.replace("const ROW_BUDGET = 200;", "const ROW_BUDGET = 100_000;"),
      probe: (m) => {
        const dir = m.buildSandbox("treatment");
        trash.push(dir);
        appendFileSync(INDEX(dir), `| 2026-07-30 | ${"x".repeat(2500)} | y |\n`);
        mkdirSync(LEDGER_DIR(dir), { recursive: true });
        appendFileSync(join(LEDGER_DIR(dir), "2026-07.md"), "\n### x\n\ndetail\n");
        return m.verdictOf({ arm: "treatment", ...m.measure(dir, "treatment") }) === "compliant";
      },
    },
    {
      name: "treatment no longer required to write the detail (the lesson can vanish and still pass)",
      apply: (s) =>
        s.replace(
          'return budgetOk && (r.arm === "control" || r.detailWritten)',
          "return budgetOk",
        ),
      probe: (m) =>
        m.verdictOf({ arm: "treatment", rowsAdded: 1, indexRowChars: 90, detailWritten: false }) ===
        "compliant",
    },
    {
      name: "an INCONCLUSIVE run reported as a win (control never reproduced the failure)",
      apply: (s) => s.replace("&& cFat > 0", "&& cFat >= 0"),
      probe: (m) =>
        /DIRECTION/.test(
          m.direction([
            { arm: "treatment", rowsAdded: 1, indexRowChars: 100, detailWritten: true },
            { arm: "control", rowsAdded: 1, indexRowChars: 100, detailWritten: false },
          ]).verdict,
        ),
    },
  ];

  let n = 0;
  for (const mu of mutants) {
    const mutated = mu.apply(src);
    assert.notEqual(mutated, src, `mutation "${mu.name}" changed nothing — the patch is stale`);
    const p = join(lab, `m${n++}.mjs`);
    // The mutant sits beside the original so its relative imports still resolve.
    writeFileSync(p, mutated);
    let killed = false;
    try {
      killed = mu.probe(await import(pathToFileURL(p).href));
    } catch {
      killed = Boolean(mu.mayCrash);
    }
    assert.ok(killed, `SURVIVING MUTANT — "${mu.name}" and the suite still passed. Add a case for it.`);
  }
  rmSync(lab, { recursive: true, force: true });
}

for (const dir of trash) rmSync(dir, { recursive: true, force: true });

console.log(
  "eval-ledger-rule.test.mjs — the two arms are genuinely different worlds, an untouched sandbox reads as " +
    "NO EDIT rather than a violation, all four verdict classes, detail under any filename, all three " +
    "pre-committed directions incl. INCONCLUSIVE, the model stays behind a main-guard, 7 mutants all killed  ✅",
);
