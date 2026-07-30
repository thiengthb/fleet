// Test for memory-wiring-check.mjs — the SessionStart hook that says "you do not actually have your memory".
// Run: node .claude/hooks/memory-wiring-check.test.mjs
//
// WHY THIS EXISTS. The shared memory tier is git-synced, but the setting that LOADS it —
// `autoMemoryDirectory` — is an absolute path, so it cannot be committed and lives in each machine's
// gitignored `settings.local.json`. A fresh clone therefore has every memory file and loads none of them, and
// **the failure is completely silent**: the agent starts each session with no memory of the user and never
// says so. That is not hypothetical — on 2026-07-28 a memory written four days earlier was found to have
// never loaded once, because the directory holding it had no index.
//
// So this hook is the only thing that can distinguish "the user has told me nothing" from "I cannot see what
// the user told me", and the two lead to opposite behaviour. Every case below is one way that distinction
// gets lost.
//
// The hook must also never be the reason a session fails to start: exit 0 in every case, including the ones
// where it has bad news.
//
// Per platform/standards/testing.md §2.5 the suite also MUTATES the hook and asserts it notices.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  copyFileSync,
  rmSync,
} from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const HOOK = join(HERE, "memory-wiring-check.mjs");

/**
 * A sandbox repo. The hook resolves the repo root two levels up from itself and reads settings from
 * `$HOME/.claude/settings.json`, the repo's `settings.json` and its `settings.local.json` in that order —
 * so both the layout and HOME have to be sandboxed or a case would read the developer's real machine.
 */
function sandbox({ memory = {}, wiring = "correct", homeSettings = null, src = null } = {}) {
  const root = mkdtempSync(join(tmpdir(), "memory-wiring-"));
  const home = join(root, "__home__");
  mkdirSync(join(home, ".claude"), { recursive: true });
  const hooks = join(root, ".claude", "hooks");
  mkdirSync(hooks, { recursive: true });
  const hook = join(hooks, "memory-wiring-check.mjs");
  if (src === null) copyFileSync(HOOK, hook);
  else writeFileSync(hook, src);
  copyFileSync(join(HERE, "_util.mjs"), join(hooks, "_util.mjs"));

  const memDir = join(root, ".claude", "memory");
  if (memory !== null) {
    mkdirSync(memDir, { recursive: true });
    for (const [name, body] of Object.entries(memory)) writeFileSync(join(memDir, name), body);
  }

  const settings =
    wiring === "correct"
      ? { autoMemoryDirectory: memDir }
      : wiring === "elsewhere"
        ? { autoMemoryDirectory: join(root, "somewhere-else") }
        : wiring === "disabled"
          ? { autoMemoryEnabled: false }
          : wiring === "malformed"
            ? "{ not json"
            : null;
  if (settings !== null)
    writeFileSync(
      join(root, ".claude", "settings.local.json"),
      typeof settings === "string" ? settings : JSON.stringify(settings),
    );
  if (homeSettings)
    writeFileSync(join(home, ".claude", "settings.json"), JSON.stringify(homeSettings));

  return { root, home, hook, memDir };
}

function fire(s) {
  const env = { ...process.env, HOME: s.home, HOOK_USAGE_LOG: "off" };
  try {
    const out = execFileSync(process.execPath, [s.hook], {
      input: "{}",
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf8",
      env,
    });
    return { code: 0, out: out || "" };
  } catch (err) {
    return { code: err.status ?? -1, out: (err.stderr || "") + (err.stdout || "") };
  }
}

const index = (lines) => `# index\n\n${lines.join("\n")}\n`;
const HEALTHY = {
  "MEMORY.md": index(["- [One](one.md) — a hook", "- [Two](two.md) — another"]),
  "one.md": "---\nname: one\n---\n\nA fact.\n",
  "two.md": "---\nname: two\n---\n\nAnother fact.\n",
};

/* ═══════════════════ 1. correctly wired ⇒ completely silent ═══════════════════ */
{
  const s = sandbox({ memory: HEALTHY });
  const r = fire(s);
  assert.equal(r.code, 0);
  assert.equal(
    r.out.trim(),
    "",
    `a healthy tier must produce NOTHING — a hook that speaks every session is a hook nobody reads:\n${r.out}`,
  );
  rmSync(s.root, { recursive: true, force: true });
}

