// Test for link-check.mjs — the checker that verifies the wires BETWEEN files.
// Run: node .claude/scripts/link-check.test.mjs
//
// WHY THIS SHAPE. A wire-checker can only be trusted if you have watched it fail. So the suite builds a
// miniature fleet in a temp directory, asserts it comes back clean, then breaks each of the six wires ONE
// AT A TIME and asserts that specific check — and only that check — reports it.
//
// "Clean on a healthy tree" is the weaker half. The half that matters is that a green result on the real
// repo means the wires are intact rather than that the checker has quietly stopped looking. That is not
// paranoia: on 2026-07-30 four discovery tools kept exiting 0 after a folder move while finding nothing,
// and `health-sweep` mis-parsed a sub-checker and reported calm over 14 findings.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  readFileSync,
  cpSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CHECKER = join(HERE, "link-check.mjs");

/** Build a minimal but STRUCTURALLY REAL fleet: every wire link-check knows about, all of them intact. */
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "link-check-"));
  const w = (rel, body) => {
    const p = join(root, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, body);
  };

  w(
    ".claude/settings.json",
    JSON.stringify(
      {
        hooks: {
          PreToolUse: [
            {
              matcher: "Edit",
              hooks: [
                {
                  type: "command",
                  command:
                    'node "${CLAUDE_PROJECT_DIR}/.claude/hooks/guard.mjs"',
                },
              ],
            },
          ],
        },
      },
      null,
      2,
    ),
  );
  w(".claude/hooks/guard.mjs", "process.exit(0);\n");

  w(
    "platform/inventory.md",
    [
      "| Domain | Project | kind | target | desc | repo | Dev path | NUC path |",
      "|---|---|---|---|---|---|---|---|",
      "| `product` | **todo** | `web-app` | `local` | x | `t/todo` | `fleet/projects/todo` | `—` |",
    ].join("\n"),
  );
  mkdirSync(join(root, "projects/todo"), { recursive: true });

  w(".claude/memory/alpha.md", "Alpha. See [[beta]].\n");
  w(".claude/memory/beta.md", "Beta.\n");

  w(
    "platform/ledger/2026-06.md",
    '### 2026-06-01 — a lesson\n\n<a id="2026-06-01-a-lesson"></a>\n\nBody.\n',
  );
  w(
    "platform/registries/knowledge-ledger.md",
    "| date | headline | link |\n|---|---|---|\n| 2026-06-01 | a lesson | [→](ledger/2026-06.md#2026-06-01-a-lesson) |\n",
  );

  w("CLAUDE.md", "Standard: `platform/standards/testing.md`.\n");
  w("platform/standards/testing.md", "Testing.\n");

  // The catalog deliberately points at a DIFFERENT project from the one INVENTORY names. The first cut used
  // the same one, so deleting it broke two wires at once and the "only this check fires" assertion failed —
  // correctly. A fixture where two checks share a dependency cannot test either of them in isolation.
  w(
    "platform/registries/shared-assets.md",
    "| item | where |\n|---|---|\n| thing | `commons/lib/db.ts` |\n",
  );
  w("commons/lib/db.ts", "export const db = 1;\n");

  return root;
}

const run = (root) => {
  const r = spawnSync(process.execPath, [CHECKER, "--quiet"], {
    encoding: "utf8",
    env: { ...process.env, FLEET_ROOT: root },
  });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
};

/* ───────────────────────────────────────────────── 1. a healthy tree must come back clean ── */

const base = fixture();
{
  const { code, out } = run(base);
  assert.equal(code, 0, `a healthy fixture must exit 0 — got:\n${out}`);
  assert.match(out, /0 broken/, "a healthy fixture must report 0 broken wires");
  for (const id of [
    "hook-wiring",
    "inventory-dev-paths",
    "memory-wikilinks",
    "ledger-anchors",
    "claude-md-paths",
    "shared-assets-paths",
  ])
    assert.match(
      out,
      new RegExp(`${id}\\s+\\[ok\\]`),
      `${id} must be ok on a healthy tree`,
    );
}

