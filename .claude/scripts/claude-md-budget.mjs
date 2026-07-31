#!/usr/bin/env node
// @vi WHAT: Canh cái file luật luôn-được-nạp (CLAUDE.md): nó có vượt ngân sách từ không, có điều CẤM nào bị chuyển đi
//   mất không, và những chỗ khác trong repo trỏ tới "CLAUDE.md §..." có còn trỏ đúng không.
// @vi WHEN: Tự động trong health-sweep hằng tuần; và mỗi lần định sửa/làm gọn CLAUDE.md.
// @vi WHY: Mọi từ trong file này bị tính phí cho MỌI lượt chat, kể cả lượt tầm phào — nên nó phình là mất tiền thật.
//   Nhưng làm gọn sai thì tệ hơn phình: một điều CẤM bị dời sang file nạp-theo-đường-dẫn sẽ đến SAU cái lệnh nó phải
//   ngăn. Máy đo được cả hai; người chỉ nhớ được một.
//
/**
 * claude-md-budget.mjs — the standing gate on the always-loaded surface.
 *
 * WHY THIS EXISTS AS A TOOL AND NOT A PARAGRAPH. `platform/standards/documentation.md §7.2–§7.3` has said
 * "keep CLAUDE.md thin" and "a prohibition may never be relocated" since it was written. The file still
 * reached 2,270 words, and a one-shot thinning applier
 * (`platform/proposals/2026-07-30-claude-md-thin.mjs`) ran its two gates ONCE, at apply time, and then
 * became a frozen record. A gate that runs once does not hold a line; it marks a moment. This runs every
 * sweep.
 *
 * It owns the canonical PROHIBITIONS list from here on. The 2026-07-30 proposal keeps its copy as part of
 * the historical record of that pass — it is not a second live source, and it is not re-run.
 *
 * THREE CHECKS.
 *
 *   BUDGET       — word count ≤ WORD_BUDGET. Words, not bytes: bytes move when a link is re-worded and say
 *                  nothing about what the model pays. Not lines either — this file is hard-wrapped, so a
 *                  line budget rewards re-flowing text instead of removing it.
 *
 *   PROHIBITIONS — every declared prohibition still present, matched on whitespace-NORMALISED text because
 *                  the file is wrapped at ~120 columns and a rule that IS present can be split mid-phrase.
 *                  (The 2026-07-30 pass hit exactly that: three prohibitions reported missing while all
 *                  three sat in the file, wrapped. A check that answers "missing" for something present is
 *                  worse than no check, because its output looks like a finding.)
 *
 *   ANCHORS      — other files cite sections of this file by name (the `CLAUDE.md §<heading>` form; written
 *                  with angle brackets here on purpose, so this sentence is not itself counted). Those are
 *                  prose, so `link-check` cannot see them: renaming a heading breaks them silently. The
 *                  citations are DISCOVERED by scanning the repo, not hardcoded, so a new referrer is
 *                  covered the day it is written.
 *
 * WHY AN UNRESOLVED ANCHOR IN A CLOSED PLAN IS NOT AN ERROR. Measured 2026-07-31 on this platform:
 * `plan-audit` was reporting 92 WARNs of which 74 were on CLOSED plans — unrepairable without editing
 * history, and they buried the 18 that were live. So a citation from an archival surface (a plan, the
 * ledger, a proposal, the attic) is reported as `legacy` and does not fail the run. Only citations from
 * LIVE governance surfaces can fail it.
 *
 * Exit 0 clean · 1 any ERROR-level finding. `--quiet` prints the summary line only.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
/**
 * Both roots are overridable so the tool can be exercised against a sandbox tree instead of the live repo.
 * Without that, every ANCHOR case would assert against whatever the platform happens to cite today and would
 * break the next time somebody writes a new reference — a test that measures the repo, not the tool.
 */
const REPO = resolve(process.env.CLAUDE_MD_REPO || join(HERE, '..', '..'));
const TARGET = process.env.CLAUDE_MD_PATH || join(REPO, 'CLAUDE.md');
const QUIET = process.argv.includes('--quiet');

/**
 * The budget. Set from the measured size after the 2026-07-31 thinning pass (1,729 words) plus ~4%
 * headroom, so an ordinary edit that re-words a rule does not fail the run while real growth does.
 *
 * It is a RATCHET, and lowering it is the only edit that needs no argument. Raising it means the
 * always-loaded surface got more expensive for every session on the platform, so raising it belongs in a
 * commit that says which rule earned the words and why it could not live at its trigger site instead.
 */
const WORD_BUDGET = Number(process.env.CLAUDE_MD_WORD_BUDGET || 1800);

/**
 * A prohibition may never rely on a path-scoped rules file (`documentation.md §7.3`, hard exception): that
 * file is delivered attached to the tool RESULT, i.e. after the call it was supposed to govern. So each of
 * these must be findable in the always-loaded text itself. Matched normalised; short and distinctive on
 * purpose, so re-wording the sentence around one does not trip the check.
 */
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

/** Live governance surfaces: a broken citation from one of these is an ERROR. */
const LIVE_PREFIXES = ['.claude', join('platform', 'standards'), join('platform', 'registries'), join('platform', 'targets')];
/** Never scanned: build output, vendored code, and the retired tier. */
const SKIP_DIRS = new Set(['.git', 'node_modules', '.next', 'dist', 'build', 'coverage', '.turbo']);

