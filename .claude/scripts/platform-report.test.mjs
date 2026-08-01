// Test for platform-report.mjs — the file that turns measurements into a VERDICT per artefact.
// Run: node .claude/scripts/platform-report.test.mjs
//
// WHY THIS EXISTS. This is the last tool before a human considers deleting something, and on its first two
// runs it was wrong in both directions — which is the whole reason the platform now distrusts its own
// instruments:
//
//   1. `--format="C%at"` used `C` as the record marker. `CLAUDE.md` appears in most commits, so the path line
//      was parsed as a marker, `Number("LAUDE.md")` came out NaN, and EVERY file's age became unknown.
//      Unknown age then read as "cannot prove it is young" and files fell toward WATCH. The most important
//      file in the repo was quietly condemning the rest.
//   2. Renames were not followed. The 2026-07-28 restructure made the entire repo look two days old, so
//      NOTHING could ever qualify as stale. That is the mirror failure — a mechanism that condemns nobody
//      looks safe while having silently stopped working.
//   3. Unknown age was treated as old age, so the script nominated ITSELF thirty seconds after being written.
//
// All three are cases below, marked REGRESSION. They are asserted through a REAL git repository in a temp
// dir with backdated commits, because all three were failures of git parsing and a fixture that fakes the
// git layer would have reproduced none of them.
//
// Per platform/standards/testing.md §2.5 the suite also MUTATES the script and asserts it notices.

import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  readdirSync,
  rmSync,
  copyFileSync,
} from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const SCRIPT = join(HERE, "platform-report.mjs");
const DAY = 86_400_000;

const write = (p, body) => {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, body);
};

const event = (name, input) =>
  JSON.stringify({
    timestamp: new Date().toISOString(),
    message: { content: [{ type: "tool_use", name, input }] },
  });

/**
 * A sandbox that is a REAL git repository: the three regressions this suite exists for were all git-parsing
 * failures, so the git layer is the thing under test and must not be faked.
 */
function sandbox({ files = {}, events = [], skills = [], hookLog = null } = {}) {
  const root = mkdtempSync(join(tmpdir(), "platform-report-"));
  const home = join(root, "__home__");
  const scripts = join(root, ".claude", "scripts");
  mkdirSync(scripts, { recursive: true });
  copyFileSync(SCRIPT, join(scripts, "platform-report.mjs"));
  // platform-report SPAWNS usage-census and refuses to produce a report without it — reuse, never
  // re-implement, so the real one has to be present.
  copyFileSync(join(HERE, "usage-census.mjs"), join(scripts, "usage-census.mjs"));

  for (const [rel, body] of Object.entries(files)) write(join(root, rel), body);
  for (const s of skills)
    write(join(root, ".claude", "skills", s, "SKILL.md"), `---\nname: ${s}\n---\nbody\n`);

  const tdir = join(home, ".claude", "projects", "-home-thien-projects-fleet");
  mkdirSync(tdir, { recursive: true });
  writeFileSync(join(tdir, "s.jsonl"), events.join("\n") + (events.length ? "\n" : ""));

  const git = (...args) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        GIT_CONFIG_GLOBAL: "/dev/null", // never read the developer's own git config
        GIT_CONFIG_SYSTEM: "/dev/null",
      },
    });
  git("init", "-q", "-b", "main");
  git("config", "user.email", "test@example.invalid");
  git("config", "user.name", "Fixture");

  /** Commit everything currently staged, dated `daysAgo` days back. */
  const commit = (message, daysAgo = 0) => {
    const when = new Date(Date.now() - daysAgo * DAY).toISOString();
    git("add", "-A");
    execFileSync("git", ["commit", "-q", "-m", message], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_CONFIG_SYSTEM: "/dev/null",
        GIT_AUTHOR_DATE: when,
        GIT_COMMITTER_DATE: when,
      },
    });
  };

  let hookLogPath = join(root, "__nolog__.jsonl");
  if (hookLog) {
    hookLogPath = join(root, "hook-usage.jsonl");
    writeFileSync(hookLogPath, hookLog.join("\n") + "\n");
  }
  return { root, home, scripts, git, commit, hookLogPath };
}

