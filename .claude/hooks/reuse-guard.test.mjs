// Test for reuse-guard.mjs — a PreToolUse hook that BLOCKS the first Write of a file whose name matches
// something the commons registry already publishes ("commons already ships this").
// Run: node .claude/hooks/reuse-guard.test.mjs
//
// WHY THIS EXISTS. The hook was installed on 2026-07-30 with a self-test written as SHELL COMMANDS IN A
// COMMENT (`reuse-guard.mjs:91-104`) and run by hand once. That is a test in the weakest sense available:
// it proved the behaviour on the day it was pasted and proves nothing on any day after. This file is that
// comment block, automated and extended — so the next person to touch the matching logic finds out from a
// test run instead of from four apps growing four theme toggles again.
//
// The two failure directions, and why the silent list below is the longer one:
//   fails OPEN  — the duplication it exists to stop happens anyway. Slow, invisible, exactly the drift
//                 `/code-reuse` has been asking for politely since 2026-06 without effect.
//   fires WRONG — it blocks legitimate new files. This is the direction that gets a hook UNINSTALLED, and
//                 it has more ways to happen: a match by basename is a blunt instrument, and the hook
//                 matches on the registry item's install TARGET, not its name.
//
// Non-negotiable property, asserted twice: an unreadable or missing registry must let the write through.
// A guard that wedges a session because a JSON file has a typo is worse than the duplication it prevents.
//
// Per platform/standards/testing.md §2.5 the suite also MUTATES the hook and asserts it notices.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  readFileSync,
  copyFileSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, "reuse-guard.mjs");
const BLOCK = 2;
const QUIET = 0;

const root = mkdtempSync(join(tmpdir(), "reuse-guard-"));

let seq = 0;
/** Unique per call — the hook leaves once-per-session-per-item markers in the OS temp dir. */
const newSession = () =>
  `test-${process.pid}-${Date.now()}-${seq++}-${Math.random().toString(36).slice(2)}`;

/**
 * The registry the hook reads, at the exact path it expects. Three items, each covering a different rule:
 *   theme-toggle      — an ordinary block; the plain match
 *   test-no-emoji     — installs `lib/no-emoji.test.ts`, so the item NAME and the FILE name differ. This is
 *                       the case the hook's own comment calls out, and the one a naive matcher gets wrong.
 *   starter-web-app   — category `starter`: a scaffold is meant to be copied and owned, so it must NOT fire.
 */
function writeRegistry(dir, items) {
  const p = join(dir, "commons", "public", "r");
  mkdirSync(p, { recursive: true });
  writeFileSync(join(p, "registry.json"), JSON.stringify({ items }));
}

const ITEMS = [
  {
    name: "theme-toggle",
    description: "Light/dark control in the shapes the apps use",
    files: [{ target: "~/components/theme-toggle.tsx" }],
    categories: ["block"],
  },
  {
    name: "test-no-emoji",
    description: "The platform no-emoji rule as a failing vitest",
    files: [{ target: "~/lib/no-emoji.test.ts" }],
    categories: ["test"],
  },
  {
    name: "starter-web-app",
    description: "One command lands the whole web-app spine",
    files: [{ target: "~/next.config.ts" }, { target: "~/Dockerfile" }],
    categories: ["starter"],
  },
];

writeRegistry(root, ITEMS);

/** Fire the hook. `projectDir` defaults to the fixture root, which is where the registry lives. */
function fire(
  hookPath,
  { tool = "Write", file, session, projectDir = root } = {},
) {
  const payload = JSON.stringify({
    tool_name: tool,
    tool_input: { file_path: file },
    session_id: session,
  });
  try {
    const out = execFileSync(process.execPath, [hookPath], {
      input: payload,
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf8",
      env: {
        ...process.env,
        HOOK_USAGE_LOG: "off", // never pollute the hook-usage counter (_util.mjs)
        CLAUDE_PROJECT_DIR: projectDir,
      },
    });
    return { code: QUIET, out: out || "" };
  } catch (err) {
    return {
      code: err.status ?? -1,
      out: (err.stderr || "") + (err.stdout || ""),
    };
  }
}

