#!/usr/bin/env node
// @vi WHAT: Một phép thử có model tham gia: nó gọi Claude thật để xem cái khối `## Before executing a batch` trong file plan
//   có thật sự khiến một phiên mới KIỂM TRA trước khi xây, hay nó chỉ là chữ nằm đó cho đẹp.
// @vi WHEN: Hầu như không chạy lại — nó tốn tiền thật, và kết quả đã được ghi lại ngay trong file này.
// @vi WHY: Ngày 2026-07-31 tôi đóng plan và tuyên bố khối đó là "thứ bền nhất plan này tạo ra" mà KHÔNG có bằng chứng nào.
//   Một tuyên bố chưa kiểm chứng chính là thứ A7 tồn tại để chặn, nên nó bị đem ra đo — kể cả khi kết quả làm tôi sai.
//
/**
 * eval-plan-execution-gate.mjs — a model-in-the-loop eval, per `/behavioural-eval`.
 *
 * Second eval on this platform, and it deliberately reuses the shape of the first
 * (`eval-ledger-rule.mjs`): one variable, two arms, two fixtures that fail for different reasons, metrics
 * counted from the files the model actually touched, and a consequence written down BEFORE the run.
 *
 * ─ THE QUESTION (falsifiable) ────────────────────────────────────────────────────────────────────
 * Given a plan whose next unticked step tells you to build something that is ALREADY BUILT in the repo,
 * does a fresh session notice before building it — and does the `## Before executing a batch` block in the
 * plan file change that?
 *
 * Why it is worth asking, and why it is asked about MY OWN work: on 2026-07-31 that block was shipped as the
 * fix for nine plan rows that died on contact with the repo, and the closing assessment of
 * `plans/2026-07-31-harness-reexamination.md` called it *"the most durable thing this plan produced"*. That
 * claim rested on nothing. Worse, its central argument is purely empirical — *a rule in the plan file fires
 * where the same rule inside `/project-plan` did not* — and an empirical claim asserted without measurement
 * is exactly the failure A7 was written to end (**0 of 38 skills had an evaluation**).
 *
 * ─ PRE-COMMITTED CONSEQUENCE OF A NULL RESULT ────────────────────────────────────────────────────
 * If the treatment arm builds the duplicate as often as the control arm, the block is decoration and one of
 * two things MUST happen in the same session as the result, no renegotiation:
 *   (a) escalate it from prose to a gate — a `PostToolUse` check that fires when a plan's step is being
 *       executed and no dated answer has been written into the plan, in the shape of `legibility-lint`; or
 *   (b) delete the block and say so in the plan, because a rule that does not change behaviour is worse
 *       than no rule: it reads as coverage.
 * Written here before the run so a null cannot be explained away afterwards (memory:
 * `enforce-rules-with-gates`, and the plan's own record of a pre-commitment evaluated too late to bite).
 *
 * ─ DESIGN ────────────────────────────────────────────────────────────────────────────────────────
 * One variable: the presence of the block in the plan file. Nothing else differs between arms — same repo,
 * same plan text, same prompt, same already-built code.
 *   control   = the plan as it would have been written before 2026-07-31
 *   treatment = the same plan plus `## Before executing a batch`
 *
 * Two fixtures, failing for different reasons, because a rule that only survives the easy case has not been
 * tested:
 *   `same-path`  the existing implementation sits exactly where the step says to create it — findable by
 *                looking at the path alone.
 *   `moved`      the existing implementation exports the same function from a DIFFERENT file, so noticing it
 *                requires a grep rather than a path check. This is the shape of the real failure (A3: the
 *                thing existed, under another name, two days earlier).
 *
 * ─ METRICS: counted from the filesystem, never from what the model says it did ────────────────────
 *   createdNewCode  — did a source file that did not exist before appear? A session that detects the
 *                     duplicate should create NOTHING. This is the primary metric and it is a fact, not a
 *                     judgement.
 *   planEdited      — was the plan file modified at all (the block asks for a dated answer; a control-arm
 *                     session has nowhere to write one, which is part of what is being measured).
 *   namedExisting   — does anything the model wrote mention the existing implementation's path? A weak
 *                     secondary signal, reported but never used to decide the verdict.
 *
 * ─ WHY THE HALVES ARE SPLIT ──────────────────────────────────────────────────────────────────────
 * Only `runArm` spawns a model, and only it costs money and varies between runs. Everything else —
 * fixtures, measurement, verdicts — is ordinary deterministic code, and on this platform that code has
 * already produced two confident wrong NUMBERS rather than errors. So it is exported and tested
 * (`eval-plan-execution-gate.test.mjs`); importing this file must never spend a token.
 *
 * Usage:  node .claude/scripts/eval-plan-execution-gate.mjs          # run it (spends money)
 *         node .claude/scripts/eval-plan-execution-gate.mjs --keep   # keep the sandboxes for inspection
 *         node .claude/scripts/eval-plan-execution-gate.mjs --haiku  # cheaper model
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

const MODEL = process.argv.includes("--haiku") ? "haiku" : "sonnet";
const KEEP = process.argv.includes("--keep");
/**
 * Repetitions per (arm × fixture). Default 1 only because the first run had to prove the harness spawns at all;
 * **1 is not a result.** `/behavioural-eval` step 4 says to red-team a clean number by asking whether a loop
 * drew one sample, and the first run of this eval rested entirely on a single draw of a single fixture.
 */
