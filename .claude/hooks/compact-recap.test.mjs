// Test for compact-recap.mjs — the only hook that speaks AFTER a context compaction.
// Run: node .claude/hooks/compact-recap.test.mjs
//
// WHY THIS EXISTS. Every other SessionStart hook on this platform deliberately returns on `source: compact`.
// This one is the inverse, and both halves of that inversion can fail silently:
//
//   fires when it should not  → a fifth startup banner on every ordinary session, which is how a useful
//                               reminder becomes noise the reader learns to skip.
//   silent when it should not → the one moment the model's recollection was just deleted passes with nothing
//                               said, which is the exact failure the hook was built for.
//
// The dangerous direction is the second, and it is invisible: a hook that exits 0 with no output looks
// identical to a hook that correctly stood down. So the acting path is asserted BY MESSAGE, never by exit code.
//
// Per platform/standards/testing.md §2.7: a silent path, the acting paths asserted by message, killed mutants
// each proved to still RUN, and no mutation of the real repo.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const HOOK = join(HERE, "compact-recap.mjs");
const SOURCE = readFileSync(HOOK, "utf8");
const UTIL = readFileSync(join(HERE, "_util.mjs"), "utf8");

const lab = mkdtempSync(join(tmpdir(), "compact-recap-"));
let pass = 0;
const fails = [];

const gitBefore = spawnSync("git", ["status", "--porcelain"], { cwd: REPO, encoding: "utf8" }).stdout;

/**
 * A throwaway repo with real git history. The hook derives REPO as two levels up from its own file, so the copy
 * has to live at `<tmp>/.claude/hooks/` for the fixture to BE the repo it inspects — first row of §2.7's table.
 * Real `git init` rather than a stub, because every fact the hook reports comes out of git and a stubbed git
 * would let the suite pass while the parsing was wrong.
 */
function sandbox({ dirty = [], plans = {}, source = SOURCE, commitFirst = true } = {}) {
  const root = mkdtempSync(join(lab, "repo-"));
  mkdirSync(join(root, ".claude", "hooks"), { recursive: true });
  mkdirSync(join(root, "platform", "plans"), { recursive: true });
  writeFileSync(join(root, ".claude", "hooks", "_util.mjs"), UTIL);
  writeFileSync(join(root, ".claude", "hooks", "compact-recap.mjs"), source);

  const git = (...a) => spawnSync("git", a, { cwd: root, encoding: "utf8" });
  git("init", "-b", "main");
  git("config", "user.email", "t@t.t");
  git("config", "user.name", "t");
  writeFileSync(join(root, "README.md"), "seed\n");
  if (commitFirst) {
    git("add", "-A");
    git("commit", "-m", "seed");
  }
  for (const [name, body] of Object.entries(plans)) writeFileSync(join(root, "platform", "plans", name), body);
  for (const name of dirty) {
    // Parent directories are created because the dirty-file names are meaningful: one case needs the path to
    // look like a knowledge-tier file (`platform/log/...`), and a bare writeFileSync cannot create that.
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), `changed ${Date.now()}\n`);
  }
  return { root, hook: join(root, ".claude", "hooks", "compact-recap.mjs") };
}

function fire(hook, payload) {
  const r = spawnSync(process.execPath, [hook], {
    input: JSON.stringify(payload),
    encoding: "utf8",
    timeout: 30_000,
    cwd: dirname(hook),
    env: { ...process.env, HOOK_USAGE_LOG: "off" },
  });
  const raw = (r.stdout || "").trim();
  let json = null;
  if (raw) {
    try {
      json = JSON.parse(raw);
    } catch {
      json = null;
    }
  }
  return { code: r.status, raw, json, err: r.stderr || "" };
}

const ctx = (res) => res.json?.hookSpecificOutput?.additionalContext || "";

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

const ACTIVE_PLAN = "---\ntitle: something open\nstatus: active\n---\n\nbody\n";
const DONE_PLAN = "---\ntitle: finished\nstatus: done\n---\n\nbody\n";

/* ═══════════════ 1. the silent path — every ordinary session start ═══════════════ */

