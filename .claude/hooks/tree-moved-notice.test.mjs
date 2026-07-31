// Test for tree-moved-notice.mjs — the Stop/UserPromptSubmit pair that reports a tree moving under us.
// Run: node .claude/hooks/tree-moved-notice.test.mjs
//
// WHY THIS EXISTS. This hook is wired to `UserPromptSubmit`, where exit 2 "blocks prompt processing and ERASES
// the prompt". Losing what the user typed is a worse outcome than every problem this hook solves, so the single
// most important property is: IT NEVER EXITS NON-ZERO. That is asserted on every path here, including the
// malformed ones.
//
// The second property is that it must be quiet. A notice that fires when nothing happened trains the reader to
// skip it, and then the one real notice is skipped too.
//
// Per platform/standards/testing.md §2.7: a silent path, acting paths asserted BY MESSAGE, killed mutants each
// proved to still RUN, and no mutation of the real repo — sandboxes are real git repos in the OS temp dir.

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const HOOK = join(HERE, "tree-moved-notice.mjs");
const RAW = readFileSync(HOOK, "utf8");
// LF-normalized for MUTATION only. On a CRLF working tree (Windows, and this repo has core.autocrlf on) a
// multi-line patch written with `\n` matches nothing and the mutant reports "the patch matched nothing".
// That is a documented local trap — it was one of the 15 defects fixed on 2026-07-30 — and it reappeared here
// the moment a rebase re-checked-out this file with CRLF. RAW is kept separately so the no-repo-mutation check
// still compares real bytes.
const SOURCE = RAW.replace(/\r\n/g, "\n");

const lab = mkdtempSync(join(tmpdir(), "tree-moved-"));
let pass = 0;
const fails = [];
let seq = 0;
const gitBefore = execFileSync("git", ["status", "--porcelain"], { cwd: REPO, encoding: "utf8" });

/** A real git repo with one commit, outside the fleet repo. */
function sandboxRepo() {
  const root = mkdtempSync(join(lab, "repo-"));
  const q = (args) => spawnSync("git", args, { cwd: root, encoding: "utf8" });
  q(["init", "-b", "main"]);
  q(["config", "user.email", "t@t.t"]);
  q(["config", "user.name", "t"]);
  writeFileSync(join(root, "seed.txt"), "seed\n");
  q(["add", "-A"]);
  q(["commit", "-m", "seed"]);
  return { root, git: q };
}

const newSession = () => `treemoved-${process.pid}-${seq++}`;

/** Fire the hook with a given event; returns exit code + stdout/stderr. */
function fire(hookPath, { event, session, cwd }) {
  const payload = JSON.stringify({ hook_event_name: event, session_id: session, cwd });
  try {
    const out = execFileSync(process.execPath, [hookPath], {
      input: payload,
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf8",
      cwd,
      env: { ...process.env, HOOK_USAGE_LOG: "off" },
    });
    return { code: 0, out: out || "" };
  } catch (err) {
    return { code: err.status ?? -1, out: (err.stderr || "") + (err.stdout || "") };
  }
}

/** The injected context string, or null when the hook stayed silent. */
function injected(r) {
  if (!r.out.trim()) return null;
  let j;
  try {
    j = JSON.parse(r.out);
  } catch {
    return null;
  }
  return j?.hookSpecificOutput?.additionalContext ?? null;
}

