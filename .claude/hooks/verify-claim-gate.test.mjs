// Test for verify-claim-gate.mjs — the first BLOCKING hook on this platform.
// Run: node .claude/hooks/verify-claim-gate.test.mjs
//
// WHY THIS EXISTS. A blocking Stop hook is the highest-blast-radius thing in `.claude/`: a false block does not
// produce a wrong answer, it produces a session that will not end, and the operator's only recourse is to
// bypass the gate — after which the gate is decorative forever. So the cases here are weighted toward the
// SILENT path. Four of the five gates are tested by proving the hook stays quiet when they fail.
//
// The mutation cases are the point: each removes one gate and proves the suite notices. A gate that nothing
// asserts is a gate that will be deleted by the next person who finds it inconvenient.
//
// Per platform/standards/testing.md §2.7: a silent path, acting paths asserted BY EXIT CODE and MESSAGE,
// killed mutants each proved to still RUN, and no mutation of the real repo.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync, copyFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const HOOK = join(HERE, "verify-claim-gate.mjs");
const RAW = readFileSync(HOOK, "utf8");
// LF-normalized for MUTATION only — every patch below is a single-line string today, so nothing here is broken
// yet. It is normalized anyway because the failure is invisible until someone adds a multi-line patch, and then
// it presents as "the patch matched nothing" rather than as an encoding problem. That trap has now cost this
// repo twice (the 2026-07-30 batch, and `tree-moved-notice.test.mjs` an hour ago); `plan-audit.test.mjs` and
// `secret-guard.test.mjs` already normalize, so this makes the convention uniform instead of two-out-of-three.
const SOURCE = RAW.replace(/\r\n/g, "\n");

const lab = mkdtempSync(join(tmpdir(), "verify-claim-gate-"));
let pass = 0;
const fails = [];
let seq = 0;
const gitBefore = execFileSync("git", ["status", "--porcelain"], { cwd: REPO, encoding: "utf8" });

/* ── transcript builders — the shapes the harness actually writes ─────────────────────────────── */

const userLine = (text = "do the thing") =>
  JSON.stringify({ type: "user", message: { role: "user", content: [{ type: "text", text }] } });

const assistantText = (text) =>
  JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text }] } });

const assistantTool = (name, input = {}) =>
  JSON.stringify({
    type: "assistant",
    message: { role: "assistant", content: [{ type: "tool_use", name, input }] },
  });

const edit = (file = "src/a.ts") => assistantTool("Edit", { file_path: file });
const bash = (cmd = "npm test") => assistantTool("Bash", { command: cmd });

function transcript(lines) {
  const p = join(lab, `t-${process.pid}-${seq++}.jsonl`);
  writeFileSync(p, lines.join("\n") + "\n");
  return p;
}

/** Run a hook against a transcript; return its exit code and combined output. */
function fire(hookPath, transcriptPath, { stopActive } = {}) {
  const payload = JSON.stringify({
    session_id: `vcg-${process.pid}-${seq}`,
    transcript_path: transcriptPath,
    ...(stopActive === undefined ? {} : { stop_hook_active: stopActive }),
  });
  try {
    const out = execFileSync(process.execPath, [hookPath], {
      input: payload,
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf8",
      env: { ...process.env, HOOK_USAGE_LOG: "off" },
    });
    return { code: 0, out: out || "" };
  } catch (err) {
    return { code: err.status ?? -1, out: (err.stderr || "") + (err.stdout || "") };
  }
}

