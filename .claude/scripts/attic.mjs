#!/usr/bin/env node
/**
 * attic.mjs — the staged, evidence-bearing retirement mechanism. It never deletes anything.
 *
 * WHY THIS EXISTS, and what it is defending against. Deleting the wrong file in this repo destroys work that
 * cannot be reconstructed from anywhere else — the knowledge base IS the accumulated output. And the danger
 * is not carelessness, it is CONFIDENCE: on 2026-07-30 a checker declared 14 live skills dead because of a
 * path assumption, and this script's own sibling nominated itself for retirement 30 seconds after being
 * written, because an unknown age read as an old age. Both were fluent, specific and wrong.
 *
 * So the design principle is presumption of innocence: **the burden of proof is on deletion, never on
 * keeping.** A file is not retired because nobody can show it is used; it is retired only when someone can
 * show what replaced it, and then only after time has failed to contradict that.
 *
 * THE PROCEDURE, and no step is skippable:
 *   stage    file must be WATCH in platform-report (no recorded use · ≤1 inbound link · >30 days old), must
 *            not be in a PROTECTED class, and must carry a written reason. An evidence snapshot of every
 *            metric at that moment is recorded, so a later disagreement argues with data, not memory.
 *   wait     ≥30 days AND ≥4 sessions. The wait IS the experiment: it is the only way to observe the need
 *            for something you have not thought of.
 *   verify   re-measures. ANY sign of life — a new inbound reference, a read, a mention — exonerates the
 *            file, restores it, and the clock is gone, not paused.
 *   ready    lists what has served its time with no sign of life, and prints the command for a HUMAN.
 *            There is deliberately no `delete` subcommand: the irreversible step is not the agent's to run.
 *
 * Usage:
 *   node .claude/scripts/attic.mjs list
 *   node .claude/scripts/attic.mjs stage <path> --reason "<≥20 chars>" [--superseded-by <path>] [--force]
 *   node .claude/scripts/attic.mjs verify
 *   node .claude/scripts/attic.mjs ready
 *   node .claude/scripts/attic.mjs restore <basename>
 *
 * Exit code: 1 on a refused stage or a failed verify, 0 otherwise.
 */

