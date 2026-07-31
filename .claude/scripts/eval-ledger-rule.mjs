#!/usr/bin/env node
// @vi WHAT: Một phép thử có model tham gia: nó gọi Claude thật hai lần để xem một phiên mới có ghi sổ tri thức đúng luật hay
//   không (một dòng mục lục ngắn + một entry chi tiết ở file riêng).
// @vi WHEN: Hầu như không chạy lại — nó tốn tiền thật và kết quả đã được ghi lại.
// @vi WHY: Đây là công cụ DUY NHẤT được miễn test, và lý do đó được in ra mỗi lần tool-check chạy: kết quả của nó không tất
//   định VÀ có phí. Nửa tất định của nó (đếm dòng trong file mà model đã sửa) chưa được tách ra nên chưa test được.
//
/**
 * eval-ledger-rule.mjs — a model-in-the-loop eval, per `/behavioural-eval`.
 *
 * ─ THE QUESTION (falsifiable) ────────────────────────────────────────────────────────────────────
 * Given the governance as it stands after 2026-07-28, does a fresh session asked to record a
 * cross-project lesson write a SHORT index row in `registries/knowledge-ledger.md` **and** a separate full
 * entry in `ledger/YYYY-MM.md` — instead of pasting the reasoning into the index?
 *
 * Why it is worth asking: the rule "one line per lesson + a pointer" was written into the ledger's own
 * header on 2026-06-12 and violated for 203 consecutive entries, some over 2500 characters, until the
 * file reached 421KB. On 2026-07-28 the rule was RESTATED (an explicit two-write procedure in
 * `/session-wrap` Step 4, plus an invariant in `standards/documentation §7.2`) and the file was split.
 * Restating a rule that already failed once is exactly the intervention that deserves measuring rather
 * than assuming — otherwise this is the platform's fourth documented case of writing a rule down and
 * calling it fixed.
 *
 * ─ PRE-COMMITTED CONSEQUENCE OF A NULL RESULT ────────────────────────────────────────────────────
 * If the treatment arm does not behave differently from control, the restatement is decoration and the
 * rule MUST be escalated from prose to a gate: a PreToolUse hook that rejects an index row over N
 * characters, in the shape of `secret-guard`. Written down here BEFORE the run so a null cannot be
 * explained away afterwards. (memory: enforce-rules-with-gates.)
 *
 * ─ DESIGN ────────────────────────────────────────────────────────────────────────────────────────
 * One variable: the Step-4 procedure + the ledger's file structure.
 *   control   = the exact bytes in force before 2026-07-28 (monolithic ledger, "add one line" prose)
 *   treatment = the exact bytes in force now (split ledger, explicit two-write procedure)
 * Two fixtures that fail for different reasons: a SHORT lesson (little pressure to over-write) and a
 * LONG one (the shape that actually produced the 2500-char rows). A rule that only survives the easy
 * case has not been tested.
 *
 * Metrics are counted from the files the model actually edited — no judge, no self-report:
 *   indexRowChars  — length of the row added to registries/knowledge-ledger.md   (lower is compliant)
 *   detailWritten  — did a detail entry appear in ledger/YYYY-MM.md?     (treatment arm only)
 *
 * Usage:  node .claude/scripts/eval-ledger-rule.mjs           # run it
 *         node .claude/scripts/eval-ledger-rule.mjs --keep    # keep the sandboxes for inspection
 *
 * ─ WHY THE HALVES ARE SPLIT ──────────────────────────────────────────────────────────────────────
 * Only `runArm` spawns a model, and only it costs money and returns something different every time. The
 * fixtures, the measurement and the verdicts are ordinary deterministic code that has already carried TWO
 * harness defects — each of which produced a confident, wrong number rather than an error. So everything
 * except `runArm` is exported and tested (`eval-ledger-rule.test.mjs`), and the arms only run when this file
 * is invoked as a command. Importing it must never spend a token.
 */

import { spawnClaude } from "./_eval.mjs";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const KEEP = process.argv.includes("--keep");
const MODEL = process.argv.includes("--haiku") ? "haiku" : "sonnet";
/** An index row longer than this is the failure mode under test (real rows hit 2500+). */
const ROW_BUDGET = 200;

// ── fixtures: the exact governance text of each arm ─────────────────────────────────────────────

const STEP4_CONTROL = `## Step 4 — Cross-project lesson → \`registries/knowledge-ledger.md\`

Does this knowledge apply to **≥2 projects** or to **the platform itself**? → add one line to section A of
\`platform/registries/knowledge-ledger.md\` (date · one-line lesson · applies to · pointer to detail). If the project is creating its
\`decisions.md\` for the first time → add/edit the pointer in section B.
`;

