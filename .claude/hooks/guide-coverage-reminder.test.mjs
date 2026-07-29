// Test for guide-coverage-reminder.mjs — a PreToolUse hook that BLOCKS the first edit of a sakubun route
// page or MCP surface, to force the in-app /guide to be updated in the same change (sakubun invariant #10).
// Run: node .claude/hooks/guide-coverage-reminder.test.mjs
//
// WHY THIS EXISTS. This hook can stop a write, and until now nothing proved it stops the right ones. Both
// failure directions are real and neither announces itself:
//
//   fails OPEN  — a new route or MCP prompt ships with no /guide entry, and the reminder that was supposed
//                 to prevent exactly that never fired. Nobody notices until a user cannot find the feature.
//   fires WRONG — it blocks edits to unrelated files, or nags on every route edit instead of once. A guard
//                 that interrupts work it has no business in is a guard that gets uninstalled.
//
// So every case below asserts BOTH the exit code AND, when it fires, the message — per Trail of Bits'
// hook guidance (`platform/plans/2026-07-30-tool-test-coverage.md` § prior art): "it exited 2" is not
// evidence it fired for the right reason, and the suggestion text is the whole value of a block.
//
// Two mechanics make this hook easy to break silently, and both are pinned here: the once-per-session
// marker (keyed by session_id, in the OS temp dir) and the registry counts read from
// `<sakubun>/docs/guide-coverage.json`, which must degrade to a generic reminder rather than crash.
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
const HOOK = join(HERE, "guide-coverage-reminder.mjs");
const BLOCK = 2; // PreToolUse: exit 2 = the write is blocked, stderr goes to Claude
const QUIET = 0;

const root = mkdtempSync(join(tmpdir(), "guide-cov-"));

/**
 * A fresh session id per call, so the once-per-session markers this hook leaves in the OS temp dir can
 * never leak between cases OR between runs of this suite. The first draft reused a fixed id and passed
 * once, then failed on the second run against a marker written by the first — which is the same class of
 * mistake as a test that depends on yesterday's state.
 */
let seq = 0;
const newSession = () =>
  `test-${process.pid}-${Date.now()}-${seq++}-${Math.random().toString(36).slice(2)}`;

/** Fire a hook with a payload; returns {code, out} where out is stderr+stdout. */
function fire(hookPath, { tool = "Edit", file, session, env } = {}) {
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
      // Never let the suite pollute the hook-usage counter (see _util.mjs — usage recording).
      env: { ...process.env, HOOK_USAGE_LOG: "off", ...env },
    });
    return { code: QUIET, out: out || "" };
  } catch (err) {
    return {
      code: err.status ?? -1,
      out: (err.stderr || "") + (err.stdout || ""),
    };
  }
}

/* ── the sakubun fixture: a route page, an MCP surface, and the coverage registry it reads ───────── */

const SAKU = join(root, "projects", "sakubun");
mkdirSync(join(SAKU, "docs"), { recursive: true });
writeFileSync(
  join(SAKU, "docs", "guide-coverage.json"),
  JSON.stringify({
    routes: { "/": {}, "/library": {} },
    prompts: { practice: {} },
    capabilities: { a: {}, b: {}, c: {} },
  }),
);

const p = (rel) => join(SAKU, rel);

/* ────────────────────────────────────────────────────────── 1. the silent paths (false positives) ──
 * Listed first and deliberately longer than the firing list: a blocking hook is judged by what it lets
 * through. Every entry here is a file someone edits in an ordinary session.
 */
const SILENT = [
  {
    what: "a tool that is not a write",
    args: { tool: "Read", file: p("app/page.tsx") },
  },
  {
    what: "a route page in a DIFFERENT project",
    args: { file: join(root, "projects/todo/app/page.tsx") },
  },
  {
    what: "an ordinary sakubun component",
    args: { file: p("components/library/feed.tsx") },
  },
  {
    what: "a sakubun app file that is not a page (layout)",
    args: { file: p("app/layout.tsx") },
  },
  {
    what: "a sakubun route's own loading state",
    args: { file: p("app/library/loading.tsx") },
  },
  {
    what: "an MCP file that is neither catalog nor server",
    args: { file: p("lib/mcp/auth.ts") },
  },
  {
    what: "a lib file outside mcp/",
    args: { file: p("lib/catalog.ts") },
  },
  {
    what: "the /guide page itself is a page.tsx — see the note below",
    args: { file: p("app/guide/page.tsx") },
    expectFires: true,
  },
];