/* ═══════════════════ 2. every way the tier fails to load, with the fix attached ═══════════════ */
{
  const CASES = [
    {
      what: "autoMemoryDirectory unset — the fresh-clone case",
      spec: { memory: HEALTHY, wiring: "unset" },
      user: /`autoMemoryDirectory` is not set on this machine/,
      // The fix must be a command the user can follow without asking a question.
      alsoUser: [/settings\.local\.json.*\(gitignored\)/s, /"autoMemoryDirectory"/, /came with `git pull`/],
    },
    {
      what: "auto memory disabled outright",
      spec: { memory: HEALTHY, wiring: "disabled" },
      user: /auto memory is DISABLED/,
      alsoUser: [/will not load, and nothing will be written to it this session/],
    },
    {
      what: "pointed at a different directory — loads someone else's memory, writes nowhere useful",
      spec: { memory: HEALTHY, wiring: "elsewhere" },
      user: /points at .*somewhere-else/,
      alsoUser: [/stays on this machine and will not travel/],
    },
    {
      what: "no MEMORY.md index — the 2026-07-28 failure, four days invisible",
      spec: { memory: { "orphan.md": "a fact with no index above it\n" } },
      user: /has no MEMORY\.md index — every memory file in it is invisible at session start/,
    },
    {
      what: "the index is past the load cap, so entries are dropped silently",
      spec: {
        memory: {
          "MEMORY.md": index(Array.from({ length: 260 }, (_, i) => `- [E${i}](e-${i}.md) — hook`)),
        },
      },
      user: /past the 200-line \/ 25KB load cap/,
      alsoUser: [/Everything beyond the cap is dropped on load/],
    },
    {
      what: "a memory file the index does not point at",
      spec: {
        memory: { ...HEALTHY, "invisible.md": "nothing points at this\n" },
      },
      user: /1 memory file\(s\) are not referenced by MEMORY\.md and will never surface: invisible\.md/,
    },
  ];

  for (const c of CASES) {
    const s = sandbox(c.spec);
    const r = fire(s);
    assert.equal(r.code, 0, `SessionStart must never fail a session: ${c.what}\n${r.out}`);
    assert.ok(r.out.trim(), `SILENT ON A REAL PROBLEM: ${c.what}`);

    const j = JSON.parse(r.out);
    assert.match(j.systemMessage, /⚠ memory wiring/, `the user-facing headline: ${c.what}`);
    assert.match(j.systemMessage, c.user, `${c.what}\n${j.systemMessage}`);
    for (const also of c.alsoUser ?? [])
      assert.match(j.systemMessage, also, `the fix must be spelled out: ${c.what}\n${j.systemMessage}`);

    // The model half matters as much: the agent must not assume it has the user's preferences.
    assert.equal(j.hookSpecificOutput.hookEventName, "SessionStart");
    assert.match(
      j.hookSpecificOutput.additionalContext,
      /do not assume you have the user's memory this session/,
      `the model must be told to distrust its own memory: ${c.what}`,
    );
    assert.match(
      j.hookSpecificOutput.additionalContext,
      /Surface this to the user before doing work that depends on remembered preferences/,
      `…and to raise it: ${c.what}`,
    );
    rmSync(s.root, { recursive: true, force: true });
  }
}

/* ─────────── 3. several problems at once are all reported, not just the first ── */
{
  const s = sandbox({ memory: { "orphan.md": "x\n" }, wiring: "unset" });
  const j = JSON.parse(fire(s).out);
  assert.match(j.systemMessage, /`autoMemoryDirectory` is not set/, "the wiring problem");
  assert.match(j.systemMessage, /has no MEMORY\.md index/, "…and the index problem, in the same report");
  rmSync(s.root, { recursive: true, force: true });
}

/* ─────────── 4. settings precedence: the repo-local file wins over $HOME ──
 * Getting this backwards would report a correctly-wired machine as broken, which trains the user to ignore it.
 */
{
  const s = sandbox({
    memory: HEALTHY,
    wiring: "correct",
    homeSettings: { autoMemoryDirectory: "/somewhere/global/memory" },
  });
  assert.equal(
    fire(s).out.trim(),
    "",
    "the repo's settings.local.json is read last and must win — a global default must not raise a false alarm",
  );
  rmSync(s.root, { recursive: true, force: true });
}

/* ─────────── 5. degraded inputs must never break a session start ── */
{
  const malformed = sandbox({ memory: HEALTHY, wiring: "malformed" });
  const r = fire(malformed);
  assert.equal(r.code, 0, "a malformed settings file must not throw — the wiring hook is not its owner");
  assert.match(r.out, /autoMemoryDirectory/, "…and with no readable setting it correctly reports the tier unwired");
  rmSync(malformed.root, { recursive: true, force: true });

  const noDir = sandbox({ memory: null, wiring: "unset" });
  assert.equal(fire(noDir).code, 0, "a missing memory directory must not throw either");
  rmSync(noDir.root, { recursive: true, force: true });
}

