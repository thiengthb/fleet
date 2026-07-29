#!/usr/bin/env node
/**
 * link-check.mjs — do the CONNECTIONS in the second brain still hold? Report-only.
 *
 * WHY THIS EXISTS. Every other checker on this platform grades a file: is this plan shaped right, is this
 * memory indexed, does this guard still fire. Nothing checked the wires BETWEEN files, and that is where
 * this repo actually breaks — silently, and by being obeyed:
 *   - 2026-07-28: `autoMemoryDirectory` pointed at a path that no longer existed. Claude Code CREATED the
 *     empty directory rather than failing, so memory looked wired and loaded nothing.
 *   - 2026-07-30: moving nine repos into `projects/` left INVENTORY's `Dev path` column pointing at
 *     `fleet/<app>` for all nine. Every row still looked plausible; not one resolved.
 *   - Same day: four documents still instructed the reader to run a script deleted in June.
 * A broken wire never raises an error. It hands you an answer that is merely smaller, or older, or empty.
 *
 * WHAT IT DOES NOT DO — deliberately, to stay one job and not a fourth copy of the audits:
 *   memory index drift/caps → `memory-audit.mjs` · skill dir↔frontmatter → `skill-audit.mjs`
 *   plan shape → `plan-audit.mjs` · stale tool citations → `recurrence-check.mjs` · tests → `tool-check.mjs`
 * Run them all at once with `health-sweep.mjs`.
 *
 * Usage:  node .claude/scripts/link-check.mjs [--json] [--quiet]
 * Exit code: 1 if any wire is broken, 0 when every one resolves.
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * FLEET_ROOT exists so the suite can point this at a fixture tree and BREAK each wire on purpose. Without
 * it the only way to test a wire-checker is to damage the real repo, which nobody will do — so the checker
 * would ship unverified, which is the exact thing it was written to stop happening elsewhere.
 */
const REPO = process.env.FLEET_ROOT
  ? resolve(process.env.FLEET_ROOT)
  : resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const JSON_OUT = process.argv.includes("--json");
const QUIET = process.argv.includes("--quiet");

const read = (p) => {
  try {
    return readFileSync(join(REPO, p), "utf8");
  } catch {
    return null;
  }
};
const checks = [];
const check = (id, what, run) => checks.push({ id, what, run });

/* 1 ── the hook layer: what settings.json promises vs what is on disk, in BOTH directions.
 *      A wired-but-missing hook is a control that silently does not run. A present-but-unwired hook is
 *      either dead weight or a control someone believes is on — both worth naming. */
