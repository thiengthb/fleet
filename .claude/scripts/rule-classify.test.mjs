// Test for rule-classify.mjs — a one-shot STUDY, tested for REPRODUCIBILITY rather than as a standing tool.
// Run: node .claude/scripts/rule-classify.test.mjs
//
// WHY A DIFFERENT KIND OF TEST. This script exists to answer one pre-committed question — "is at least 40% of
// the rulebook verification-shaped, i.e. checkable from the produced artifact alone?" — whose answer decided
// whether idea-0023 (an MCP platform server) went ahead or was rejected outright. It ran, it answered PASS,
// and a decision was taken on that number.
//
// A study like that does not need "does the feature work" coverage. It needs the property that makes a
// recorded number worth anything: **re-run it and the same verdict comes out.** A study whose number no
// longer reproduces is not a passing test or a failing one — it is a finding, and it means a decision is
// resting on something that has moved. That is what case 1 asserts.
//
// The rest of the suite covers the parts where a wrong answer would be invisible: the noise class excluded
// from the denominator (rather than silently counted as one side), ties counted AGAINST the proposal, and the
// confidence interval — an n=60 sample cannot support a precise claim, and a script that reported the point
// estimate alone would round toward whatever answer was wanted.
//
// SAFETY: `--emit-sample` OVERWRITES the hand-labelled `rule-classify-sample.json`. It is only ever invoked
// here inside a temp sandbox; running it against the real repo would destroy the labels the study rests on,
// and there would be no error to notice.
//
// Per platform/standards/testing.md §2.5 the suite also MUTATES the script and asserts it notices.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const SCRIPT = join(HERE, "rule-classify.mjs");
const SAMPLE = join(HERE, "rule-classify-sample.json");

const write = (p, body) => {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, body);
};

/**
 * A sandbox repo. `corpusFiles()` reads `.claude/skills` with no existence check, so that directory has to be
 * there even when a case does not care about the corpus.
 */
function sandbox({ sample = null, corpus = {}, src = null } = {}) {
  const root = mkdtempSync(join(tmpdir(), "rule-classify-"));
  const scripts = join(root, ".claude", "scripts");
  mkdirSync(scripts, { recursive: true });
  mkdirSync(join(root, ".claude", "skills"), { recursive: true });
  // `corpusFiles()` pushes CLAUDE.md unconditionally and the extractor then reads it, so a sandbox without
  // one crashes on ENOENT. It always exists in the real repo, so this is a fixture requirement rather than a
  // defect — but the asymmetry is worth noting: the platform standards below it ARE existence-guarded.
  writeFileSync(join(root, "CLAUDE.md"), "# fixture constitution\n");
  writeFileSync(join(scripts, "rule-classify.mjs"), src ?? readFileSync(SCRIPT, "utf8"));
  if (sample) writeFileSync(join(scripts, "rule-classify-sample.json"), JSON.stringify(sample, null, 2));
  for (const [rel, body] of Object.entries(corpus)) write(join(root, rel), body);
  return { root, script: join(scripts, "rule-classify.mjs"), samplePath: join(scripts, "rule-classify-sample.json") };
}

const run = (script, args = [], cwd) => {
  const r = spawnSync(process.execPath, [script, ...args], { encoding: "utf8", timeout: 120_000, cwd });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
};

/** A labelled sample in the committed shape. */
const mkSample = (classes) => ({
  seed: 20260728,
  n: classes.length,
  population: 500,
  sample: classes.map((c, i) => ({ id: i + 1, file: "x.md", line: i + 1, text: "a rule statement", class: c })),
});

