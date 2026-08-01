// Test for claude-md-budget.mjs — the standing gate on the always-loaded surface.
// Run: node .claude/scripts/claude-md-budget.test.mjs
//
// WHY THIS EXISTS. This gate has exactly one job that cannot be done by reading: telling the difference
// between a prohibition that was RELOCATED and a prohibition that is merely WRAPPED across a line. Its
// predecessor got that wrong — the 2026-07-30 thinning applier reported three prohibitions missing while all
// three sat in the file, hard-wrapped mid-phrase. A check that answers "missing" for something present is
// worse than no check, because its output reads like a finding. So the wrapped-but-present case is the first
// one here, and it is the case a mutant must not be able to survive.
//
// The second thing worth testing is the ARCHIVAL split. Measured on this platform 2026-07-31: `plan-audit`
// was reporting 92 WARNs of which 74 were on closed plans, and they buried the 18 that were live. A citation
// from a closed plan is unrepairable without editing history, so it must be reported and must NOT fail the
// run — while the same break from a live governance file must.
//
// Per platform/standards/testing.md §2.7: a silent path, acting paths asserted BY MESSAGE, killed mutants
// each proved to still RUN, and no mutation of the real repo.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const SCRIPT = join(HERE, "claude-md-budget.mjs");
/**
 * RAW is the bytes on disk (this repo checks out CRLF on Windows); SOURCE is LF-normalised and is what the
 * mutation patches are written against. Conflating the two is a trap this platform has already been bitten
 * by twice — a patch authored with "\n" silently matches nothing in a CRLF file, so every mutant "survives"
 * and the suite reports a false all-clear.
 */
const RAW = readFileSync(SCRIPT, "utf8");
const SOURCE = RAW.replace(/\r\n/g, "\n");

const LAB = mkdtempSync(join(tmpdir(), "claude-md-budget-"));
let pass = 0;
const fails = [];

/** Every prohibition the gate declares, so a fixture can satisfy all of them and then break exactly one. */
const PROHIBITIONS = [...SOURCE.matchAll(/^  '((?:[^'\\]|\\.)*)',$/gm)].map((m) => m[1].replace(/\\'/g, "'"));

/**
 * Every key except `claudeMd` is a repo-relative file to plant. Deliberately NOT a nested `files:` option:
 * the first draft had one, three call sites passed their fixtures at the top level instead, and the trees
 * were built EMPTY — so three citation cases and two mutants reported clean against nothing. A fixture
 * builder that silently ignores what it was given is the same class of defect as a check that can't fail.
 */
function buildTree(name, { claudeMd, ...files }) {
  const root = join(LAB, name);
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "CLAUDE.md"), claudeMd, "utf8");
  for (const [rel, body] of Object.entries(files)) {
    const p = join(root, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, body, "utf8");
  }
  return root;
}

function run(root, { script = SCRIPT, budget = "1800" } = {}) {
  const r = spawnSync(process.execPath, [script], {
    encoding: "utf8",
    env: { ...process.env, CLAUDE_MD_REPO: root, CLAUDE_MD_WORD_BUDGET: budget },
  });
  return { code: r.status, out: `${r.stdout || ""}${r.stderr || ""}` };
}

/** A CLAUDE.md that satisfies every gate: all prohibitions present, each one WRAPPED mid-phrase. */
function healthyClaudeMd(extra = "") {
  const wrapped = PROHIBITIONS.map((p) => {
    const words = p.split(" ");
    const cut = Math.max(1, Math.floor(words.length / 2));
    return `- ${words.slice(0, cut).join(" ")}\n  ${words.slice(cut).join(" ")}`;
  }).join("\n");
  return `# fleet\n\n## Conventions\n\n${wrapped}\n\n## Model routing\n\nrouting.\n${extra}`;
}

function check(name, fn) {
  try {
    fn();
    pass += 1;
  } catch (e) {
    fails.push(`${name}: ${e.message}`);
  }
}

/* ─────────────────────────── the silent path ─────────────────────────── */

check("a healthy tree passes, and every prohibition is found WRAPPED across a line", () => {
  const root = buildTree("healthy", { claudeMd: healthyClaudeMd() });
  const { code, out } = run(root);
  assert.equal(code, 0, `expected exit 0, got ${code}:\n${out}`);
  assert.match(out, /16\/16 prohibitions/, out);
  assert.match(out, /^ok /m, out);
});

