// Test for _util.mjs — the module nearly every hook imports.
// Run: node .claude/hooks/_util.test.mjs
//
// WHY THIS EXISTS. `tool-check` skips `_`-prefixed files as "libraries, covered through their callers", which
// is true only for callers that have tests. Eleven hooks import this one, and two things in it are load-bearing
// in a way no single hook's suite can prove:
//
//   readPayload()  — the ONLY way a hook learns what it is guarding. If it ever threw instead of returning {},
//                    every PreToolUse hook would fail on a malformed payload, and a hook that crashes is a hook
//                    that either blocks everything or nothing depending on how the harness reads its exit code.
//   recordRun()    — the whole hook-usage measurement. A hook is not a tool call, so nothing in a transcript
//                    can see it run; this counter is the only evidence that a guard fires at all. If it
//                    double-counts, `fired`/`ran` are inflated and a guard looks busier than it is. If it
//                    stops recording, every hook reads as dead — and "dead" is what gets things retired.
//
// The safety property asserted throughout: **bookkeeping must never change a hook's outcome.** An unwritable
// log, a full log, a missing directory — none of them may alter the exit code, because the exit code is the
// guard's whole contract with the harness (stdout + stderr + exit code, nothing else).
//
// Per platform/standards/testing.md §2.5 the suite also MUTATES the module and asserts it notices.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
  chmodSync,
} from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { getWriteText } from "./_util.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const MODULE = join(HERE, "_util.mjs");

const lab = mkdtempSync(join(tmpdir(), "util-hook-"));

/**
 * A throwaway hook that imports the module under test and reports what it saw. Written per case so the driver
 * can exercise a different code path each time; `util` is the module (real or mutated) to import.
 */
function driver(body, { util = readFileSync(MODULE, "utf8"), name = "fixture-hook.mjs" } = {}) {
  const dir = mkdtempSync(join(lab, "run-"));
  writeFileSync(join(dir, "_util.mjs"), util);
  const hook = join(dir, name);
  writeFileSync(hook, body);
  return { dir, hook };
}

/**
 * `cwd` is the hook's own sandbox directory, and that is not cosmetic. One mutant here REMOVES the
 * `HOOK_USAGE_LOG=off` check; the mutated code then treats the literal string "off" as a log PATH and writes
 * it relative to cwd. With cwd left at the repo root that produced a stray `off` file in the repo — a
 * mutation test leaking into the tree it was supposed to leave untouched (found 2026-07-30, 2250 bytes of
 * hook log). Any test that runs deliberately-broken code must give it a cwd it is allowed to dirty.
 */