/* ═══════════ 1. REPRODUCTION: the recorded verdict must still come out of the real study ═══════════ */
{
  const a = run(SCRIPT, [], REPO);
  assert.equal(a.code, 0, `the study must still run:\n${a.out}`);

  assert.match(
    a.out,
    /VERDICT: PASS/,
    `THE STUDY NO LONGER REPRODUCES ITS RECORDED VERDICT. idea-0023 was allowed to proceed on a PASS; if this ` +
      `is now REJECT or INCONCLUSIVE, a decision is resting on a number that has moved, and that is a finding ` +
      `to report rather than a test to fix.\n${a.out}`,
  );
  assert.match(a.out, /verification-shaped: 58\.9%/, `the recorded ratio must still hold:\n${a.out}`);
  assert.match(a.out, /pre-committed gate:  ≥ 40%/, "the gate was committed BEFORE the run and must not drift");
  assert.match(a.out, /56 classified \(\+4 extractor noise, excluded\)/, "the labelled sample is a committed file");
  assert.match(a.out, /seed 20260728, deterministic/, "…and the sampling is seeded, not fresh each run");
  assert.match(a.out, /B both → with G/, "ties are counted against the proposal, and the output says so");
  assert.match(a.out, /95% CI ≈ 46–72%/, "n=56 cannot support a precise claim, and the interval must be shown");

  // Determinism: nothing here may vary between runs (no timestamps, no fresh sampling).
  const b = run(SCRIPT, [], REPO);
  assert.equal(b.out, a.out, "two runs of a deterministic study must be byte-identical");

  // …and it must not have touched the labelled sample it reads.
  const dirty = spawnSync("git", ["status", "--porcelain", "--", ".claude/scripts/rule-classify-sample.json"], {
    cwd: REPO,
    encoding: "utf8",
  }).stdout;
  assert.equal(dirty, "", `a plain run must never rewrite the labels:\n${dirty}`);
  assert.ok(existsSync(SAMPLE), "the labelled sample must exist — without it the study cannot be audited");
}

/* ═══════════ 2. the denominator: extractor noise is EXCLUDED, not counted as a side ═══════════
 * `N` means "the extractor picked up a table header or a trigger phrase, not a rule". Counting it as G would
 * bias the answer against the proposal; counting it as V would bias it for. Excluding it and REPORTING the
 * count keeps the extractor honest too.
 */
{
  const s = sandbox({ sample: mkSample(["V", "V", "V", "V", "G", "N", "N", "N", "N", "N"]) });
  const { out } = run(s.script, [], s.root);
  assert.match(out, /sample\s+5 classified \(\+5 extractor noise, excluded\)/, out);
  assert.match(out, /verification-shaped: 80\.0%/, "4 of 5, not 4 of 10 — noise must leave the denominator");
  rmSync(s.root, { recursive: true, force: true });
}

/* ═══════════ 3. `B` (both) counts with G — a tie goes AGAINST the proposal ═══════════ */
{
  const withB = sandbox({ sample: mkSample(["V", "V", "B", "B"]) });
  const out = run(withB.script, [], withB.root).out;
  assert.match(out, /verification-shaped: 50\.0%/, `B must not be counted as V:\n${out}`);
  assert.match(out, /B both → with G   2/, "…and the choice must be visible in the output");
  rmSync(withB.root, { recursive: true, force: true });
}

/* ═══════════ 4. the verdict comes from the INTERVAL, not the point estimate ═══════════
 * The whole discipline of this study is refusing to round toward the answer you wanted.
 */
{
  // Overwhelmingly verification-shaped ⇒ the whole interval clears the gate ⇒ PASS.
  const pass = sandbox({ sample: mkSample(Array(40).fill("V").concat(Array(2).fill("G"))) });
  assert.match(run(pass.script, [], pass.root).out, /VERDICT: PASS/);
  rmSync(pass.root, { recursive: true, force: true });

  // Overwhelmingly generation-shaping ⇒ the whole interval is below ⇒ REJECT, and the pre-committed
  // consequence was that the proposal collapses rather than being rescoped.
  const reject = sandbox({ sample: mkSample(Array(2).fill("V").concat(Array(40).fill("G"))) });
  assert.match(run(reject.script, [], reject.root).out, /VERDICT: REJECT/);
  rmSync(reject.root, { recursive: true, force: true });

  // A point estimate right on the line with a small sample ⇒ the interval straddles it ⇒ say so.
  const unclear = sandbox({ sample: mkSample(Array(4).fill("V").concat(Array(6).fill("G"))) });
  const u = run(unclear.script, [], unclear.root).out;
  assert.match(u, /VERDICT: INCONCLUSIVE/, `40% of 10 cannot decide anything:\n${u}`);
  assert.match(
    u,
    /do not round toward the answer you wanted/,
    "the INCONCLUSIVE branch must say what NOT to do, or it will be read as a weak pass",
  );
  assert.match(u, /Enlarge the sample to decide/, "…and what would settle it");
  rmSync(unclear.root, { recursive: true, force: true });
}

