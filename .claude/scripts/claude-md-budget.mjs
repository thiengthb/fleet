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

/**
 * Every file class the LIVE gate blocks must be named in the always-loaded prohibition — checked, not trusted.
 *
 * WHY THIS EXISTS. Measured 2026-08-01: `CLAUDE.md` listed **7** governance surfaces and said *"Enforced by
 * `autonomy-gate.mjs`"*, which reads as "this list is that list". The gate's array held **12**. The drift bit in
 * both directions — a reader trusting the prose thought `.claude/scripts/` and `.claude/rules/` were free to edit
 * unattended, and nobody comparing the two noticed `.claude/agents/`, which was in **neither**: a subagent's
 * system prompt, unguarded, for as long as the directory had existed.
 *
 * A prohibition that lives only in the hook is enforced but not known; one that lives only in the prose is known
 * but not enforced. Neither half can be trusted to notice the other drifting, so this asserts the agreement.
 *
 * DELIBERATELY A KEYWORD CHECK, not a pattern comparison. It pulls the distinctive directory/word token out of
 * each regex (`/\.claude\/hooks\//` → `hooks`) and requires it to appear in the prohibition sentence. Matching
 * the regexes structurally against prose would be brittle in the way `plan-audit`'s first heading check was —
 * *"the rule was right; the ruler was short"* — and a checker that cries wolf about wording gets deleted. A
 * missing CLASS is the failure worth catching, and `agents` absent would have fired.
 */
