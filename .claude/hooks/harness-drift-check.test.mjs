// Test for harness-drift-check.mjs — the SessionStart hook that asks, once per Claude Code upgrade, whether
// the harness just shipped something this platform hand-rolled.
// Run: node .claude/hooks/harness-drift-check.test.mjs
//
// WHY THIS EXISTS. Between 2026-06-14 and 06-20 roughly six sessions built "auto-pilot": an external
// orchestrator, a scheduled task wrapper, and a two-way Discord control plane with signed single-use approval
// tokens. It worked, and on 2026-07-28 all of it was deleted, because Claude Code had shipped the same
// capability natively. Nothing about the process failed — research ran, the gate was tested,
// propose-don't-execute held. **The premise expired and no step ever re-checked it.**
//
// This hook is the re-check, and its two failure modes are asymmetric:
//   silent when it should speak — the expiry goes unnoticed for another six sessions of building. That is the
//                                 expensive one, and it is invisible.
//   speaks when it should not   — it fires on every session start, on every compaction, and becomes the
//                                 banner nobody reads. Which produces the first failure anyway.
//
// So the silent-path list is the longer one, and the firing case asserts the MESSAGE — a version-bump banner
// with no procedure attached is a notification, not a check.
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
const HOOK = join(HERE, "harness-drift-check.mjs");

/**
 * A sandbox repo. The hook derives the repo root two levels up from ITSELF, so it must be copied into a
 * `.claude/hooks/` inside the sandbox — a flatter layout would make the baseline "missing" and every case
 * would pass for the wrong reason.
 */
function sandbox({ baseline = { reviewedVersion: "2.1.100" }, src = null } = {}) {
  const root = mkdtempSync(join(tmpdir(), "harness-drift-"));
  const hooks = join(root, ".claude", "hooks");
  mkdirSync(hooks, { recursive: true });
  const hook = join(hooks, "harness-drift-check.mjs");
  if (src === null) copyFileSync(HOOK, hook);
  else writeFileSync(hook, src);
  copyFileSync(join(HERE, "_util.mjs"), join(hooks, "_util.mjs"));
  if (baseline !== null)
    writeFileSync(
      join(root, ".claude", "harness-baseline.json"),
      typeof baseline === "string" ? baseline : JSON.stringify(baseline),
    );
  return { root, hook };
}

function fire(s, { version = "2.1.220", source = "startup", execpath } = {}) {
  const env = { ...process.env, HOOK_USAGE_LOG: "off" };
  if (execpath !== undefined) env.CLAUDE_CODE_EXECPATH = execpath;
  else if (version === null) delete env.CLAUDE_CODE_EXECPATH;
  else env.CLAUDE_CODE_EXECPATH = `/home/u/.local/share/claude/versions/${version}`;

  try {
    const out = execFileSync(process.execPath, [s.hook], {
      input: JSON.stringify({ source }),
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf8",
      env,
    });
    return { code: 0, out: out || "" };
  } catch (err) {
    return { code: err.status ?? -1, out: (err.stderr || "") + (err.stdout || "") };
  }
}

/* ═══════════════════ 1. every reason to stay silent ═══════════════════ */
{
  const SILENT = [
    {
      what: "the installed version is the one already reviewed",
      make: () => sandbox({ baseline: { reviewedVersion: "2.1.220" } }),
      args: { version: "2.1.220" },
    },
    {
      what: "no baseline file at all (nothing has ever been reviewed — not this hook's problem)",
      make: () => sandbox({ baseline: null }),
      args: {},
    },
    {
      what: "a malformed baseline (a broken JSON file must not block a session)",
      make: () => sandbox({ baseline: "{ not json" }),
      args: {},
    },
    {
      what: "a baseline with no reviewedVersion",
      make: () => sandbox({ baseline: { notes: "nothing yet" } }),
      args: {},
    },
    {
      what: "CLAUDE_CODE_EXECPATH unset — the version is unknowable, so guessing is worse than silence",
      make: () => sandbox(),
      args: { version: null },
    },
    {
      what: "an execpath whose basename is not a version",
      make: () => sandbox(),
      args: { execpath: "/usr/local/bin/claude" },
    },
    {
      what: "a compaction — SessionStart re-runs, and a version cannot change mid-session",
      make: () => sandbox(),
      args: { source: "compact" },
    },
  ];

  for (const c of SILENT) {
    const s = c.make();
    const r = fire(s, c.args);
    assert.equal(r.code, 0, `SessionStart must never fail a session: ${c.what}\n${r.out}`);
    assert.equal(r.out.trim(), "", `SPOKE WHEN IT SHOULD NOT: ${c.what}\n${r.out}`);
    rmSync(s.root, { recursive: true, force: true });
  }
}