const STEP4_TREATMENT = `## Step 4 — Cross-project lesson → the ledger (index + detail are SEPARATE files)

Does this knowledge apply to **≥2 projects** or to **the platform itself**? Then it is **two writes, not one**:

1. **Detail** → append the full entry to \`platform/ledger/YYYY-MM.md\` (current month):
   \`\`\`markdown
   ### 2026-07-28 — <headline, the same text you'll put in the index>

   <a id="2026-07-28-headline-slugified-lowercase-hyphens"></a>

   **<headline>** — full reasoning, the failure it came from, what to do instead. As long as it needs to be.
   \`\`\`
2. **Index** → add ONE row to section A of \`platform/registries/knowledge-ledger.md\`:
   \`\`\`markdown
   | 2026-07-28 | <headline, ≤120 chars, no detail> | [→](ledger/2026-07.md#2026-07-28-headline-slugified) |
   \`\`\`

> **Do NOT paste the detail into the index table.** That rule existed from day one and eroded anyway: by 2026-07-28 the
> index had reached 421KB (~105K tokens) with single rows over 2500 characters, and had to be split mechanically.
> The index is for scanning "have we tripped on anything like this?" — it is only useful while it stays scannable.
`;

const LEDGER_CONTROL = `# 06 — Cross-project knowledge log (index)

## A. Cross-project lessons (content here)

| Date       | Lesson (one line) |
| ---------- | --- |
| 2026-07-20 | **A schema default is silent data loss during a migration** — when a column gains a NOT NULL default, existing rows are back-filled with that default rather than left null, so a "safe additive migration" can overwrite real values that were meaningfully absent. Verify the back-fill on a copy before running it, and prefer a nullable column plus an explicit back-fill statement you can read. |
| 2026-07-23 | **Prompt adherence degrades with prompt length, not with prompt clarity** — restating a rule a fourth time in the same file made it less likely to be followed, not more, because the file crossed the length where adherence drops. Cut, don't add. |
`;

const LEDGER_TREATMENT_INDEX = `# 06 — Cross-project knowledge log (index)

## A. Cross-project lessons (content here)

> **Index only.** One row = one lesson: the headline plus a link. **Do not paste detail back into this table.**

| Date | Lesson | Detail |
| ---------- | --- | --- |
| 2026-07-20 | A schema default is silent data loss during a migration | [→](ledger/2026-07.md#2026-07-20-a-schema-default-is-silent-data-loss) |
| 2026-07-23 | Prompt adherence degrades with prompt length, not with clarity | [→](ledger/2026-07.md#2026-07-23-prompt-adherence-degrades-with-length) |
`;

const LEDGER_TREATMENT_DETAIL = `# Knowledge ledger — 2026-07

> Full text of the cross-project lessons recorded this month. The scannable index lives in
> \`../registries/knowledge-ledger.md\`; this file holds the detail it points at. **Append-only.**

---

### 2026-07-20 — A schema default is silent data loss during a migration

<a id="2026-07-20-a-schema-default-is-silent-data-loss"></a>

**A schema default is silent data loss during a migration** — when a column gains a NOT NULL default, existing rows are
back-filled with that default rather than left null, so a "safe additive migration" can overwrite real values that were
meaningfully absent. Verify the back-fill on a copy first.

### 2026-07-23 — Prompt adherence degrades with prompt length, not with clarity

<a id="2026-07-23-prompt-adherence-degrades-with-length"></a>

**Prompt adherence degrades with prompt length, not with prompt clarity** — restating a rule a fourth time in the same
file made it less likely to be followed, because the file crossed the length where adherence drops. Cut, don't add.
`;

// ── the two lessons to record (different failure pressure) ──────────────────────────────────────

const LESSONS = {
  short: {
    label: "SHORT lesson (little pressure to over-write)",
    text: `A named Docker volume survives \`docker compose down\`, but NOT \`docker compose down -v\`. Use the plain form when restarting an app.`,
  },
  long: {
    label: "LONG lesson (the shape that produced the 2500-char rows)",
    text: `Today's incident, worth recording as a cross-project lesson.

We treated a green CI build as proof that a change was live. It was not. The image built and pushed to ghcr
successfully, so the workflow went green and we reported the feature as shipped. But the pull side never ran: the
deployment host had been down for six days, so the running container was still on the previous image. The user found
the old behaviour in production while we were describing the new behaviour as deployed.

Root cause: "the build succeeded" and "the change is running" are two different claims, and our verification stopped at
the first one. The deploy chain has a push half and a pull half, and only the push half reports to us — the pull half
is silent when it does not happen at all, which is the worst possible failure signal.

What to do instead: verify the END state on the surface the user touches, not the last green step in the pipeline. For a
containerised app that means querying the running container (image digest, health endpoint, or the actual behaviour),
not reading a CI badge. If the end state cannot be reached, say the change is unverified rather than shipped. This
applies to every project on the platform, not just the one where it happened.`,
  },
};