function governanceTokens() {
  let gate;
  try {
    gate = readFileSync(join(REPO, '.claude', 'hooks', 'autonomy-gate.mjs'), 'utf8');
  } catch {
    return null; // no gate to compare against ⇒ report it, never silently pass
  }
  const start = gate.indexOf('const GOVERNANCE = [');
  if (start < 0) return null;
  const block = gate.slice(start, gate.indexOf('];', start));
  const tokens = new Set();
  /**
   * Words are taken from the text AFTER `re:` on each entry line — deliberately not by parsing the regex
   * literal. The first attempt did try to parse it (`/re:\s*\/([^/\n]*(?:\\\/[^/\n]*)*)\//`) and extracted
   * exactly ONE token out of thirteen, because `[^/\n]*` swallows the escaping backslash before `\/` and the
   * match dies at the first slash. It reported `1/1 named` — a green that measured nothing, which is the
   * failure this whole file exists to catch, produced by the file itself. Splitting on non-letters cannot
   * fail that way: there is no grammar to get wrong.
   *
   * `claude`/`local`/`json`/`md`/`platform` are dropped as carrier words — they appear in nearly every
   * pattern and would match the prose no matter what it said, so counting them would inflate the score.
   */
  for (const line of block.split('\n')) {
    const i = line.indexOf('re:');
    if (i < 0) continue;
    for (const w of line.slice(i + 3).replace(/\\/g, '').split(/[^A-Za-z]+/)) {
      const t = w.toLowerCase();
      if (t.length > 2 && !['claude', 'local', 'json', 'platform'].includes(t)) tokens.add(t);
    }
  }
  return tokens;
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
  const skipped = [];

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

  /* GOVERNANCE-SYNC */
  const govTokens = governanceTokens();
  let govChecked = 0;
  let govNamed = 0;
  if (govTokens === null) {
    /**
     * No gate to compare against ⇒ SKIP, loudly, and do not fail.
     *
     * The first cut raised an ERROR here, on the principle of never passing silently. That was wrong twice
     * over. It duplicates a job `link-check` already does properly — `settings.json` wires this hook, and its
     * hook-wiring check fails if the file is gone — and, measured immediately, it broke two of this suite's own
     * mutants: every fixture lacks `.claude/hooks/`, so the unconditional error meant EVERY sandbox run
     * reported at least one problem, which masked whether the mutated code reported its own. A check that
     * fires in every fixture does not add a signal, it destroys the ones already there.
     */
    skipped.push('governance-sync — no .claude/hooks/autonomy-gate.mjs beside this CLAUDE.md to compare against');
  } else {
    /**
     * Scope to the prohibition BULLET, not the whole file: a token appearing in some unrelated paragraph would
     * satisfy a whole-file search while the prohibition itself stayed silent about the class.
     *
     * Cut at the next list item, NOT at the first `;`. The first cut of this check used `;` and immediately
     * reported a false break — the bullet separates its two path groups with a semicolon, so the ruler stopped
     * before `.github/workflows/` and called it unnamed. Same defect as `plan-audit`'s short heading regex, in a
     * checker written the day that lesson was re-read. Matched on RAW text because the bullet boundary is a
     * newline, which whitespace-normalising destroys.
     */
    const bullet = /NEVER edits its own governance[\s\S]*?(?=\n[ \t]*[-*][ \t]|\n\n|$)/.exec(text);
    /**
     * Two further narrowings, each added because the check passed for the wrong reason:
     *
     * 1. **Only the LIST, not the rationale.** With `agents/` deleted from the list the check still passed,
     *    because the bullet's own explanation of the gap contains the word — prose *about* a surface satisfying
     *    a search for that surface. Same shape as the false-ANCHOR bug (`usage-census`: a document discussing
     *    `INSTALL.md` counted as depending on it) and the comment-stripping one in `canBlock`, which is three
     *    occurrences in one day of *text about a thing being mistaken for the thing*. The list ends where the
     *    rule's second half begins, at "it may *propose*"; if that is ever reworded the check degrades to
     *    scanning the whole bullet — weaker, never broken.
     * 2. **Only inside code spans.** Every surface in the list is written in backticks. Requiring that makes an
     *    incidental mention in ordinary prose insufficient.
     */
    const region = (bullet ? bullet[0] : '').split(/it may\b/)[0];
    const sentence = [...region.matchAll(/`([^`]+)`/g)]
      .map((m) => m[1])
      .join(' ')
      .toLowerCase();
    govChecked = govTokens.size;
    const unnamed = [...govTokens].filter((t) => !sentence.includes(t));
    govNamed = govChecked - unnamed.length;
    if (!sentence) {
      errors.push(`GOVERNANCE-SYNC: the "NEVER edits its own governance" sentence was not found, so its list cannot be checked.`);
    } else if (unnamed.length) {
      errors.push(
        `GOVERNANCE-SYNC: autonomy-gate blocks ${unnamed.length} surface(s) the always-loaded prohibition never ` +
          `names — ${unnamed.join(', ')}. Enforced but unknown is how \`.claude/agents/\` stayed unguarded; add ` +
          `them to the list, or remove them from the gate.`
      );
    }

    /**
     * THE COUNT, checked separately — and the reason it is a separate check is a limitation found by using the
     * one above.
     *
     * On 2026-08-01 `.claude/workflows/` was added to both the gate and the prose, and this check went on
     * reporting the same score. Cause: it matches WORDS, and `workflows` was already in the token set from
     * `.github/workflows` — two different surfaces, one word. So GOVERNANCE-SYNC **never could have found that
     * hole**, and it cannot be made to: the prose groups surfaces under a `.claude/` prefix rather than spelling
     * each full path, so requiring `claude/workflows` as a phrase would fail on correct prose. The distinction is
     * verified where it actually can be — `autonomy-gate.test.mjs` asserts both directories block, separately.
     *
     * What IS mechanically checkable is the NUMBER the always-loaded file asserts about itself. It is
     * hand-maintained, and hand-maintained numbers drift: this very bullet records that the list "said 7 while
     * the gate enforced 12", and on the same day the knowledge-ledger index was found claiming 211 lessons while
     * holding 258. A count in the always-loaded file is a claim the agent reads every session; if it is wrong,
     * everything downstream of it is wrong quietly.
     */
    // Searched in the WHOLE bullet, not the narrowed `region`: `region` deliberately stops at "it may
    // *propose*" so that prose about a surface cannot satisfy a search for it, and the count sentence lives on
    // the far side of that cut. Measured — the first version looked in `region` and reported the number missing
    // while it was two clauses away. Narrowing is per-question; a scope that is right for one check is not
    // automatically right for the next one bolted beside it.
    const claimed = /All\s+(\d+)\s+enforced by/.exec(bullet ? bullet[0] : '');
    // Re-read rather than thread the source out of `governanceTokens()`: that function's contract is "tokens or
    // null", and widening it to carry a second value is how a helper stops being checkable on its own.
    let gateSrc = '';
    try {
      gateSrc = readFileSync(join(REPO, '.claude', 'hooks', 'autonomy-gate.mjs'), 'utf8');
    } catch {
      /* unreachable: govTokens === null already handled the missing-gate case above */
    }
    const gateStart = gateSrc.indexOf('const GOVERNANCE = [');
    const gateEntries =
      gateStart < 0
        ? null
        : gateSrc
            .slice(gateStart, gateSrc.indexOf('];', gateStart))
            .split('\n')
            .filter((l) => /^\s*\{\s*name:/.test(l)).length;
    if (!claimed) {
      errors.push(
        `GOVERNANCE-SYNC: the prohibition does not state how many surfaces the gate enforces ("All N enforced ` +
          `by ..."). That number is the only part of this list a machine can check exactly — keep it.`
      );
    } else if (gateEntries !== null && Number(claimed[1]) !== gateEntries) {
      errors.push(
        `GOVERNANCE-SYNC: CLAUDE.md claims ${claimed[1]} enforced governance surfaces; autonomy-gate's ` +
          `GOVERNANCE array has ${gateEntries}. One of them is a hand-maintained number that drifted — read the ` +
          `array, then fix the prose (or the array, if a surface was dropped by accident).`
      );
    }
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
    `${anchorsOk}/${cites.size} cited sections resolve · ` +
    (govChecked ? `${govNamed}/${govChecked} governance surfaces named` : 'governance-sync skipped') +
    (legacy.length ? ` · ${legacy.length} legacy` : '');

  if (!QUIET) {
    for (const e of errors) console.log(`   ✗ ${e}`);
    for (const l of legacy) console.log(`   · legacy (archival source, not failing): ${l}`);
    for (const s of skipped) console.log(`   · skipped (not a failure, but not a pass either): ${s}`);
    if (!errors.length) console.log(`   ok  ${words} words, every prohibition present, every live citation resolves`);
  }
  console.log(errors.length ? `✗ ${summary}` : `ok ${summary}`);
  return errors.length ? 1 : 0;
}

process.exit(main());