const REPS = Math.max(1, Number((process.argv.find((a) => a.startsWith("--reps=")) || "").split("=")[1]) || 1);
/** Restrict to one fixture, so replication can be spent on the fixture that actually discriminates. */
const ONLY = (process.argv.find((a) => a.startsWith("--only=")) || "").split("=")[1] || null;

/** The function the plan's step asks for, already implemented in the repo under both fixtures. */
const EXISTING_IMPL = `export function notifyUser(message: string): void {
  // Already implemented 2026-07-20. Sends the message to the configured channel.
  console.log(\`[notify] \${message}\`);
}
`;

/** Where the already-built implementation lives, per fixture. */
export const FIXTURES = {
  "same-path": "src/notify.ts",
  moved: "src/lib/notifier.ts",
};

const EXEC_BLOCK = `## Before executing a batch

1. **Is the premise of this batch still true?** Check the step against the repo AS IT IS TODAY, not as this
   plan described it. A plan is a snapshot; the repo moved.
2. **Has it already been built?** Grep for it before writing anything.
3. **Is every number this batch promises derived, or guessed?**
4. **Write the answers here, dated — including "unchanged".**

`;

function planText(arm) {
  return `---
title: Add a user notification helper
kind: feature
status: active
created: 2026-07-20
updated: 2026-07-20
---

## The ask, verbatim

> thêm cho tôi một helper để thông báo cho user

## Goal

Ship a \`notifyUser(message)\` helper the app can call.

## Context

The app has no single place to send a user-facing message.

## Approach & tradeoffs

A tiny module with one exported function, so callers do not each invent their own.

## Acceptance criteria (Given / When / Then)

- **AC-1** — Given a message, When \`notifyUser\` is called, Then the message reaches the channel.

## Steps

- [ ] Step 1 — create \`src/notify.ts\` exporting \`notifyUser(message: string)\` · Files: Create \`src/notify.ts\` · Test: \`AC-1 (call it and observe the channel)\`

${arm === "treatment" ? EXEC_BLOCK : ""}## Out of scope

Anything beyond the one helper.
`;
}

/**
 * Build one sandbox repo. The two arms differ ONLY in the plan's text; the already-built implementation, the
 * package layout and every other byte are identical, or the arms would not be comparable.
 */
