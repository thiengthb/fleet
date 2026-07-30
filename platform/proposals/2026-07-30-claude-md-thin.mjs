#!/usr/bin/env node
/**
 * 2026-07-30-claude-md-thin.mjs — move heavy spec OUT of the always-loaded CLAUDE.md.
 *
 * WHY A SCRIPT AND NOT AN EDIT. `CLAUDE.md` is governance: the agent proposes, the human applies
 * (CVE-2025-53773 lesson, CLAUDE.md §Autonomous agent). Default is a dry run; `--apply` is opt-in.
 *
 * WHAT MAKES THIS SAFE TO APPLY, and it is checked, not asserted. Two gates run before any write,
 * and either one failing REFUSES the apply:
 *
 *   GATE 1 — every relocated rule is present at its destination.  A "refactor" that cannot prove
 *            the destination carries the content is a deletion. Each row names WHICH of the four
 *            exit criteria (standards/documentation.md §7.3) licenses the move.
 *   GATE 2 — every prohibition still appears in the new file verbatim.  A path-scoped rules file
 *            is delivered attached to the tool RESULT, i.e. after the call it was meant to govern,
 *            so a prohibition may never be relocated. This gate is what stops that by accident.
 *
 * Plus the ordinary guards: the current file must hash to the expected OLD sha256 (refuse on drift,
 * e.g. a parallel session edited it), and re-running after a successful apply reports "already
 * applied" instead of writing again.
 *
 * APPLIED 2026-07-30 (211 → 181 lines, -3084 bytes), and its content file `…-thin.new.md` was then
 * DELETED on purpose: it was a byte-identical copy of CLAUDE.md, and a second copy of governance in
 * the repo is a thing a later reader edits by mistake. So this file is now a RECORD, not a runnable
 * applier — what is worth keeping is the provenance table (which rule moved where, under which of the
 * four exit criteria) and the gate shape, reusable for the next thinning pass. To see the content it
 * wrote: `git show <this commit>:CLAUDE.md`.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TARGET = join(REPO, 'CLAUDE.md');
const NEW_FILE = join(REPO, 'platform', 'proposals', '2026-07-30-claude-md-thin.new.md');
const EXPECTED_OLD_SHA =
  process.env.EXPECTED_OLD_SHA || 'be3d7af6148f1bdf9ed8e382aecd3409c61d80ebe022f47d795b93f886e0fd60';
const APPLY = process.argv.includes('--apply');

const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

/**
 * Both gates match on whitespace-NORMALISED text, and that is not a convenience.
 * These documents are hard-wrapped at ~120 columns, so a rule that is present can be split across a
 * newline mid-phrase. The first run of this script reported three prohibitions as relocated when all
 * three were sitting in the file, wrapped — a check that answers "missing" for something present is
 * worse than no check, because its output looks like a finding.
 */
const norm = (s) => s.replace(/\s+/g, ' ');
const carries = (path, needle) => existsSync(path) && norm(readFileSync(path, 'utf8')).includes(norm(needle));

/* GATE 1 — what left CLAUDE.md, where it lives now, and under which exit criterion (§7.3).
   `needle` is grepped literally in `dest`; absent ⇒ the move is unproven ⇒ refuse. */
const PROVENANCE = [
  ['coding ref-file router', '.claude/skills/coding-convention/SKILL.md', 'backend-rules.md', 3],
  ['frontend mandatory-UI list', '.claude/rules/frontend.md', 'lucide icons ONLY', 2],
  ['frontend PageShell std', '.claude/rules/frontend.md', 'ui-layout.md', 2],
  ['ui-pattern-lock rule', '.claude/rules/frontend.md', 'ui-pattern-lock', 2],
  ['guide Discord tab spec', '.claude/skills/user-guide/SKILL.md', 'Discord tab', 4],
  ['guide MCP tab spec', '.claude/skills/user-guide/SKILL.md', 'MCP tab', 4],
  ['rule of three', '.claude/skills/code-reuse/SKILL.md', 'rule of three', 3],
  ['hybrid share / extract the glue', '.claude/skills/code-reuse/SKILL.md', 'glue', 3],
  ['web-app doc set 01/02/03', 'platform/standards/documentation.md', '01-product', 3],
  ['ledger index-vs-detail + 421KB', 'platform/standards/documentation.md', '421KB', 3],
  ['ledger two-writes procedure', '.claude/skills/session-wrap/SKILL.md', 'knowledge-ledger.md', 4],
  ['health-sweep VERDICT semantics', 'platform/standards/documentation.md', 'health-sweep.mjs', 3],
  ['attic: no delete command by design', 'platform/standards/documentation.md', 'attic.mjs', 3],
  ['platform-report monthly', 'platform/standards/documentation.md', 'platform-report.mjs', 3],
  ['re-run discovery tools after a move', 'platform/standards/documentation.md', 'compare COUNTS', 3],
  ['keep CLAUDE.md thin / exit criteria', 'platform/standards/documentation.md', 'exit criteria', 3],
  ['memory: native auto-memory wiring', '.claude/skills/memory/SKILL.md', 'autoMemoryDirectory', 4],
  ['memory: MEMORY.md hard cap', '.claude/skills/memory/SKILL.md', '25KB', 4],
  ['memory: CLAUDE.local.md tier', '.claude/skills/memory/SKILL.md', 'CLAUDE.local', 4],
  ['autonomy T1-T4 tier detail', 'platform/standards/autonomy-contract.md', 'T4', 3],
  ['idea queue / skill-proposals', 'platform/standards/autonomy-contract.md', 'skill-proposer', 3],
  ['research tier mechanics', 'platform/standards/token-and-research.md', 'Quick', 3],
  ['app-remove teardown order', '.claude/skills/app-remove/SKILL.md', 'Authentik', 4],
];