check("the prohibition list was actually parsed out of the script (the fixture is not vacuous)", () => {
  assert.equal(PROHIBITIONS.length, 16, `parsed ${PROHIBITIONS.length} prohibitions from the source`);
  assert.ok(PROHIBITIONS.includes("never commit/push unless asked"), PROHIBITIONS.join(" | "));
});

/* ─────────────────────────── the acting paths ─────────────────────────── */

check("BUDGET fires, by message, when the word count exceeds the budget", () => {
  const root = buildTree("fat", { claudeMd: healthyClaudeMd(`\n${"filler ".repeat(400)}`) });
  // Budget lowered for the case rather than padding the fixture past 1800 words: it asserts the comparison
  // AND that the env override the tool exposes for exactly this purpose is wired to the comparison.
  const { code, out } = run(root, { budget: "150" });
  assert.equal(code, 1, `expected exit 1, got ${code}:\n${out}`);
  assert.match(out, /BUDGET: \d+ words > 150/, out);
});

check("a REMOVED prohibition fires and the message names it", () => {
  const dropped = "never commit/push unless asked";
  const md = healthyClaudeMd().replace(/- never commit\/push\n  unless asked/, "- (relocated)");
  assert.ok(!md.includes("unless asked"), "fixture must actually remove the rule");
  const { code, out } = run(buildTree("lost-rule", { claudeMd: md }));
  assert.equal(code, 1, `expected exit 1, got ${code}:\n${out}`);
  assert.match(out, /PROHIBITION missing/, out);
  assert.ok(out.includes(dropped), `message should name the rule; got:\n${out}`);
});

check("a broken citation from a LIVE governance file is an ERROR", () => {
  const root = buildTree("live-break", {
    claudeMd: healthyClaudeMd(),
    ".claude/hooks/x.mjs": '// see CLAUDE.md §"Nonexistent section" for the rule\n',
  });
  const { code, out } = run(root);
  assert.equal(code, 1, `expected exit 1, got ${code}:\n${out}`);
  assert.match(out, /ANCHOR: no heading .* §"Nonexistent section"/, out);
});

check("the same break from an ARCHIVAL file is reported as legacy and does NOT fail the run", () => {
  const root = buildTree("legacy-break", {
    claudeMd: healthyClaudeMd(),
    "platform/plans/2026-01-01-old.md": 'Contract: CLAUDE.md §"Nonexistent section".\n',
  });
  const { code, out } = run(root);
  assert.equal(code, 0, `an archival citation must not fail the run; got ${code}:\n${out}`);
  assert.match(out, /legacy/, out);
});

check("a citation written as §Heading (\"parenthetical\") resolves to the heading", () => {
  const root = buildTree("paren-cite", {
    claudeMd: healthyClaudeMd(),
    ".claude/hooks/y.mjs": '// CLAUDE.md §Conventions ("Legible decision surface") requires it\n',
  });
  const { code, out } = run(root);
  assert.equal(code, 0, `expected exit 0, got ${code}:\n${out}`);
  assert.match(out, /cited sections resolve/, out);
});

/* ───────── GOVERNANCE-SYNC: the prose list must match what the gate really blocks ─────────
 *
 * Added 2026-08-01, after measuring that CLAUDE.md named 7 surfaces while the gate enforced 12 and
 * `.claude/agents/**` — a subagent's system prompt — was in NEITHER for as long as the directory existed.
 *
 * The fixture's own prohibition bullet has to sit on ONE line: `healthyClaudeMd` deliberately wraps every
 * prohibition mid-phrase (that is what its first case tests), and this check reads RAW text because a bullet
 * boundary is a newline. The wrapped copy therefore does not match the anchor and the appended one does.
 */
const GATE = (...dirs) =>
  `const GOVERNANCE = [\n` +
  dirs.map((d) => `  { name: '${d}', re: /\\.claude\\/${d}\\// },`).join("\n") +
  `\n];\n`;
/**
 * The bullet carries the COUNT as well as the list, because the real one does and the count is the only part of
 * this list a machine can check exactly. `claimed` defaults to `dirs.length`; pass a number to make it lie.
 *
 * Adding the count check without touching this helper would have fired the "no count stated" error in EVERY
 * governance fixture, masking whether each one reported its own defect — the failure the missing-gate branch of
 * this checker was already rewritten once to avoid. Verified by running it that way first.
 */
const govBullet = (...dirs) => govBulletCounted(dirs.length, ...dirs);
const govBulletCounted = (claimed, ...dirs) =>
  `\n- the agent NEVER edits its own governance — under \`.claude/\`: ` +
  dirs.map((d) => `\`${d}/\``).join(", ") +
  ` — it may propose, a human decides. All ${claimed} enforced by \`autonomy-gate.mjs\`;\n`;