/* ═══════════ 5. with no labelled sample it explains itself and writes nothing ═══════════ */
{
  const s = sandbox({
    corpus: {
      ".claude/skills/thing/SKILL.md":
        "---\nname: thing\n---\n\n- MUST always use lucide icons and never an emoji as an icon here\n",
    },
  });
  const { code, out } = run(s.script, [], s.root);
  assert.equal(code, 0);
  assert.match(out, /population: \d+ rule statements across \d+ files/, "it must still report the population");
  assert.match(out, /no labelled sample yet — run with --emit-sample, then hand-label/, out);
  assert.equal(existsSync(s.samplePath), false, "a plain run must never write the sample file");
  rmSync(s.root, { recursive: true, force: true });
}

/* ═══════════ 6. `--emit-sample` is deterministic, and emits UNLABELLED rows ═══════════
 * Sandbox only — see the SAFETY note at the top of this file.
 */
{
  const corpus = {
    ".claude/skills/a/SKILL.md":
      "---\nname: a\n---\n\n" +
      Array.from({ length: 12 }, (_, i) => `- MUST never do the forbidden thing number ${i} under any circumstances`).join("\n") +
      "\n",
    ".claude/skills/a/references/naming.md":
      Array.from({ length: 12 }, (_, i) => `- ALWAYS prefer the clearer name over the shorter one, case ${i}`).join("\n") + "\n",
    ".claude/rules/frontend.md":
      Array.from({ length: 12 }, (_, i) => `- Use the shared component and never fork it locally, rule ${i}`).join("\n") + "\n",
  };

  const one = sandbox({ corpus });
  const two = sandbox({ corpus });
  assert.match(run(one.script, ["--emit-sample"], one.root).out, /wrote .*rule-classify-sample\.json/);
  run(two.script, ["--emit-sample"], two.root);

  const a = JSON.parse(readFileSync(one.samplePath, "utf8"));
  const b = JSON.parse(readFileSync(two.samplePath, "utf8"));
  assert.deepEqual(
    a.sample.map((s) => `${s.file}:${s.line}`),
    b.sample.map((s) => `${s.file}:${s.line}`),
    "the same seed must select the same lines — 'deterministic' is a claim the output makes about itself",
  );
  assert.equal(a.seed, 20260728, "the seed is recorded so the selection can be re-derived by hand");
  assert.ok(
    a.sample.every((s) => s.class === null),
    "rows must be emitted UNLABELLED — a script that pre-labels its own sample is not a measurement",
  );
  assert.ok(a.sample.length > 0 && a.sample.length <= 60, `sample size ${a.sample.length} must respect SAMPLE_N`);
  rmSync(one.root, { recursive: true, force: true });
  rmSync(two.root, { recursive: true, force: true });
}

/* ═══════════ 7. what counts as a rule statement — the extractor's own edges ═══════════ */
{
  const s = sandbox({
    corpus: {
      ".claude/skills/x/SKILL.md": [
        "---",
        "name: x",
        "---",
        "",
        "- MUST always keep this obligation, which is long enough to count as a rule",
        "- too short",
        "This is a prose paragraph that says MUST but is not a bullet, so it is not a rule statement.",
        "",
        "```md",
        "- MUST never count a rule that is inside a fenced code block, however long it is",
        "```",
        "",
        "| ------- | ------- |",
        // Careful: the obligation list contains the bare token `no `, so "with no obligation word" would
        // itself trip it. That looseness is exactly why the labelling scheme has an `N` (noise) class.
        "- a bullet describing the historical background of this decision in some detail",
        "",
      ].join("\n"),
    },
  });
  const { out } = run(s.script, [], s.root);
  const population = Number((/population: (\d+) rule statements/.exec(out) || [])[1]);
  assert.equal(
    population,
    1,
    `only the first bullet is a rule statement. Fenced code, prose, table separators, short lines and ` +
      `bullets with no obligation must all be excluded:\n${out}`,
  );
  rmSync(s.root, { recursive: true, force: true });
}