/* ──────────────────────────────── 2. break each wire ALONE and assert that check reports it ── */

/**
 * Each case names the check that MUST fire. The `only` assertion matters as much as the hit: a checker that
 * reports six problems for one broken file is a checker whose output gets skimmed.
 */
const BREAKS = [
  {
    id: "hook-wiring",
    what: "a hook is wired in settings.json but the file is gone",
    apply: (root) => rmSync(join(root, ".claude/hooks/guard.mjs")),
  },
  {
    id: "hook-wiring",
    what: "a hook exists on disk but nothing wires it",
    apply: (root) =>
      writeFileSync(
        join(root, ".claude/hooks/orphan.mjs"),
        "process.exit(0);\n",
      ),
  },
  {
    id: "hook-wiring",
    what: "settings.json does not parse — Claude Code would load NO hooks at all",
    apply: (root) =>
      writeFileSync(join(root, ".claude/settings.json"), "{ not json"),
  },
  {
    id: "inventory-dev-paths",
    what: "an INVENTORY Dev path points nowhere (the 2026-07-30 defect)",
    apply: (root) => rmSync(join(root, "projects/todo"), { recursive: true }),
  },
  {
    id: "ledger-anchors",
    what: "an index row points at an anchor that does not exist",
    apply: (root) =>
      writeFileSync(
        join(root, "platform/ledger/2026-06.md"),
        "### a lesson\n\nno anchor here\n",
      ),
  },
  {
    id: "ledger-anchors",
    what: "an index row points at a month file that is gone",
    apply: (root) => rmSync(join(root, "platform/ledger/2026-06.md")),
  },
  {
    id: "claude-md-paths",
    what: "CLAUDE.md names a standard that does not exist",
    apply: (root) => rmSync(join(root, "platform/standards/testing.md")),
  },
  {
    id: "shared-assets-paths",
    what: "the shared-asset catalog points at a file that moved",
    apply: (root) => rmSync(join(root, "commons/lib/db.ts")),
  },
];

for (const b of BREAKS) {
  const root = mkdtempSync(join(tmpdir(), "link-check-break-"));
  cpSync(base, root, { recursive: true });
  b.apply(root);
  const { code, out } = run(root);
  assert.equal(code, 1, `BROKEN WIRE NOT DETECTED: ${b.what}\n${out}`);
  assert.match(
    out,
    new RegExp(`${b.id}\\s+\\[\\d+ BROKEN\\]`),
    `${b.id} must be the check that fires for: ${b.what}\n${out}`,
  );
  const firing = [...out.matchAll(/── ([a-z-]+)\s+\[(\d+) BROKEN\]/g)].map(
    (m) => m[1],
  );
  assert.deepEqual(
    firing,
    [b.id],
    `only ${b.id} should fire for: ${b.what} — got ${firing.join(", ")}`,
  );
  rmSync(root, { recursive: true, force: true });
}

/* ─────────────────────────── 3. a dangling memory link is a NOTE, not a fault (by design) ── */
{
  const root = mkdtempSync(join(tmpdir(), "link-check-note-"));
  cpSync(base, root, { recursive: true });
  writeFileSync(
    join(root, ".claude/memory/alpha.md"),
    "Alpha. See [[not-written-yet]].\n",
  );
  const { code, out } = run(root);
  assert.equal(
    code,
    0,
    "a dangling [[link]] must NOT fail the run — it marks a memory worth writing",
  );
  assert.match(
    out,
    /not-written-yet/,
    "but it must still be reported, or the note is useless",
  );
  rmSync(root, { recursive: true, force: true });
}

rmSync(base, { recursive: true, force: true });
console.log(
  `link-check.test.mjs — healthy tree clean, ${BREAKS.length} broken wires each detected in isolation, dangling link reported not failed  ✅`,
);