check("GOVERNANCE-SYNC passes when the prose names every surface the gate blocks", () => {
  const root = buildTree("gov-ok", {
    claudeMd: healthyClaudeMd(govBullet("hooks", "agents")),
    ".claude/hooks/autonomy-gate.mjs": GATE("hooks", "agents"),
  });
  const { code, out } = run(root);
  assert.equal(code, 0, `expected a pass:\n${out}`);
  assert.match(out, /2\/2 governance surfaces named/, out);
});

check("GOVERNANCE-SYNC fires, and NAMES the surface, when the prose omits one", () => {
  const root = buildTree("gov-missing", {
    claudeMd: healthyClaudeMd(govBullet("hooks")), // `agents` deliberately absent
    ".claude/hooks/autonomy-gate.mjs": GATE("hooks", "agents"),
  });
  const { code, out } = run(root);
  assert.equal(code, 1, `a surface enforced but unnamed must FAIL:\n${out}`);
  assert.match(out, /GOVERNANCE-SYNC/, out);
  assert.match(out, /agents/, "the message must name the missing surface, not just count it");
  assert.match(out, /1\/2 governance surfaces named/, out);
});

/* ───────── the COUNT the always-loaded file asserts about itself ─────────
 *
 * Why a separate check from the one above, stated because it is a limitation and not a design preference:
 * GOVERNANCE-SYNC matches WORDS, so when `.claude/workflows/` was added on 2026-08-01 the score did not move —
 * `workflows` was already in the token set from `.github/workflows`. Two surfaces, one word. It cannot be fixed
 * by requiring the phrase either, because the prose groups paths under a `.claude/` prefix instead of spelling
 * each one. The directories are distinguished where that is actually possible (`autonomy-gate.test.mjs` asserts
 * both block); what is left for THIS file is the number, which is hand-maintained and has drifted before — the
 * bullet itself records "said 7 while the gate enforced 12".
 */
check("the count matches the gate's entry count → pass", () => {
  const root = buildTree("gov-count-ok", {
    claudeMd: healthyClaudeMd(govBulletCounted(2, "hooks", "agents")),
    ".claude/hooks/autonomy-gate.mjs": GATE("hooks", "agents"),
  });
  const { code, out } = run(root);
  assert.equal(code, 0, `a truthful count must pass:\n${out}`);
});

check("a count that disagrees with the gate FAILS, and both numbers are printed", () => {
  const root = buildTree("gov-count-drift", {
    // Every surface is named, so the word-matching half is satisfied — only the number lies. That is the whole
    // point: this catches the case the check above cannot see.
    claudeMd: healthyClaudeMd(govBulletCounted(7, "hooks", "agents")),
    ".claude/hooks/autonomy-gate.mjs": GATE("hooks", "agents"),
  });
  const { code, out } = run(root);
  assert.equal(code, 1, `a drifted count must FAIL:\n${out}`);
  assert.match(out, /claims 7 enforced governance surfaces/, out);
  assert.match(out, /array has 2/, "both numbers must appear — one alone cannot be acted on");
});

check("stating no count at all FAILS — the exact-checkable part may not be dropped", () => {
  const root = buildTree("gov-count-absent", {
    claudeMd: healthyClaudeMd(
      `\n- the agent NEVER edits its own governance — under \`.claude/\`: \`hooks/\`, \`agents/\` — it may ` +
        `propose, a human decides;\n`,
    ),
    ".claude/hooks/autonomy-gate.mjs": GATE("hooks", "agents"),
  });
  const { code, out } = run(root);
  assert.equal(code, 1, `dropping the count must FAIL:\n${out}`);
  assert.match(out, /does not state how many surfaces/, out);
});

check("prose ABOUT a surface does not satisfy the check — only the list before 'it may' counts", () => {
  // The real failure this narrowing came from: with `agents/` deleted from the list, the bullet's own
  // explanation of the gap still contained the word, so the check passed for the wrong reason.
  const root = buildTree("gov-prose", {
    claudeMd: healthyClaudeMd(
      `\n- the agent NEVER edits its own governance — under \`.claude/\`: \`hooks/\` — it may propose, a human` +
        ` decides. This list once omitted \`agents/\` and nobody noticed;\n`,
    ),
    ".claude/hooks/autonomy-gate.mjs": GATE("hooks", "agents"),
  });
  const { code, out } = run(root);
  assert.equal(code, 1, `a mention in the RATIONALE must not count as naming it:\n${out}`);
  assert.match(out, /agents/, out);
});