const app = (rel) => join(root, "projects", "todo", rel);

/* ─────────────────────────────────────────── 1. everything it must let through, and why ──
 * Longer than the firing list on purpose. Each of these is a file that gets written in normal work; a
 * hook that stops any of them is a hook someone removes.
 */
const SILENT = [
  {
    what: "an Edit, not a Write — the choice was made long ago",
    args: { tool: "Edit", file: app("components/theme-toggle.tsx") },
  },
  {
    what: "a non-code file with a matching name",
    args: { file: app("components/theme-toggle.css") },
  },
  {
    what: "a file inside commons — that IS the canonical",
    args: { file: join(root, "commons/registry/block/theme-toggle.tsx") },
  },
  {
    what: "a file inside platform/ — docs and tooling, not app code",
    args: { file: join(root, "platform/scripts/theme-toggle.tsx") },
  },
  {
    what: "a `starter` scaffold file — meant to be copied and owned",
    args: { file: app("next.config.ts") },
  },
  {
    what: "a second starter file, to prove the category and not the name is what exempts",
    args: { file: app("Dockerfile") },
  },
  {
    what: "an unrelated new component",
    args: { file: app("components/sentence-card.tsx") },
  },
  {
    what: "a name that only PREFIXES a registry item",
    args: { file: app("components/theme-toggle-group.tsx") },
  },
];

for (const c of SILENT) {
  const { code, out } = fire(HOOK, { session: newSession(), ...c.args });
  assert.equal(code, QUIET, `BLOCKED A LEGITIMATE WRITE: ${c.what}\n${out}`);
  assert.equal(
    out.trim(),
    "",
    `must be silent, not merely non-blocking: ${c.what}\n${out}`,
  );
}

/* ─────────────────────────────────── 2. a file that already exists is an edit in practice ── */
{
  const existing = app("components/theme-toggle.tsx");
  mkdirSync(dirname(existing), { recursive: true });
  writeFileSync(existing, "// already here\n");
  const { code, out } = fire(HOOK, {
    session: newSession(),
    file: existing,
  });
  assert.equal(
    code,
    QUIET,
    `a Write over an EXISTING file must not fire — overwriting is editing:\n${out}`,
  );
  rmSync(existing);
}

/* ───────────────────────────────────────────────── 3. the duplications it must catch ── */

const FIRES = [
  {
    what: "a new component matching a registry item by name",
    file: app("components/theme-toggle.tsx"),
    item: "theme-toggle",
    target: "components/theme-toggle.tsx",
  },
  {
    what: "a gate matched by its install TARGET, not the item name",
    file: app("lib/no-emoji.test.ts"),
    item: "test-no-emoji",
    target: "lib/no-emoji.test.ts",
  },
  {
    what: "the same shape in a different project",
    file: join(root, "projects/journal/components/theme-toggle.tsx"),
    item: "theme-toggle",
    target: "components/theme-toggle.tsx",
  },
  {
    what: "a .mjs file (the extension list is not just TS/TSX)",
    file: app("lib/no-emoji.test.ts"),
    item: "test-no-emoji",
    target: "lib/no-emoji.test.ts",
  },
];

for (const c of FIRES) {
  const { code, out } = fire(HOOK, { session: newSession(), file: c.file });
  assert.equal(code, BLOCK, `FAILED OPEN on: ${c.what}\n${out}`);
  // Everything the author needs in order to act, asserted individually — a block whose message is vague
  // costs a turn and teaches nothing.
  assert.match(
    out,
    new RegExp(`commons already ships this: @thiengthb/${c.item}`),
    `does not name the item: ${c.what}\n${out}`,
  );
  assert.match(
    out,
    new RegExp(`add @thiengthb/${c.item}`),
    `does not give the install command: ${c.what}`,
  );
  assert.match(out, new RegExp(c.target.replace(/[.]/g, "\\.")), `does not name the install target: ${c.what}`);
  assert.match(
    out,
    /divergences\.json/,
    `does not say how to declare a DELIBERATE local variant: ${c.what}`,
  );
  assert.match(
    out,
    /Retry the same Write to proceed/,
    `does not say how to proceed — the author is stuck: ${c.what}`,
  );
}

