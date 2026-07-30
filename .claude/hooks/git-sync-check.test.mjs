// Test for git-sync-check.mjs — the SessionStart hook that catches stale-local and unpushed work across every
// repo in the fleet, at the one moment a multi-machine workflow needs it.
// Run: node .claude/hooks/git-sync-check.test.mjs
//
// WHY THIS EXISTS. The user works across several machines, so at any session start the local tree may be
// BEHIND (they pushed from another box) or AHEAD (they left work unpushed here). Both are silent: git says
// nothing until you ask, and building on a stale checkout produces work that has to be redone or merged by
// hand. There is a memory for exactly this — `git-fetch-before-work`, written after a session re-did fixes
// that were already installed.
//
// The failure this suite is really guarding is subtler than "it did not warn". On 2026-07-30 the nine app
// repos moved into `projects/` and this hook went from watching 13 repos to 4 **without reporting anything
// wrong** — a smaller, true-looking answer. That is why case 2 asserts the repos it finds by NAME rather than
// asserting that it "found some", and why the fleet-shaped fixture nests repos one level down.
//
// Everything is exercised against real git repositories with a real (file://) remote, because ahead/behind is
// computed from `rev-list --left-right HEAD...@{u}` and a faked git layer would prove nothing about it.
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
const HOOK = join(HERE, "git-sync-check.mjs");

const GIT_ENV = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_SYSTEM: "/dev/null",
  GIT_AUTHOR_NAME: "Fixture",
  GIT_AUTHOR_EMAIL: "t@example.invalid",
  GIT_COMMITTER_NAME: "Fixture",
  GIT_COMMITTER_EMAIL: "t@example.invalid",
};
const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8", env: GIT_ENV });

/**
 * A sandbox fleet. The hook resolves its root two levels up from ITSELF and imports `../scripts/_layout.mjs`,
 * so both directories have to exist inside the sandbox — a flatter copy would find no repos and every case
 * would pass for the wrong reason.
 */
function sandbox({ src = null } = {}) {
  const root = mkdtempSync(join(tmpdir(), "git-sync-"));
  const hooks = join(root, ".claude", "hooks");
  const scripts = join(root, ".claude", "scripts");
  mkdirSync(hooks, { recursive: true });
  mkdirSync(scripts, { recursive: true });
  const hook = join(hooks, "git-sync-check.mjs");
  if (src === null) copyFileSync(HOOK, hook);
  else writeFileSync(hook, src);
  copyFileSync(join(HERE, "_util.mjs"), join(hooks, "_util.mjs"));
  copyFileSync(join(REPO, ".claude", "scripts", "_layout.mjs"), join(scripts, "_layout.mjs"));
  return { root, hook };
}

/** A project repo one level down (the post-2026-07-30 fleet shape), optionally wired to a bare remote. */
function makeRepo(s, name, { remote = false } = {}) {
  const dir = join(s.root, "projects", name);
  mkdirSync(dir, { recursive: true });
  git(dir, "init", "-q", "-b", "main");
  writeFileSync(join(dir, "README.md"), `# ${name}\n`);
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "initial");

  let bare = null;
  if (remote) {
    bare = join(s.root, "remotes", `${name}.git`);
    mkdirSync(dirname(bare), { recursive: true });
    // `-b main` matters: with the global config disabled, a bare repo's HEAD defaults to `master`, and a
    // later clone then checks out nothing ("remote HEAD refers to nonexistent ref"), so the second-machine
    // fixture silently produces no commits and the behind case cannot arise.
    git(s.root, "init", "-q", "--bare", "-b", "main", bare);
    git(dir, "remote", "add", "origin", bare);
    git(dir, "push", "-q", "-u", "origin", "main");
  }
  return { dir, bare, name };
}

function fire(s, { source = "startup" } = {}) {
  try {
    const out = execFileSync(process.execPath, [s.hook], {
      input: JSON.stringify({ source }),
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf8",
      timeout: 120_000,
      env: { ...GIT_ENV, HOOK_USAGE_LOG: "off" },
    });
    return { code: 0, out: out || "" };
  } catch (err) {
    return { code: err.status ?? -1, out: (err.stderr || "") + (err.stdout || "") };
  }
}