check("no gate to compare against ⇒ SKIPPED, never a failure (it would fire in every fixture)", () => {
  const root = buildTree("gov-nogate", { claudeMd: healthyClaudeMd(govBullet("hooks")) });
  const { code, out } = run(root);
  assert.equal(code, 0, `a missing gate is link-check's job, not this one's:\n${out}`);
  assert.match(out, /governance-sync skipped/, out);
});

check("the retired tier is never scanned for citations", () => {
  const root = buildTree("attic-ignored", {
    claudeMd: healthyClaudeMd(),
    "node_modules/pkg/readme.md": 'CLAUDE.md §"Nonexistent section"\n',
  });
  const { code } = run(root);
  assert.equal(code, 0, "vendored trees must not be able to fail this gate");
});

/* ─────────────────────────── mutation testing (§2.7) ─────────────────────────── */

const MUTANTS = [
  {
    name: "budget comparison neutered",
    from: "if (words > WORD_BUDGET) {",
    to: "if (words > WORD_BUDGET * 100) {",
    caught: () => {
      const root = buildTree("m1", { claudeMd: healthyClaudeMd(`\n${"filler ".repeat(400)}`) });
      return run(root, { script: mutantPath }).code === 0;
    },
  },
  {
    // The mutation has to hit the FILE side. Dropping norm() from the needle is an equivalent mutation —
    // the declared prohibitions are already single-spaced, so it changes nothing and would "survive" no
    // matter how good the cases are. The 2026-07-30 defect was the file's own wrapping not being collapsed.
    name: "prohibition match loses whitespace normalisation of the file (the 2026-07-30 defect)",
    from: "  const flat = norm(text);",
    to: "  const flat = text;",
    caught: () => run(buildTree("m2", { claudeMd: healthyClaudeMd() }), { script: mutantPath }).code === 1,
  },
  {
    name: "archival citations promoted to errors",
    from: "    if (live.length) errors.push(msg);\n    else legacy.push(msg);",
    to: "    errors.push(msg);",
    caught: () => {
      const root = buildTree("m3", {
        claudeMd: healthyClaudeMd(),
        "platform/plans/2026-01-01-old.md": 'CLAUDE.md §"Nonexistent section"\n',
      });
      return run(root, { script: mutantPath }).code === 1;
    },
  },
  {
    name: "live citations demoted to legacy",
    from: "    if (live.length) errors.push(msg);\n    else legacy.push(msg);",
    to: "    legacy.push(msg);",
    caught: () => {
      const root = buildTree("m4", {
        claudeMd: healthyClaudeMd(),
        ".claude/hooks/x.mjs": '// CLAUDE.md §"Nonexistent section"\n',
      });
      return run(root, { script: mutantPath }).code === 0;
    },
  },
  {
    name: "citation parser no longer stops at an opening parenthesis",
    from: "[A-Za-z][^,;.`()\\]\\n\"]{0,45}",
    to: "[A-Za-z][^,;.`)\\]\\n\"]{0,45}",
    caught: () => {
      const root = buildTree("m5", {
        claudeMd: healthyClaudeMd(),
        ".claude/hooks/y.mjs": '// CLAUDE.md §Conventions ("Legible decision surface") requires it\n',
      });
      return run(root, { script: mutantPath }).code === 1;
    },
  },
  {
    // The GOVERNANCE-SYNC comparison neutered: every surface the gate blocks is treated as named, so an
    // enforced-but-unknown class — the exact state `.claude/agents/**` was in — reports clean.
    name: "governance-sync comparison neutered (an unnamed surface reports clean)",
    from: "const unnamed = [...govTokens].filter((t) => !sentence.includes(t));",
    to: "const unnamed = [];",
    caught: () => {
      const root = buildTree("m6", {
        // `govBulletCounted(2, …)` names only `hooks` but states the gate's REAL entry count, so the count check
        // is satisfied and the word comparison is the only thing that can speak. Written the naive way first
        // (`govBullet("hooks")`, which states 1) and this mutant SURVIVED: the count error fired under both the
        // mutated and unmutated tool, so the probe could not tell them apart. That is the same defect the
        // missing-gate branch was rewritten to avoid, reproduced one level down in the mutant's own fixture —
        // a new check must be neutral in every fixture that is probing something else.
        claudeMd: healthyClaudeMd(govBulletCounted(2, "hooks")),
        ".claude/hooks/autonomy-gate.mjs": GATE("hooks", "agents"),
      });
      return run(root, { script: mutantPath }).code === 0;
    },
  },
  {
    // The region narrowing removed, so the RATIONALE half of the bullet counts as the list again. This is the
    // bug that shipped for one run: `agents/` deleted from the list, still green, because the sentence
    // explaining the omission contained the word.
    name: "governance-sync reads the whole bullet again, rationale included",
    from: "const region = (bullet ? bullet[0] : '').split(/it may\\b/)[0];",
    to: "const region = bullet ? bullet[0] : '';",
    caught: () => {
      const root = buildTree("m7", {
        // The count sentence is stated truthfully (2 = the gate's entries) for the same reason as m6: this probe
        // is about WHERE the list ends, so the count must not be able to fail the run on its own.
        claudeMd: healthyClaudeMd(
          `\n- the agent NEVER edits its own governance — under \`.claude/\`: \`hooks/\` — it may propose. This` +
            ` list once omitted \`agents/\`. All 2 enforced by \`autonomy-gate.mjs\`;\n`,
        ),
        ".claude/hooks/autonomy-gate.mjs": GATE("hooks", "agents"),
      });
      return run(root, { script: mutantPath }).code === 0;
    },
  },
  {
    // The count comparison neutered. Added with the check on 2026-08-01: the number in the always-loaded file is
    // hand-maintained, and this bullet's own history is the evidence that hand-maintained numbers drift ("said 7
    // while the gate enforced 12"). Every surface is named in this fixture, so ONLY the count can speak.
    name: "the enforced-surface count no longer compared (a drifted number reports clean)",
    from: "} else if (gateEntries !== null && Number(claimed[1]) !== gateEntries) {",
    to: "} else if (false) {",
    caught: () => {
      const root = buildTree("m8", {
        claudeMd: healthyClaudeMd(govBulletCounted(7, "hooks", "agents")),
        ".claude/hooks/autonomy-gate.mjs": GATE("hooks", "agents"),
      });
      return run(root, { script: mutantPath }).code === 0;
    },
  },
];