const norm = (s) => s.replace(/\s+/g, ' ');

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(join(dir, e.name), out);
    } else if (/\.(md|mjs|js|ts|json)$/.test(e.name)) {
      out.push(join(dir, e.name));
    }
  }
  return out;
}

/**
 * Pull the cited section name out of a `CLAUDE.md §…` reference. Two forms are in use here — quoted
 * (`§"Model routing"`) and bare (`§Autonomous agent`) — and the bare form has no closing delimiter, so it
 * is cut at the first punctuation that cannot appear inside a heading and capped in length. An over-greedy
 * capture would invent a needle that can never match and report a break that is not one.
 */
function citedSections(text) {
  const found = [];
  const re = /CLAUDE\.md\s*§\s*(?:"([^"]{1,60})"|([A-Za-z][^,;.`()\]\n"]{0,45}))/g;
  for (const m of text.matchAll(re)) {
    const raw = (m[1] ?? m[2] ?? '').trim().replace(/\s+/g, ' ');
    if (raw) found.push(raw);
  }
  return found;
}

function main() {
  let text;
  try {
    text = readFileSync(TARGET, 'utf8');
  } catch {
    // A clean, explained exit instead of a stack trace. The first wiring of this tool into `health-sweep`
    // ran it against a sandbox that had no repo root above it, and the sweep's report line became a
    // fragment of a Node exception — a checker whose failure output is unreadable teaches nothing.
    console.log(`✗ claude-md-budget — cannot read ${TARGET} (set CLAUDE_MD_PATH, or run from inside the repo)`);
    return 1;
  }
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const headings = text
    .split('\n')
    .filter((l) => /^#{1,6}\s/.test(l))
    .map((l) => l.replace(/^#{1,6}\s*/, '').trim());
  const flat = norm(text);

  const errors = [];
  const legacy = [];

  /* BUDGET */
  if (words > WORD_BUDGET) {
    errors.push(
      `BUDGET: ${words} words > ${WORD_BUDGET}. Move heavy spec to its trigger site (documentation.md §7.3), ` +
        `or say in the commit which rule earned the words.`
    );
  }

  /* PROHIBITIONS */
  const lostRules = PROHIBITIONS.filter((p) => !flat.includes(norm(p)));
  for (const p of lostRules) {
    errors.push(`PROHIBITION missing from the always-loaded text: "${norm(p)}" — it may not live anywhere else (§7.3).`);
  }

  /* ANCHORS */
  const headingsLower = headings.map((h) => h.toLowerCase());
  const cites = new Map(); // needle -> Set(relative source paths)
  for (const file of walk(REPO)) {
    const rel = relative(REPO, file);
    if (rel === 'CLAUDE.md') continue; // the file citing itself is not a wire
    /**
     * A test file is not a wire either, and this tool proved it on itself: its own suite plants a citation
     * to a section that does not exist, as the fixture that checks a break IS caught — and the first run of
     * the finished tool reported that fixture as a break, i.e. failed on the evidence that it works.
     * Fixtures are meant to be wrong; nobody follows one to look up a rule.
     *
     * CONVENTION for prose in this repo, and the reason it exists: writing the citation form literally in a
     * comment makes the tool flag its own documentation. So describe it as `CLAUDE.md §<heading>` with angle
     * brackets — that does not match, because the pattern requires a letter after the section sign. This is
     * deliberately NOT solved by exempting this file: the message names the file and the missing heading, so
     * anyone who trips it is told exactly what to do, and an exemption would blind a real citation later.
     */
    if (/\.test\.[cm]?[jt]s$/.test(rel)) continue;
    let body;
    try {
      body = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    if (!body.includes('CLAUDE.md')) continue;
    for (const needle of citedSections(body)) {
      if (!cites.has(needle)) cites.set(needle, new Set());
      cites.get(needle).add(rel);
    }
  }
  let anchorsOk = 0;
  for (const [needle, sources] of cites) {
    const hit = headingsLower.some((h) => h.includes(needle.toLowerCase()));
    if (hit) {
      anchorsOk += 1;
      continue;
    }
    const live = [...sources].filter((s) => LIVE_PREFIXES.some((p) => s === p || s.startsWith(p + sep)));
    const msg = `ANCHOR: no heading in ${relative(REPO, TARGET)} matches §"${needle}" — cited by ${[...sources].join(', ')}`;
    if (live.length) errors.push(msg);
    else legacy.push(msg);
  }

  const label = QUIET ? 'claude-md-budget' : `claude-md-budget — ${relative(REPO, TARGET)}`;
  const summary =
    `${label} — ${words}/${WORD_BUDGET} words · ` +
    `${PROHIBITIONS.length - lostRules.length}/${PROHIBITIONS.length} prohibitions · ` +
    `${anchorsOk}/${cites.size} cited sections resolve` +
    (legacy.length ? ` · ${legacy.length} legacy` : '');

  if (!QUIET) {
    for (const e of errors) console.log(`   ✗ ${e}`);
    for (const l of legacy) console.log(`   · legacy (archival source, not failing): ${l}`);
    if (!errors.length) console.log(`   ok  ${words} words, every prohibition present, every live citation resolves`);
  }
  console.log(errors.length ? `✗ ${summary}` : `ok ${summary}`);
  return errors.length ? 1 : 0;
}

process.exit(main());