const parse = (out) => {
  assert.ok(out.trim(), "expected JSON output, got nothing");
  return JSON.parse(out);
};

/* ═══════════════════ 1. clean and synced ⇒ completely silent ═══════════════════ */
{
  const s = sandbox();
  makeRepo(s, "app-a", { remote: true });
  makeRepo(s, "app-b", { remote: true });
  const r = fire(s);
  assert.equal(r.code, 0, "SessionStart must never fail a session");
  assert.equal(
    r.out.trim(),
    "",
    `nothing out of sync ⇒ no output at all. A hook that speaks every session is one nobody reads:\n${r.out}`,
  );
  rmSync(s.root, { recursive: true, force: true });
}

/* ═══════════════════ 2. THE REGRESSION SHAPE: every repo is found, by name ═══════════════
 * The 2026-07-30 move dropped this hook from 13 repos to 4 with no error. Asserting "it found something"
 * would have passed throughout that. So: name them.
 */
{
  const s = sandbox();
  const a = makeRepo(s, "app-a", { remote: true });
  const b = makeRepo(s, "app-b", { remote: true });
  const c = makeRepo(s, "app-c", { remote: true });
  for (const r of [a, b, c]) writeFileSync(join(r.dir, "dirty.txt"), "uncommitted\n");

  const j = parse(fire(s).out);
  for (const name of ["app-a", "app-b", "app-c"])
    assert.match(
      j.systemMessage,
      new RegExp(`• ${name}: `),
      `${name} was not reported — a nested repo going missing is the exact 2026-07-30 failure, and it is ` +
        `silent:\n${j.systemMessage}`,
    );
  assert.match(j.systemMessage, /3 repo cần chú ý/, "the COUNT is the number a reader checks against a baseline");
  rmSync(s.root, { recursive: true, force: true });
}

/* ═══════════════════ 3. each of the three signals, in both channels ═══════════════ */
{
  // ── dirty
  {
    const s = sandbox();
    const a = makeRepo(s, "app-a", { remote: true });
    writeFileSync(join(a.dir, "one.txt"), "x\n");
    writeFileSync(join(a.dir, "two.txt"), "y\n");
    const j = parse(fire(s).out);
    assert.match(j.systemMessage, /• app-a: ✎2 chưa commit/, j.systemMessage);
    assert.match(j.hookSpecificOutput.additionalContext, /- app-a: 2 uncommitted/, "the model half, in English");
    rmSync(s.root, { recursive: true, force: true });
  }

  // ── ahead (work left unpushed on this machine)
  {
    const s = sandbox();
    const a = makeRepo(s, "app-a", { remote: true });
    writeFileSync(join(a.dir, "local.txt"), "local work\n");
    git(a.dir, "add", "-A");
    git(a.dir, "commit", "-q", "-m", "unpushed");
    const j = parse(fire(s).out);
    assert.match(j.systemMessage, /• app-a: ↑1 chưa push/, j.systemMessage);
    assert.match(j.hookSpecificOutput.additionalContext, /- app-a: ahead 1/, "the model half");
    rmSync(s.root, { recursive: true, force: true });
  }

  // ── behind (someone pushed from another machine) — the case with an explicit ACTION
  {
    const s = sandbox();
    const a = makeRepo(s, "app-a", { remote: true });
    // A second clone stands in for "the other machine": commit there, push, leave this one behind.
    const other = join(s.root, "other-machine");
    git(s.root, "clone", "-q", a.bare, other);
    writeFileSync(join(other, "from-elsewhere.txt"), "written on the laptop\n");
    git(other, "add", "-A");
    git(other, "commit", "-q", "-m", "from the other machine");
    git(other, "push", "-q");

    const j = parse(fire(s).out);
    assert.match(j.systemMessage, /• app-a: ↓1 sau remote \(nên pull\)/, j.systemMessage);
    assert.match(
      j.systemMessage,
      /nên `git pull --ff-only` trước khi sửa để khỏi build trên code cũ/,
      "the user must be told WHY, not just that a number is non-zero",
    );
    const ctx = j.hookSpecificOutput.additionalContext;
    assert.match(ctx, /- app-a: behind 1/, "the model half");
    assert.match(
      ctx,
      /ACTION: app-a are BEHIND origin — local code is stale/,
      "the model needs an instruction, not a status line — this is the memory `git-fetch-before-work` in code",
    );
    assert.match(ctx, /the user works across multiple machines/, "…and the reason it matters here");
    rmSync(s.root, { recursive: true, force: true });
  }

  // ── all three at once, on one repo
  {
    const s = sandbox();
    const a = makeRepo(s, "app-a", { remote: true });
    const other = join(s.root, "other-machine");
    git(s.root, "clone", "-q", a.bare, other);
    writeFileSync(join(other, "remote.txt"), "x\n");
    git(other, "add", "-A");
    git(other, "commit", "-q", "-m", "remote work");
    git(other, "push", "-q");
    writeFileSync(join(a.dir, "local.txt"), "y\n");
    git(a.dir, "add", "-A");
    git(a.dir, "commit", "-q", "-m", "local work");
    writeFileSync(join(a.dir, "scratch.txt"), "z\n");

    const j = parse(fire(s).out);
    assert.match(
      j.systemMessage,
      /• app-a: ↓1 sau remote \(nên pull\), ↑1 chưa push, ✎1 chưa commit/,
      `all three signals must appear together, in a fixed order:\n${j.systemMessage}`,
    );
    rmSync(s.root, { recursive: true, force: true });
  }
}