check(
  "hook-wiring",
  "every hook in settings.json exists, and every hook on disk is wired",
  () => {
    const raw = read(".claude/settings.json");
    if (!raw)
      return [
        { msg: ".claude/settings.json is missing — no hook runs at all" },
      ];
    let cfg;
    try {
      cfg = JSON.parse(raw);
    } catch (e) {
      return [
        {
          msg: `.claude/settings.json does not parse (${e.message}) — Claude Code loads NO hooks`,
        },
      ];
    }
    const bad = [];
    const wired = new Set();
    for (const [evt, groups] of Object.entries(cfg.hooks ?? {}))
      for (const g of groups)
        for (const h of g.hooks ?? []) {
          const m = /\$\{CLAUDE_PROJECT_DIR\}\/([^"']+?\.mjs)/.exec(
            h.command || "",
          );
          if (!m) {
            bad.push({
              msg: `${evt}: command names no \${CLAUDE_PROJECT_DIR} script — ${String(h.command).slice(0, 60)}`,
            });
            continue;
          }
          wired.add(m[1].split("/").pop());
          if (!existsSync(join(REPO, m[1])))
            bad.push({ msg: `${evt}: WIRED BUT MISSING — ${m[1]}` });
        }
    for (const f of readdirSync(join(REPO, ".claude/hooks")))
      if (
        f.endsWith(".mjs") &&
        !f.endsWith(".test.mjs") &&
        !f.startsWith("_") &&
        !wired.has(f)
      )
        bad.push({ msg: `on disk but never wired — .claude/hooks/${f}` });
    return bad;
  },
);

/* 2 ── INVENTORY is the single source of truth for where a project lives. A Dev path that does not
 *      resolve is the source of truth being wrong, which is worse than it being absent. */
check(
  "inventory-dev-paths",
  "every `Dev path` in INVENTORY resolves to a real directory",
  () => {
    const text = read("platform/inventory.md");
    if (!text) return [{ msg: "platform/inventory.md is missing" }];
    const bad = [];
    for (const line of text.split("\n")) {
      if (!/^\|\s*`/.test(line)) continue;
      const cells = line.split("|").map((c) => c.trim());
      const dev = (cells[7] || "").replace(/`/g, "").trim();
      const name = (cells[2] || "").replace(/\*\*/g, "").trim();
      if (!dev || /root|—|^-$/.test(dev)) continue;
      const rel = dev.replace(/^fleet\//, "");
      if (!existsSync(join(REPO, rel)))
        bad.push({ msg: `${name}: Dev path \`${dev}\` does not exist` });
    }
    return bad;
  },
);

/* 3 ── memory cross-links. `[[name]]` is how one memory points at another; a dangling one is allowed
 *      by design (it marks a memory worth writing) — so this reports them as INFO, never as broken. */
check(
  "memory-wikilinks",
  "every [[link]] between memories resolves (dangling = a note, not a fault)",
  () => {
    const dir = join(REPO, ".claude/memory");
    if (!existsSync(dir))
      return [
        { msg: ".claude/memory is missing — the shared memory tier is gone" },
      ];
    const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
    const names = new Set(files.map((f) => f.replace(/\.md$/, "")));
    const dangling = [];
    for (const f of files)
      for (const m of readFileSync(join(dir, f), "utf8").matchAll(
        /\[\[([^\]]+)\]\]/g,
      ))
        if (!names.has(m[1]))
          dangling.push({
            info: true,
            msg: `${f} → [[${m[1]}]] (not written yet)`,
          });
    return dangling;
  },
);

/* 4 ── the ledger's two-file split only works if the index row can actually reach its detail. */
check(
  "ledger-anchors",
  "every knowledge-ledger index row reaches its detail entry",
  () => {
    const idx = read("platform/registries/knowledge-ledger.md");
    if (!idx)
      return [{ msg: "platform/registries/knowledge-ledger.md is missing" }];
    const bad = [];
    let rows = 0;
    for (const m of idx.matchAll(
      /\]\((ledger\/(?:20\d\d-\d\d)\.md)#([a-z0-9-]+)\)/g,
    )) {
      rows++;
      const body = read(join("platform", m[1]));
      if (body === null)
        bad.push({ msg: `index points at a missing month file: ${m[1]}` });
      else if (!body.includes(`id="${m[2]}"`))
        bad.push({ msg: `${m[1]}#${m[2]} — no such anchor in the month file` });
    }
    if (!rows)
      bad.push({
        msg: "no index row links to a month file at all — the ledger split is not in effect",
      });
    return bad;
  },
);

/* 5 ── CLAUDE.md is loaded every session and is the map everything else hangs off. A path in it that
 *      does not exist is a instruction the agent will follow into nothing. Template placeholders
 *      (`docs/decisions.md` means "each project's") are excluded by shape, not by name. */
check(
  "claude-md-paths",
  "every concrete path named in CLAUDE.md exists",
  () => {
    const text = read("CLAUDE.md");
    if (!text) return [{ msg: "CLAUDE.md is missing" }];
    const bad = [];
    const seen = new Set();
    for (const m of text.matchAll(/`((?:platform|\.claude)\/[\w./@-]+)`/g)) {
      const p = m[1].replace(/[.,;)]$/, "");
      if (seen.has(p) || /<|YYYY|\*|\{/.test(p)) continue;
      seen.add(p);
      if (!existsSync(join(REPO, p)))
        bad.push({ msg: `CLAUDE.md names \`${p}\`, which does not exist` });
    }
    return bad;
  },
);

/* 6 ── the shared-asset catalog is what `/code-reuse` reads before building anything. A row pointing at
 *      a file that moved sends the next session to reinvent what is already there. */
check(
  "shared-assets-paths",
  "every file path in the shared-asset catalog resolves",
  () => {
    const text = read("platform/registries/shared-assets.md");
    if (!text) return [];
    const bad = [];
    const seen = new Set();
    for (const m of text.matchAll(
      /`((?:platform|\.claude|projects|commons|rulebook)\/[\w./@-]+\.\w{2,4})`/g,
    )) {
      const p = m[1];
      if (seen.has(p) || /<|\*/.test(p)) continue;
      seen.add(p);
      if (!existsSync(join(REPO, p)))
        bad.push({
          msg: `catalog row points at \`${p}\`, which does not exist`,
        });
    }
    return bad;
  },
);

/* ─────────────────────────────────────────────────────────────────────────────────── report ── */

const results = checks.map((c) => {
  const hits = c.run();
  return {
    id: c.id,
    what: c.what,
    broken: hits.filter((h) => !h.info),
    info: hits.filter((h) => h.info),
  };
});
const brokenTotal = results.reduce((n, r) => n + r.broken.length, 0);

if (JSON_OUT) {
  console.log(JSON.stringify({ broken: brokenTotal, results }, null, 2));
  process.exit(brokenTotal ? 1 : 0);
}

console.log(
  `link-check — ${checks.length} wire(s) checked, ${brokenTotal} broken\n`,
);
for (const r of results) {
  const tag = r.broken.length ? `${r.broken.length} BROKEN` : "ok";
  console.log(`── ${r.id}  [${tag}]`);
  if (!QUIET) console.log(`   ${r.what}`);
  for (const h of r.broken) console.log(`   ✗ ${h.msg}`);
  for (const h of r.info) console.log(`   · ${h.msg}`);
  console.log("");
}
if (!brokenTotal && !QUIET)
  console.log(`Every wire resolves. This says the connections are intact — it does NOT say the things they
connect are still worth keeping. That question is usage-census's, and it is a slower one.`);

process.exit(brokenTotal ? 1 : 0);