// ── harness ─────────────────────────────────────────────────────────────────────────────────────

export function buildSandbox(arm) {
  const dir = mkdtempSync(join(tmpdir(), `eval-ledger-${arm}-`));
  // HARNESS DEFECT #1 (found + fixed 2026-07-28, first run): `ledger/` used to be created for BOTH arms.
  // That leaked the structure under test into the control fixture — the control model saw an empty
  // ledger/ directory that did not exist in the pre-2026-07-28 world, and one run duly split its entry
  // into it. Control now gets exactly the world it had: no ledger/ directory at all.
  // `registries/` must be created explicitly — writeFileSync does not create parent directories, so without
  // this every arm died with ENOENT before the model was ever asked anything. Latent until the deterministic
  // half was extracted and could be run without paying for two model calls first.
  mkdirSync(join(dir, "platform", "registries"), { recursive: true });
  writeFileSync(join(dir, "SESSION-WRAP-STEP-4.md"), arm === "control" ? STEP4_CONTROL : STEP4_TREATMENT);
  if (arm === "control") {
    writeFileSync(join(dir, "platform", "registries/knowledge-ledger.md"), LEDGER_CONTROL);
  } else {
    mkdirSync(join(dir, "platform", "ledger"), { recursive: true });
    writeFileSync(join(dir, "platform", "registries/knowledge-ledger.md"), LEDGER_TREATMENT_INDEX);
    writeFileSync(join(dir, "platform", "ledger", "2026-07.md"), LEDGER_TREATMENT_DETAIL);
  }
  return dir;
}

function runArm(dir, lesson) {
  const prompt =
    `You are wrapping up a work session on this platform. The file SESSION-WRAP-STEP-4.md contains the ` +
    `platform's procedure for recording a cross-project lesson. Read it, read whatever files it refers to, and ` +
    `record the following lesson by editing the files. Then stop.\n\n` +
    `THE LESSON TO RECORD:\n${lesson}`;
  /**
   * The spawn moved to `_eval.mjs` on 2026-07-31, at the rule of three. It is the code that had been broken on
   * Windows in every copy of it — an env allowlist dropping `PATHEXT`, and Node refusing to spawn `claude.cmd`
   * directly since its CVE-2024-27980 mitigation — so one copy means one place to fix and one place to test.
   */
  const { error } = spawnClaude({ cwd: dir, prompt, model: MODEL });
  return error ? { error } : {};
}

/** Deterministic: measure the files, never ask the model what it did. */
export function measure(dir, arm) {
  const idxPath = join(dir, "platform", "registries/knowledge-ledger.md");
  const rows = readFileSync(idxPath, "utf8")
    .split("\n")
    .filter((l) => /^\|\s*\d{4}-\d{2}-\d{2}/.test(l));
  const seeded = arm === "control" ? 2 : 2;
  const added = rows.slice(seeded); // seeded rows come first; anything after is what the model wrote
  const newRow = added.length ? added[added.length - 1] : rows[rows.length - 1];
  // HARNESS DEFECT #2 (found + fixed 2026-07-28, first run): this used to look only at `2026-07.md`, so a
  // control run that wrote `2026-07-28-green-ci-not-deployed.md` was scored detailWritten=false — a false
  // negative that flattered the treatment arm. Measure the whole directory, whatever the model named it.
  const ledgerDir = join(dir, "platform", "ledger");
  const detailBefore = arm === "control" ? 0 : LEDGER_TREATMENT_DETAIL.length;
  const detailAfter = existsSync(ledgerDir)
    ? readdirSync(ledgerDir).reduce((n, f) => n + readFileSync(join(ledgerDir, f), "utf8").length, 0)
    : 0;
  return {
    rowsAdded: Math.max(0, rows.length - seeded),
    indexRowChars: newRow ? newRow.length : 0,
    indexRow: newRow ? newRow.slice(0, 120) : "(none)",
    detailWritten: detailAfter > detailBefore,
    detailGrewBy: detailAfter - detailBefore,
  };
}