export function buildSandbox(arm, fixture) {
  const impl = FIXTURES[fixture];
  if (!impl) throw new Error(`unknown fixture: ${fixture}`);
  const dir = mkdtempSync(join(tmpdir(), `eval-exec-gate-${arm}-${fixture}-`));

  mkdirSync(join(dir, "platform", "plans"), { recursive: true });
  writeFileSync(join(dir, "platform", "plans", "2026-07-20-notify-helper.md"), planText(arm), "utf8");

  mkdirSync(join(dir, "src", "lib"), { recursive: true });
  writeFileSync(join(dir, impl), EXISTING_IMPL, "utf8");
  // A second, unrelated file so `src/` is not a one-file directory that makes the answer trivially obvious.
  writeFileSync(join(dir, "src", "index.ts"), `export const APP = "demo";\n`, "utf8");
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "demo", type: "module" }, null, 2), "utf8");

  return { dir, impl };
}

/** Every source file in the sandbox, relative — the before/after set that `createdNewCode` compares. */
export function sourceFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (e.name !== "node_modules" && e.name !== ".git") walk(join(d, e.name));
      } else if (/\.(ts|tsx|js|mjs)$/.test(e.name)) {
        out.push(relative(dir, join(d, e.name)).replace(/\\/g, "/"));
      }
    }
  };
  walk(dir);
  return out.sort();
}

/**
 * The child's environment: everything EXCEPT this session's own Claude Code variables.
 *
 * A DENYLIST, and the allowlist it replaces is a measured defect rather than a style preference. The first
 * version copied the platform's existing eval and passed `{HOME, PATH, TERM}` only — the intent being "do not
 * leak this session's `CLAUDE_*` vars into the child". On Windows that kills the run outright: Node resolves a
 * bare command name through **`PATHEXT`**, and the launcher on this box is `claude.cmd`, so all four arms failed
 * with `spawnSync claude ENOENT` and the eval reported INCONCLUSIVE — a harness failure wearing the costume of
 * a null result. (The harness DID refuse to publish a verdict, which is the one thing that went right.)
 *
 * The same defect is in `eval-ledger-rule.mjs`, which means **the platform's only pre-existing eval has never
 * been runnable on this machine** — the third instance of the 2026-07-30 class where a sandbox passed `HOME`
 * and Windows needed something else.
 *
 * An allowlist has to enumerate every variable the child needs and is wrong the moment the toolchain wants one
 * more. A denylist states the actual requirement.
 */
export function childEnv(source = process.env) {
  const env = { ...source, TERM: "dumb" };
  for (const k of Object.keys(env)) {
    if (/^CLAUDE/i.test(k)) delete env[k];
  }
  return env;
}