/* ═══════════ 8. the suite must NOTICE a broken study (mutation) ═══════════ */
{
  const src = readFileSync(SCRIPT, "utf8");

  const mutants = [
    {
      name: "the pre-committed gate lowered (a REJECT becomes a PASS)",
      spec: { sample: mkSample(Array(2).fill("V").concat(Array(40).fill("G"))) },
      // 0, not 0.01: with 2 of 42 verification-shaped the interval is ≈0–11%, which does not CLEAR a 1% gate
      // either — it straddles it, so the honest verdict stays INCONCLUSIVE. Only a gate of zero flips it to
      // PASS, which is what "the gate was moved to fit the answer" actually looks like.
      apply: (s) => s.replace("const THRESHOLD = 0.4;", "const THRESHOLD = 0;"),
      probe: (s) => /VERDICT: PASS/.test(run(s.script, [], s.root).out),
    },
    {
      name: "extractor noise counted in the denominator (the ratio is diluted)",
      spec: { sample: mkSample(["V", "V", "V", "V", "G", "N", "N", "N", "N", "N"]) },
      apply: (s) =>
        s.replace(
          "const labelled = data.sample.filter((s) => s.class && s.class !== 'N');",
          "const labelled = data.sample.filter((s) => s.class);",
        ),
      probe: (s) => /verification-shaped: 40\.0%/.test(run(s.script, [], s.root).out),
    },
    {
      name: "ties counted FOR the proposal (B moved from G to V)",
      spec: { sample: mkSample(["V", "V", "B", "B"]) },
      apply: (s) =>
        s.replace(
          "for (const s of labelled) counts[s.class] = (counts[s.class] || 0) + 1;",
          "for (const s of labelled) counts[s.class === 'B' ? 'V' : s.class] = (counts[s.class === 'B' ? 'V' : s.class] || 0) + 1;",
        ),
      probe: (s) => /verification-shaped: 100\.0%/.test(run(s.script, [], s.root).out),
    },
    {
      name: "the verdict taken from the point estimate (INCONCLUSIVE disappears)",
      spec: { sample: mkSample(Array(4).fill("V").concat(Array(6).fill("G"))) },
      apply: (s) =>
        s.replace(
          "const verdict = hi < THRESHOLD ? 'REJECT' : lo >= THRESHOLD ? 'PASS' : 'INCONCLUSIVE';",
          "const verdict = vRatio >= THRESHOLD ? 'PASS' : 'REJECT';",
        ),
      probe: (s) => !/INCONCLUSIVE/.test(run(s.script, [], s.root).out),
    },
    {
      name: "the sampling seed randomised (the study stops being reproducible)",
      spec: {
        corpus: {
          ".claude/skills/a/SKILL.md":
            "---\nname: a\n---\n\n" +
            Array.from({ length: 80 }, (_, i) => `- MUST never do the forbidden thing number ${i} under any circumstance`).join("\n") +
            "\n",
        },
      },
      apply: (s) => s.replace("const SEED = 20260728;", "const SEED = Date.now() & 0xffff;"),
      probe: (s) => {
        // Two emissions from the SAME mutated script must now disagree.
        const other = sandbox({ spec: null, src: readFileSync(s.script, "utf8"), corpus: s.corpus });
        run(s.script, ["--emit-sample"], s.root);
        run(other.script, ["--emit-sample"], other.root);
        const a = JSON.parse(readFileSync(s.samplePath, "utf8")).sample.map((x) => x.line).join(",");
        const b = JSON.parse(readFileSync(other.samplePath, "utf8")).sample.map((x) => x.line).join(",");
        rmSync(other.root, { recursive: true, force: true });
        return a !== b;
      },
    },
    {
      name: "the confidence interval collapsed (a precise claim from n=10)",
      spec: { sample: mkSample(Array(4).fill("V").concat(Array(6).fill("G"))) },
      apply: (s) => s.replace("const se = Math.sqrt((vRatio * (1 - vRatio)) / n);", "const se = 0;"),
      probe: (s) => !/INCONCLUSIVE/.test(run(s.script, [], s.root).out),
    },
  ];

  for (const m of mutants) {
    const mutated = m.apply(src);
    assert.notEqual(mutated, src, `mutation "${m.name}" changed nothing — the patch is stale`);
    const spec = { ...(m.spec ?? {}), src: mutated };
    const s = sandbox(spec);
    s.corpus = spec.corpus ?? {};
    const sanity = run(s.script, [], s.root);
    assert.equal(
      sanity.code,
      0,
      `mutant "${m.name}" crashed instead of changing behaviour:\n${sanity.out.slice(0, 300)}`,
    );
    const killed = m.probe(s);
    rmSync(s.root, { recursive: true, force: true });
    assert.ok(killed, `SURVIVING MUTANT — "${m.name}" and the suite still passed. Add a case for it.`);
  }
}

console.log(
  "rule-classify.test.mjs — the recorded verdict reproduces (PASS, 58.9%, gate 40%, seed 20260728) and two " +
    "runs are byte-identical, noise excluded from the denominator, ties counted against the proposal, the " +
    "verdict taken from the interval not the point estimate, deterministic unlabelled --emit-sample, the " +
    "extractor's five exclusions, 6 mutants all killed  ✅",
);