for (const source of ["startup", "resume", "clear", undefined]) {
  check(`silent on source=${source ?? "(absent)"} — exit 0, no output at all`, () => {
    const { hook } = sandbox({ dirty: ["a.txt"] });
    const r = fire(hook, { hook_event_name: "SessionStart", source });
    assert.equal(r.code, 0, `must never fail a session start (exit ${r.code}) ${r.err}`);
    assert.equal(r.raw, "", `must print nothing on a non-compact start, got: ${r.raw.slice(0, 120)}`);
  });
}

/* ═══════════════ 2. the acting path, asserted by MESSAGE ═══════════════ */

check("on compact it reports branch, uncommitted count and unpushed state to the model", () => {
  const { hook } = sandbox({ dirty: ["a.txt", "b.txt"] });
  const r = fire(hook, { hook_event_name: "SessionStart", source: "compact" });
  assert.equal(r.code, 0);
  assert.ok(r.json, `must emit parseable JSON, got: ${r.raw.slice(0, 200)}`);
  assert.equal(r.json.hookSpecificOutput.hookEventName, "SessionStart", "wrong event name ⇒ harness ignores it");
  assert.match(ctx(r), /branch main/, "the branch is the cheapest orienting fact");
  assert.match(ctx(r), /2 uncommitted file\(s\)/, "must count the real working tree, not guess");
  assert.match(ctx(r), /compacted/i, "must say WHY it is speaking");
});

check("warns the USER only when there is unrecorded work to lose", () => {
  const { hook } = sandbox({ dirty: ["a.txt"], plans: { "p.md": ACTIVE_PLAN } });
  const r = fire(hook, { hook_event_name: "SessionStart", source: "compact" });
  assert.match(r.json.systemMessage || "", /CHƯA ghi gì vào tầng tri thức/, "the at-risk case must reach the user");
  assert.match(r.json.systemMessage || "", /p\.md/, "and must name the plan the work belongs to");
});

check("stays out of the user's way when the knowledge tier was already touched", () => {
  const { hook } = sandbox({ dirty: ["platform/log/2026-07-31.md"] });
  const r = fire(hook, { hook_event_name: "SessionStart", source: "compact" });
  assert.equal(r.json.systemMessage, undefined, "a wrapped session must not be nagged");
  assert.match(ctx(r), /knowledge tier already touched/, "but the model should still know the state");
});

check("a clean tree produces no user warning and says there is nothing uncommitted", () => {
  const { hook } = sandbox({});
  const r = fire(hook, { hook_event_name: "SessionStart", source: "compact" });
  assert.equal(r.json.systemMessage, undefined, "nothing at risk ⇒ nothing to say to the user");
  assert.match(ctx(r), /0 uncommitted file\(s\)/, "must report zero as zero, not omit the fact");
});

check("only ACTIVE plans are named — a closed plan is a record, not open work", () => {
  const { hook } = sandbox({ dirty: ["a.txt"], plans: { "open.md": ACTIVE_PLAN, "closed.md": DONE_PLAN } });
  const r = fire(hook, { hook_event_name: "SessionStart", source: "compact" });
  assert.match(ctx(r), /open\.md/, "an active plan must surface");
  assert.doesNotMatch(ctx(r), /closed\.md/, "a done plan must not be presented as open work");
});

check("no active plan is stated explicitly rather than left blank", () => {
  const { hook } = sandbox({ dirty: ["a.txt"], plans: { "closed.md": DONE_PLAN } });
  assert.match(ctx(fire(hook, { hook_event_name: "SessionStart", source: "compact" })), /no active plan/);
});

check("an unreadable git state is declared, never reported as a clean tree", () => {
  // No commit and no upstream: `rev-list @{u}..HEAD` and `status` behave differently from the happy path. The
  // hook must not turn "I could not tell" into "nothing to worry about" — the third-state rule of §2.5.
  const { hook } = sandbox({ commitFirst: false, dirty: ["a.txt"] });
  const r = fire(hook, { hook_event_name: "SessionStart", source: "compact" });
  assert.equal(r.code, 0, "a weird git state must not break the session");
  assert.doesNotMatch(ctx(r), /\bundefined\b|\bnull\b|NaN/, `no placeholder leakage: ${ctx(r)}`);
});