function mutantHook(patched) {
  const dir = mkdtempSync(join(lab, "mutant-"));
  copyFileSync(join(HERE, "_util.mjs"), join(dir, "_util.mjs"));
  const p = join(dir, "tree-moved-notice.mjs");
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

/* ═══════════════════ 1. THE PROPERTY THAT MATTERS MOST — never non-zero ═══════════════════ */

check("every path exits 0 — UserPromptSubmit exit 2 would ERASE the user's prompt", () => {
  const { root } = sandboxRepo();
  const s = newSession();
  // A real directory that is NOT a git repo. The first version of this case pointed at a path that did not
  // exist, so `execFileSync` failed to spawn and returned -1 — the hook never ran and the "failure" was the
  // test's own. Worth keeping as a comment: a red result whose cause is the harness looks identical to a defect.
  const notARepo = join(lab, "not-a-repo");
  mkdirSync(notARepo, { recursive: true });
  const cases = [
    { event: "Stop", session: s, cwd: root },
    { event: "UserPromptSubmit", session: s, cwd: root },
    { event: "UserPromptSubmit", session: newSession(), cwd: root }, // no baseline
    { event: "UserPromptSubmit", session: newSession(), cwd: notARepo }, // a dir, but not a repo
    { event: "Stop", session: "", cwd: root }, // no session id
    { event: "Weird", session: newSession(), cwd: root }, // unknown event
  ];
  for (const c of cases) {
    const r = fire(HOOK, c);
    assert.equal(r.code, 0, `${c.event} (${c.session || "no-session"}) must exit 0, got ${r.code}: ${r.out.slice(0, 160)}`);
  }
});

/* ═══════════════════ 2. the SILENT paths ═══════════════════ */

check("first prompt of a session → silent (nothing to compare against is not a finding)", () => {
  const { root } = sandboxRepo();
  const r = fire(HOOK, { event: "UserPromptSubmit", session: newSession(), cwd: root });
  assert.equal(injected(r), null, `must stay silent, got: ${r.out.slice(0, 200)}`);
});

check("nothing moved between Stop and the next prompt → silent", () => {
  const { root } = sandboxRepo();
  const s = newSession();
  fire(HOOK, { event: "Stop", session: s, cwd: root });
  const r = fire(HOOK, { event: "UserPromptSubmit", session: s, cwd: root });
  assert.equal(injected(r), null, `an unchanged tree must produce no notice, got: ${r.out.slice(0, 200)}`);
});

check("Stop never speaks, even when the tree is dirty", () => {
  const { root } = sandboxRepo();
  writeFileSync(join(root, "dirty.txt"), "x\n");
  const r = fire(HOOK, { event: "Stop", session: newSession(), cwd: root });
  assert.equal(r.out.trim(), "", "the Stop half must record silently");
});

/* ═══════════════════ 3. the ACTING paths — asserted BY MESSAGE ═══════════════════ */

check("a file appearing between turns is named", () => {
  const { root } = sandboxRepo();
  const s = newSession();
  fire(HOOK, { event: "Stop", session: s, cwd: root });
  writeFileSync(join(root, "someone-elses-work.txt"), "not mine\n");
  const ctx = injected(fire(HOOK, { event: "UserPromptSubmit", session: s, cwd: root }));
  assert.ok(ctx, "a new untracked file must produce a notice");
  assert.match(ctx, /appeared/, "must say what kind of change it was");
  assert.match(ctx, /someone-elses-work\.txt/, "must name the file");
  assert.match(ctx, /stage only your own files/, "must say what to do about it");
});

check("a file vanishing between turns is named — the sprawl-check case from 2026-07-31", () => {
  const { root } = sandboxRepo();
  const s = newSession();
  writeFileSync(join(root, "transient.txt"), "here now\n");
  fire(HOOK, { event: "Stop", session: s, cwd: root });
  rmSync(join(root, "transient.txt"));
  const ctx = injected(fire(HOOK, { event: "UserPromptSubmit", session: s, cwd: root }));
  assert.ok(ctx, "a file that disappeared must produce a notice");
  assert.match(ctx, /vanished/, `must report the disappearance: ${ctx}`);
  assert.match(ctx, /transient\.txt/, "must name it");
});

check("HEAD moving is reported with the commits — the case I missed three times", () => {
  const { root, git } = sandboxRepo();
  const s = newSession();
  fire(HOOK, { event: "Stop", session: s, cwd: root });
  writeFileSync(join(root, "theirs.txt"), "their work\n");
  git(["add", "-A"]);
  git(["commit", "-m", "docs(wrap): the second writer in this tree"]);
  const ctx = injected(fire(HOOK, { event: "UserPromptSubmit", session: s, cwd: root }));
  assert.ok(ctx, "a commit by someone else must produce a notice");
  assert.match(ctx, /HEAD moved/, `must lead with the HEAD move: ${ctx}`);
  assert.match(ctx, /second writer in this tree/, "must show the commit subject, not just the sha");
});

check("the notice does not repeat on the following prompt (re-baselined)", () => {
  const { root } = sandboxRepo();
  const s = newSession();
  fire(HOOK, { event: "Stop", session: s, cwd: root });
  writeFileSync(join(root, "once.txt"), "x\n");
  assert.ok(injected(fire(HOOK, { event: "UserPromptSubmit", session: s, cwd: root })), "first notice expected");
  const second = injected(fire(HOOK, { event: "UserPromptSubmit", session: s, cwd: root }));
  assert.equal(second, null, `the same change must not be reported twice, got: ${second}`);
});

check("a long list is truncated — a notice nobody reads protects nothing", () => {
  const { root } = sandboxRepo();
  const s = newSession();
  fire(HOOK, { event: "Stop", session: s, cwd: root });
  for (let i = 0; i < 30; i++) writeFileSync(join(root, `f${i}.txt`), "x\n");
  const ctx = injected(fire(HOOK, { event: "UserPromptSubmit", session: s, cwd: root }));
  assert.ok(ctx, "expected a notice");
  assert.match(ctx, /and \d+ more/, `must truncate rather than dump 30 paths: ${ctx.slice(0, 300)}`);
});

/* ═══════════════════ 4. mutants — each proved to still RUN ═══════════════════ */

const mutants = [
  {
    // BOTH short-circuits, because the quiet path is guarded TWICE and removing one is masked by the other.
    // The first version of this mutant removed only the fingerprint comparison and "survived" — correctly, since
    // `if (!lines.length) exit(0)` still caught it. That is defence in depth, not a hole; so the mutant has to
    // remove the pair to be observable, and what it proves is that the pair together is load-bearing.
    name: "both unchanged-tree short-circuits removed (it speaks when nothing happened)",
    patch: (s) =>
      s
        .replace("if (before.head === now.head && before.status === now.status) process.exit(0);", "")
        .replace("if (!lines.length) process.exit(0);", ""),
    scenario: ({ hookPath, root }) => {
      const s2 = newSession();
      fire(hookPath, { event: "Stop", session: s2, cwd: root });
      return fire(hookPath, { event: "UserPromptSubmit", session: s2, cwd: root });
    },
    probe: (r) => r.out.trim() !== "",
  },
  {
    // The Stop branch's job is NOT "record the baseline" — the fall-through path records one too. Its job is to
    // STAY SILENT on Stop. The first version of this mutant tested the recording and survived, because the
    // fall-through happens to record the same thing. So the fixture must give Stop something to talk about.
    name: "the Stop branch removed (Stop starts emitting notices instead of recording quietly)",
    patch: (s) => s.replace("if (event === 'Stop') {", "if (false) {"),
    scenario: ({ hookPath, root }) => {
      const s2 = newSession();
      fire(hookPath, { event: "Stop", session: s2, cwd: root }); // baseline
      writeFileSync(join(root, `m-${seq++}.txt`), "x\n"); // something changed
      return fire(hookPath, { event: "Stop", session: s2, cwd: root }); // Stop must NOT speak about it
    },
    probe: (r) => r.out.trim() !== "",
  },
  {
    name: "the first-prompt guard removed (a fresh session gets a spurious notice)",
    patch: (s) =>
      s.replace(
        "if (!before || typeof before.head !== 'string' || typeof before.status !== 'string') process.exit(0);",
        "if (!before) before = { head: 'x', status: '' };",
      ),
    scenario: ({ hookPath, root }) => fire(hookPath, { event: "UserPromptSubmit", session: newSession(), cwd: root }),
    probe: (r) => injected(r) !== null,
  },
  {
    name: "re-baselining removed (the same notice repeats forever)",
    patch: (s) => s.replace(/\/\/ Re-baseline unconditionally[\s\S]*?catch \{\n    \/\* ignore \*\/\n  \}/, ""),
    scenario: ({ hookPath, root }) => {
      const s2 = newSession();
      fire(hookPath, { event: "Stop", session: s2, cwd: root });
      writeFileSync(join(root, `r-${seq++}.txt`), "x\n");
      fire(hookPath, { event: "UserPromptSubmit", session: s2, cwd: root }); // first notice
      return fire(hookPath, { event: "UserPromptSubmit", session: s2, cwd: root }); // must be silent when correct
    },
    probe: (r) => injected(r) !== null,
  },
  {
    name: "truncation removed (30 paths get dumped into context)",
    patch: (s) => s.replace("const MAX_LISTED = 12;", "const MAX_LISTED = 1000;"),
    scenario: ({ hookPath, root }) => {
      const s2 = newSession();
      fire(hookPath, { event: "Stop", session: s2, cwd: root });
      for (let i = 0; i < 30; i++) writeFileSync(join(root, `t${i}-${seq}.txt`), "x\n");
      return fire(hookPath, { event: "UserPromptSubmit", session: s2, cwd: root });
    },
    probe: (r) => {
      const c = injected(r);
      return c !== null && !/and \d+ more/.test(c);
    },
  },
];

for (const m of mutants) {
  check(`mutant killed — ${m.name}`, () => {
    const patched = m.patch(SOURCE);
    assert.notEqual(patched, SOURCE, "the patch matched nothing — it would prove nothing (§2.7)");
    const hookPath = mutantHook(patched);

    const bad = sandboxRepo();
    const rBad = m.scenario({ hookPath, root: bad.root, git: bad.git });
    // SANITY — a mutant that only crashes proves the suite notices a broken file and nothing else.
    assert.equal(rBad.code, 0, `mutant crashed instead of running (exit ${rBad.code}): ${rBad.out.slice(0, 200)}`);
    assert.ok(m.probe(rBad), "the mutant survived — the suite does not actually assert this behaviour");

    const good = sandboxRepo();
    const rGood = m.scenario({ hookPath: HOOK, root: good.root, git: good.git });
    assert.ok(!m.probe(rGood), "the real hook shows the same symptom — the probe is not specific");
  });
}

/* ═══════════════════ 5. no repo mutation ═══════════════════ */

check("the suite did not mutate the hook it reads", () => {
  assert.equal(readFileSync(HOOK, "utf8"), RAW, "tree-moved-notice.mjs changed on disk during this run");
  assert.ok(!lab.startsWith(REPO), "sandboxes must live outside the repo");
  assert.ok(existsSync(HOOK));
});

rmSync(lab, { recursive: true, force: true });

{
  const after = execFileSync("git", ["status", "--porcelain"], { cwd: REPO, encoding: "utf8" });
  if (after !== gitBefore) console.log("  note the working tree moved while this suite ran — not a failure of this suite.");
}

console.log(
  `\ntree-moved-notice.test.mjs — ${pass} passed, ${fails.length} failed ` +
    `(${mutants.length} mutants, each proved to still run)`,
);
if (fails.length) {
  for (const f of fails) console.log(`  ✗ ${f}`);
  process.exit(1);
}
