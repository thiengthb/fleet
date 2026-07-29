#!/usr/bin/env node
/**
 * decisions-split.mjs — turn a project's `docs/decisions.md` back into an INDEX.
 *
 * Same disease, same cure as `ledger-split.mjs` (2026-07-28, 421KB → index + monthly files).
 * That fix was applied to the cross-project ledger and nobody checked whether the PER-PROJECT
 * decision logs had grown the same way. Measured 2026-07-29, they had:
 *
 *   sakubun   382KB  4874 lines  203 entries   (~95K tokens)
 *   yakudoku   36KB   335 lines   14 entries
 *   rulebook   19KB   268 lines    9 entries
 *   todo       12KB   137 lines    4 entries
 *
 * sakubun is 10x the next largest. `documentation.md` calls `decisions.md` an on-demand archival
 * tier, so it is not paid every session — but ~95K tokens is unreadable in one pass by a human OR
 * an agent, which defeats the purpose of a log you consult before making a decision.
 *
 * What this does, and the part that matters: entries are RELOCATED, never rewritten. The index
 * carries date + title + link only. Byte-for-byte preservation is VERIFIED by reassembling the
 * split output and comparing entry bodies against the original — a split that silently drops an
 * entry would destroy the most valuable file in the project, so it is checked rather than trusted.
 *
 * Usage
 *   node .claude/scripts/decisions-split.mjs <project>            # dry-run, report only
 *   node .claude/scripts/decisions-split.mjs <project> --apply
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const REPO = resolve('.');
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const project = args.find((a) => !a.startsWith('--'));

if (!project) {
  console.error('usage: node .claude/scripts/decisions-split.mjs <project> [--apply]');
  process.exit(2);
}

const SRC = join(REPO, project, 'docs', 'decisions.md');
const OUT_DIR = join(REPO, project, 'docs', 'decisions');
const ENTRY = /^##\s+(\d{4}-\d{2}-\d{2})\s+[—-]\s+(.+)$/;
const TITLE_MAX = 120;

if (!existsSync(SRC)) {
  console.error(`decisions-split: ${project}/docs/decisions.md does not exist.`);
  process.exit(2);
}

const src = readFileSync(SRC, 'utf8');
const lines = src.split('\n');

/* ---------------------------------------------------------------- parse -- */

const header = [];
const entries = [];
let current = null;

for (const line of lines) {
  const m = line.match(ENTRY);
  if (m) {
    if (current) entries.push(current);
    current = { date: m[1], title: m[2].trim(), heading: line, body: [] };
    continue;
  }
  if (current) current.body.push(line);
  else header.push(line);
}
if (current) entries.push(current);

if (entries.length === 0) {
  console.error(
    `decisions-split: parsed 0 entries from ${SRC}.\n` +
      `  Expected "## YYYY-MM-DD — title" headings. Refusing to write anything.`,
  );
  process.exit(2);
}

/** A `---` rule that only separated two entries belongs to neither; drop it from the tail. */
function trimSeparator(bodyLines) {
  const out = [...bodyLines];
  while (out.length && out[out.length - 1].trim() === '') out.pop();
  if (out.length && out[out.length - 1].trim() === '---') out.pop();
  while (out.length && out[out.length - 1].trim() === '') out.pop();
  return out;
}

for (const e of entries) e.body = trimSeparator(e.body);

const slugOf = (e) =>
  `${e.date}-${e.title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
    .replace(/-$/, '');

const clip = (s) =>
  s.length <= TITLE_MAX ? s : `${s.slice(0, TITLE_MAX - 1).replace(/[\s,;:—-]+$/, '')}…`;

/* ------------------------------------------------------- group by month -- */

const byMonth = new Map();
for (const e of entries) {
  const month = e.date.slice(0, 7);
  if (!byMonth.has(month)) byMonth.set(month, []);
  byMonth.get(month).push(e);
}

const monthFiles = [...byMonth.entries()]
  .sort()
  .map(([month, list]) => {
    // Newest first inside a month, matching the convention of the file being replaced.
    const ordered = [...list].reverse();
    const content = [
      `# ${project} — decisions, ${month}`,
      '',
      `> Detail tier. ${ordered.length} entr${ordered.length === 1 ? 'y' : 'ies'}, relocated **verbatim** from`,
      `> \`${project}/docs/decisions.md\` when that file passed the readable-in-one-pass threshold.`,
      '> The index lives at `../decisions.md`; append new entries THERE and re-run the split, or append here',
      '> and add the index row in the same change.',
      '',
      ...ordered.flatMap((e) => [
        `## ${e.date} — ${e.title}`,
        '',
        `<a id="${slugOf(e)}"></a>`,
        '',
        ...e.body,
        '',
        '---',
        '',
      ]),
    ].join('\n');
    return { month, file: `${month}.md`, list: ordered, content };
  });