/** A copy of the hook with one mutation applied, living OUTSIDE the repo. */
function mutantHook(patched) {
  const dir = mkdtempSync(join(lab, "mutant-"));
  copyFileSync(join(HERE, "_util.mjs"), join(dir, "_util.mjs"));
  const p = join(dir, "verify-claim-gate.mjs");
  writeFileSync(p, patched);
  return p;
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

/* ═══════════════════ 1. the ACTING path — all five gates hold ═══════════════════ */

const BLOCKING = [userLine(), edit(), assistantText("Done — the refactor is complete.")];

check("edited + no check + claimed done → BLOCKS with exit 2 and says why", () => {
  const r = fire(HOOK, transcript(BLOCKING));
  assert.equal(r.code, 2, `must block with exit 2, got ${r.code}: ${r.out.slice(0, 200)}`);
  assert.match(r.out, /ran no check/, "the message must name what was missing");
  assert.match(r.out, /unverified/, "…and must offer the honest escape hatch, not only the work");
});

check("a Vietnamese claim blocks too — the operator's chat language is not an exemption", () => {
  const r = fire(HOOK, transcript([userLine(), edit(), assistantText("Xong rồi, em đã sửa hết.")]));
  assert.equal(r.code, 2, `a "xong" claim must block, got ${r.code}`);
});

/* ═══════════════════ 2. the SILENT paths — one gate failing must mean silence ═══════════════════ */

check("GATE 5 — a check WAS run → silent (this is the common case, it must never nag)", () => {
  const r = fire(HOOK, transcript([userLine(), edit(), bash(), assistantText("Done — all tests pass.")]));
  assert.equal(r.code, 0, `a turn that ran a check must pass silently, got ${r.code}: ${r.out.slice(0, 200)}`);
  assert.equal(r.out.trim(), "", "and must print nothing at all");
});

check("GATE 4 — a chat turn that merely says 'done' → silent (no edits, no claim about work)", () => {
  const r = fire(HOOK, transcript([userLine(), assistantText("Done — that's the whole answer to your question.")]));
  assert.equal(r.code, 0, `a turn with no edits must never block, got ${r.code}`);
});

check("GATE 3 — an admitted-unverified claim → silent, because that is the behaviour we want", () => {
  const r = fire(
    HOOK,
    transcript([userLine(), edit(), assistantText("Done, but unverified — I have not run the suite.")]),
  );
  assert.equal(r.code, 0, `an honestly hedged claim must pass, got ${r.code}: ${r.out.slice(0, 200)}`);
});

check("GATE 3 (vi) — 'chưa xác minh' is the same hedge in the operator's language", () => {
  const r = fire(HOOK, transcript([userLine(), edit(), assistantText("Đã sửa xong, nhưng chưa xác minh.")]));
  assert.equal(r.code, 0, `a Vietnamese hedge must pass, got ${r.code}`);
});

check("GATE 2 — edits with no completion claim → silent (reporting progress is not claiming done)", () => {
  const r = fire(
    HOOK,
    transcript([userLine(), edit(), assistantText("I changed the parser; next I need to look at the caller.")]),
  );
  assert.equal(r.code, 0, `no claim means nothing to gate, got ${r.code}: ${r.out.slice(0, 200)}`);
});

check("GATE 1 — stop_hook_active → silent, or the hook can wedge the session forever", () => {
  const r = fire(HOOK, transcript(BLOCKING), { stopActive: true });
  assert.equal(r.code, 0, `must never fire inside a continuation loop, got ${r.code}`);
});

check("only the CURRENT turn counts — a check in a previous turn does not excuse this one", () => {
  const r = fire(
    HOOK,
    transcript([
      userLine("first task"),
      edit(),
      bash(), // evidence, but in the PREVIOUS turn
      assistantText("Done."),
      userLine("second task"),
      edit(),
      assistantText("Done — finished that too."),
    ]),
  );
  assert.equal(r.code, 2, `stale evidence from an earlier turn must not count, got ${r.code}`);
});

/* ═══════════════════ 2b. THE REAL TRANSCRIPT SHAPE — a tool_result is role:"user" ═══════════════════
 * The defect this pins nearly shipped. Every case above uses clean user/assistant alternation, and all 17
 * passed while the hook treated a TOOL RESULT as a turn boundary. Measured on a real 1105-line transcript:
 * 247 entries were `user` + `tool_result` and only 19 were human messages. With the naive boundary, the Bash
 * call falls outside the window, `ranEvidence` is false, and the hook blocks a turn that did run its check.
 *
 * So the fixture below is the shape the harness ACTUALLY writes, and it must stay silent.
 */
{
  const toolResult = (text = "ok") =>
    JSON.stringify({
      type: "user",
      message: { role: "user", content: [{ type: "tool_result", content: text }] },
    });
  // A real human message in this transcript format carries a STRING content.
  const realUser = (text = "do the thing") =>
    JSON.stringify({ type: "user", message: { role: "user", content: text } });

  check("a tool_result is NOT a turn boundary — a checked turn stays silent in the real shape", () => {
    const r = fire(
      HOOK,
      transcript([
        realUser(),
        edit(),
        toolResult(), // the Edit's result — role:"user", must not end the turn
        bash(),
        toolResult("all tests pass"), // the Bash result — likewise
        assistantText("Done — all tests pass."),
      ]),
    );
    assert.equal(r.code, 0, `evidence before a tool_result must still count, got ${r.code}: ${r.out.slice(0, 250)}`);
  });

  check("…and the gate still BLOCKS in the real shape when no check was run", () => {
    const r = fire(HOOK, transcript([realUser(), edit(), toolResult(), assistantText("Done — complete.")]));
    assert.equal(r.code, 2, `an unverified claim must still block in the real shape, got ${r.code}`);
  });
}

/* ═══════════════════ 3. fail-open on malformed input — a named, deliberate tradeoff ═══════════════════ */

check("a missing transcript → silent, never a block on 'I cannot tell'", () => {
  const r = fire(HOOK, join(lab, "does-not-exist.jsonl"));
  assert.equal(r.code, 0, `an unreadable transcript must not block, got ${r.code}`);
});

check("garbage lines → silent, and no crash", () => {
  const p = join(lab, `garbage-${seq++}.jsonl`);
  writeFileSync(p, "not json\n{broken\n");
  const r = fire(HOOK, p);
  assert.equal(r.code, 0, `unparseable transcript must not block, got ${r.code}`);
});

/* ═══════════════════ 4. mutants — each proved to still RUN ═══════════════════ */

const mutants = [
  {
    name: "the evidence gate removed (the hook blocks even when a check WAS run)",
    patch: (s) => s.replace("if (ranEvidence) process.exit(0);", ""),
    transcriptLines: [userLine(), edit(), bash(), assistantText("Done — all tests pass.")],
    // With the gate gone, a turn that DID run its check gets blocked. That is the false-block failure mode.
    probe: (r) => r.code === 2,
  },
  {
    name: "the edit gate removed (a pure chat turn saying 'done' gets blocked)",
    patch: (s) => s.replace("if (!edited) process.exit(0);", ""),
    transcriptLines: [userLine(), assistantText("Done — that answers it.")],
    probe: (r) => r.code === 2,
  },
  {
    name: "the hedge gate removed (honest reporting gets punished)",
    patch: (s) => s.replace("if (HEDGE.some((re) => re.test(text))) process.exit(0);", ""),
    transcriptLines: [userLine(), edit(), assistantText("Done, but unverified — I have not run the suite.")],
    probe: (r) => r.code === 2,
  },
  {
    name: "the continuation guard removed (the hook can wedge the session)",
    patch: (s) => s.replace("if (payload.stop_hook_active === true) process.exit(0);", ""),
    transcriptLines: [userLine(), edit(), assistantText("Done — the refactor is complete.")],
    probe: (r) => r.code === 2, // fires even with stop_hook_active set
    stopActive: true,
  },
  {
    name: "tool_result treated as a turn boundary again (the false-block machine that nearly shipped)",
    patch: (s) => s.replace("if (Array.isArray(content)) return !content.some((b) => b?.type === 'tool_result');", ""),
    // Order matters: the evidence must come BEFORE the tool_result and the edit AFTER it. Then removing the
    // guard moves the boundary so that the window keeps the edit and loses the Bash — which is precisely the
    // production shape (a check, its result, a follow-up edit, a claim).
    transcriptLines: [
      JSON.stringify({ type: "user", message: { role: "user", content: [{ type: "text", text: "go" }] } }),
      bash(),
      JSON.stringify({
        type: "user",
        message: { role: "user", content: [{ type: "tool_result", content: "all tests pass" }] },
      }),
      edit(),
      assistantText("Done — all tests pass."),
    ],
    // With the guard gone the tool_result ends the turn, the Bash falls outside it, and a turn that DID run
    // its check gets blocked. That is the production failure the real transcript exposed.
    probe: (r) => r.code === 2,
  },
  {
    name: "the turn window widened to the whole transcript (stale evidence excuses a new claim)",
    patch: (s) => s.replace("const turn = objs.slice(start + 1);", "const turn = objs;"),
    transcriptLines: [
      userLine("first"),
      edit(),
      bash(),
      assistantText("Done."),
      userLine("second"),
      edit(),
      assistantText("Done — finished that too."),
    ],
    // With the window widened, the old Bash counts and the new unverified claim slips through.
    probe: (r) => r.code === 0,
  },
];

for (const m of mutants) {
  check(`mutant killed — ${m.name}`, () => {
    const patched = m.patch(SOURCE);
    assert.notEqual(patched, SOURCE, "the patch matched nothing — it would prove nothing (§2.7)");

    const hookPath = mutantHook(patched);
    const tp = transcript(m.transcriptLines);

    // SANITY — a mutant that only crashes proves the suite notices a broken file and nothing else.
    const rBad = fire(hookPath, tp, m.stopActive === undefined ? {} : { stopActive: m.stopActive });
    assert.ok(rBad.code === 0 || rBad.code === 2, `mutant crashed instead of running (exit ${rBad.code}): ${rBad.out.slice(0, 200)}`);

    assert.ok(m.probe(rBad), "the mutant survived — the suite does not actually assert this gate");

    // …and the unmutated hook must NOT show the same symptom, or the probe proves nothing.
    const rGood = fire(HOOK, tp, m.stopActive === undefined ? {} : { stopActive: m.stopActive });
    assert.ok(!m.probe(rGood), "the real hook shows the same symptom — the probe is not specific");
  });
}

/* ═══════════════════ 5. no repo mutation ═══════════════════ */

check("the suite did not mutate the hook it reads", () => {
  assert.equal(readFileSync(HOOK, "utf8"), RAW, "verify-claim-gate.mjs changed on disk during this run");
  assert.ok(!lab.startsWith(REPO), "the lab must live outside the repo");
});

rmSync(lab, { recursive: true, force: true });

// Unrelated tree movement is worth SEEING but is not this suite's failure (the lesson from
// sprawl-check.test.mjs, 2026-07-31: a whole-repo git-status equality check measures the environment).
{
  const after = execFileSync("git", ["status", "--porcelain"], { cwd: REPO, encoding: "utf8" });
  if (after !== gitBefore) console.log("  note the working tree moved while this suite ran — not a failure of this suite.");
}

console.log(
  `\nverify-claim-gate.test.mjs — ${pass} passed, ${fails.length} failed ` +
    `(${mutants.length} mutants, each proved to still run)`,
);
if (fails.length) {
  for (const f of fails) console.log(`  ✗ ${f}`);
  process.exit(1);
}