/* ═══════════════════ 2. a version bump must produce a PROCEDURE, not a banner ═══════════════ */
{
  const s = sandbox({ baseline: { reviewedVersion: "2.1.100" } });
  const r = fire(s, { version: "2.1.220" });
  assert.equal(r.code, 0, "advisory only — it must never be why a session will not start");

  const j = JSON.parse(r.out);
  assert.match(j.systemMessage, /harness upgraded 2\.1\.100 → 2\.1\.220/, j.systemMessage);
  assert.equal(j.hookSpecificOutput.hookEventName, "SessionStart");

  const ctx = j.hookSpecificOutput.additionalContext;
  assert.match(ctx, /2\.1\.100 \(last reviewed\) → 2\.1\.220 \(installed\)/, "both versions, both labelled");
  assert.match(
    ctx,
    /did the harness just ship something this platform hand-rolled\?/,
    "the ONE question to read the changelog with — without it this is a version notification",
  );
  assert.match(ctx, /\/idea \(propose, don't self-execute\)/, "where a finding goes, and that it is not self-executed");
  assert.match(
    ctx,
    /Update \.claude\/harness-baseline\.json/,
    "…and how to make it stop asking, or it becomes the banner nobody reads",
  );
  assert.match(
    ctx,
    /~6 sessions of auto-pilot were deleted/,
    "the evidence that justifies the interruption must travel with it",
  );
  assert.match(ctx, /do this ONCE, then move on/, "the scope must be bounded, or it reads as a research project");
  rmSync(s.root, { recursive: true, force: true });
}

/* ─────────── 2b. a DOWNGRADE is still drift — the reviewed version simply differs ── */
{
  const s = sandbox({ baseline: { reviewedVersion: "2.1.300" } });
  const r = fire(s, { version: "2.1.220" });
  assert.match(
    JSON.parse(r.out).systemMessage,
    /2\.1\.300 → 2\.1\.220/,
    "rolling back is a change of premise too, and the check is 'differs', not 'is newer'",
  );
  rmSync(s.root, { recursive: true, force: true });
}

/* ─────────── 3. it must not cost a subprocess ──
 * The whole design argument is that a version bump is a CHEAP trigger; a hook that shells out on every
 * session start is the thing that gets uninstalled for being slow.
 */
{
  const src = readFileSync(HOOK, "utf8");
  assert.ok(
    !/execSync|spawnSync|execFileSync|child_process/.test(src),
    "this hook must read env + one small JSON file, nothing more — no subprocess on the session-start path",
  );
}

/* ═══════════════════ 4. the suite must NOTICE a broken check (mutation) ═══════════════ */
{
  // LF-normalized: on a CRLF working tree (Windows) every multi-line mutation patch below would go stale.
  const src = readFileSync(HOOK, "utf8").replace(/\r\n/g, "\n");

  const mutants = [
    {
      name: "the version comparison inverted (fires when nothing changed)",
      baseline: { reviewedVersion: "2.1.220" },
      apply: (s) => s.replace("if (!reviewed || reviewed === current) process.exit(0);", "if (!reviewed) process.exit(0);"),
      probe: (s) => fire(s, { version: "2.1.220" }).out.trim() !== "",
    },
    {
      name: "the compaction guard removed (nags on every compact)",
      baseline: { reviewedVersion: "2.1.100" },
      apply: (s) => s.replace("if (source === 'compact') process.exit(0);", ""),
      probe: (s) => fire(s, { version: "2.1.220", source: "compact" }).out.trim() !== "",
    },
    {
      name: "the check silenced entirely (an expired premise goes unnoticed)",
      baseline: { reviewedVersion: "2.1.100" },
      apply: (s) => s.replace("const reviewed = baseline.reviewedVersion;", "const reviewed = null;"),
      probe: (s) => fire(s, { version: "2.1.220" }).out.trim() === "",
    },
    {
      name: "the procedure stripped from the message (a notification, not a check)",
      baseline: { reviewedVersion: "2.1.100" },
      apply: (s) =>
        s.replace(
          '`     "did the harness just ship something this platform hand-rolled?"\\n` +',
          "`` +",
        ),
      probe: (s) => !/hand-rolled/.test(fire(s, { version: "2.1.220" }).out),
    },
    {
      name: "a malformed baseline crashes the session start",
      baseline: "{ not json",
      apply: (s) => s.replace("} catch {\n  process.exit(0); // a malformed baseline", "} catch (e) {\n  throw e; // a malformed baseline"),
      probe: (s) => fire(s, { version: "2.1.220" }).code !== 0,
    },
  ];

  for (const m of mutants) {
    const mutated = m.apply(src);
    assert.notEqual(mutated, src, `mutation "${m.name}" changed nothing — the patch is stale`);
    const s = sandbox({ baseline: m.baseline, src: mutated });
    const killed = m.probe(s);
    rmSync(s.root, { recursive: true, force: true });
    assert.ok(killed, `SURVIVING MUTANT — "${m.name}" and the suite still passed. Add a case for it.`);
  }
}

/* ─────────── the real baseline must be untouched ── */
{
  const dirty = execFileSync("git", ["status", "--porcelain", "--", ".claude/harness-baseline.json"], {
    cwd: REPO,
    encoding: "utf8",
  });
  assert.equal(dirty, "", `the suite modified the real harness baseline:\n${dirty}`);
}

console.log(
  "harness-drift-check.test.mjs — 7 silent paths (same version, no/broken/empty baseline, unknown version, " +
    "compaction), the firing case asserted procedure-by-procedure, downgrades counted as drift, no subprocess " +
    "on the session-start path, 5 mutants all killed  ✅",
);