for (const c of SILENT) {
  if (c.expectFires) continue; // handled in the firing list; kept here to document the known behaviour
  const { code, out } = fire(HOOK, { session: newSession(), ...c.args });
  assert.equal(
    code,
    QUIET,
    `BLOCKED SOMETHING IT SHOULD IGNORE: ${c.what}\n${out}`,
  );
  assert.equal(out.trim(), "", `must be silent, not merely non-blocking: ${c.what}\n${out}`);
}

/* ─────────────────────────────────────────────────────────── 2. the surfaces that MUST be caught ── */

const FIRES = [
  { what: "the root route page", file: p("app/page.tsx") },
  { what: "a nested route page", file: p("app/library/[id]/page.tsx") },
  { what: "the MCP catalog", file: p("lib/mcp/catalog.ts") },
  { what: "the MCP server", file: p("lib/mcp/server.ts") },
  {
    what: "a route page written via MultiEdit",
    file: p("app/history/page.tsx"),
    tool: "MultiEdit",
  },
  {
    what: "a route page created via Write",
    file: p("app/new-thing/page.tsx"),
    tool: "Write",
  },
  {
    // Documented, and arguably a false positive: editing /guide itself trips the reminder to update
    // /guide. Kept as intended behaviour because the message is cheap and the alternative — exempting the
    // guide route — would silently exempt the one page that is most often edited alongside a new feature.
    what: "the /guide page itself (documented as intended, not a bug)",
    file: p("app/guide/page.tsx"),
  },
];