/* ═══════════════════ 6. the suite must NOTICE a broken check (mutation) ═══════════════ */
{
  const src = readFileSync(HOOK, "utf8");

  const mutants = [
    {
      name: "the unset case no longer reported (a fresh clone runs blind and silent)",
      spec: { memory: HEALTHY, wiring: "unset" },
      // The finding is DROPPED, not the branch. Replacing the branch condition with `false` falls through to
      // `setting.dir` on a null and throws — a crash mutant proves the suite notices a broken file, not the
      // behaviour being claimed. Redirecting the push keeps the file valid and removes only the report.
      apply: (s) => s.replace("} else if (!setting) {\n  problems.push(", "} else if (!setting) {\n  [].push("),
      probe: (s) => fire(s).out.trim() === "",
    },
    {
      name: "a wrong directory accepted",
      spec: { memory: HEALTHY, wiring: "elsewhere" },
      apply: (s) => s.replace("} else if (setting.dir !== MEMORY_DIR) {", "} else if (false) {"),
      probe: (s) => fire(s).out.trim() === "",
    },
    {
      name: "the missing-index case no longer reported (the 2026-07-28 failure returns)",
      spec: { memory: { "orphan.md": "x\n" } },
      // Same technique, same reason: `if (false)` here falls into the else branch and readFileSync throws on
      // the index that is not there.
      apply: (s) =>
        s.replace(
          "problems.push(`${MEMORY_DIR} has no MEMORY.md index",
          "[].push(`${MEMORY_DIR} has no MEMORY.md index",
        ),
      probe: (s) => !/no MEMORY\.md index/.test(fire(s).out),
    },
    {
      name: "the load cap raised out of reach (silent truncation goes unreported)",
      spec: {
        memory: { "MEMORY.md": index(Array.from({ length: 260 }, (_, i) => `- [E${i}](e-${i}.md) — hook`)) },
      },
      apply: (s) => s.replace("if (lines > 200 || bytes > 25 * 1024) {", "if (false) {"),
      probe: (s) => fire(s).out.trim() === "",
    },
    {
      name: "unindexed files no longer reported",
      spec: { memory: { ...HEALTHY, "invisible.md": "x\n" } },
      apply: (s) => s.replace("if (unindexed.length) {", "if (false) {"),
      probe: (s) => fire(s).out.trim() === "",
    },
    {
      name: "the model no longer told to distrust its memory",
      spec: { memory: HEALTHY, wiring: "unset" },
      apply: (s) =>
        s.replace("`MEMORY WIRING PROBLEM — do not assume you have the user's memory this session:", "`Note:"),
      probe: (s) => !/do not assume you have the user's memory/.test(fire(s).out),
    },
    {
      name: "settings precedence reversed ($HOME wins, a healthy machine looks broken)",
      spec: {
        memory: HEALTHY,
        wiring: "correct",
        homeSettings: { autoMemoryDirectory: "/somewhere/global/memory" },
      },
      apply: (s) => s.replace("  return found;\n}", "  return found;\n}\n"),
      skip: true, // precedence is expressed by array ORDER; there is no single expression to invert cleanly
    },
  ];

  for (const m of mutants) {
    if (m.skip) continue;
    const mutated = m.apply(src);
    assert.notEqual(mutated, src, `mutation "${m.name}" changed nothing — the patch is stale`);
    const s = sandbox({ ...m.spec, src: mutated });
    // A mutant that merely CRASHES proves the suite notices a broken file, not the behaviour claimed. Every
    // mutant here must still exit 0, because that is what this hook promises the harness in every case.
    const sanity = fire(s);
    assert.equal(
      sanity.code,
      0,
      `mutant "${m.name}" crashed instead of changing behaviour — it proves nothing:\n${sanity.out.slice(0, 300)}`,
    );
    const killed = m.probe(s);
    rmSync(s.root, { recursive: true, force: true });
    assert.ok(killed, `SURVIVING MUTANT — "${m.name}" and the suite still passed. Add a case for it.`);
  }
}

/* ─────────── the real memory tier must be untouched ── */
{
  const dirty = execFileSync("git", ["status", "--porcelain", "--", ".claude/memory"], {
    cwd: REPO,
    encoding: "utf8",
  });
  assert.ok(
    !/\.claude\/memory\/(one|two|orphan|invisible)\.md/.test(dirty),
    `the suite leaked fixtures into the real memory tier:\n${dirty}`,
  );
}

console.log(
  "memory-wiring-check.test.mjs — silent when healthy, 6 distinct load failures each with its fix and its " +
    "model-facing warning, multiple problems reported together, settings precedence, malformed settings and a " +
    "missing directory both survived, 6 mutants all killed  ✅",
);
