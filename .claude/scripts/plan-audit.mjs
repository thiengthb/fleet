#!/usr/bin/env node
/**
 * plan-audit.mjs — does a plan/proposal file actually follow the standard? Report-only.
 *
 * WHY THIS EXISTS. The platform had three ways to be told how to write a plan (`/project-plan`,
 * `templates/plan.md`, `standards/documentation.md §5.5`) and exactly one mechanical check on the result:
 * `plan-checkin.mjs`, which only looks at `checkin:` and staleness. Everything else — prior art on a feature
 * plan, acceptance criteria, steps naming their files and their test, template placeholders left unfilled —
 * was enforced by the agent remembering. That is the same shape as every rule this platform has already
 * watched erode: the ledger index rule held for zero of 203 entries until it was split by a script.
 *
 * The supervisor's own doctrine, applied to the agent's own process: **if checking it needs no thought,
 * it should not cost a thought.** This is that script.
 *
 * WHAT IT IS NOT. It cannot judge whether a plan is any GOOD — whether the approach is sound, whether the
 * ruled-out options were really considered, whether an AC is meaningful. It checks the SHAPE. A file can
 * score clean here and still be a bad plan. Treat a clean run as "nothing structural is missing", never as
 * "this plan is fine".
 *
 * Exit code is always 0. This informs; a human decides. (`--strict` returns 1 on any ERROR, for CI use.)
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve, dirname, basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectRoots } from './_layout.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const JSON_OUT = process.argv.includes('--json');
const STRICT = process.argv.includes('--strict');

/* ── locate every plan/proposal ─────────────────────────────────────────────────────────────── */

/** Plans live in exactly two shapes: the platform's own `platform/plans/`, and `<project>/docs/plans/`. */
function findPlanFiles() {
  const out = [];
  const platformPlans = join(REPO, 'platform', 'plans');
  if (existsSync(platformPlans)) {
    for (const f of readdirSync(platformPlans)) {
      if (f.endsWith('.md')) out.push(join(platformPlans, f));
    }
  }
  // Discovery via _layout so a project living under `projects/` is still found (see _layout.mjs).
  for (const project of projectRoots(REPO)) {
    const dir = join(project.dir, 'docs', 'plans');
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (f.endsWith('.md') && !f.startsWith('_')) out.push(join(dir, f));
    }
  }
  return out.sort();
}

/* ── parsing ────────────────────────────────────────────────────────────────────────────────── */

function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (/^\s*#/.test(line)) continue; // commented-out template hints are not settings
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    fm[kv[1]] = kv[2].replace(/\s+#.*$/, '').trim(); // strip trailing comments
  }
  return fm;
}

/**
 * Body of a `## Heading` section, up to the next `## `. Returns null when the heading is absent.
 *
 * HARNESS DEFECT #1 (found + fixed on the first run, 2026-07-28). This used to anchor the heading with `$`,
 * demanding an EXACT match. But `templates/proposal.md` itself ships headings with suffixes —
 * `## Options considered — REQUIRED: ≥2, with tradeoffs` — so every proposal that followed the template
 * VERBATIM was reported as missing the very sections it contained, including the one written minutes earlier
 * in this session with four options and four pre-mortem bullets in it. A checker that fails the template it
 * checks against is worse than no checker: it would have taught the reader to ignore it.
 * Matching is therefore a PREFIX match on the heading text.
 */
function section(text, heading) {
  const re = new RegExp(`^##\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(?:[—\\-–:(].*)?$`, 'im');
  const m = text.match(re);
  if (!m) return null;
  const rest = text.slice(m.index + m[0].length);
  const next = rest.search(/^##\s+/m);
  return next === -1 ? rest : rest.slice(0, next);
}

/**
 * Accepted synonyms for a required section.
 *
 * HARNESS DEFECT #2 (same run). Judging every divergence as an ERROR flagged plans that do the required
 * thinking under a different heading — `## Design` + `## Research` instead of `## Approach & tradeoffs`.
 * That is the standard being *adapted*, not *ignored*, and the supervisor's rule is explicit: creativity is
 * welcome inside a frame earned from experience. So a synonym is a WARN naming the drift, never an ERROR.
 * Anything not listed here is still an ERROR — the frame has edges.
 */
const SYNONYMS = {
  'Approach & tradeoffs': ['Design', 'Approach', 'Approach and tradeoffs'],
  Goal: ['Objective', 'Outcome'],
  Context: ['Background', 'Why now'],
  'Prior art & sources': ['Research', 'Prior art'],
  Problem: ['Context'],
};

/** Returns { body, via } — `via` names the synonym used, or null for the canonical heading. */
function sectionOrSynonym(text, heading) {
  const canonical = section(text, heading);
  if (canonical !== null) return { body: canonical, via: null };
  for (const alt of SYNONYMS[heading] || []) {
    const body = section(text, alt);
    if (body !== null) return { body, via: alt };
  }
  return { body: null, via: null };
}

/** Strip HTML comments — template guidance inside `<!-- -->` must never count as filled-in content. */
const uncomment = (s) => (s || '').replace(/<!--[\s\S]*?-->/g, '');

const countExternalUrls = (s) => {
  const urls = uncomment(s).match(/https?:\/\/[^\s)>\]]+/g) || [];
  // `(url)` is the literal placeholder in both templates; a bare example.com is not a source either.
  return new Set(urls.filter((u) => !/^https?:\/\/(url|example\.com)/.test(u))).size;
};