function report(s, args = []) {
  const r = spawnSync(process.execPath, [join(s.scripts, "platform-report.mjs"), ...args], {
    encoding: "utf8",
    timeout: 180_000,
    cwd: s.root,
    // HOME redirects os.homedir() on POSIX only — on Windows it reads USERPROFILE, so without this the
    // sandbox is ignored and every case silently measures the REAL transcript store instead of its fixtures.
    env: {
      ...process.env,
      HOME: s.home,
      USERPROFILE: s.home,
      HOOK_USAGE_LOG: s.hookLogPath,
    },
  });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

/** path → row, from --json. */
function rows(s, args = []) {
  const { out, code } = report(s, ["--json", ...args]);
  assert.equal(code, 0, `platform-report exited ${code}:\n${out.slice(0, 800)}`);
  const j = JSON.parse(out);
  return Object.fromEntries(j.rows.map((r) => [r.path, r]));
}

/* ═══════════ 1. REGRESSION: a path beginning with the record marker must not break ages ═════════
 * `CLAUDE.md` is in most commits. When the marker was `C`, its path line was read as a timestamp line and
 * every age in the repo became NaN → unknown → drifting toward WATCH.
 *
 * HONEST SCOPE, established by mutation: the ORIGINAL bug is no longer reachable, because the command has
 * since moved to `--name-status` and every path line now carries a status prefix. This case is a canary for
 * the class, not proof of the fix; the reachable version of the same failure is mutated in section 10 using
 * `R`, which really does occur in the data as a rename status.
 */
{
  const s = sandbox({
    files: {
      "CLAUDE.md": "# the constitution\n",
      "platform/standards/zebra-standard.md": "# a standard\n",
    },
  });
  s.commit("initial, with CLAUDE.md alongside another file", 60);

  const r = rows(s);
  assert.ok(
    Number.isFinite(r["platform/standards/zebra-standard.md"].first),
    "a file committed ALONGSIDE CLAUDE.md must still have a parseable first-seen date — this is the \\x01 " +
      "marker regression, and its symptom was every age in the repo becoming unknown",
  );
  assert.equal(
    r["platform/standards/zebra-standard.md"].commits,
    1,
    "its commit must be counted, not swallowed by the marker collision",
  );
  assert.ok(
    Number.isFinite(r["CLAUDE.md"].first),
    "and CLAUDE.md itself must have a date, not NaN",
  );
  rmSync(s.root, { recursive: true, force: true });
}

/* ═══════════════ 2. REGRESSION: renames must be followed, or nothing is ever old ══════════════ */
{
  const s = sandbox({ files: { "platform/standards/old-name.md": "# a standard\n" } });
  s.commit("create it", 90);
  s.git("mv", "platform/standards/old-name.md", "platform/standards/new-name.md");
  s.commit("rename it (the 2026-07-28 restructure, in miniature)", 1);

  const r = rows(s)["platform/standards/new-name.md"];
  const ageDays = Math.round((Date.now() - r.first) / DAY);
  assert.ok(
    ageDays >= 85,
    `the file is 90 days old and was renamed yesterday; without rename tracking it reads as ${ageDays}d ` +
      "and can never qualify as stale — the failure that made the whole repo look two days old",
  );
  assert.equal(r.commits, 2, "both commits must accrue to the file's CURRENT path");
  rmSync(s.root, { recursive: true, force: true });
}

/* ═══════════ 3. REGRESSION: unknown age lands in NEW, never WATCH ══════════════════
 * The first run of this script nominated itself thirty seconds after being written.
 */
{
  const s = sandbox({ files: { "platform/standards/committed.md": "# old\n" } });
  s.commit("only this one is committed", 60);
  // Written after the commit: it has no git history at all.
  write(join(s.root, "platform/standards/uncommitted.md"), "# brand new, never committed\n");

  const r = rows(s);
  assert.equal(
    r["platform/standards/uncommitted.md"].v,
    "NEW",
    "a file with no git history gets the benefit of the doubt — absence of history is not evidence of age",
  );
  assert.match(
    r["platform/standards/uncommitted.md"].why,
    /age unknown, so it cannot be judged/,
    "and the reason must say WHY it cannot be judged, not just assign a label",
  );
  assert.equal(
    r["platform/standards/committed.md"].v,
    "WATCH",
    "…while a genuinely old, unused, unlinked file does qualify",
  );
  rmSync(s.root, { recursive: true, force: true });
}

/* ─────────────────────────── 4. the verdict ladder, one rung at a time ── */
{
  const s = sandbox({
    files: {
      // ACTIVE: one recorded read is enough
      "platform/standards/used.md": "# read once\n",
      // ANCHOR: unread, but cited by two files
      "platform/standards/anchored.md": "# cited\n",
      "platform/registries/citer-one.md": "see anchored.md\n",
      "platform/registries/citer-two.md": "also anchored.md\n",
      // WATCH: old, unused, ≤1 inbound link
      "platform/standards/forgotten.md": "# nobody\n",
      // PROTECTED classes
      ".claude/memory/tapir-memory.md": "# a memory\n",
      "platform/log/2026-06-01.md": "# a day log\n",
      "platform/ledger/2026-06.md": "# the archive\n",
      "platform/inventory.md": "# the source of truth\n",
      "platform/standards/README.md": "# an index\n",
      "platform/targets/nuc/agent-rebuild-runbook.md": "# a runbook\n",
      "platform/backup/restore.md": "# restore docs\n",
    },
    events: [event("Read", { file_path: "platform/standards/used.md" })],
  });
  s.commit("everything, 60 days ago", 60);

  const r = rows(s);
  assert.equal(r["platform/standards/used.md"].v, "ACTIVE");
  assert.match(r["platform/standards/used.md"].why, /1 recorded use/);

  assert.equal(r["platform/standards/anchored.md"].v, "ANCHOR");
  assert.match(
    r["platform/standards/anchored.md"].why,
    /deleting it breaks their references/,
    "the ANCHOR reason must state the consequence — that is what stops the deletion",
  );

  assert.equal(r["platform/standards/forgotten.md"].v, "WATCH");
  assert.match(
    r["platform/standards/forgotten.md"].why,
    /eligible for the attic, NOT for deletion/,
    "even the actionable class must say what it is NOT",
  );

  for (const [path, expect] of [
    [".claude/memory/tapir-memory.md", /injected by the harness/],
    ["platform/log/2026-06-01.md", /read as a TIER/],
    ["platform/ledger/2026-06.md", /rarely read and never lost/],
    ["platform/inventory.md", /single source of truth/],
    ["platform/standards/README.md", /index or template/],
    ["platform/targets/nuc/agent-rebuild-runbook.md", /earns its keep on the day it is needed/],
    ["platform/backup/restore.md", /restore documentation/],
  ]) {
    assert.equal(r[path].v, "PROTECTED", `${path} must be PROTECTED`);
    assert.match(
      r[path].why,
      expect,
      `${path}: PROTECTED must name the measurement that is BLIND, not merely exempt the file`,
    );
  }
  rmSync(s.root, { recursive: true, force: true });
}

/* ───────── 5. PROTECTED outranks everything, including a WATCH-shaped file ── */
{
  const s = sandbox({ files: { ".claude/memory/never-opened.md": "# a memory nobody read\n" } });
  s.commit("a year ago", 365);
  const r = rows(s)[".claude/memory/never-opened.md"];
  assert.equal(
    r.v,
    "PROTECTED",
    "a memory that is old, unread and unlinked is STILL protected — the counter cannot see memory at all, " +
      "so its zero is a fact about the instrument",
  );
  rmSync(s.root, { recursive: true, force: true });
}

/* ─────────── 6. `NEW` is a time window, not a permanent excuse ── */
{
  const s = sandbox({ files: { "platform/standards/recent.md": "# written last week\n" } });
  s.commit("recent", 7);
  const r = rows(s)["platform/standards/recent.md"];
  assert.equal(r.v, "NEW", "7 days old must not be judged");
  assert.match(r.why, /too early for silence to mean anything/);
  rmSync(s.root, { recursive: true, force: true });
}

/* ─────────── 7. outbound links: the mirror of `in`, and the reason a MOVE is dangerous ── */
{
  const s = sandbox({
    files: {
      "platform/standards/hub-standard.md":
        "this cites zebra-standard.md and quokka-registry.md and hub-standard.md itself\n",
      "platform/standards/zebra-standard.md": "# a\n",
      "platform/registries/quokka-registry.md": "# b\n",
    },
  });
  s.commit("all", 60);
  const r = rows(s);
  assert.equal(
    r["platform/standards/hub-standard.md"].linksOut,
    2,
    "two distinct artefacts cited; the self-citation must not count",
  );
  assert.equal(r["platform/standards/zebra-standard.md"].linksOut, 0);
  rmSync(s.root, { recursive: true, force: true });
}

/* ═════════ 8. the report's own framing — the sentences that stop it reading as a deletion order ═════ */
{
  const s = sandbox({
    files: {
      "platform/standards/forgotten.md": "# nobody\n",
      ".claude/memory/tapir-memory.md": "# a memory\n",
    },
  });
  s.commit("all", 60);

  const { out, code } = report(s, ["--stdout"]);
  assert.equal(code, 0, "always exit 0 — a report that fails a build is a report people stop generating");
  assert.match(out, /Không có gì trong file này là lệnh xoá/, "the no-deletion framing, in the supervisor's language");
  assert.match(out, /Công cụ \*đo\*; tôi \(agent\) \*diễn giải\*; bạn \*quyết\*/, "the three-source arrangement");
  // The count is not asserted: the sandbox's own copies of the two scripts are artefacts too, and pinning
  // a number here would make the case fail every time the fixture gains a file — a brittle assertion that
  // teaches a future author to loosen the wrong thing. What matters is that the section exists and that the
  // file which qualifies is IN it.
  assert.match(out, /## The only actionable list: \d+ `WATCH` file\(s\)/, `the WATCH section:\n${out.slice(0, 400)}`);
  assert.match(
    out,
    /\| `platform\/standards\/forgotten\.md` \| no recorded use, 0 inbound link\(s\), \d+d old/,
    "the qualifying file must be listed with the evidence that put it there",
  );
  assert.match(out, /"the counter says 0" is not a reason/, "the bar for staging must be stated in the report");
  assert.match(out, /## How to disagree with this report/, "the supervisor must be told how to overrule it");
  assert.match(
    out,
    /one read by the agent while auditing counts as use/,
    "the observer effect must be disclosed — the report cannot tell 'consulted' from 'audited'",
  );
  assert.match(out, /\| Column \| Source \| What it can and cannot see \|/, "every column must declare its blindness");

  // --stdout must NOT write a file; the default must.
  assert.ok(!existsSync(join(s.root, "platform", "reports")), "--stdout must not write anything");
  const written = report(s);
  assert.match(written.out, /^written: platform\/reports\/\d{4}-\d{2}-\d{2}-platform-report\.md/, written.out);
  const files = readdirSync(join(s.root, "platform", "reports"));
  assert.equal(files.length, 1, `exactly one report file: ${files.join(", ")}`);
  // LOCAL date, not UTC: at +07 a UTC filename is a day behind the supervisor's evening work.
  const localToday = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
  assert.equal(files[0], `${localToday}-platform-report.md`, "the filename must use the LOCAL date");
  rmSync(s.root, { recursive: true, force: true });
}

/* ─────────── 9. --path filters, and a broken census must not produce a confident report ── */
{
  const s = sandbox({
    files: {
      "platform/standards/zebra-standard.md": "# a\n",
      ".claude/scripts/ibis-script.mjs": "// b\n",
    },
  });
  s.commit("all", 60);
  const filtered = rows(s, ["--path", "platform/"]);
  assert.ok(filtered["platform/standards/zebra-standard.md"], "the filter must keep matching paths");
  assert.ok(!filtered[".claude/scripts/ibis-script.mjs"], "…and drop the rest");

  // Replace the census with something that returns garbage: the report must refuse, not invent.
  writeFileSync(join(s.scripts, "usage-census.mjs"), 'console.log("not json");\n');
  const { out, code } = report(s, ["--stdout"]);
  assert.equal(code, 0, "it must exit 0 rather than fail a build");
  assert.match(
    out,
    /usage-census --json failed; the report cannot be trusted without it/,
    "a report built on a broken measurement must say so and stop, not degrade silently",
  );
  assert.doesNotMatch(out, /## Summary/, "and it must NOT emit a report");
  rmSync(s.root, { recursive: true, force: true });
}

/* ═════════ 9b. the hook column must carry `n/a` across the process boundary ══════════════════════
 *
 * This report does not measure hooks itself — it spawns `usage-census --json` and renders the rows. As of
 * 2026-08-01 usage-census reports `fired: null` for a hook with no exit-2 path, because 7 of 15 hooks can
 * never exit 2 and a zero there condemns a working guard. The render used `r.fired ?? 0`, which turns that
 * null straight back into `0` — the defect re-appearing on the far side of the pipe, in the one document the
 * supervisor is told to audit the agent's judgement with. Untested until this case existed. */
{
  const s = sandbox({
    files: {
      ".claude/hooks/tapir-hook.mjs": "process.exit(0);\n", // speaks at exit 0 ⇒ n/a
      ".claude/hooks/dingo-hook.mjs": "if (bad) process.exit(2);\n", // can block ⇒ a real number
    },
    hookLog: [
      JSON.stringify({ ts: new Date().toISOString(), hook: "tapir-hook.mjs", code: 0, ms: 1 }),
      JSON.stringify({ ts: new Date().toISOString(), hook: "dingo-hook.mjs", code: 0, ms: 1 }),
    ],
  });
  s.commit("hooks");
  const { out } = report(s, ["--stdout"]);
  assert.match(
    out,
    /tapir-hook\.mjs.*\| 1\/n\/a \|/,
    `a hook with no exit-2 path must render ran/fired as 1/n/a:\n${out
      .split("\n")
      .filter((l) => /tapir/.test(l))
      .join("\n")}`,
  );
  assert.match(
    out,
    /dingo-hook\.mjs.*\| 1\/0 \|/,
    "…and a hook that CAN block keeps a real 0, which is a measurement",
  );
  assert.match(
    out,
    /`n\/a` means the hook has no exit-2 path/,
    "the legend must explain n/a, or a reader treats the gap as missing data",
  );
  rmSync(s.root, { recursive: true, force: true });
}

/* ───────────────────── 10. the suite must NOTICE a broken verdict engine (mutation) ── */
{
  // LF-normalized: on a CRLF working tree (Windows) every multi-line mutation patch below would go stale.
  const src = readFileSync(SCRIPT, "utf8").replace(/\r\n/g, "\n");

  const mutants = [
    {
      // FINDING, 2026-07-30. The original defect was a `C` marker colliding with `CLAUDE.md`, and a mutant
      // restoring `C` SURVIVES today — because the command has since moved to `--name-status`, so every path
      // line is prefixed by a status letter and a bare `CLAUDE.md` line can no longer occur. The historical
      // bug is unreachable, which means a mutant reproducing it proves nothing.
      //
      // The separation it protects is still real, though: git's status letters include `R` (and `C`, if
      // copy detection is ever switched on with `-C`). So the mutant uses `R`, which DOES appear in the data
      // as `R100\told\tnew` — the same class of failure, reachable with the code as it stands.
      name: "the record marker set to a letter that occurs in the data (`R`, a rename status)",
      spec: { files: { "platform/standards/old-name.md": "# a\n" } },
      days: 90,
      after: (s) => {
        s.git("mv", "platform/standards/old-name.md", "platform/standards/new-name.md");
        s.commit("rename", 1);
      },
      // NOTE: the replacement must be a FUNCTION. `String.replace` treats `$'` in a string replacement as
      // "everything after the match", so passing "--format=$'R%at'" splices the rest of the file in and
      // produces a syntax error — which the sanity check above caught, correctly refusing to call it a kill.
      apply: (s) =>
        s
          .replace("--format=$'\\\\x01%at'", () => "--format=$'R%at'")
          .replace('line.startsWith("\\x01")', () => 'line.startsWith("R")'),
      probe: (s) => !Number.isFinite(rows(s)["platform/standards/new-name.md"].first),
    },
    {
      // FINDING: simply deleting `-M` SURVIVES, because git has detected renames by default since 2.9
      // (`diff.renames=true`). So `-M` is not what makes case 2 pass — it is insurance against a config that
      // turns the default off, which is real work in an environment nobody controls, but not the mechanism.
      // The mutant therefore has to disable rename detection outright to be a behavioural change at all.
      name: "rename tracking disabled (--no-renames)",
      spec: { files: { "platform/standards/old-name.md": "# a\n" } },
      after: (s) => {
        s.git("mv", "platform/standards/old-name.md", "platform/standards/new-name.md");
        s.commit("rename", 1);
      },
      days: 90,
      // The anchor includes `%at'` on purpose. `--name-status -M` also appears in the docstring that
      // EXPLAINS this fix, and it appears there FIRST — so the obvious patch silently mutated a comment and
      // the mutant "survived". A mutation patch has to be anchored on code, and the only reason this was
      // caught is that a surviving mutant is investigated rather than explained away.
      // Anchored on the ARGUMENT ARRAY, which is where the flag now lives: the git call stopped going through
      // a shell (there is no /bin/bash on Windows, so it threw and every age read as unknown), and the old
      // anchor was the shell string.
      apply: (s) =>
        s.replace('"--name-status", "-M"', () => '"--name-status", "--no-renames"'),
      probe: (s) => {
        const r = rows(s)["platform/standards/new-name.md"];
        return Math.round((Date.now() - r.first) / DAY) < 5;
      },
    },
    {
      name: "unknown age treated as OLD age (self-condemnation)",
      spec: { files: { "platform/standards/committed.md": "# a\n" } },
      days: 60,
      after: (s) => write(join(s.root, "platform/standards/uncommitted.md"), "# new\n"),
      // FINDING: removing only the explicit `ageDays === null` branch SURVIVES, because the very next line
      // is `ageDays < MIN_AGE_DAYS` and `null < 30` coerces to true — unknown age lands in NEW by accident.
      // That accident evaporates the moment MIN_AGE_DAYS is 0, so the explicit branch is doing real work and
      // the mutant has to defeat both layers to be honest about what is being protected. What the single-layer
      // mutant DOES change is the explanation ("0d old" instead of "age unknown"), which is what the
      // supervisor reads — hence the `why` assertion in case 3.
      apply: (s) =>
        s
          .replace(
            'if (ageDays === null)\n    return {\n      v: "NEW",',
            'if (false)\n    return {\n      v: "NEW",',
          )
          .replace(
            "if (ageDays < MIN_AGE_DAYS)",
            "if (ageDays !== null && ageDays < MIN_AGE_DAYS)",
          ),
      probe: (s) => rows(s)["platform/standards/uncommitted.md"].v === "WATCH",
    },
    {
      name: "the PROTECTED classes emptied",
      spec: { files: { ".claude/memory/tapir-memory.md": "# a memory\n" } },
      days: 60,
      apply: (s) => s.replace(/const PROTECTED = \[[\s\S]*?\n\];/, "const PROTECTED = [];"),
      probe: (s) => rows(s)[".claude/memory/tapir-memory.md"].v === "WATCH",
    },
    {
      name: "ANCHOR protection removed (a cited file becomes a candidate)",
      spec: {
        files: {
          "platform/standards/anchored.md": "# cited\n",
          "platform/registries/citer-one.md": "see anchored.md\n",
          "platform/registries/citer-two.md": "also anchored.md\n",
        },
      },
      days: 60,
      apply: (s) => s.replace("if (r.links > 1)", "if (false)"),
      probe: (s) => rows(s)["platform/standards/anchored.md"].v === "WATCH",
    },
    {
      name: "the age threshold collapsed to 0 (everything is instantly judgeable)",
      spec: { files: { "platform/standards/recent.md": "# a\n" } },
      days: 7,
      apply: (s) => s.replace("const MIN_AGE_DAYS = 30;", "const MIN_AGE_DAYS = 0;"),
      probe: (s) => rows(s)["platform/standards/recent.md"].v === "WATCH",
    },
    {
      name: "the no-deletion framing removed from the report",
      spec: { files: { "platform/standards/zebra-standard.md": "# a\n" } },
      days: 60,
      apply: (s) => s.replace("**Không có gì trong file này là lệnh xoá.**", "Notes."),
      probe: (s) => !/Không có gì trong file này là lệnh xoá/.test(report(s, ["--stdout"]).out),
    },
  ];

  for (const m of mutants) {
    const s = sandbox(m.spec);
    s.commit("fixture", m.days ?? 60);
    m.after?.(s);
    const mutated = m.apply(src);
    assert.notEqual(mutated, src, `mutation "${m.name}" changed nothing — the patch is stale`);
    writeFileSync(join(s.scripts, "platform-report.mjs"), mutated);

    // A mutant must still RUN: one that only crashes proves the suite notices a broken file, not the
    // behaviour claimed. (Hit twice on 2026-07-30 before this check existed.)
    const sanity = report(s, ["--json"]);
    let ran = false;
    try {
      ran = Array.isArray(JSON.parse(sanity.out).rows);
    } catch {
      ran = false;
    }
    assert.ok(
      ran,
      `mutant "${m.name}" did not run — syntax error, not a behavioural change:\n${sanity.out.slice(0, 400)}`,
    );

    const killed = m.probe(s);
    rmSync(s.root, { recursive: true, force: true });
    assert.ok(killed, `SURVIVING MUTANT — "${m.name}" and the suite still passed. Add a case for it.`);
  }
}

/* ─────────────── the real repo must be untouched — every fixture lived in a temp dir ── */
{
  const dirty = spawnSync("git", ["status", "--porcelain"], { cwd: REPO, encoding: "utf8" }).stdout;
  assert.ok(
    !/zebra|quokka|tapir|forgotten|anchored/.test(dirty),
    `the suite leaked fixtures into the real repo:\n${dirty}`,
  );
}

console.log(
  "platform-report.test.mjs — the 3 measured regressions (marker-vs-data separation, rename following, " +
    "unknown age), " +
    "the full verdict ladder, 7 PROTECTED classes with their stated blindness, outbound links, the report's " +
    "no-deletion framing, `n/a` surviving the census pipe, a refused report on a broken census, " +
    "7 mutants all killed  ✅",
);
