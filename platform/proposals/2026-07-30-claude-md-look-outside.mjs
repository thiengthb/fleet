#!/usr/bin/env node
/**
 * PROPOSAL — teach the ALWAYS-LOADED rule summary that "look before you build" includes outside.
 *
 * `/code-reuse` was extended on 2026-07-30 with Step 1c (probe installed tools, then web, then record a
 * verdict). But CLAUDE.md §"Code reuse across projects" — the text that is loaded on EVERY turn and
 * therefore the thing that actually shapes the agent's first move — still names only two sources, both
 * internal: the catalog and a grep of sibling projects. A skill loads on demand; this paragraph does not.
 * Leaving it as-is means the mechanism exists but the reflex it is meant to change never sees it.
 *
 * The agent may not edit any CLAUDE.md (governance; the CVE-2025-53773 lesson), so this exists to be run
 * by a human. It is an exact-string replacement of one paragraph — it refuses to run if the expected text
 * is not found byte-for-byte, so it cannot half-apply against a drifted file.
 *
 *   node platform/proposals/2026-07-30-claude-md-look-outside.mjs           # show the diff, change nothing
 *   node platform/proposals/2026-07-30-claude-md-look-outside.mjs --apply   # write it
 *
 * Then: git add CLAUDE.md && git commit -m "docs(rules): look outside before writing original code"
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const FILE = join(process.cwd(), 'CLAUDE.md');
const APPLY = process.argv.includes('--apply');

const OLD = `Independent repos → reuse isn't free, but reinventing wastes tokens+time. **Before building a feature:** read the catalog
**\`platform/registries/shared-assets.md\`** + grep sibling projects for prior art.`;

const NEW = `Independent repos → reuse isn't free, but reinventing wastes tokens+time. **Before building a feature, IN THIS ORDER:**
① read the catalog **\`platform/registries/shared-assets.md\`** + grep sibling projects · ② **probe the tools already
installed** — \`npx shadcn@latest search @<ns>\`: 8 community namespaces resolve with **no config at all** (~3.4k items,
measured 2026-07-30) · ③ **look outside** (web; P2+ only, Quick tier — P1 skips it and says so), then write a verdict row
**including refusals** into \`commons/docs/external-patterns.md\`. **Writing original code is the LAST step, not the
first** — an outside source may exceed what the user was able to ask for, and surfacing that is the job, not scope creep.
**FOMO brake:** never pre-build for software that *might* come later — a verdict row is cheap, an item is expensive
(\`commons\`: 27 proven items, **0 installs** so far).`;

const text = readFileSync(FILE, 'utf8');

// Sentinel must be text that appears ONLY in the new version. The first ~80 characters of OLD and NEW are
// byte-identical, so a prefix check reports "already applied" against an untouched file — found by
// rehearsing this script on a copy, not by reading it.
const SENTINEL = '**Before building a feature, IN THIS ORDER:**';
if (text.includes(SENTINEL)) {
  console.log('Already applied — CLAUDE.md carries the ordered version. Nothing to do.');
  process.exit(0);
}

const count = text.split(OLD).length - 1;
if (count !== 1) {
  console.error(
    `REFUSING: expected the anchor paragraph exactly once, found ${count}.\n` +
      `CLAUDE.md has drifted from what this proposal was written against — re-read §"Code reuse\n` +
      `across projects" and update this script rather than forcing it.`,
  );
  process.exit(1);
}

console.log('--- remove\n' + OLD + '\n\n+++ insert\n' + NEW + '\n');

if (!APPLY) {
  console.log('Dry run — nothing written. Re-run with --apply.');
  process.exit(0);
}

writeFileSync(FILE, text.replace(OLD, NEW));
console.log('CLAUDE.md updated. Review with `git diff CLAUDE.md` before committing.');