/* ─────────────────────────────── 4. once per session PER ITEM — informative, not a fight ── */
{
  const session = newSession();
  const first = fire(HOOK, { session, file: app("components/theme-toggle.tsx") });
  assert.equal(first.code, BLOCK, "the first attempt must be blocked");

  const retry = fire(HOOK, { session, file: app("components/theme-toggle.tsx") });
  assert.equal(
    retry.code,
    QUIET,
    `the retry must go through — a deliberate local variant costs one beat, not a fight:\n${retry.out}`,
  );

  const otherItem = fire(HOOK, { session, file: app("lib/no-emoji.test.ts") });
  assert.equal(
    otherItem.code,
    BLOCK,
    "per ITEM, not per session — a second duplication in the same session is still worth saying once",
  );

  const nextSession = fire(HOOK, {
    session: newSession(),
    file: app("components/theme-toggle.tsx"),
  });
  assert.equal(nextSession.code, BLOCK, "a new session must be told again");
}

/* ────────────────────── 5. FAIL OPEN, always: no registry, or a broken one ──
 * Asserted as its own section because it is the property that makes this hook safe to install at all.
 */
{
  const noRegistry = mkdtempSync(join(tmpdir(), "reuse-guard-noreg-"));
  const a = fire(HOOK, {
    session: newSession(),
    file: join(noRegistry, "projects/todo/components/theme-toggle.tsx"),
    projectDir: noRegistry,
  });
  assert.equal(a.code, QUIET, `a MISSING registry must never block a write:\n${a.out}`);

  const badRegistry = mkdtempSync(join(tmpdir(), "reuse-guard-bad-"));
  mkdirSync(join(badRegistry, "commons/public/r"), { recursive: true });
  writeFileSync(join(badRegistry, "commons/public/r/registry.json"), "{ items: [");
  const b = fire(HOOK, {
    session: newSession(),
    file: join(badRegistry, "projects/todo/components/theme-toggle.tsx"),
    projectDir: badRegistry,
  });
  assert.equal(
    b.code,
    QUIET,
    `a MALFORMED registry must never block a write — a typo in a JSON file cannot be allowed to wedge a session:\n${b.out}`,
  );

  const emptyItems = mkdtempSync(join(tmpdir(), "reuse-guard-empty-"));
  writeRegistry(emptyItems, []);
  const c = fire(HOOK, {
    session: newSession(),
    file: join(emptyItems, "projects/todo/components/theme-toggle.tsx"),
    projectDir: emptyItems,
  });
  assert.equal(c.code, QUIET, "an empty registry matches nothing");

  for (const d of [noRegistry, badRegistry, emptyItems])
    rmSync(d, { recursive: true, force: true });
}

