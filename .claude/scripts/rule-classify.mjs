#!/usr/bin/env node
/**
 * rule-classify.mjs — Step 0 of idea-0023: how much of the rulebook could stay ON the server?
 *
 * THE QUESTION, stated so it can come out "no". The MCP platform-server proposal rests on a claim:
 * that most rules only VERIFY an artifact after it exists, so the server can evaluate them and return a
 * verdict without ever transmitting the rule. The pre-committed consequence (written before any code, in
 * plans/2026-07-28-idea-0023-…-proposal.md): **if under 40% is verification-shaped, Option A collapses into
 * Option C and the proposal is REJECTED, not rescoped.**
 *
 * THE UNIT. One *rule statement* — an imperative line in the rulebook that a change could violate. Not a
 * file, not a byte: a 3-line rule and a 300-line rule bind equally, and byte-weighting would just measure
 * how verbose a document is.
 *
 * THE CLASSIFICATION, and it is a JUDGEMENT, not a regex:
 *   V (verification-shaped) — compliance is decidable by inspecting the produced artifact alone.
 *                             "lucide icons only" · "no host port published" · "commit is Conventional".
 *   G (generation-shaping)  — the rule must be known BEFORE writing, and its absence is invisible in the
 *                             output. "read prior art before designing" · "propose, don't execute" ·
 *                             "thin-slice first". You cannot review your way to these.
 *   B (both)                — has a checkable residue AND a generative half. Counted with G, deliberately:
 *                             the whole point is what MUST be transmitted, so a tie goes against the claim.
 *
 * This script EXTRACTS and SAMPLES deterministically. The classification itself is a committed data file
 * (rule-classify-sample.json), hand-labelled, so anyone can re-read the same 60 lines and disagree with a
 * specific one. A ratio nobody can audit is not a measurement.
 */

import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SAMPLE_FILE = join(REPO, '.claude', 'scripts', 'rule-classify-sample.json');
const SAMPLE_N = 60;
const SEED = 20260728;
const THRESHOLD = 0.4;

/* The corpus = everything an MCP platform server would have to deliver to a consuming project. */
function corpusFiles() {
  const out = [];
  const skills = join(REPO, '.claude', 'skills');
  for (const d of readdirSync(skills)) {
    const f = join(skills, d, 'SKILL.md');
    if (existsSync(f)) out.push(f);
    const refs = join(skills, d, 'references');
    if (existsSync(refs)) for (const r of readdirSync(refs)) if (r.endsWith('.md')) out.push(join(refs, r));
  }
  const rules = join(REPO, '.claude', 'rules');
  if (existsSync(rules)) for (const r of readdirSync(rules)) if (r.endsWith('.md')) out.push(join(rules, r));
  out.push(join(REPO, 'CLAUDE.md'));
  for (const n of ['05-documentation-standard.md', '09-autonomy-contract.md', '11-testing-standard.md', '12-ui-layout-standard.md', '13-token-and-research-discipline.md']) {
    const f = join(REPO, 'platform', n);
    if (existsSync(f)) out.push(f);
  }
  return out;
}

/**
 * A "rule statement" is a bullet / numbered item / table row carrying an obligation.
 * Prose paragraphs, headings, code and commentary are not rules — they are the explanation around one.
 */
const OBLIGATION = /\b(MUST|NEVER|ALWAYS|REQUIRED|FORBIDDEN|do not|don'?t|no |only |must|never|always|required|should|shall|use |prefer |avoid |keep |write |run |add |set |record |update |read )/i;

function extractRules(file) {
  const text = readFileSync(file, 'utf8');
  const rel = relative(REPO, file);
  const out = [];
  let inCode = false;
  text.split(/\r?\n/).forEach((line, i) => {
    if (/^\s*```/.test(line)) { inCode = !inCode; return; }
    if (inCode) return;
    const isItem = /^\s*([-*+]|\d+\.)\s+\S/.test(line) || /^\|\s*\*?\*?[A-Za-z`]/.test(line);
    if (!isItem) return;
    const body = line.replace(/^\s*([-*+]|\d+\.)\s+/, '').trim();
    if (body.length < 25) return;              // too short to be a rule
    if (/^\|?\s*-{3,}/.test(body)) return;     // table separator
    if (!OBLIGATION.test(body)) return;
    out.push({ file: rel, line: i + 1, text: body.slice(0, 300) });
  });
  return out;
}

/* Deterministic sample — a mulberry32 PRNG, so the same 60 lines come back every run. */
function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const all = corpusFiles().flatMap(extractRules);
const rand = rng(SEED);
const shuffled = all.map((r) => ({ r, k: rand() })).sort((a, b) => a.k - b.k).map((x) => x.r);
const sample = shuffled.slice(0, SAMPLE_N);

if (process.argv.includes('--emit-sample')) {
  writeFileSync(SAMPLE_FILE, JSON.stringify({ seed: SEED, n: SAMPLE_N, population: all.length, sample: sample.map((s, i) => ({ id: i + 1, ...s, class: null })) }, null, 2));
  console.log(`wrote ${SAMPLE_FILE} — ${sample.length} of ${all.length} rule statements, unlabelled`);
  process.exit(0);
}

if (!existsSync(SAMPLE_FILE)) {
  console.log(`population: ${all.length} rule statements across ${corpusFiles().length} files`);
  console.log(`no labelled sample yet — run with --emit-sample, then hand-label the \`class\` field (V|G|B)`);
  process.exit(0);
}

const data = JSON.parse(readFileSync(SAMPLE_FILE, 'utf8'));
// `N` = extractor noise (a table header, a trigger phrase) — not a rule, so it is excluded from the
// denominator rather than silently counted as one side. Reporting it keeps the extractor honest too.
const noise = data.sample.filter((s) => s.class === 'N').length;
const labelled = data.sample.filter((s) => s.class && s.class !== 'N');
const counts = { V: 0, G: 0, B: 0 };
for (const s of labelled) counts[s.class] = (counts[s.class] || 0) + 1;

const n = labelled.length;
const vRatio = counts.V / n;
// Wald 95% interval — crude, and said to be crude. n=60 cannot support a precise claim.
const se = Math.sqrt((vRatio * (1 - vRatio)) / n);
const lo = Math.max(0, vRatio - 1.96 * se);
const hi = Math.min(1, vRatio + 1.96 * se);

console.log(`\nStep 0 — how much of the rulebook is VERIFICATION-shaped?\n`);
console.log(`  population        ${data.population} rule statements`);
console.log(`  sample            ${n} classified (+${noise} extractor noise, excluded) · seed ${data.seed}, deterministic`);
console.log(`  V verification    ${counts.V}`);
console.log(`  G generation      ${counts.G}`);
console.log(`  B both → with G   ${counts.B}   (ties counted AGAINST the proposal)`);
console.log(`\n  verification-shaped: ${(vRatio * 100).toFixed(1)}%   95% CI ≈ ${(lo * 100).toFixed(0)}–${(hi * 100).toFixed(0)}%`);
console.log(`  pre-committed gate:  ≥ ${THRESHOLD * 100}%`);

const verdict = hi < THRESHOLD ? 'REJECT' : lo >= THRESHOLD ? 'PASS' : 'INCONCLUSIVE';
console.log(`\n  VERDICT: ${verdict}`);
if (verdict === 'INCONCLUSIVE') {
  console.log(`  The point estimate is ${vRatio >= THRESHOLD ? 'above' : 'below'} the line but the interval straddles it.`);
  console.log(`  Say so — do not round toward the answer you wanted. Enlarge the sample to decide.`);
}
console.log('');
