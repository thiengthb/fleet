// Test for attic.mjs — the only tool on this platform that MOVES files.
// Run: node .claude/scripts/attic.test.mjs
//
// WHAT THIS SUITE IS FOR, and it is not "does staging work". Staging was exercised by hand on 2026-07-30,
// including a full restore round-trip. The risk that needs a standing test is the opposite one:
//
//     when attic REFUSES, does it leave the repository completely untouched?
//
// A refusal that half-moved a file, wrote a manifest row, or left an evidence snapshot behind would be worse
// than no guard at all — the repo would be in a state nobody chose, and the next reader could not tell
// whether the retirement had been approved. So every case below asserts the refusal AND asserts that
// `git status --porcelain` is byte-identical before and after.
//
// These cases run against the REAL repo on purpose. A refusal is read-only by design, so if any of them
// modifies anything, that IS the bug this suite exists to catch. If a case ever does leave a change behind,
// the suite fails loudly rather than cleaning up after it — silently repairing damage would hide the defect.

import assert from "node:assert/strict";
import { spawnSync, execSync } from "node:child_process";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const ATTIC = join(HERE, "attic.mjs");

const gitState = () =>
  execSync("git status --porcelain", { cwd: REPO, encoding: "utf8" }) +
  "\n" +
  execSync("git stash list", { cwd: REPO, encoding: "utf8" });

const run = (args) => {
  const r = spawnSync(process.execPath, [ATTIC, ...args], {
    encoding: "utf8",
    cwd: REPO,
    timeout: 120_000,
  });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
};

const before = gitState();

/**
 * Each case is a way someone could ask for a wrongful retirement. `expect` is the phrase the refusal must
 * contain — asserting the REASON, not just the exit code, because "it refused" for the wrong reason means
 * the guard that mattered was not the one that fired.
 */
const REFUSALS = [
  {
    what: "a PROTECTED class (memory — its use cannot be measured at all)",
    args: [
      ".claude/memory/user-profile.md",
      "--reason",
      "a deliberately long but wrong reason for staging this",
    ],
    expect: /PROTECTED/,
  },
  {
    what: "a PROTECTED class even WITH --force (the override must not reach this class)",
    args: [
      ".claude/memory/user-profile.md",
      "--reason",
      "a deliberately long but wrong reason for staging this",
      "--force",
    ],
    expect: /--force does not apply/,
  },
  {
    what: "no reason at all",
    args: ["platform/standards/testing.md"],
    expect: /--reason is required/,
  },
  {
    what: 'a reason that is not one ("unused" is what the counter already said)',
    args: ["platform/standards/testing.md", "--reason", "unused"],
    expect: /must be a real sentence/,
  },
  {
    what: "a file with recorded use",
    args: [
      "platform/standards/testing.md",
      "--reason",
      "pretending an actively used standard is obsolete",
    ],
    expect: /is ACTIVE, not WATCH/,
  },
  {
    what: "a path that does not exist",
    args: [
      "platform/nope/does-not-exist.md",
      "--reason",
      "staging something that was never there at all",
    ],
    expect: /does not exist/,
  },
];

for (const c of REFUSALS) {
  const { code, out } = run(["stage", ...c.args]);
  assert.equal(code, 1, `must REFUSE: ${c.what}\n${out}`);
  assert.match(
    out,
    c.expect,
    `refused for the wrong reason: ${c.what}\n${out}`,
  );
  const after = gitState();
  assert.equal(
    after,
    before,
    `A REFUSED STAGE CHANGED THE REPO — ${c.what}\nThis is the defect this suite exists for; the working tree is now dirty and must be inspected by hand.`,
  );
}

/* ───────────────────────── the read-only subcommands must also never touch anything ── */

for (const sub of [["list"], ["verify"], ["ready"]]) {
  const { out } = run(sub);
  assert.ok(typeof out === "string", `${sub[0]} produced no output`);
  assert.equal(
    gitState(),
    before,
    `\`attic ${sub[0]}\` modified the repository — it must be read-only`,
  );
}

/* ───────────────────────── `ready` must never nominate anything before the wait is served ── */
{
  const { out } = run(["ready"]);
  const manifest = execSync(
    "cat platform/attic/MANIFEST.md 2>/dev/null || true",
    { cwd: REPO, encoding: "utf8" },
  );
  const staged = (manifest.match(/\| staged \|/g) || []).length;
  if (staged > 0)
    assert.doesNotMatch(
      out,
      /have served the wait/,
      "something was staged today and `ready` already lists it — the 30-day/4-session wait is not being enforced",
    );
}

/* ───────────────────────── there must be NO way to delete from this tool ── */
{
  const src = execSync(`cat ${JSON.stringify(ATTIC)}`, { encoding: "utf8" });
  assert.doesNotMatch(
    src,
    /case "delete"/,
    "attic.mjs must not have a delete subcommand — deletion is the supervisor's move",
  );
  // No filesystem removal API, and no EXECUTION of `git rm`. The literal string "git rm" is expected and
  // required: `ready` prints it for the supervisor to run by hand. The distinction between printing a
  // destructive command and running one is the entire safety property here, so the assertion has to be
  // precise rather than merely strict — the first version failed on the printed suggestion, which would have
  // pushed a future author to delete the helpful output instead of keeping the guarantee.
  assert.doesNotMatch(
    src,
    /\brmSync\s*\(|\bunlinkSync\s*\(|\brm\s*-rf\b/,
    "attic.mjs must contain no code path that removes a file",
  );
  assert.doesNotMatch(
    src,
    /execFileSync\(\s*["']git["']\s*,\s*\[\s*["']rm["']|execSync\(\s*[`"'][^`"']*git\s+rm/,
    "attic.mjs must never EXECUTE `git rm` — printing it for a human is the intended behaviour",
  );
  assert.match(
    src,
    /git rm/,
    "…and it must still PRINT the command, or the supervisor has to reconstruct it",
  );
}

console.log(
  `attic.test.mjs — ${REFUSALS.length} wrongful stagings refused, repo untouched by every refusal and every read-only subcommand, no delete path exists  ✅`,
);