/* ── the checks ─────────────────────────────────────────────────────────────────────────────── */

const FEATUREY = new Set(['feature', 'system-change']);
const PLAN_SECTIONS = ['Goal', 'Context', 'Approach & tradeoffs', 'Steps', 'Out of scope'];
const PROPOSAL_SECTIONS = ['Problem', 'Options considered', 'Recommendation', 'Pre-mortem', 'Counter-case'];

// Text that only appears if a template was copied and not filled in.
const PLACEHOLDERS = [
  [/<one line[^>]*>/i, 'unfilled `<one line …>` placeholder'],
  [/\bYYYY-MM-DD\b/, 'literal `YYYY-MM-DD` left in place'],
  [/\[Source 1\]\(url\)/i, 'unfilled `[Source 1](url)` placeholder'],
  [/^\s*-\s*\.\.\.\s*$/m, 'a bullet left as `- ...`'],
  [/\bAC-2\s*—\s*\.\.\./, 'unfilled `AC-2 — ...` placeholder'],
];

function auditFile(path) {
  const text = readFileSync(path, 'utf8');
  const rel = relative(REPO, path);
  const findings = [];
  const add = (level, msg) => findings.push({ level, msg });

  const fm = parseFrontmatter(text);
  if (!fm) {
    add('ERROR', 'no YAML frontmatter — nothing downstream (plan-checkin, status globs) can see this file');
    return { rel, kind: null, status: null, findings, isProposal: null };
  }

  // A proposal is the pre-acceptance artifact; it follows templates/proposal.md, not plan.md.
  const isProposal = /proposal/i.test(basename(path)) || section(text, 'Options considered') !== null;
  const kind = (fm.kind || '').toLowerCase();
  const status = (fm.status || '').toLowerCase();

  /**
   * HARNESS DEFECT #3 (same run). `kind:`, acceptance criteria and the prior-art rule all entered
   * `templates/plan.md` on 2026-06-14 (commit 562b691). Charging a plan written on 2026-06-13 with breaking
   * a rule that did not exist yet is the checker inventing history — and it inflates the failure count with
   * findings nobody can act on. Files created before the rule are exempt from it and reported separately.
   */
  const preStandard = !!fm.created && Date.parse(fm.created) < Date.parse('2026-06-14');
  if (preStandard) add('INFO', 'predates the 2026-06-14 plan standard — `kind:` / acceptance-criteria / prior-art checks skipped');

  /* frontmatter */
  for (const key of ['title', 'status', 'created']) {
    if (!fm[key]) add('ERROR', `frontmatter missing \`${key}:\``);
  }
  if (!isProposal && !fm.updated) {
    add('WARN', 'frontmatter missing `updated:` — staleness detection reads this');
  }
  if (!kind && !preStandard) {
    add(
      isProposal ? 'WARN' : 'ERROR',
      'frontmatter missing `kind:` — this is what decides whether prior art + acceptance criteria are required, so an absent `kind` silently exempts the file from both',
    );
  } else if (kind && !['feature', 'system-change', 'fix', 'refactor', 'chore'].includes(kind)) {
    add('WARN', `unknown \`kind: ${kind}\``);
  }

  /* required sections */
  for (const h of isProposal ? PROPOSAL_SECTIONS : PLAN_SECTIONS) {
    const { body, via } = sectionOrSynonym(text, h);
    if (body === null) add('ERROR', `missing required section \`## ${h}\``);
    else if (via) add('WARN', `\`## ${h}\` written as \`## ${via}\` — same job, non-standard heading (drift, not a violation)`);
  }

  /* the ask, verbatim — the one section the agent did not write
   *
   * Every other section is the agent's restatement of the request, so closing a plan against them can only
   * confirm the agent's own reading. Added 2026-07-30 after the supervisor asked whether finished work is
   * ever compared to what he originally asked for: it was not, anywhere. Advisory on plans that predate the
   * block, an ERROR on anything created after it — and an empty quote is worse than no section at all,
   * because it looks satisfied. */
  if (!isProposal && !preStandard) {
    const { body: askBody } = sectionOrSynonym(text, 'The ask, verbatim');
    const quoted = (uncomment(askBody || '').match(/^\s*>\s*\S+/gm) || []).length;
    const placeholder = /\(paste the request here\)/i.test(askBody || '');
    if (askBody === null) {
      const bornAfterTheRule = String(fm.created || '') >= '2026-07-30';
      add(
        bornAfterTheRule ? 'ERROR' : 'INFO',
        'no `## The ask, verbatim` section — nothing here records what was actually requested, so closing this plan can only check the work against the agent\'s own restatement of it',
      );
    } else if (placeholder || quoted === 0) {
      add(
        'ERROR',
        '`## The ask, verbatim` is present but holds no quoted request — an unfilled block reads as satisfied at close, which is worse than an absent one',
      );
    }
  }

  /* research-before-design */
  const { body: priorArtBody } = sectionOrSynonym(text, 'Prior art & sources');

  const needsPriorArt = isProposal || (FEATUREY.has(kind) && ['active', 'done'].includes(status));
  if (needsPriorArt && !preStandard) {
    if (priorArtBody === null) {
      add('ERROR', 'no `## Prior art & sources` section, but this is a feature/system-change past `draft` — research-before-design is not optional here');
    } else {
      const n = countExternalUrls(priorArtBody);
      if (n < 2) add('ERROR', `prior art has ${n} external URL(s); the standard requires ≥2`);
    }
  }

  /* proposal-specific */
  if (isProposal) {
    const opts = uncomment(section(text, 'Options considered') || '');
    const rows = (opts.match(/^\|\s*(?!-)(?!\s*Option\b)[^|]+\|/gim) || []).length;
    if (rows < 2) add('ERROR', `options table has ${rows} option row(s); the standard requires ≥2`);
    if (!/khuyến nghị/i.test(opts)) {
      add('ERROR', 'no option marked `(khuyến nghị)` in the options table — the supervisor cannot see the pick at a glance');
    }
    const premortem = uncomment(section(text, 'Pre-mortem') || section(text, 'Pre-mortem — REQUIRED: ≥2 failure modes') || '');
    const bullets = (premortem.match(/^\s*-\s+\S/gm) || []).length;
    if (bullets < 2) add('ERROR', `pre-mortem lists ${bullets} failure mode(s); the standard requires ≥2`);
    if (section(text, 'Decision \\(human\\) — the human-accept gate') === null && !/human-accept gate/i.test(text)) {
      add('WARN', 'no human-accept gate section — the file does not say who decides or what accept/reject means');
    }
  }

  /* plan-specific */
  if (!isProposal) {
    const steps = section(text, 'Steps') || '';
    // A step is a BLOCK (its `- [ ]` line plus any continuation lines), not a line. Reading line-by-line
    // reported `Files:`/`Test:` as missing whenever a step wrapped — measured 2026-07-29: 13 such steps
    // across 2 plans, every one of them carrying the data on line 2. The rule was right; the ruler was short.
    const items = steps
      .split(/\n(?=[ \t]*-[ \t]*\[[ xX]\][ \t])/)
      .filter((b) => /^[ \t]*-[ \t]*\[[ xX]\][ \t]/.test(b));
    if (items.length === 0) {
      add('ERROR', 'the `## Steps` section has no `- [ ]` checklist items');
    } else {
      const noFiles = items.filter((s) => !/\bFiles?:/i.test(s)).length;
      const noTest = items.filter((s) => !/\bTest:/i.test(s)).length;
      if (noFiles) add('WARN', `${noFiles}/${items.length} steps name no \`Files:\` — a fresh session must re-derive where to work`);
      if (noTest) add('WARN', `${noTest}/${items.length} steps name no \`Test:\` — "done" is unverifiable for those steps`);
    }

    const acBody = section(text, 'Acceptance criteria');
    if (FEATUREY.has(kind) && ['active', 'done'].includes(status) && !preStandard) {
      const acs = (uncomment(acBody || '').match(/\*\*AC-\d+\*\*/g) || []).length;
      if (acs === 0) {
        add('ERROR', 'feature/system-change past `draft` with no `AC-n` acceptance criteria (standards/testing §3: 1 AC → 1 test)');
      } else if (items.length && !/AC-\d+/.test(steps)) {
        add('WARN', `${acs} AC(s) defined but no step references an \`AC-n\` — the spec→test bridge is not wired`);
      }
    }

    if (section(text, 'Decisions to distill') === null && ['done'].includes(status)) {
      add('WARN', 'closed plan with no `## Decisions to distill` — nothing hands off to `decisions.md` at /session-wrap');
    }

    /* the checkin pair — mirrors plan-checkin.mjs so one command reports everything */
    if (fm.checkin && section(text, 'Check-in runbook') === null) {
      add('ERROR', '`checkin:` set with no `## Check-in runbook` — a reminder that arrives with no instructions');
    }
    if (!fm.checkin && section(text, 'Check-in runbook') !== null) {
      add('WARN', '`## Check-in runbook` present but no `checkin:` date — the runbook will never fire');
    }

    /* staleness */
    if (status === 'active' && fm.updated) {
      const days = Math.floor((Date.now() - Date.parse(fm.updated)) / 86400000);
      if (Number.isFinite(days) && days > 10) add('WARN', `\`status: active\` but untouched for ${days} days — dangling`);
    }
  }

  /* placeholders — the cheapest, highest-signal check there is */
  for (const [re, label] of PLACEHOLDERS) {
    if (re.test(uncomment(text))) add('WARN', `template not fully filled in: ${label}`);
  }

  return { rel, kind: kind || null, status: status || null, isProposal, findings };
}