check("it does no network I/O — the reason it may run on compaction at all", () => {
  // Comments are stripped FIRST. The naive version matched the word "fetch" inside this hook's own docstring,
  // where it appears explaining that `git-sync-check` fetches and this one must not — a check failing on the
  // prose that justifies it. Fourth occurrence in two days of "the token lives in the comment about the token"
  // (standards/testing.md §2.7).
  const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(code, /["'`]fetch["'`]|\bfetch\(/, "a fetch here would price compaction like a session start");
  const { hook } = sandbox({ dirty: ["a.txt"] });
  const t0 = Date.now();
  fire(hook, { hook_event_name: "SessionStart", source: "compact" });
  const ms = Date.now() - t0;
  assert.ok(ms < 4000, `too slow for a compaction restart: ${ms}ms`);
});

/* ═══════════════ 3. mutants — each proved to still RUN before its probe counts ═══════════════ */

const mutants = [
  {
    name: "the compact-only guard is removed (fires on every ordinary session)",
    patch: (s) => s.replace('if (payload?.source !== "compact") process.exit(0);', ""),
    fixture: { dirty: ["a.txt"] },
    payload: { hook_event_name: "SessionStart", source: "startup" },
    probe: (r) => r.raw !== "",
  },
  {
    name: "the uncommitted count is read from nothing (silently reports a clean tree)",
    patch: (s) => s.replace("porcelain.split(\"\\n\").filter((l) => l.trim()).length", "0"),
    fixture: { dirty: ["a.txt", "b.txt"] },
    payload: { hook_event_name: "SessionStart", source: "compact" },
    probe: (r) => /0 uncommitted file\(s\)/.test(ctx(r)),
  },
  {
    name: "the knowledge-tier check always claims the session was recorded",
    patch: (s) => s.replace("porcelain.split(\"\\n\").some((l) => KNOWLEDGE.test(l))", "true"),
    fixture: { dirty: ["a.txt"] },
    payload: { hook_event_name: "SessionStart", source: "compact" },
    probe: (r) => r.json?.systemMessage === undefined && /already touched/.test(ctx(r)),
  },
  {
    name: "plan discovery stops filtering on status (a closed plan is presented as open)",
    patch: (s) => s.replace("/^status:\\s*active\\b/im.test(head)", "true"),
    fixture: { dirty: ["a.txt"], plans: { "closed.md": DONE_PLAN } },
    payload: { hook_event_name: "SessionStart", source: "compact" },
    probe: (r) => /closed\.md/.test(ctx(r)),
  },
  {
    name: "the event name in the output is wrong (harness would discard the context)",
    patch: (s) => s.replace('hookEventName: "SessionStart"', 'hookEventName: "Nonsense"'),
    fixture: { dirty: ["a.txt"] },
    payload: { hook_event_name: "SessionStart", source: "compact" },
    probe: (r) => r.json?.hookSpecificOutput?.hookEventName !== "SessionStart",
  },
];

for (const m of mutants) {
  check(`mutant killed — ${m.name}`, () => {
    const mutated = m.patch(SOURCE);
    assert.notEqual(mutated, SOURCE, "the patch matched nothing — it would prove nothing (§2.7)");

    // SANITY FIRST: a mutant that only crashes proves the suite notices a broken file and nothing about the
    // behaviour it claims to remove. Five suites were green this way on 2026-07-30.
    const bad = sandbox({ ...m.fixture, source: mutated });
    const rBad = fire(bad.hook, m.payload);
    assert.equal(rBad.code, 0, `mutant crashed instead of running (exit ${rBad.code}): ${rBad.err.slice(0, 200)}`);

    assert.ok(m.probe(rBad), "the mutant survived — the suite does not actually assert this behaviour");

    const good = sandbox(m.fixture);
    assert.ok(!m.probe(fire(good.hook, m.payload)), "the unmutated hook shows the same symptom — probe not specific");
  });
}

/* ═══════════════ 4. no repo mutation ═══════════════ */

check("the suite left the real repo's git state exactly as it found it", () => {
  const after = spawnSync("git", ["status", "--porcelain"], { cwd: REPO, encoding: "utf8" }).stdout;
  assert.equal(after, gitBefore, "this suite wrote into the repo it only meant to read");
  assert.ok(existsSync(HOOK), "the hook under test must still be there");
});

rmSync(lab, { recursive: true, force: true });

console.log(
  `\ncompact-recap.test.mjs — ${pass} passed, ${fails.length} failed (${mutants.length} mutants, each proved to still run)`,
);
if (fails.length) {
  for (const f of fails) console.log(`  ✗ ${f}`);
  process.exit(1);
}