/**
 * One arm's verdict from its measurement.
 *
 * The `rowsAdded === 0` branch is the important one and it is not a formality: `measure` falls back to the
 * LAST SEEDED row when the model added nothing, and the seeded control row is deliberately fat — so without
 * this branch "the harness did nothing" renders as "the model violated the rule", which is a fabricated
 * result in the direction the experimenter wants. An absent measurement must never render as a real one.
 */
export function verdictOf(r) {
  if (r.error) return "ERROR";
  if (r.rowsAdded === 0) return "NO EDIT — not a result, harness/model no-op";
  const budgetOk = r.indexRowChars <= ROW_BUDGET;
  // The treatment arm is only compliant if the detail landed SOMEWHERE — a short index row with no detail
  // written is not the behaviour under test, it is the lesson being lost.
  return budgetOk && (r.arm === "control" || r.detailWritten) ? "compliant" : "VIOLATES the rule";
}

/**
 * The pre-committed reading of the whole run. Stated as code so a null result cannot be re-narrated after
 * the fact: treatment must be compliant everywhere AND control must actually have reproduced the failure,
 * or the conclusion is "escalate to a gate" / "the fixture proves nothing" — never "good enough".
 */
export function direction(results) {
  const t = results.filter((r) => r.arm === "treatment" && !r.error);
  const c = results.filter((r) => r.arm === "control" && !r.error);
  const tOk = t.filter((r) => verdictOf(r) === "compliant").length;
  const cFat = c.filter((r) => r.rowsAdded > 0 && r.indexRowChars > ROW_BUDGET).length;
  const verdict =
    t.length && tOk === t.length && cFat > 0
      ? "DIRECTION: the restated rule changes behaviour. Keep it as prose; no gate needed yet."
      : tOk < t.length
        ? "NULL/NEGATIVE: the restatement did not hold. Per the pre-commitment above, escalate to a PreToolUse gate."
        : "INCONCLUSIVE: control did not reproduce the failure, so the treatment had nothing to beat. Fix the fixture.";
  return { control: c.length, treatment: t.length, treatmentCompliant: tOk, controlFat: cFat, verdict };
}

// ── run ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * Only when invoked as a command. Importing this file spawns nothing: `eval-ledger-rule.test.mjs` exercises
 * the fixtures, the measurement and the verdicts, and a test that spent money on every commit would simply
 * be deleted by the next person who noticed.
 */
function main() {
  console.log(`eval-ledger-rule — model=${MODEL}, row budget=${ROW_BUDGET} chars\n`);
  const results = [];
  for (const [key, lesson] of Object.entries(LESSONS)) {
    for (const arm of ["control", "treatment"]) {
      const dir = buildSandbox(arm);
      process.stdout.write(`  running ${arm.padEnd(9)} / ${key.padEnd(5)} … `);
      const err = runArm(dir, lesson.text);
      const m = err.error ? { error: err.error } : measure(dir, arm);
      results.push({ fixture: key, arm, dir, ...m });
      console.log(
        err.error ? `ERROR ${err.error}` : `rowsAdded=${m.rowsAdded} row=${m.indexRowChars}ch detail=${m.detailWritten}`,
      );
      if (!KEEP) rmSync(dir, { recursive: true, force: true });
      else console.log(`    sandbox kept: ${dir}`);
    }
  }

  console.log(`\n${"fixture".padEnd(8)}${"arm".padEnd(11)}${"added".padEnd(7)}${"rowChars".padEnd(10)}${"detail?".padEnd(9)}verdict`);
  for (const r of results) {
    if (r.error) {
      console.log(`${r.fixture.padEnd(8)}${r.arm.padEnd(11)}ERROR: ${r.error}`);
      continue;
    }
    console.log(
      `${r.fixture.padEnd(8)}${r.arm.padEnd(11)}${String(r.rowsAdded).padEnd(7)}${String(r.indexRowChars).padEnd(10)}${String(r.detailWritten).padEnd(9)}` +
        verdictOf(r),
    );
  }

  const d = direction(results);
  console.log(`\nn = ${results.length} runs (${d.control} control, ${d.treatment} treatment) — small; read the DIRECTION.`);
  console.log(
    `treatment compliant on ${d.treatmentCompliant}/${d.treatment}; control wrote an over-budget row on ` +
      `${d.controlFat}/${d.control}.`,
  );
  console.log(d.verdict);
}

// `process.argv[1]` is the invoked path; an import leaves it pointing at the importer instead.
if (existsSync(process.argv[1] ?? "") && import.meta.url === pathToFileURL(process.argv[1]).href) main();