/* ── run ────────────────────────────────────────────────────────────────────────────────────── */

/**
 * `--file <path>` — audit ONE file and speak to the agent in-loop (PostToolUse). Exits 2 with the findings
 * on stderr so Claude sees them as feedback on the write it just made; the write is never blocked.
 *
 * This mode replaces the old `prior-art-check.mjs`, which was a strict subset (same trigger, prior art only)
 * and had already learned this file's Defect #1 the hard way: it matched the heading on intent rather than
 * one exact string precisely because a compliant plan kept being failed on every edit. Two hooks re-learning
 * the same lesson separately is the duplication `/code-reuse` exists to prevent.
 */
const fileArgIdx = process.argv.indexOf('--file');
const HOOK = process.argv.includes('--hook');
if (fileArgIdx !== -1 || HOOK) {
  // `--hook` takes the path from the PostToolUse payload on stdin — the mechanism the retired
  // prior-art-check.mjs used and which is known to work here. `--file <path>` is the manual/testable form.
  let target = fileArgIdx !== -1 ? process.argv[fileArgIdx + 1] : '';
  if (HOOK && !target) {
    try {
      const chunks = [];
      for await (const c of process.stdin) chunks.push(c);
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      target = raw ? (JSON.parse(raw)?.tool_input?.file_path ?? '') : '';
    } catch {
      process.exit(0); // an unreadable payload must never be why a write reports a problem
    }
  }
  const norm = (target || '').replace(/\\/g, '/').toLowerCase();
  if (!target || !norm.includes('/plans/') || !norm.endsWith('.md') || !existsSync(target)) process.exit(0);

  const r = auditFile(resolve(target));
  const hard = r.findings.filter((f) => f.level === 'ERROR');
  if (!hard.length) process.exit(0);

  console.error(
    `plan-audit — \`${r.rel}\` (kind: ${r.kind ?? '—'}, status: ${r.status ?? '—'}) is missing something the ` +
      `standard requires. Fix it in the plan now, not later:\n` +
      hard.map((f) => `  ✗ ${f.msg}`).join('\n') +
      `\n\nStandard: platform/standards/documentation.md §5.5 · template: .claude/skills/project-plan/templates/` +
      `\nFull sweep: node .claude/scripts/plan-audit.mjs`,
  );
  process.exit(2);
}