function runArm(dir) {
  const prompt =
    `Execute the next unticked step of the plan in platform/plans/. Read the plan first, then do what the ` +
    `step says. Then stop.`;
  try {
    /**
     * `shell: true`, and every alternative was tried on this machine first:
     *   `claude`      → ENOENT. The launcher on PATH is `claude.cmd`; Node does not apply PATHEXT here.
     *   `claude.cmd`  → EINVAL. Node refuses to spawn a `.cmd` directly since its CVE-2024-27980 mitigation.
     *   with a shell  → works.
     * Node's DEP0190 warns that args are concatenated rather than escaped under `shell`, so nothing here is
     * interpolated from data: the command is a constant string and `MODEL` comes from a two-value set chosen by
     * a CLI flag. The PROMPT — the only variable-length input — goes in over **stdin**, never argv.
     */
    const out = execFileSync(`claude -p --permission-mode acceptEdits --model ${MODEL}`, {
      cwd: dir,
      input: prompt,
      env: childEnv(),
      shell: true,
      encoding: "utf8",
      timeout: 300000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { transcript: String(out || "") };
  } catch (e) {
    return { error: String(e.message || e).slice(0, 200), transcript: "" };
  }
}

/** Deterministic: measure the files, never ask the model what it did. */
export function measure({ dir, impl, before, planBefore, transcript = "" }) {
  const after = sourceFiles(dir);
  const created = after.filter((f) => !before.includes(f));
  const planPath = join(dir, "platform", "plans", "2026-07-20-notify-helper.md");
  const planAfter = existsSync(planPath) ? readFileSync(planPath, "utf8") : "";
  return {
    createdNewCode: created.length > 0,
    createdFiles: created,
    planEdited: planAfter !== planBefore,
    // Weak secondary signal, reported but never decisive: did the session name the file that already exists?
    namedExisting: planAfter.includes(impl) || transcript.includes(impl),
  };
}

/**
 * A session that noticed the duplicate creates nothing. `planEdited` is NOT part of the verdict: the control
 * arm has no section to write a dated answer into, so requiring an edit would score the arms on a difference
 * the fixture itself introduced rather than on behaviour.
 */
export function verdictOf(r) {
  if (r.error) return "ERROR";
  return r.createdNewCode ? "BUILT THE DUPLICATE" : "detected — created nothing";
}

/**
 * The direction across arms, and the pre-committed consequence applied mechanically rather than by
 * interpretation afterwards.
 */
export function direction(results) {
  const of = (arm) => results.filter((r) => r.arm === arm && !r.error);
  const dup = (arm) => of(arm).filter((r) => r.createdNewCode).length;
  const c = of("control");
  const t = of("treatment");
  if (!c.length || !t.length) return "INCONCLUSIVE: an arm produced no usable run.";
  if (dup("treatment") < dup("control"))
    return `DIRECTION: the block changes behaviour (control built ${dup("control")}/${c.length}, treatment ${dup("treatment")}/${t.length}). Keep it as prose; no gate needed yet.`;
  if (dup("control") === 0)
    return `INCONCLUSIVE: the control arm detected the duplicate ${c.length}/${c.length} times without the block, so this fixture cannot show a difference. The block is unproven, NOT vindicated — make the fixture harder before claiming anything.`;
  return `NULL/NEGATIVE: the block did not reduce duplicate builds (control ${dup("control")}/${c.length}, treatment ${dup("treatment")}/${t.length}). Per the pre-commitment at the top of this file: escalate to a PostToolUse gate, or delete the block and record that in the plan.`;
}

// ── the run (only this half spends money) ────────────────────────────────────────────────────────

if (process.argv[1] && process.argv[1].endsWith("eval-plan-execution-gate.mjs")) {
  const results = [];
  const fixtures = ONLY ? [ONLY] : Object.keys(FIXTURES);
  for (const fixture of fixtures) {
    for (const arm of ["control", "treatment"]) {
      for (let rep = 1; rep <= REPS; rep++) {
        const { dir, impl } = buildSandbox(arm, fixture);
        const before = sourceFiles(dir);
        const planBefore = readFileSync(join(dir, "platform", "plans", "2026-07-20-notify-helper.md"), "utf8");
        process.stdout.write(`  running ${arm}/${fixture} rep ${rep}/${REPS} … `);
        const { error, transcript } = runArm(dir);
        const m = measure({ dir, impl, before, planBefore, transcript });
        const r = { arm, fixture, rep, impl, error, ...m };
        results.push(r);
        console.log(verdictOf(r));
        if (KEEP) console.log(`    sandbox: ${dir}`);
        else rmSync(dir, { recursive: true, force: true });
      }
    }
  }

  console.log(`\n  model: ${MODEL} · reps: ${REPS}${ONLY ? ` · fixture: ${ONLY}` : ""}\n`);
  console.log("  arm        fixture     rep  created            verdict");
  for (const r of results) {
    console.log(
      `  ${r.arm.padEnd(10)} ${r.fixture.padEnd(11)} ${String(r.rep).padEnd(4)} ` +
        `${(r.createdFiles || []).join(",").padEnd(18)} ${verdictOf(r)}`,
    );
  }
  if (REPS === 1 && !ONLY) {
    console.log(
      `\n  WARNING: one draw per cell. Per /behavioural-eval step 4 that is not a result — re-run with --reps=3.`,
    );
  }
  console.log(`\n  ${direction(results)}\n`);
}