/* ═══════════════════ 4. the silent paths ═══════════════════ */
{
  // compaction: frequent, automatic, and the repos have not changed since startup
  {
    const s = sandbox();
    const a = makeRepo(s, "app-a", { remote: true });
    writeFileSync(join(a.dir, "dirty.txt"), "x\n");
    assert.equal(
      fire(s, { source: "compact" }).out.trim(),
      "",
      "a compaction must not re-report what was already reported at startup",
    );
    rmSync(s.root, { recursive: true, force: true });
  }

  // no repos at all
  {
    const s = sandbox();
    assert.equal(fire(s).out.trim(), "", "a tree with no git repos has nothing to say");
    rmSync(s.root, { recursive: true, force: true });
  }

  // a repo with no upstream: ahead/behind are unknowable, so only real signals are reported
  {
    const s = sandbox();
    makeRepo(s, "app-a"); // no remote
    assert.equal(
      fire(s).out.trim(),
      "",
      "no tracking branch ⇒ no signal. Reporting 'ahead 1' against a remote that does not exist is noise.",
    );

    const s2 = sandbox();
    const b = makeRepo(s2, "app-b"); // no remote, but dirty
    writeFileSync(join(b.dir, "dirty.txt"), "x\n");
    assert.match(
      parse(fire(s2).out).systemMessage,
      /• app-b: ✎1 chưa commit/,
      "…while an uncommitted change is still worth saying, remote or not",
    );
    rmSync(s.root, { recursive: true, force: true });
    rmSync(s2.root, { recursive: true, force: true });
  }

  // a broken repo must be skipped, not crash the session start
  {
    const s = sandbox();
    makeRepo(s, "app-a", { remote: true });
    const broken = join(s.root, "projects", "app-broken");
    mkdirSync(join(broken, ".git"), { recursive: true });
    writeFileSync(join(broken, ".git", "HEAD"), "garbage\n");
    const r = fire(s);
    assert.equal(r.code, 0, `a corrupt repo must never fail a session start:\n${r.out}`);
    assert.ok(!/app-broken/.test(r.out), "…and must be skipped silently rather than reported as a finding");
    rmSync(s.root, { recursive: true, force: true });
  }
}

/* ─────────── 5. it must never prompt, or the session start hangs ──
 * A repo whose remote needs credentials would block on a password prompt until the timeout; over several
 * repos that turns a session start into a minute of nothing.
 */
{
  const src = readFileSync(HOOK, "utf8");
  assert.match(src, /GIT_TERMINAL_PROMPT: '0'/, "credential prompts must be disabled");
  assert.match(src, /BatchMode=yes/, "…and so must ssh host-key confirmation");
  assert.match(src, /FETCH_TIMEOUT_MS = \d+/, "the network call must be bounded");
}