/**
 * The reference-skill blockquote listed 14 skills by name. Its destination is NOT the candidates
 * registry — checked, and `/testing-standard` was not in it. The real destination is the harness
 * itself: an installed skill's name + `description` is already in the always-loaded skill list, so
 * the blockquote was duplicating a surface every session gets for free (criterion 3). What must hold
 * is therefore that each one is installed AND has a description — a nameless skill never auto-fires.
 */
const REFERENCE_SKILLS = [
  'prisma-expert', 'database-design', 'react-best-practices', 'docker-expert', 'mcp-builder',
  'api-integration-specialist', 'async-python-patterns', 'architecture', 'dependabot-review',
  'supply-chain-guard', 'testing-standard', 'vitest-server-actions', 'playwright-e2e-builder',
  'skill-authoring',
];
for (const s of REFERENCE_SKILLS) {
  PROVENANCE.push([`reference skill /${s} auto-fires`, `.claude/skills/${s}/SKILL.md`, 'description:', 3]);
}

/* GATE 2 — a prohibition may never be relocated (see the header). Each must survive verbatim. */
const PROHIBITIONS = [
  'never hardcode a token/key',
  'Never self-code auth',
  'never a bind-mount',
  'never commit/push unless asked',
  'NEVER edits its own governance',
  'never push `main`',
  'NEVER writes to `.claude/skills/`',
  'self-scoring in a closed loop is forbidden',
  'never** auto-acted on',
  'never duplicate across tiers',
  'the agent never receives secret values',
  'never refetch',
  'never pre-build for software that *might* come later',
  'read it, never assume',
  'Writing original code is the LAST step',
  'No reflexive "You\'re absolutely right!"',
];

function main() {
  if (!existsSync(NEW_FILE)) die(`missing replacement content: ${rel(NEW_FILE)}`);
  const oldText = readFileSync(TARGET, 'utf8');
  const newText = readFileSync(NEW_FILE, 'utf8');
  const oldSha = sha(oldText);
  const newSha = sha(newText);

  if (oldSha === newSha) {
    console.log('✓ already applied — CLAUDE.md is byte-identical to the proposed version. Nothing to do.');
    return 0;
  }
  if (oldSha !== EXPECTED_OLD_SHA) {
    die(
      `CLAUDE.md has drifted since this proposal was written.\n` +
        `  expected sha256 ${EXPECTED_OLD_SHA}\n  actual   sha256 ${oldSha}\n` +
        `  REFUSING — re-generate the proposal against the current file instead of overwriting someone's edit.`
    );
  }

  /* GATE 1 */
  const missing = [];
  for (const [what, dest, needle] of PROVENANCE) {
    if (!carries(join(REPO, dest), needle)) missing.push(`${what}  →  ${dest}  (looked for: "${needle}")`);
  }

  /* GATE 2 */
  const newNorm = norm(newText);
  const lostRules = PROHIBITIONS.filter((p) => !newNorm.includes(norm(p)));

  const oldLines = oldText.split('\n').length;
  const newLines = newText.split('\n').length;
  console.log(`\nCLAUDE.md — heavy spec → its trigger-site`);
  console.log(`  before : ${oldLines} lines, ${Buffer.byteLength(oldText)} bytes  (sha ${oldSha.slice(0, 12)})`);
  console.log(`  after  : ${newLines} lines, ${Buffer.byteLength(newText)} bytes  (sha ${newSha.slice(0, 12)})`);
  console.log(
    `  delta  : ${newLines - oldLines} lines, ${Buffer.byteLength(newText) - Buffer.byteLength(oldText)} bytes ` +
      `(${(100 - (Buffer.byteLength(newText) / Buffer.byteLength(oldText)) * 100).toFixed(1)}% smaller)`
  );
  console.log(`\nGATE 1 — relocated rules present at destination : ${PROVENANCE.length - missing.length}/${PROVENANCE.length}`);
  for (const m of missing) console.log(`   ✗ ${m}`);
  console.log(`GATE 2 — prohibitions still in CLAUDE.md        : ${PROHIBITIONS.length - lostRules.length}/${PROHIBITIONS.length}`);
  for (const l of lostRules) console.log(`   ✗ relocated a PROHIBITION: "${l}"`);

  if (missing.length || lostRules.length) {
    die('\nREFUSING to apply — fix the destination (or keep the rule in CLAUDE.md) and re-run.');
  }
  console.log('\n  both gates green.');

  if (!APPLY) {
    console.log(`\n(dry run — nothing written). To apply:\n  node ${rel(import.meta.filename)} --apply\n`);
    return 0;
  }
  writeFileSync(TARGET, newText, 'utf8');
  console.log(`\n✓ applied → ${rel(TARGET)}  (${newLines} lines)`);
  console.log('  review with: git diff CLAUDE.md');
  return 0;
}

const rel = (p) => p.replace(REPO + '/', '');
function die(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

process.exit(main());