function fire(hook, { input = "", env = {} } = {}) {
  const r = spawnSync(process.execPath, [hook], {
    input,
    encoding: "utf8",
    timeout: 30_000,
    cwd: dirname(hook),
    env: { ...process.env, ...env },
  });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

const logLines = (p) =>
  existsSync(p)
    ? readFileSync(p, "utf8")
        .split("\n")
        .filter((l) => l.trim())
        .map((l) => JSON.parse(l))
    : [];

/* ═══════════════════ 1. getWriteText — the text a guard actually inspects ═══════════════════
 * Tested by direct import: it is pure. Every write-shaped tool_input has a different field, and a guard that
 * reads the wrong one inspects an empty string and passes everything.
 */
{
  assert.equal(getWriteText({ content: "written" }), "written", "Write uses `content`");
  assert.equal(getWriteText({ new_string: "edited" }), "edited", "Edit uses `new_string`");
  assert.equal(
    getWriteText({ edits: [{ new_string: "a" }, { new_string: "b" }] }),
    "a\nb",
    "MultiEdit's edits are joined, so a secret in the SECOND edit is still seen",
  );
  assert.equal(getWriteText({ edits: [{}, { new_string: "b" }] }), "\nb", "a malformed edit must not throw");
  assert.equal(getWriteText({}), "", "an unrecognised shape yields an empty string, never undefined");
  assert.equal(getWriteText(), "", "…and no argument at all is safe");
  assert.equal(
    getWriteText({ content: "x", new_string: "y" }),
    "x",
    "content wins when both are present — pinned so the precedence cannot drift silently",
  );
}

/* ═══════════════════ 2. readPayload — it must NEVER throw, whatever arrives on stdin ═══════════ */
{
  const body = `
import { readPayload } from './_util.mjs';
const p = await readPayload();
process.stdout.write(JSON.stringify({ ok: true, tool: p?.tool_name ?? null, keys: Object.keys(p).length }));
process.exit(0);
`;
  const { hook } = driver(body);
  const off = { HOOK_USAGE_LOG: "off" };

  const good = fire(hook, { input: JSON.stringify({ tool_name: "Write", tool_input: {} }), env: off });
  assert.equal(good.code, 0);
  assert.deepEqual(JSON.parse(good.out), { ok: true, tool: "Write", keys: 2 }, good.out);

  const empty = fire(hook, { input: "", env: off });
  assert.deepEqual(JSON.parse(empty.out), { ok: true, tool: null, keys: 0 }, "empty stdin ⇒ {}");

  const malformed = fire(hook, { input: "{ not json at all", env: off });
  assert.deepEqual(
    JSON.parse(malformed.out),
    { ok: true, tool: null, keys: 0 },
    "malformed JSON ⇒ {}, never an exception. A hook that throws here fails on every write.",
  );

  const notObject = fire(hook, { input: "42", env: off });
  assert.equal(JSON.parse(notObject.out).ok, true, "a non-object payload must not throw either");
}

/* ═══════════════════ 3. recordRun — one line per run, with the exit code as the finding ═══════ */
{
  const body = `
import { readPayload } from './_util.mjs';
await readPayload();
process.exit(Number(process.env.EXIT_WITH || 0));
`;
  const { dir, hook } = driver(body, { name: "counted-hook.mjs" });
  const log = join(dir, "usage.jsonl");

  fire(hook, { input: "{}", env: { HOOK_USAGE_LOG: log } });
  let lines = logLines(log);
  assert.equal(lines.length, 1, "exactly one line per run");
  assert.equal(lines[0].hook, "counted-hook.mjs", "keyed by the hook's own filename, not the module's");
  assert.equal(lines[0].code, 0, "a silent pass is recorded as code 0");
  assert.ok(typeof lines[0].ts === "string" && !Number.isNaN(Date.parse(lines[0].ts)), "an ISO timestamp");
  assert.equal(typeof lines[0].ms, "number", "and a duration");

  fire(hook, { input: "{}", env: { HOOK_USAGE_LOG: log, EXIT_WITH: "2" } });
  lines = logLines(log);
  assert.equal(lines.length, 2, "a second run appends");
  assert.equal(
    lines[1].code,
    2,
    "exit 2 is THE finding — `ran` without `fired` over weeks is the signature of a guard that costs time " +
      "and catches nothing, and that distinction is only visible if the code is recorded honestly",
  );

  /**
   * A CLOSED set, deliberately: no file path, no tool input, no source line. `spoke` was added 2026-08-01 and
   * had to be argued into this list rather than appear in it — which is what this assertion is for, and it did
   * its job by failing the moment the field shipped.
   *
   * Why `spoke` is admissible where a path or an input would not be: it is a single boolean derived from a BYTE
   * COUNT (`process.stdout.bytesWritten`), so it cannot carry content even in principle. The implementation is
   * read-only for the same reason — an earlier version wrapped `process.stdout.write`, which could have seen
   * every line a hook emits, and the permission layer refused it twice. Anything that can see content does not
   * belong in a file this small and this permanent.
   */
  assert.deepEqual(
    Object.keys(lines[0]).sort(),
    ["code", "hook", "ms", "spoke", "ts"],
    "the log records the minimum that answers the question — anything more is a privacy problem in a local file",
  );
  assert.equal(
    typeof lines[0].spoke,
    "boolean",
    "`spoke` must be a BOOLEAN — a string or a number here would be a channel for content, which is the whole " +
      "thing this closed field set exists to prevent",
  );
}

/* ═══════ 3a. `spoke` — the question the exit code cannot answer ═══════════════════════════════════
 *
 * Measured 2026-08-01 over 2,874 real events: 7 of the 15 installed hooks have NO `process.exit(2)` path, so
 * for them `exit 0` means both "looked and spoke" and "looked and said nothing", and `fired` is 0 by
 * construction forever. This is what makes those seven judgeable at all. Both branches are asserted with the
 * SAME hook, because a difference across two different hooks could be an artefact of the hooks. */
{
  const body = `
import { readPayload } from './_util.mjs';
await readPayload();
if (process.env.SAY) process.stdout.write(JSON.stringify({ hookSpecificOutput: { additionalContext: 'x' } }));
process.exit(0);
`;
  const { dir, hook } = driver(body, { name: "talkative-hook.mjs" });
  const log = join(dir, "usage.jsonl");

  fire(hook, { input: "{}", env: { HOOK_USAGE_LOG: log } });
  fire(hook, { input: "{}", env: { HOOK_USAGE_LOG: log, SAY: "1" } });
  const lines = logLines(log);

  assert.equal(lines[0].code, 0, "the silent run exits 0…");
  assert.equal(lines[0].spoke, false, "…and is recorded as having said nothing");
  assert.equal(lines[1].code, 0, "the speaking run ALSO exits 0 — which is exactly why `code` cannot answer it…");
  assert.equal(lines[1].spoke, true, "…and `spoke` distinguishes them");
}

/* ─────────── 3b. idempotent: recordRun called twice must not double-count ── */
{
  const body = `
import { readPayload, recordRun } from './_util.mjs';
await readPayload();
recordRun();
recordRun();
process.exit(0);
`;
  const { dir, hook } = driver(body, { name: "double-hook.mjs" });
  const log = join(dir, "usage.jsonl");
  fire(hook, { input: "{}", env: { HOOK_USAGE_LOG: log } });
  assert.equal(
    logLines(log).length,
    1,
    "a hook that calls recordRun directly AND via readPayload must still count once — otherwise the SessionStart " +
      "hooks that do exactly that would report double",
  );
}

/* ─────────── 3c. a SessionStart hook that reads no stdin still counts itself ── */
{
  const body = `
import { recordRun } from './_util.mjs';
recordRun();
process.exit(0);
`;
  const { dir, hook } = driver(body, { name: "session-start-hook.mjs" });
  const log = join(dir, "usage.jsonl");
  fire(hook, { env: { HOOK_USAGE_LOG: log } });
  assert.equal(logLines(log).length, 1, "recordRun() must work without readPayload — four hooks rely on this");
}

/* ═══════════════════ 4. the off switch, and every spelling of it ═══════════════════
 * Every test suite on this platform sets this; without it a single `tool-check` run injected ~130 phantom
 * firings into the counter, which is measurement noise the retirement mechanism would then read as evidence.
 */
{
  const body = `
import { readPayload } from './_util.mjs';
await readPayload();
process.exit(0);
`;
  for (const value of ["off", "OFF", "0", "false", "no", " off "]) {
    const { dir, hook } = driver(body, { name: "off-hook.mjs" });
    const stray = join(dir, "usage.jsonl");
    fire(hook, { input: "{}", env: { HOOK_USAGE_LOG: value } });
    assert.equal(logLines(stray).length, 0, `HOOK_USAGE_LOG=${JSON.stringify(value)} must disable recording`);
    assert.ok(!existsSync(join(dir, value.trim())), `…and must not create a file literally named ${value.trim()}`);
  }

  // An explicit path is honoured even if it does not exist yet — the directory is created.
  const { dir, hook } = driver(body, { name: "nested-hook.mjs" });
  const nested = join(dir, "a", "b", "usage.jsonl");
  fire(hook, { input: "{}", env: { HOOK_USAGE_LOG: nested } });
  assert.equal(logLines(nested).length, 1, "a log path in a missing directory must be created, not skipped");
}

/* ═══════════════════ 5. the cap: stop growing rather than rotate ═══════════════════ */
{
  const body = `
import { readPayload } from './_util.mjs';
await readPayload();
process.exit(0);
`;
  const { dir, hook } = driver(body, { name: "capped-hook.mjs" });
  const log = join(dir, "usage.jsonl");
  // Just over 4MB of valid-but-irrelevant lines.
  writeFileSync(log, `${'{"ts":"2026-01-01T00:00:00.000Z","hook":"old.mjs","code":0,"ms":1}'.padEnd(64, " ")}\n`.repeat(70_000));
  const sizeBefore = readFileSync(log, "utf8").length;
  const r = fire(hook, { input: "{}", env: { HOOK_USAGE_LOG: log } });
  assert.equal(r.code, 0, "the hook must still succeed");
  assert.equal(
    readFileSync(log, "utf8").length,
    sizeBefore,
    "past the cap it must stop appending — this is a counter, not an audit trail, and unbounded growth in a " +
      "file every hook writes to is a slow way to break every hook at once",
  );
}

/* ═══════════════════ 6. bookkeeping must NEVER change a hook's outcome ═══════════════════ */
{
  const body = `
import { readPayload } from './_util.mjs';
await readPayload();
process.stdout.write("guard ran");
process.exit(2);
`;
  // An unwritable log location: a directory where a file should be.
  const { dir, hook } = driver(body, { name: "unwritable-hook.mjs" });
  const asDir = join(dir, "usage.jsonl");
  mkdirSync(asDir, { recursive: true });
  const r = fire(hook, { input: "{}", env: { HOOK_USAGE_LOG: asDir } });
  assert.equal(r.code, 2, "a failed log write must not change the exit code — the exit code IS the guard");
  assert.match(r.out, /guard ran/, "…and must not swallow the guard's own output");

  // A read-only directory: mkdir/append both fail.
  const ro = mkdtempSync(join(lab, "readonly-"));
  const { hook: hook2 } = driver(body, { name: "ro-hook.mjs" });
  chmodSync(ro, 0o500);
  const r2 = fire(hook2, { input: "{}", env: { HOOK_USAGE_LOG: join(ro, "sub", "usage.jsonl") } });
  chmodSync(ro, 0o700);
  assert.equal(r2.code, 2, "an unwritable directory must not change the exit code either");
}

/* ═══════════════════ 7. the suite must NOTICE a broken counter (mutation) ═══════════════════ */
{
  // LF-normalized: on a CRLF working tree (Windows, core.autocrlf) every multi-line mutation patch below
  // would match nothing, and a stale patch reports itself as a broken test rather than as a platform gap.
  const src = readFileSync(MODULE, "utf8").replace(/\r\n/g, "\n");
  const payloadBody = `
import { readPayload, recordRun } from './_util.mjs';
const p = await readPayload();
recordRun();
process.stdout.write(JSON.stringify({ keys: Object.keys(p).length }));
process.exit(Number(process.env.EXIT_WITH || 0));
`;

  const mutants = [
    {
      name: "the idempotence flag removed (every direct recordRun double-counts)",
      apply: (s) => s.replace("if (recording) return;", ""),
      probe: ({ hook, log }) => {
        fire(hook, { input: "{}", env: { HOOK_USAGE_LOG: log } });
        return logLines(log).length > 1;
      },
    },
    {
      name: "the cap check removed (the counter grows without bound)",
      apply: (s) => s.replace("if (size > USAGE_CAP_BYTES) return;", ""),
      probe: ({ hook, log }) => {
        writeFileSync(log, `${'{"ts":"2026-01-01T00:00:00.000Z","hook":"old.mjs","code":0,"ms":1}'.padEnd(64, " ")}\n`.repeat(70_000));
        const before = readFileSync(log, "utf8").length;
        fire(hook, { input: "{}", env: { HOOK_USAGE_LOG: log } });
        return readFileSync(log, "utf8").length > before;
      },
    },
    {
      name: "the off switch ignored (test suites pollute the measurement)",
      apply: (s) => s.replace("return /^(0|off|false|no)$/i.test(override.trim()) ? null : override;", "return override;"),
      probe: ({ dir, hook }) => {
        fire(hook, { input: "{}", env: { HOOK_USAGE_LOG: "off" } });
        return existsSync(join(dir, "off")) || existsSync("off");
      },
    },
    {
      name: "the exit code no longer recorded (ran and fired become indistinguishable)",
      apply: (s) => s.replace("process.on('exit', (code) => {", "process.on('exit', () => { const code = 0;"),
      probe: ({ hook, log }) => {
        fire(hook, { input: "{}", env: { HOOK_USAGE_LOG: log, EXIT_WITH: "2" } });
        return logLines(log)[0]?.code !== 2;
      },
    },
    {
      name: "readPayload throws on malformed input (every hook fails on a bad payload)",
      apply: (s) => s.replace("return raw ? JSON.parse(raw) : {};\n  } catch {\n    return {};", "return raw ? JSON.parse(raw) : {};\n  } catch (e) {\n    throw e;"),
      probe: ({ hook, log }) => fire(hook, { input: "{ bad", env: { HOOK_USAGE_LOG: log } }).code !== 0,
    },
    {
      // `spoke` pinned to false: the seven hooks that cannot exit 2 become unjudgeable again, and — worse —
      // the column would read as a MEASURED "never said a word" rather than as no data, because the key is
      // present. A silent regression that looks like evidence.
      name: "`spoke` always false (the seven advisory hooks become unjudgeable, and it looks measured)",
      apply: (s) =>
        s.replace(
          "const spoke = (process.stdout.bytesWritten || 0) + (process.stderr.bytesWritten || 0) > 0;",
          "const spoke = false;",
        ),
      // Observable only because `payloadBody` above writes to stdout unconditionally, so the unmutated module
      // records `spoke: true` here. Without that this would be an EQUIVALENT mutant — false both ways — and
      // would report itself killed while proving nothing.
      probe: ({ hook, log }) => {
        fire(hook, { input: "{}", env: { HOOK_USAGE_LOG: log } });
        return logLines(log)[0]?.spoke === false;
      },
    },
    {
      name: "recordRun stops recording entirely (every hook reads as dead)",
      apply: (s) => s.replace("export function recordRun() {", "export function recordRun() {\n  return;"),
      probe: ({ hook, log }) => {
        fire(hook, { input: "{}", env: { HOOK_USAGE_LOG: log } });
        return logLines(log).length === 0;
      },
    },
  ];

  for (const m of mutants) {
    const mutated = m.apply(src);
    assert.notEqual(mutated, src, `mutation "${m.name}" changed nothing — the patch is stale`);
    const { dir, hook } = driver(payloadBody, { util: mutated, name: "mutant-hook.mjs" });
    const killed = m.probe({ dir, hook, log: join(dir, "usage.jsonl") });
    assert.ok(killed, `SURVIVING MUTANT — "${m.name}" and the suite still passed. Add a case for it.`);
  }
}

/* ─────────── nothing may have been written to the real counter or the real repo ── */
{
  const dirty = spawnSync("git", ["status", "--porcelain"], { cwd: REPO, encoding: "utf8" }).stdout;
  assert.ok(!/hooks\/(fixture|counted|off|capped|mutant)/.test(dirty), `fixtures leaked into the repo:\n${dirty}`);
}

rmSync(lab, { recursive: true, force: true });
console.log(
  "_util.test.mjs — getWriteText across all three write shapes, readPayload never throwing on any stdin, one " +
    "log line per run with the exit code AND `spoke` as findings (both branches on ONE hook, field set still " +
    "CLOSED and `spoke` proven to be a boolean), idempotence, the stdin-less path, 6 spellings of the off " +
    "switch, the 4MB cap, and an unwritable log leaving the exit code untouched; 7 mutants all killed  ✅",
);