let mutantPath = "";
let killed = 0;
for (const [i, m] of MUTANTS.entries()) {
  check(`mutant killed: ${m.name}`, () => {
    assert.ok(SOURCE.includes(m.from), `mutation target not found in source: ${m.from}`);
    const mutated = SOURCE.replace(m.from, m.to);
    assert.notEqual(mutated, SOURCE, "patch changed nothing");
    /**
     * Mutants live in an OS temp dir, never in the repo. A sibling suite used to write them next to the real
     * script; a run killed by a timeout leaked one into `.claude/hooks/`, and an unrelated suite then failed
     * blaming itself. Zero repo writes, and it is asserted below.
     */
    mutantPath = join(LAB, `mutant-${i}-${process.pid}.mjs`);
    writeFileSync(mutantPath, mutated, "utf8");

    // The mutant must still RUN — a mutant killed by a syntax error proves nothing about the assertion.
    const smoke = run(buildTree(`m${i}-smoke`, { claudeMd: healthyClaudeMd() }), { script: mutantPath });
    assert.ok(
      smoke.code === 0 || smoke.code === 1,
      `mutant did not run (exit ${smoke.code}):\n${smoke.out}`
    );
    assert.ok(!/SyntaxError|ReferenceError|Cannot find/.test(smoke.out), `mutant crashed:\n${smoke.out}`);

    assert.ok(m.caught(), `mutant SURVIVED — a case is missing for: ${m.name}`);
    killed += 1;
  });
}

check("the suite did not mutate the script it reads", () => {
  assert.equal(readFileSync(SCRIPT, "utf8"), RAW, "claude-md-budget.mjs changed on disk during this run");
  assert.ok(!LAB.startsWith(REPO), "sandboxes must live outside the repo");
});

/* ─────────────────────────── report ─────────────────────────── */

try {
  rmSync(LAB, { recursive: true, force: true });
} catch {
  /* a leaked temp dir is not a test failure */
}

const total = pass + fails.length;
console.log(
  fails.length
    ? `✗ claude-md-budget.test — ${pass}/${total} passing, ${fails.length} FAILING · ${killed}/${MUTANTS.length} mutants killed`
    : `ok claude-md-budget.test — ${pass}/${total} passing · ${killed}/${MUTANTS.length} mutants killed`
);
for (const f of fails) console.log(`   ✗ ${f}`);
process.exit(fails.length ? 1 : 0);