import { execFileSync, execSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join, resolve, dirname, basename, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ATTIC = join(REPO, "platform", "attic");
const MANIFEST = join(ATTIC, "MANIFEST.md");
const EVIDENCE = join(ATTIC, "evidence");
const WAIT_DAYS = 30;
const WAIT_SESSIONS = 4;

const cmd = process.argv[2];
const arg = (f) => {
  const i = process.argv.indexOf(f);
  return i > -1 ? process.argv[i + 1] : null;
};
const has = (f) => process.argv.includes(f);
const die = (msg) => {
  console.error(msg);
  process.exit(1);
};

/* ─────────────────────────────────────────────────────────────────────────────────── evidence ── */

/**
 * A mention is only an obstacle if it is an INSTRUCTION. The day-log, the ledger and closed plans describe
 * what was true on a date; they do not require the file to keep existing, and they must never be edited to
 * make a retirement possible. Everything else — a standard, a registry, a skill, a live plan, a hook,
 * CLAUDE.md — is a live pointer, and staging past one strands a reader.
 *
 * Without this split the mechanism is unusable rather than safe: the sandbox below is named in 55 files, of
 * which 50 are history. A rule that blocks on any mention blocks forever, and a rule that blocks forever is
 * a rule people route around.
 */
function splitMentions(files) {
  const live = [];
  const historical = [];
  for (const f of files) {
    const isHistory =
      /^platform\/(log|ledger|reports|attic)\//.test(f) ||
      (/^platform\/plans\//.test(f) &&
        /^status:\s*(done|abandoned|superseded|rejected)\b/im.test(
          safeRead(f),
        ));
    (isHistory ? historical : live).push(f);
  }
  return { live, historical };
}
const safeRead = (f) => {
  try {
    return readFileSync(join(REPO, f), "utf8");
  } catch {
    return "";
  }
};

/** Every metric the platform can produce for one path, at this instant. The snapshot is the argument. */
function measure(path) {
  const r = spawnSync(
    process.execPath,
    [join(REPO, ".claude/scripts/platform-report.mjs"), "--json"],
    {
      encoding: "utf8",
      maxBuffer: 1 << 26,
      cwd: REPO,
    },
  );
  let row = null;
  try {
    row = JSON.parse(r.stdout).rows.find((x) => x.path === path) ?? null;
  } catch {
    die(
      "attic: platform-report --json failed — refusing to stage anything without evidence",
    );
  }
  // Signals platform-report does not carry: who mentions this file by NAME anywhere in the tree right now.
  const name = basename(path);
  let mentions = [];
  try {
    mentions = execSync(
      `grep -rl --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=attic -F ${JSON.stringify(name)} platform .claude CLAUDE.md 2>/dev/null || true`,
      { cwd: REPO, encoding: "utf8" },
    )
      .split("\n")
      .filter((l) => l.trim() && !l.includes(path));
  } catch {
    /* grep found nothing */
  }
  const split = splitMentions(mentions);
  return {
    at: new Date().toISOString(),
    row,
    mentions: split.live,
    historical: split.historical,
    sessions: sessionCount(),
  };
}

/**
 * A DIRECTORY is retirable only as a whole, and only when nothing inside it is alive. A sandbox, a plan
 * folder, a superseded skill draft — these are units: staging three of their four files leaves the
 * remainder pointing at holes, which is a worse state than either keeping or removing the lot.
 *
 * The rule, deliberately strict: every inventoried file inside must be WATCH or NEW, and nothing OUTSIDE
 * the directory may mention any of them by name. One ACTIVE or ANCHOR file vetoes the whole unit.
 */
function measureDir(rel) {
  const r = spawnSync(
    process.execPath,
    [join(REPO, ".claude/scripts/platform-report.mjs"), "--json"],
    {
      encoding: "utf8",
      maxBuffer: 1 << 26,
      cwd: REPO,
    },
  );
  let rows;
  try {
    rows = JSON.parse(r.stdout).rows.filter((x) =>
      x.path.startsWith(rel.replace(/\/$/, "") + "/"),
    );
  } catch {
    die(
      "attic: platform-report --json failed — refusing to stage anything without evidence",
    );
  }
  if (!rows.length)
    return {
      at: new Date().toISOString(),
      row: null,
      mentions: [],
      sessions: sessionCount(),
    };

  const alive = rows.filter(
    (x) => x.v === "ACTIVE" || x.v === "ANCHOR" || x.v === "PROTECTED",
  );
  const worst = alive.length ? alive[0] : null;

  // Mentions from OUTSIDE the unit only — files inside it naturally reference each other. Generic
  // basenames (README.md, INSTALL.md) are searched as the DIRECTORY name instead: grepping for "README.md"
  // matches most of the repo and reported 37 live blockers for a unit nothing actually points at.
  const GENERIC =
    /^(README|INSTALL|SKILL|MANIFEST|CHANGELOG|LICENSE|_TEMPLATE|index|page|layout|route)\.\w+$/i;
  const names = [
    ...new Set([
      basename(rel),
      ...rows.map((x) => basename(x.path)).filter((n) => !GENERIC.test(n)),
    ]),
  ];
  const mentions = new Set();
  for (const n of names) {
    let out = "";
    try {
      out = execSync(
        `grep -rl --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=attic -F ${JSON.stringify(n)} platform .claude CLAUDE.md 2>/dev/null || true`,
        { cwd: REPO, encoding: "utf8" },
      );
    } catch {
      /* none */
    }
    for (const l of out.split("\n"))
      if (l.trim() && !l.startsWith(rel)) mentions.add(l.trim());
  }
  const split = splitMentions([...mentions]);

  return {
    at: new Date().toISOString(),
    row: worst
      ? {
          path: rel,
          v: worst.v,
          why: `${basename(worst.path)} inside it is ${worst.v} — ${worst.why}`,
        }
      : {
          path: rel,
          v: "WATCH",
          why: `${rows.length} file(s) inside, none of them ACTIVE, ANCHOR or PROTECTED`,
        },
    files: rows,
    mentions: split.live,
    historical: split.historical,
    sessions: sessionCount(),
  };
}

/** How many recorded sessions exist. The wait is counted in sessions as well as days: 30 quiet days while
 *  nobody worked proves nothing at all. */
function sessionCount() {
  const root = join(homedir(), ".claude", "projects");
  if (!existsSync(root)) return 0;
  let n = 0;
  for (const d of readdirSync(root)) {
    const p = join(root, d);
    try {
      if (statSync(p).isDirectory())
        n += readdirSync(p).filter((f) => f.endsWith(".jsonl")).length;
    } catch {
      /* unreadable */
    }
  }
  return n;
}

/* ─────────────────────────────────────────────────────────────────────────────────── manifest ── */

const MANIFEST_HEADER = `# Attic manifest

Files staged for retirement. **Nothing here has been deleted**, and nothing here may be deleted by a tool.

Read this table as a set of open questions, not decisions. A row leaves this file in one of two ways:

- **restored** — any sign of life during the wait. The file goes back and the clock is not paused, it is gone.
- **deleted** — by the supervisor, by hand, after \`node .claude/scripts/attic.mjs ready\` lists it and he agrees.

The evidence snapshot taken at staging time is in \`evidence/\`, so a later disagreement argues with the
numbers as they were, rather than with anyone's memory of them.

| staged | file | reason | superseded by | earliest delete | status |
|---|---|---|---|---|---|
`;

function readManifest() {
  if (!existsSync(MANIFEST)) return [];
  return readFileSync(MANIFEST, "utf8")
    .split("\n")
    .filter((l) => /^\| \d{4}-\d{2}-\d{2} \|/.test(l))
    .map((l) => {
      const c = l.split("|").map((x) => x.trim());
      return {
        staged: c[1],
        file: c[2].replace(/`/g, ""),
        reason: c[3],
        superseded: c[4],
        earliest: c[5],
        status: c[6],
        raw: l,
      };
    });
}

function writeManifest(rows) {
  mkdirSync(ATTIC, { recursive: true });
  writeFileSync(
    MANIFEST,
    MANIFEST_HEADER + rows.map((r) => r.raw).join("\n") + "\n",
  );
}

const today = () =>
  new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
const plusDays = (n) =>
  new Date(Date.now() + n * 86400_000 - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);

/* ──────────────────────────────────────────────────────────────────────────────── subcommands ── */

function stage() {
  const target = process.argv[3];
  if (!target || target.startsWith("--"))
    die(
      'usage: attic.mjs stage <path> --reason "<why>" [--superseded-by <path>]',
    );
  const rel = relative(REPO, resolve(REPO, target));
  if (!existsSync(join(REPO, rel))) die(`attic: ${rel} does not exist`);

  const reason = arg("--reason");
  if (!reason || reason.length < 20)
    die(
      "attic: --reason is required and must be a real sentence (≥20 chars).\n" +
        '       "unused" is not a reason — the counter already said that, and the counter has been wrong.\n' +
        "       State what replaced it, or why it can never be needed again.",
    );

  const isDir = statSync(join(REPO, rel)).isDirectory();
  const ev = isDir ? measureDir(rel) : measure(rel);
  const row = ev.row;
  if (!row)
    die(
      `attic: ${rel} is not in platform-report's inventory, so there is no evidence to stage it on.\n` +
        `       Widen the inventory in usage-census.mjs rather than staging something unmeasured.`,
    );

  if (row.v !== "WATCH" && !has("--force"))
    die(
      `attic: REFUSED. ${rel} is ${row.v}, not WATCH.\n` +
        `       ${row.why}\n` +
        `       Only WATCH qualifies. If you believe the verdict is wrong, pass --force and the override is\n` +
        `       recorded in the manifest as an override — never silently.`,
    );
  if (row.v === "PROTECTED")
    die(
      `attic: REFUSED and --force does not apply. ${rel} is PROTECTED: ${row.why}`,
    );
  if (ev.mentions.length && !has("--force"))
    die(
      `attic: REFUSED. ${ev.mentions.length} LIVE document(s) still point at \`${basename(rel)}\`:\n` +
        ev.mentions.map((m) => `         ${m}`).join("\n") +
        `\n       Staging it would strand a reader. Update those first, or --force with a reason.\n` +
        `       (${(ev.historical ?? []).length} historical mention(s) in log/ledger/closed plans do NOT block —\n` +
        `        they describe what was true on a date and are never edited to enable a retirement.)`,
    );

  const monthDir = join(ATTIC, today().slice(0, 7));
  mkdirSync(monthDir, { recursive: true });
  mkdirSync(EVIDENCE, { recursive: true });
  const dest = join(monthDir, basename(rel));
  if (existsSync(dest))
    die(`attic: ${relative(REPO, dest)} already exists — resolve by hand`);

  execFileSync("git", ["mv", rel, relative(REPO, dest)], { cwd: REPO });
  writeFileSync(
    join(EVIDENCE, `${basename(rel)}.json`),
    JSON.stringify(
      { original: rel, staged: today(), reason, evidence: ev },
      null,
      2,
    ),
  );

  const rows = readManifest();
  const forced = has("--force") ? " ⚠ OVERRIDE" : "";
  const raw = `| ${today()} | \`${relative(REPO, dest)}\` | ${reason}${forced} | ${arg("--superseded-by") ?? "—"} | ${plusDays(WAIT_DAYS)} | staged |`;
  rows.push({ raw });
  writeManifest(rows);

  console.log(`staged: ${rel} → ${relative(REPO, dest)}`);
  console.log(`  evidence: platform/attic/evidence/${basename(rel)}.json`);
  console.log(
    `  earliest delete: ${plusDays(WAIT_DAYS)} (and ≥${WAIT_SESSIONS} sessions), and only by a human`,
  );
  console.log(
    `  run \`node .claude/scripts/health-sweep.mjs\` NOW — it must still be 0 BROKEN.`,
  );
}

function list() {
  const rows = readManifest();
  if (!rows.length)
    return console.log("attic: empty. Nothing has been staged for retirement.");
  console.log(`attic — ${rows.length} staged file(s)\n`);
  for (const r of rows)
    console.log(
      `  ${r.staged}  ${r.status.padEnd(9)} ${r.file}\n            ${r.reason}`,
    );
}

/** Re-measure everything staged. Any sign of life exonerates — and exoneration is automatic, not a judgement. */
function verify() {
  const rows = readManifest().filter((r) => r.status === "staged");
  if (!rows.length) return console.log("attic: nothing staged to verify.");
  let alive = 0;
  console.log(`attic verify — ${rows.length} staged file(s)\n`);
  for (const r of rows) {
    const name = basename(r.file);
    let mentions = [];
    try {
      mentions = execSync(
        `grep -rl --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=attic -F ${JSON.stringify(name)} platform .claude CLAUDE.md 2>/dev/null || true`,
        { cwd: REPO, encoding: "utf8" },
      )
        .split("\n")
        .filter((l) => l.trim());
    } catch {
      /* none */
    }
    const days = Math.round((Date.now() - Date.parse(r.staged)) / 86400_000);
    const sessions = sessionCount();
    let evStaged = null;
    try {
      evStaged = JSON.parse(
        readFileSync(join(EVIDENCE, `${name}.json`), "utf8"),
      );
    } catch {
      /* no snapshot — reported below */
    }
    const sessionsSince = evStaged
      ? sessions - (evStaged.evidence.sessions ?? sessions)
      : null;
    const signOfLife = mentions.length > 0;
    if (signOfLife) alive++;
    console.log(`  ${signOfLife ? "ALIVE  " : "quiet  "} ${r.file}`);
    console.log(
      `           ${days}d staged · ${sessionsSince ?? "?"} session(s) since · ${mentions.length} mention(s)`,
    );
    if (signOfLife) {
      console.log(
        `           → EXONERATED: still referenced by ${mentions.join(", ")}`,
      );
      console.log(
        `           → restore with: node .claude/scripts/attic.mjs restore ${name}`,
      );
    }
    if (!evStaged)
      console.log(
        `           → WARNING: no evidence snapshot. Do not delete this without one; restore it instead.`,
      );
  }
  console.log(
    `\n  ${alive} of ${rows.length} showed signs of life. Anything ALIVE goes back — the clock is not paused, it is void.`,
  );
  process.exit(alive ? 1 : 0);
}

function ready() {
  const rows = readManifest().filter((r) => r.status === "staged");
  const out = [];
  for (const r of rows) {
    const days = Math.round((Date.now() - Date.parse(r.staged)) / 86400_000);
    let sessionsSince = null;
    try {
      const ev = JSON.parse(
        readFileSync(join(EVIDENCE, `${basename(r.file)}.json`), "utf8"),
      );
      sessionsSince = sessionCount() - (ev.evidence.sessions ?? 0);
    } catch {
      /* no snapshot → never ready */
    }
    if (
      days >= WAIT_DAYS &&
      sessionsSince !== null &&
      sessionsSince >= WAIT_SESSIONS
    )
      out.push({ ...r, days, sessionsSince });
  }
  if (!out.length)
    return console.log(
      `attic: nothing is ready. A file needs ≥${WAIT_DAYS} days AND ≥${WAIT_SESSIONS} sessions of silence,\n` +
        `       plus a clean \`verify\`, before it may even be proposed for deletion.`,
    );
  console.log(`attic — ${out.length} file(s) have served the wait:\n`);
  for (const r of out)
    console.log(
      `  ${r.file}   (${r.days}d, ${r.sessionsSince} sessions)\n     staged because: ${r.reason}`,
    );
  console.log(`
  Run \`node .claude/scripts/attic.mjs verify\` first; it must report 0 ALIVE.
  Then the SUPERVISOR deletes, by hand, and records it in the manifest:
${out.map((r) => `      git rm ${r.file}`).join("\n")}
  This script will not do it. The irreversible step is not the agent's to run.`);
}

function restore() {
  const name = process.argv[3];
  if (!name) die("usage: attic.mjs restore <basename>");
  const rows = readManifest();
  const row = rows.find(
    (r) => basename(r.file) === name && r.status === "staged",
  );
  if (!row) die(`attic: no staged file named ${name}`);
  let ev;
  try {
    ev = JSON.parse(readFileSync(join(EVIDENCE, `${name}.json`), "utf8"));
  } catch {
    die(
      `attic: no evidence snapshot for ${name}; restore it by hand with \`git mv\` to be safe`,
    );
  }
  execFileSync("git", ["mv", row.file, ev.original], { cwd: REPO });
  row.raw = row.raw.replace(/\| staged \|$/, `| restored ${today()} |`);
  writeManifest(rows);
  console.log(`restored: ${row.file} → ${ev.original}`);
}

switch (cmd) {
  case "stage":
    stage();
    break;
  case "list":
    list();
    break;
  case "verify":
    verify();
    break;
  case "ready":
    ready();
    break;
  case "restore":
    restore();
    break;
  default:
    console.log(
      readFileSync(fileURLToPath(import.meta.url), "utf8")
        .split("*/")[0]
        .replace(/^#!.*\n/, ""),
    );
}