const files = findPlanFiles();
const results = files.map(auditFile);
const errors = results.reduce((n, r) => n + r.findings.filter((f) => f.level === 'ERROR').length, 0);
const warns = results.reduce((n, r) => n + r.findings.filter((f) => f.level === 'WARN').length, 0);

if (JSON_OUT) {
  console.log(JSON.stringify({ scanned: files.length, errors, warns, results }, null, 2));
} else {
  console.log(`\nplan-audit — ${files.length} file(s) under platform/plans/ and */docs/plans/\n`);
  const dirty = results.filter((r) => r.findings.some((f) => f.level !== 'INFO'));
  for (const r of dirty) {
    const tag = r.isProposal ? 'proposal' : 'plan';
    console.log(`  ${r.rel}  [${tag} · kind: ${r.kind ?? '—'} · status: ${r.status ?? '—'}]`);
    for (const f of r.findings) {
      console.log(`      ${{ ERROR: '✗', WARN: '·', INFO: 'i' }[f.level]} ${f.level}  ${f.msg}`);
    }
    console.log('');
  }
  console.log(`  clean: ${results.length - dirty.length}/${results.length}   ERROR: ${errors}   WARN: ${warns}`);
  console.log(`\n  Shape only. A clean file can still be a bad plan — this never judges the thinking.\n`);
}

process.exit(STRICT && errors ? 1 : 0);