/* ═══════════════════ 6. the suite must NOTICE a broken guard (mutation) ═══════════════ */
{
  const src = readFileSync(HOOK, "utf8");

  const mutants = [
    {
      name: "repo discovery collapsed to the root (THE 2026-07-30 SHAPE — a smaller, true-looking answer)",
      setup: (s) => {
        const a = makeRepo(s, "app-a", { remote: true });
        writeFileSync(join(a.dir, "dirty.txt"), "x\n");
      },
      apply: (s) => s.replace("const findRepos = (root) => gitRepos(root);", "const findRepos = () => [];"),
      probe: (s) => fire(s).out.trim() === "",
    },
    {
      name: "the behind signal dropped (building on stale code, silently)",
      setup: (s) => {
        const a = makeRepo(s, "app-a", { remote: true });
        const other = join(s.root, "other-machine");
        git(s.root, "clone", "-q", a.bare, other);
        writeFileSync(join(other, "x.txt"), "x\n");
        git(other, "add", "-A");
        git(other, "commit", "-q", "-m", "remote");
        git(other, "push", "-q");
      },
      apply: (s) => s.replace("if (r.behind > 0) bits.push", "if (false) bits.push"),
      // Anchored on the repo's own line, not on the words "sau remote": the static advice line at the bottom
      // of the message contains that phrase too, so the loose regex matched even with the signal removed.
      probe: (s) => !/• app-a: ↓/.test(fire(s).out),
    },
    {
      name: "the ACTION line removed (the model is told a fact but not what to do with it)",
      setup: (s) => {
        const a = makeRepo(s, "app-a", { remote: true });
        const other = join(s.root, "other-machine");
        git(s.root, "clone", "-q", a.bare, other);
        writeFileSync(join(other, "x.txt"), "x\n");
        git(other, "add", "-A");
        git(other, "commit", "-q", "-m", "remote");
        git(other, "push", "-q");
      },
      apply: (s) => s.replace("if (behindNames.length) {", "if (false) {"),
      probe: (s) => !/ACTION: .*BEHIND origin/.test(fire(s).out),
    },
    {
      name: "the compaction guard removed (re-reports on every compact)",
      setup: (s) => {
        const a = makeRepo(s, "app-a", { remote: true });
        writeFileSync(join(a.dir, "dirty.txt"), "x\n");
      },
      apply: (s) => s.replace("if (String(payload.source || '') === 'compact') process.exit(0);", ""),
      probe: (s) => fire(s, { source: "compact" }).out.trim() !== "",
    },
    {
      name: "a clean fleet now reports anyway (the hook becomes wallpaper)",
      setup: (s) => {
        makeRepo(s, "app-a", { remote: true });
      },
      apply: (s) => s.replace("if (!flagged.length) process.exit(0);", ""),
      probe: (s) => fire(s).out.trim() !== "",
    },
  ];

  for (const m of mutants) {
    const mutated = m.apply(src);
    assert.notEqual(mutated, src, `mutation "${m.name}" changed nothing — the patch is stale`);
    const s = sandbox({ src: mutated });
    m.setup(s);
    const sanity = fire(s);
    assert.equal(sanity.code, 0, `mutant "${m.name}" crashed instead of changing behaviour:\n${sanity.out.slice(0, 300)}`);
    const killed = m.probe(s);
    rmSync(s.root, { recursive: true, force: true });
    assert.ok(killed, `SURVIVING MUTANT — "${m.name}" and the suite still passed. Add a case for it.`);
  }
}

/* ─────────── the real fleet must be untouched — every fixture repo lived in a temp dir ── */
{
  const dirty = execFileSync("git", ["status", "--porcelain"], { cwd: REPO, encoding: "utf8" });
  assert.ok(!/app-a|app-b|other-machine|remotes\//.test(dirty), `fixtures leaked into the real repo:\n${dirty}`);
}

console.log(
  "git-sync-check.test.mjs — silent when synced, every nested repo found BY NAME, all three signals in both " +
    "the Vietnamese user channel and the English model channel, the behind-ACTION, compaction/no-repo/" +
    "no-upstream/corrupt-repo silence, no interactive prompts, 5 mutants all killed  ✅",
);