for (const c of FIRES) {
  const { code, out } = fire(HOOK, {
    session: newSession(),
    tool: c.tool || "Edit",
    file: c.file,
  });
  assert.equal(code, BLOCK, `FAILED OPEN on: ${c.what}\n${out}`);
  // The message IS the deliverable — a block with no instruction just costs a turn.
  assert.match(out, /guide-coverage reminder/, `no headline: ${c.what}`);
  assert.match(out, /invariant #10/, `does not name the invariant: ${c.what}`);
  assert.match(
    out,
    /re-issue the same edit to proceed/,
    `does not say how to proceed — the user is left stuck: ${c.what}`,
  );
  assert.match(
    out,
    /guide-coverage\.json/,
    `does not name the registry to update: ${c.what}`,
  );
  // Read from the fixture registry (2 routes / 1 prompt / 3 capabilities), which is what makes the
  // reminder concrete instead of boilerplate.
  assert.match(
    out,
    /registry: 2 routes, 1 prompts, 3 capabilities/,
    `did not read the coverage registry: ${c.what}\n${out}`,
  );
}

/* ───────────────────────────────────────── 3. once per session, then out of the way ── */
{
  const session = newSession();
  const file = p("app/once/page.tsx");
  const first = fire(HOOK, { session, file });
  assert.equal(first.code, BLOCK, "the first edit must be blocked");

  const retry = fire(HOOK, { session, file });
  assert.equal(
    retry.code,
    QUIET,
    `the RETRY must go through — otherwise the hook is not a reminder, it is a wall:\n${retry.out}`,
  );

  const otherFile = fire(HOOK, { session, file: p("app/other/page.tsx") });
  assert.equal(
    otherFile.code,
    QUIET,
    "once per SESSION, not once per file — nagging on every route edit is how a guard gets muted",
  );

  const nextSession = fire(HOOK, { session: newSession(), file });
  assert.equal(
    nextSession.code,
    BLOCK,
    "a new session must be reminded again — the invariant did not stop applying",
  );
}

/* ───────────────────────── 4. an unreadable registry must degrade, never crash ──
 * The hook's job is the reminder; the counts are decoration. If a malformed JSON file could take it
 * down, a typo in the registry would silently disable the invariant it exists to protect.
 */
{
  const broken = join(root, "broken", "projects", "sakubun");
  mkdirSync(join(broken, "docs"), { recursive: true });
  writeFileSync(join(broken, "docs", "guide-coverage.json"), "{ not json ");
  const { code, out } = fire(HOOK, {
    session: newSession(),
    file: join(broken, "app", "page.tsx"),
  });
  assert.equal(code, BLOCK, `a malformed registry must not disable the reminder:\n${out}`);
  assert.match(out, /guide-coverage reminder/, "the generic reminder must still be shown");
  assert.doesNotMatch(out, /registry: /, "must not print counts it could not read");

  const none = join(root, "noreg", "projects", "sakubun");
  const missing = fire(HOOK, {
    session: newSession(),
    file: join(none, "app", "page.tsx"),
  });
  assert.equal(missing.code, BLOCK, "a MISSING registry must not disable the reminder either");
  assert.doesNotMatch(missing.out, /registry: /, "no counts when there is no registry");
}

/* ─────────────────────────────────── 5. the suite must NOTICE a broken guard (mutation) ──
 * Mutants run from a temp copy, beside a copy of _util.mjs, because the hook imports it relative to
 * itself. Writing them into .claude/hooks/ would dirty the real repo for the length of the run.
 */
{
  const src = readFileSync(HOOK, "utf8");
  const lab = join(root, "mutants");
  mkdirSync(lab, { recursive: true });
  copyFileSync(join(HERE, "_util.mjs"), join(lab, "_util.mjs"));

  /** Every mutant must be killed by at least one case above; `probe` says which behaviour proves it. */
  const mutants = [
    {
      // NOTE, and it is the finding this mutant produced: dropping only `filePath.includes('/sakubun/')`
      // changes NOTHING observable, because both surface regexes hardcode `/sakubun/` themselves. That
      // line is a fast path, not a guard — an equivalent mutant, and the first draft of this suite failed
      // demanding a case for a defect that cannot exist. So the mutant has to break the SCOPE ITSELF.
      name: "the sakubun scoping dropped (fires on any project's route page)",
      apply: (s) =>
        s
          .replace("!filePath.includes('/sakubun/')", "false")
          .replace("\\/sakubun\\/app\\/", "\\/app\\/"),
      probe: (h) =>
        fire(h, {
          session: newSession(),
          file: join(root, "projects/todo/app/page.tsx"),
        }).code === BLOCK,
    },
    {
      name: "the route/MCP filter dropped (fires on every sakubun file)",
      apply: (s) => s.replace("if (!isRoutePage && !isMcpSurface)", "if (false)"),
      probe: (h) => fire(h, { session: newSession(), file: p("components/x.tsx") }).code === BLOCK,
    },
    {
      name: "the block downgraded to silence (fails open)",
      apply: (s) => s.replace(/process\.exit\(2\);\s*$/, "process.exit(0);"),
      probe: (h) => fire(h, { session: newSession(), file: p("app/page.tsx") }).code === QUIET,
    },
    {
      name: "the once-per-session marker ignored (nags forever)",
      apply: (s) => s.replace("if (existsSync(marker)) process.exit(0);", ""),
      probe: (h) => {
        const session = newSession();
        const file = p("app/mut/page.tsx");
        fire(h, { session, file });
        return fire(h, { session, file }).code === BLOCK;
      },
    },
    {
      name: "the write-tool filter dropped (fires on Read)",
      apply: (s) =>
        s.replace(
          "if (!['Edit', 'Write', 'MultiEdit'].includes(payload?.tool_name || ''))",
          "if (false)",
        ),
      probe: (h) => fire(h, { session: newSession(), tool: "Read", file: p("app/page.tsx") }).code === BLOCK,
    },
    {
      name: "the proceed instruction removed (a block with no way out)",
      apply: (s) => s.replace("re-issue the same edit to proceed", "no further information"),
      probe: (h) => {
        const { out } = fire(h, { session: newSession(), file: p("app/page.tsx") });
        return !/re-issue the same edit to proceed/.test(out);
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
  `guide-coverage-reminder.test.mjs — ${SILENT.length - 1} silent paths, ${FIRES.length} caught surfaces, ` +
    `once-per-session + retry, registry degradation, 6 mutants all killed  ✅`,
);