/* ───────────────────────────────── 6. the suite must NOTICE a broken guard (mutation) ── */
{
  // LF-normalized: on a CRLF working tree (Windows) every multi-line mutation patch below would go stale.
  const src = readFileSync(HOOK, "utf8").replace(/\r\n/g, "\n");
  const lab = join(root, "mutants");
  mkdirSync(lab, { recursive: true });
  copyFileSync(join(HERE, "_util.mjs"), join(lab, "_util.mjs"));

  const mutants = [
    {
      name: "fires on Edit too (nags on ordinary work)",
      apply: (s) => s.replace("payload?.tool_name !== 'Write'", "false"),
      probe: (h) =>
        fire(h, {
          session: newSession(),
          tool: "Edit",
          file: app("components/theme-toggle.tsx"),
        }).code === BLOCK,
    },
    {
      name: "the commons/platform exemption dropped (fires inside the canonical)",
      apply: (s) => s.replace("/\\/(commons|platform)\\//", "/NEVERMATCHXYZ/"),
      probe: (h) =>
        fire(h, {
          session: newSession(),
          file: join(root, "commons/registry/block/theme-toggle.tsx"),
        }).code === BLOCK,
    },
    {
      name: "the existing-file exemption dropped (an overwrite is treated as new)",
      apply: (s) => s.replace("if (existsSync(filePath)) process.exit(0);", ""),
      probe: (h) => {
        const f = app("components/theme-toggle.tsx");
        mkdirSync(dirname(f), { recursive: true });
        writeFileSync(f, "// exists\n");
        const r = fire(h, { session: newSession(), file: f });
        rmSync(f);
        return r.code === BLOCK;
      },
    },
    {
      name: "the `starter` exemption dropped (blocks scaffold files)",
      apply: (s) =>
        s.replace("(hit.categories ?? []).includes('starter')", "false"),
      probe: (h) =>
        fire(h, { session: newSession(), file: app("next.config.ts") }).code === BLOCK,
    },
    {
      name: "matching by item NAME instead of install target",
      apply: (s) =>
        s.replace(
          "(item.files ?? []).some((f) => (f.target || '').replace(/^~\\//, '').split('/').pop() === base)",
          "item.name === base",
        ),
      probe: (h) =>
        fire(h, { session: newSession(), file: app("lib/no-emoji.test.ts") }).code === QUIET,
    },
    {
      name: "FAILS CLOSED on a malformed registry (wedges the session)",
      apply: (s) =>
        s.replace(
          "process.exit(0); // a malformed registry must never block someone's work",
          "process.exit(2);",
        ),
      probe: (h) => {
        const bad = mkdtempSync(join(tmpdir(), "reuse-guard-mut-"));
        mkdirSync(join(bad, "commons/public/r"), { recursive: true });
        writeFileSync(join(bad, "commons/public/r/registry.json"), "{ items: [");
        const r = fire(h, {
          session: newSession(),
          file: join(bad, "projects/todo/components/theme-toggle.tsx"),
          projectDir: bad,
        });
        rmSync(bad, { recursive: true, force: true });
        return r.code === BLOCK;
      },
    },
    {
      name: "the block downgraded to silence (fails open)",
      apply: (s) => s.replace(/process\.exit\(2\);\s*\n\n\/\*/, "process.exit(0);\n\n/*"),
      probe: (h) =>
        fire(h, { session: newSession(), file: app("components/theme-toggle.tsx") }).code === QUIET,
    },
    {
      name: "the once-per-session marker ignored (nags on every retry)",
      apply: (s) => s.replace("if (existsSync(marker)) process.exit(0);", ""),
      probe: (h) => {
        const session = newSession();
        const f = app("components/theme-toggle.tsx");
        fire(h, { session, file: f });
        return fire(h, { session, file: f }).code === BLOCK;
      },
    },
  ];

  for (const m of mutants) {
    const mutated = m.apply(src);
    assert.notEqual(
      mutated,
      src,
      `mutation "${m.name}" changed nothing — the patch is stale and this mutant proves nothing`,
    );
    const path = join(lab, `mutant-${Math.random().toString(36).slice(2)}.mjs`);
    writeFileSync(path, mutated);
    assert.ok(
      m.probe(path),
      `SURVIVING MUTANT — "${m.name}" and the suite still passed. Add a case for it.`,
    );
  }
}

rmSync(root, { recursive: true, force: true });
console.log(
  `reuse-guard.test.mjs — ${SILENT.length} silent paths + existing-file, ${FIRES.length} caught duplications, ` +
    `once-per-session-per-item, 3 fail-open paths, 8 mutants all killed  ✅`,
);