/* --------------------------------------------------------- build index -- */

const indexRows = [...entries]
  .reverse()
  .map(
    (e) =>
      `| ${e.date} | ${clip(e.title).replace(/\|/g, '\\|')} | [→](decisions/${e.date.slice(0, 7)}.md#${slugOf(e)}) |`,
  );

const headerText = header.join('\n').trim();

const newIndex = [
  headerText,
  '',
  '---',
  '',
  '## Index',
  '',
  `**${entries.length} decisions**, ${entries[entries.length - 1].date} → ${entries[0].date}, newest first.`,
  `Detail lives in \`docs/decisions/YYYY-MM.md\` — this file is the scannable index.`,
  '',
  '> **Split 2026-07-29.** This file had reached 382KB / 4874 lines / ~95K tokens — 10× the next largest',
  '> project — which is unreadable in one pass by a human or an agent, and a log you cannot read before',
  '> deciding is not a decision log. Entries were relocated **verbatim** by',
  '> `.claude/scripts/decisions-split.mjs`; nothing was summarised, rewritten or dropped. Same cure the',
  '> cross-project ledger got on 2026-07-28 — the per-project logs were simply never checked for it.',
  '>',
  '> **Adding a decision:** append the full entry to the current month file and one row here, in the same',
  '> change. That is the rule the ledger learned the hard way: detail in the index is how an index dies.',
  '',
  '| Date | Decision | Detail |',
  '|---|---|---|',
  ...indexRows,
  '',
  '## Detail files',
  '',
  ...monthFiles
    .slice()
    .reverse()
    .map((f) => `- [\`decisions/${f.file}\`](decisions/${f.file}) — ${f.list.length} entries`),
  '',
].join('\n');

/* -------------------------------------------------------- verification -- */

const norm = (s) => s.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trim();
const digest = (s) => createHash('sha256').update(norm(s)).digest('hex').slice(0, 12);

let mismatches = 0;
for (const f of monthFiles) {
  for (const e of f.list) {
    if (!f.content.includes(e.body.join('\n').trim())) {
      console.error(`  MISMATCH: ${e.date} — ${e.title} did not survive relocation verbatim`);
      mismatches++;
    }
  }
}
const bodyDigestBefore = digest(entries.map((e) => e.body.join('\n')).join('\n\n'));
const bodyDigestAfter = digest(
  monthFiles
    .flatMap((f) => f.list)
    .sort((a, b) => entries.indexOf(a) - entries.indexOf(b))
    .map((e) => e.body.join('\n'))
    .join('\n\n'),
);

const before = Buffer.byteLength(src);
const afterIndex = Buffer.byteLength(newIndex);
const afterDetail = monthFiles.reduce((n, f) => n + Buffer.byteLength(f.content), 0);

console.log(`decisions-split — ${project}`);
console.log(`  source        : ${before} bytes, ${lines.length} lines, ${entries.length} entries`);
console.log(`  new index     : ${afterIndex} bytes  (${((afterIndex / before) * 100).toFixed(1)}% of the original)`);
console.log(`  detail files  : ${monthFiles.length} files, ${afterDetail} bytes total`);
for (const f of monthFiles) console.log(`      docs/decisions/${f.file}  ${f.list.length} entries`);
console.log(`  entry-body digest  before=${bodyDigestBefore}  after=${bodyDigestAfter}`);
console.log(`  verbatim check     ${mismatches === 0 ? 'PASS — every entry body relocated intact' : `FAIL — ${mismatches} mismatch(es)`}`);

if (mismatches > 0 || bodyDigestBefore !== bodyDigestAfter) {
  console.error('\nRefusing to write: the relocation is not byte-faithful.');
  process.exit(1);
}

if (!APPLY) {
  console.log('\ndry run — nothing written. Re-run with --apply.');
  process.exit(0);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const f of monthFiles) writeFileSync(join(OUT_DIR, f.file), f.content, 'utf8');
writeFileSync(SRC, newIndex, 'utf8');
console.log(`\nAPPLIED. ${readdirSync(OUT_DIR).length} detail files + a ${afterIndex}-byte index.`);
