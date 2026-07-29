// Test for plan-audit.mjs — the checker that reads a plan file and says whether it follows the standard,
// and the only one of these tools that speaks IN-LOOP (PostToolUse, exit 2) while a plan is being written.
// Run: node .claude/scripts/plan-audit.test.mjs
//
// WHY THIS EXISTS. This script has already produced FOUR wrong answers on real files, and every one of them
// was of the most corrosive kind available to a checker: it failed a compliant document.
//
//   Defect #1 — headings were matched with a `$` anchor, so `## Options considered — REQUIRED: ≥2, …` (the
//               wording the TEMPLATE ships) counted as absent. It failed the template it checks against.
//   Defect #2 — a section written under a reasonable synonym (`## Design`) was an ERROR rather than a noted
//               drift, which reads as "the standard forbids thinking in your own words".
//   Defect #3 — plans written before the standard existed were charged with breaking it.
//   Defect #4 — `\s*` in the heading regex let the whitespace run cross the newline, so the optional trailing
//               descriptor `(?:[—\-–:(].*)?` matched the section's FIRST BULLET (a bullet starts with `-`).
//               The heading ate a line of its own body, and the script then failed a plan for "prior art has
//               1 external URL" while the file plainly listed two.
//
// Defect #4 is the one to hold on to: **the failure mode of a parser that eats one line of its input is a
// SHORTFALL REPORT**, and the natural response to a shortfall report is to add redundant material until the
// tool goes quiet. A checker that can do that trains the author to write worse documents. It is case 1 below.
//
// Per platform/standards/testing.md §2.5 the suite also MUTATES the script and asserts it notices.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  copyFileSync,
} from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const SCRIPT = join(HERE, "plan-audit.mjs");

/** A sandbox repo holding only `platform/plans/` and a copy of the script + its layout dependency. */
function sandbox(plans = {}) {
  const root = mkdtempSync(join(tmpdir(), "plan-audit-"));
  const scripts = join(root, ".claude", "scripts");
  mkdirSync(scripts, { recursive: true });
  copyFileSync(SCRIPT, join(scripts, "plan-audit.mjs"));
  copyFileSync(join(HERE, "_layout.mjs"), join(scripts, "_layout.mjs"));
  const dir = join(root, "platform", "plans");
  mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(plans)) writeFileSync(join(dir, name), body);
  return { root, scripts, dir };
}

function audit(s, args = []) {
  const r = spawnSync(process.execPath, [join(s.scripts, "plan-audit.mjs"), ...args], {
    encoding: "utf8",
    timeout: 60_000,
    cwd: s.root,
  });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

/** Findings for one plan file, by name. */
function findings(s, name, args = []) {
  const { out, code } = audit(s, ["--json", ...args]);
  assert.equal(code, 0, `plan-audit exited ${code}:\n${out.slice(0, 600)}`);
  const j = JSON.parse(out);
  const r = j.results.find((x) => x.rel.endsWith(name));
  assert.ok(r, `no result for ${name} — the file was not discovered at all`);
  return r;
}

const levels = (r, level) => r.findings.filter((f) => f.level === level).map((f) => f.msg);
const has = (r, level, re) => levels(r, level).some((m) => re.test(m));

/** A plan that satisfies every rule, so a case can break exactly one thing. */
function goodPlan({
  kind = "system-change",
  status = "active",
  created = "2026-07-30",
  priorArt = "- [Source one](https://example.org/a) — what we learn\n- [Source two](https://example.net/b) — and this\n",
  ask = "> làm cho tôi cái này\n",
  extra = "",
} = {}) {
  return `---
title: a fixture plan
kind: ${kind}
status: ${status}
created: ${created}
updated: ${created}
---

## The ask, verbatim

${ask}
## Goal

One sentence.

## Context

Why now.

## Prior art & sources

${priorArt}
## Approach & tradeoffs

The chosen approach, plus two options ruled out.

## Acceptance criteria (Given / When / Then)

- **AC-1** — Given a thing, When it happens, Then it is observable.

## Steps

- [ ] Step 1 — do the thing · Files: Create \`a/b.ts\` · Test: \`AC-1 (how)\`

## Out of scope

Nothing else.
${extra}`;
}

/* ═══════════ 1. THE REGRESSION: the heading must not eat the first line of its own body ═════════
 * With `\s*` the heading match consumed `## Prior art & sources` PLUS the first bullet, so a plan with two
 * sources was failed for having one. The tell was a shortfall report on a compliant file.
 */
{
  const s = sandbox({
    "2026-07-30-two-sources.md": goodPlan({
      priorArt:
        "- [First source](https://first.example.org/x) — the one that used to be swallowed\n" +
        "- [Second source](https://second.example.net/y) — the one that survived\n",
    }),
  });
  const r = findings(s, "two-sources.md");
  assert.ok(
    !has(r, "ERROR", /prior art has \d+ external URL/),
    `a plan listing TWO sources must not be failed for having one — the heading regex must use [ \\t]*, not ` +
      `\\s*, or the first bullet is consumed as the heading's trailing descriptor:\n${JSON.stringify(r.findings, null, 2)}`,
  );
  assert.deepEqual(levels(r, "ERROR"), [], `the fixture plan must be fully clean:\n${JSON.stringify(r.findings)}`);
  rmSync(s.root, { recursive: true, force: true });
}

/* ─────── 1b. …and one source really is a shortfall, so the check still has teeth ── */
{
  const s = sandbox({
    "2026-07-30-one-source.md": goodPlan({
      priorArt: "- [Only source](https://only.example.org/x) — alone\n",
    }),
  });
  assert.ok(
    has(findings(s, "one-source.md"), "ERROR", /prior art has 1 external URL\(s\); the standard requires ≥2/),
    "the fix must not have been achieved by disabling the check",
  );
  rmSync(s.root, { recursive: true, force: true });
}

/* ═══════════ 2. DEFECT #1: a heading carrying the template's own suffix must be found ═══════════ */
{
  const s = sandbox({
    "2026-07-30-suffixed.md": goodPlan()
      .replace(
        "## Prior art & sources",
        "## Prior art & sources — REQUIRED: ≥2 external URLs (research-before-design)",
      )
      // A REQUIRED section too, not only the prior-art one: those take different code paths, and a case that
      // only suffixes prior art would pass even with required-section matching broken.
      .replace("## Approach & tradeoffs", "## Approach & tradeoffs — with the options ruled out")
      .replace("## Out of scope", "## Out of scope (explicit non-goals)"),
  });
  const r = findings(s, "suffixed.md");
  assert.deepEqual(
    levels(r, "ERROR"),
    [],
    `the templates SHIP suffixed headings; matching on an exact string failed every plan that followed the ` +
      `template verbatim:\n${JSON.stringify(r.findings, null, 2)}`,
  );
  rmSync(s.root, { recursive: true, force: true });
}

/* ═══════════ 3. DEFECT #2: a reasonable synonym is DRIFT, not a violation ═══════════ */
{
  const s = sandbox({
    "2026-07-30-synonym.md": goodPlan().replace("## Approach & tradeoffs", "## Design"),
  });
  const r = findings(s, "synonym.md");
  assert.ok(
    !has(r, "ERROR", /missing required section `## Approach & tradeoffs`/),
    "doing the required thinking under a different heading is the standard being ADAPTED, not ignored",
  );
  assert.ok(
    has(r, "WARN", /written as `## Design` — same job, non-standard heading/),
    "…but it must still be NAMED, or the standard has no edges",
  );

  // And an unlisted heading is still an ERROR — the frame is a frame.
  const s2 = sandbox({
    "2026-07-30-invented.md": goodPlan().replace("## Approach & tradeoffs", "## Vibes"),
  });
  assert.ok(
    has(findings(s2, "invented.md"), "ERROR", /missing required section `## Approach & tradeoffs`/),
    "an arbitrary heading is not a synonym",
  );
  rmSync(s.root, { recursive: true, force: true });
  rmSync(s2.root, { recursive: true, force: true });
}

/* ═══════════ 4. DEFECT #3: a plan cannot break a rule that did not exist when it was written ═════ */
{
  const s = sandbox({
    "2026-06-01-ancient.md": `---
title: an old plan
status: done
created: 2026-06-01
updated: 2026-06-02
---

## Goal

x

## Context

x

## Approach & tradeoffs

x

## Steps

- [ ] Step 1 — something

## Out of scope

x
`,
  });
  const r = findings(s, "ancient.md");
  assert.ok(
    has(r, "INFO", /predates the 2026-06-14 plan standard/),
    "the exemption must be stated, not silent",
  );
  assert.ok(
    !has(r, "ERROR", /missing `kind:`|kind/),
    "no `kind:` charge against a file written before `kind:` existed",
  );
  assert.ok(!has(r, "ERROR", /prior art/), "no prior-art charge either");
  assert.ok(!has(r, "ERROR", /acceptance criteria/), "nor acceptance criteria");
  rmSync(s.root, { recursive: true, force: true });
}

/* ═══════════ 5. `## The ask, verbatim` — the one section the agent did not write ═══════════
 * An UNFILLED block is worse than an absent one, because it looks satisfied when the plan is closed.
 */
{
  const withoutSection = goodPlan().replace(/## The ask, verbatim\n\n> làm cho tôi cái này\n\n/, "");
  const s = sandbox({
    // Created after the rule → ERROR.
    "2026-07-31-no-ask.md": withoutSection.replace(/created: .*/, "created: 2026-07-31").replace(/updated: .*/, "updated: 2026-07-31"),
    // Created before it → advisory only; retro-fitting every old plan is not the point.
    "2026-07-01-no-ask-old.md": withoutSection.replace(/created: .*/, "created: 2026-07-01").replace(/updated: .*/, "updated: 2026-07-01"),
    // Present but holding the template's placeholder → ERROR.
    "2026-07-30-placeholder-ask.md": goodPlan({ ask: "> (paste the request here)\n" }),
    // Present but holding nothing quoted at all → ERROR.
    "2026-07-30-empty-ask.md": goodPlan({ ask: "TODO\n" }),
  });

  assert.ok(
    has(findings(s, "2026-07-31-no-ask.md"), "ERROR", /no `## The ask, verbatim` section/),
    "a plan born after the rule must carry the raw request",
  );
  assert.ok(
    has(findings(s, "no-ask-old.md"), "INFO", /no `## The ask, verbatim` section/),
    "an older plan is informed, not charged",
  );
  for (const f of ["placeholder-ask.md", "empty-ask.md"])
    assert.ok(
      has(findings(s, f), "ERROR", /present but holds no quoted request/),
      `an unfilled ask block must be an ERROR: ${f}`,
    );
  rmSync(s.root, { recursive: true, force: true });
}

/* ═══════════ 6. a step is a BLOCK, not a line ═══════════
 * 13 steps across 2 plans carried their `Files:`/`Test:` on a continuation line and were all reported as
 * missing both. The rule was right; the ruler was short.
 */
{
  const s = sandbox({
    "2026-07-30-wrapped.md": goodPlan({}).replace(
      "- [ ] Step 1 — do the thing · Files: Create `a/b.ts` · Test: `AC-1 (how)`",
      "- [ ] Step 1 — do a thing whose description is long enough that it wraps\n" +
        "      · Files: Create `a/b.ts`\n" +
        "      · Test: `AC-1 (how it is verified)`",
    ),
  });
  const r = findings(s, "wrapped.md");
  assert.ok(!has(r, "WARN", /steps name no `Files:`/), `a wrapped step still names its files:\n${JSON.stringify(r.findings)}`);
  assert.ok(!has(r, "WARN", /steps name no `Test:`/), "…and its test");

  const s2 = sandbox({
    "2026-07-30-bare.md": goodPlan().replace(
      "- [ ] Step 1 — do the thing · Files: Create `a/b.ts` · Test: `AC-1 (how)`",
      "- [ ] Step 1 — do the thing",
    ),
  });
  const r2 = findings(s2, "bare.md");
  assert.ok(has(r2, "WARN", /1\/1 steps name no `Files:`/), "a step that really names nothing is still reported");
  rmSync(s.root, { recursive: true, force: true });
  rmSync(s2.root, { recursive: true, force: true });
}

/* ═══════════ 7. template guidance inside HTML comments is NOT content ═══════════
 * Otherwise every unfilled plan passes on the strength of the instructions telling it what to write.
 */
{
  const s = sandbox({
    "2026-07-30-commented.md": goodPlan({
      priorArt:
        "<!-- - [Source 1](https://real.example.org/a) — an example inside the guidance\n" +
        "     - [Source 2](https://real.example.net/b) — another -->\n",
    }),
  });
  assert.ok(
    has(findings(s, "commented.md"), "ERROR", /prior art has 0 external URL\(s\)/),
    "URLs inside a comment are the template's examples, not the plan's sources",
  );

  // …and the template's literal placeholders are not sources either.
  const s2 = sandbox({
    "2026-07-30-placeholder-urls.md": goodPlan({
      priorArt: "- [Source 1](url) — what we learn\n- [Source 2](https://example.com/x) — ...\n",
    }),
  });
  const r2 = findings(s2, "placeholder-urls.md");
  assert.ok(has(r2, "ERROR", /prior art has 0 external URL\(s\)/), "`(url)` and example.com are placeholders");
  assert.ok(has(r2, "WARN", /unfilled `\[Source 1\]\(url\)` placeholder/), "and the placeholder itself is reported");
  rmSync(s.root, { recursive: true, force: true });
  rmSync(s2.root, { recursive: true, force: true });
}

/* ═══════════ 8. the checkin pair, mirroring plan-checkin so one command reports everything ═══════ */
{
  const s = sandbox({
    "2026-07-30-checkin-no-runbook.md": goodPlan().replace(
      "updated: 2026-07-30",
      "updated: 2026-07-30\ncheckin: 2026-08-06",
    ),
    "2026-07-30-runbook-no-checkin.md": goodPlan({
      extra: "\n## Check-in runbook\n\nSteps nobody will ever be reminded to run.\n",
    }),
  });
  assert.ok(
    has(findings(s, "checkin-no-runbook.md"), "ERROR", /`checkin:` set with no `## Check-in runbook`/),
    "a reminder that arrives with no instructions makes the user re-ask the steps",
  );
  assert.ok(
    has(findings(s, "runbook-no-checkin.md"), "WARN", /`## Check-in runbook` present but no `checkin:` date/),
    "a runbook with no date will never fire",
  );
  rmSync(s.root, { recursive: true, force: true });
}

/* ═══════════ 9. proposals are judged by the proposal template, not the plan one ═══════════ */
{
  const proposal = `---
title: a fixture proposal
kind: system-change
status: draft
created: 2026-07-30
---

## Problem

x

## Options considered — REQUIRED: ≥2, with tradeoffs

| Option | Tradeoff |
|---|---|
| A — do it this way **(khuyến nghị)** | cheap, narrow |
| B — do it that way | broad, slow |

## Recommendation

A, because it is cheap.

## Pre-mortem

- It could fail because of one thing.
- It could also fail because of another.

## Counter-case

Maybe do nothing.

## Prior art & sources

- [One](https://a.example.org/x) — y
- [Two](https://b.example.net/z) — w

## Decision (human) — the human-accept gate

Accept ⇒ it becomes a plan.
`;
  const s = sandbox({ "2026-07-30-thing-proposal.md": proposal });
  const r = findings(s, "thing-proposal.md");
  assert.equal(r.isProposal, true, "detected as a proposal by filename");
  assert.deepEqual(levels(r, "ERROR"), [], `a compliant proposal must be clean:\n${JSON.stringify(r.findings)}`);

  // Now break each proposal-specific rule one at a time.
  const s2 = sandbox({
    "2026-07-30-no-pick-proposal.md": proposal.replace(" **(khuyến nghị)**", ""),
    "2026-07-30-one-option-proposal.md": proposal.replace("| B — do it that way | broad, slow |\n", ""),
    "2026-07-30-thin-premortem-proposal.md": proposal.replace(
      "- It could also fail because of another.\n",
      "",
    ),
  });
  assert.ok(
    has(findings(s2, "no-pick-proposal.md"), "ERROR", /no option marked `\(khuyến nghị\)`/),
    "the supervisor must be able to see the pick at a glance",
  );
  assert.ok(
    has(findings(s2, "one-option-proposal.md"), "ERROR", /options table has 1 option row/),
    "one option is not a choice",
  );
  assert.ok(
    has(findings(s2, "thin-premortem-proposal.md"), "ERROR", /pre-mortem lists 1 failure mode/),
    "one failure mode is not a pre-mortem",
  );
  rmSync(s.root, { recursive: true, force: true });
  rmSync(s2.root, { recursive: true, force: true });
}

/* ═══════════ 10. the in-loop hook mode: it speaks, and it never blocks a write ═══════════ */
{
  const s = sandbox({
    "2026-07-30-broken.md": goodPlan({ priorArt: "- nothing at all\n" }),
    "2026-07-30-clean.md": goodPlan(),
  });
  const brokenPath = join(s.dir, "2026-07-30-broken.md");
  const cleanPath = join(s.dir, "2026-07-30-clean.md");

  const fire = (payload) => {
    const r = spawnSync(process.execPath, [join(s.scripts, "plan-audit.mjs"), "--hook"], {
      input: JSON.stringify(payload),
      encoding: "utf8",
      timeout: 60_000,
      cwd: s.root,
    });
    return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
  };

  const bad = fire({ tool_name: "Write", tool_input: { file_path: brokenPath } });
  assert.equal(bad.code, 2, `a plan with ERRORs must produce PostToolUse feedback:\n${bad.out}`);
  assert.match(bad.out, /prior art has 0 external URL/, "the feedback must name the actual problem");
  assert.match(bad.out, /Fix it in the plan now, not later/, "…and say when to fix it");
  assert.match(bad.out, /standards\/documentation\.md §5\.5/, "…and where the rule lives");

  assert.equal(
    fire({ tool_name: "Write", tool_input: { file_path: cleanPath } }).code,
    0,
    "a compliant plan must be silent — a hook that always speaks becomes wallpaper",
  );
  assert.equal(
    fire({ tool_name: "Write", tool_input: { file_path: join(s.root, "platform", "notes.md") } }).code,
    0,
    "a file outside /plans/ is none of its business",
  );
  assert.equal(
    fire({ tool_name: "Write", tool_input: { file_path: join(s.dir, "does-not-exist.md") } }).code,
    0,
    "a path that is not there must not throw",
  );

  const garbled = spawnSync(process.execPath, [join(s.scripts, "plan-audit.mjs"), "--hook"], {
    input: "{ not json",
    encoding: "utf8",
    cwd: s.root,
  });
  assert.equal(
    garbled.status,
    0,
    "an unreadable payload must never be the reason a write reports a problem",
  );

  // --strict is the CI form; the default must never fail a run.
  assert.equal(audit(s).code, 0, "report-only by default");
  assert.equal(audit(s, ["--strict"]).code, 1, "--strict returns 1 when there are ERRORs");
  rmSync(s.root, { recursive: true, force: true });
}

/* ═══════════ 11. the suite must NOTICE a broken checker (mutation) ═══════════ */
{
  const src = readFileSync(SCRIPT, "utf8");

  const mutants = [
    {
      name: "the heading regex back to `\\s*` (DEFECT #4 — the heading eats the first bullet)",
      plans: {
        "2026-07-30-two-sources.md": goodPlan({
          priorArt:
            "- [First source](https://first.example.org/x) — swallowed\n" +
            "- [Second source](https://second.example.net/y) — survivor\n",
        }),
      },
      // The defect was in the whitespace run AFTER the heading text, not before it: `\s*` there lets the
      // match cross the newline, and the optional trailing descriptor then eats the first bullet. The first
      // version of this patch changed the LEADING run and the mutant survived, which is the correct outcome
      // for a patch that mutates something the case does not depend on.
      apply: (s) =>
        s.replace(
          "[ \\\\t]*(?:[—\\\\-–:(].*)?$",
          () => "\\\\s*(?:[—\\\\-–:(].*)?$",
        ),
      probe: (s) => has(findings(s, "two-sources.md"), "ERROR", /prior art has 1 external URL/),
    },
    {
      name: "the heading anchored exactly again (DEFECT #1 — the template's own headings fail)",
      plans: {
        "2026-07-30-suffixed.md": goodPlan().replace(
          "## Approach & tradeoffs",
          "## Approach & tradeoffs — with the options ruled out",
        ),
      },
      apply: (s) => s.replace("[ \\\\t]*(?:[—\\\\-–:(].*)?$", () => "$"),
      // A REQUIRED section, because `Prior art & sources` is not in PLAN_SECTIONS and its absence produces a
      // different message — the first version of this probe looked for a "missing required section" error that
      // could never be emitted for prior art, and the mutant survived on a technicality of my own making.
      probe: (s) =>
        has(findings(s, "suffixed.md"), "ERROR", /missing required section `## Approach & tradeoffs`/),
    },
    {
      name: "synonyms removed (DEFECT #2 — adapting the standard becomes a violation)",
      plans: { "2026-07-30-synonym.md": goodPlan().replace("## Approach & tradeoffs", "## Design") },
      apply: (s) => s.replace(/const SYNONYMS = \{[\s\S]*?\n\};/, "const SYNONYMS = {};"),
      probe: (s) =>
        has(findings(s, "synonym.md"), "ERROR", /missing required section `## Approach & tradeoffs`/),
    },
    {
      name: "the pre-standard exemption removed (DEFECT #3 — inventing history)",
      plans: {
        "2026-06-01-ancient.md":
          "---\ntitle: old\nstatus: done\ncreated: 2026-06-01\nupdated: 2026-06-02\n---\n\n" +
          "## Goal\n\nx\n\n## Context\n\nx\n\n## Approach & tradeoffs\n\nx\n\n## Steps\n\n- [ ] Step 1\n\n## Out of scope\n\nx\n",
      },
      apply: (s) => s.replace("const preStandard = !!fm.created &&", "const preStandard = false &&"),
      probe: (s) => has(findings(s, "ancient.md"), "ERROR", /missing `kind:`/),
    },
    {
      name: "HTML comments counted as content (every unfilled plan passes)",
      plans: {
        "2026-07-30-commented.md": goodPlan({
          priorArt: "<!-- - [S1](https://a.example.org/x)\n     - [S2](https://b.example.net/y) -->\n",
        }),
      },
      apply: (s) => s.replace("const uncomment = (s) =>", "const uncomment = (s) => s ?? (() =>"),
      mayCrash: true,
      probe: (s) => !has(findings(s, "commented.md"), "ERROR", /prior art has 0 external URL/),
    },
    {
      name: "steps read line-by-line instead of block-by-block",
      plans: {
        "2026-07-30-wrapped.md": goodPlan().replace(
          "- [ ] Step 1 — do the thing · Files: Create `a/b.ts` · Test: `AC-1 (how)`",
          "- [ ] Step 1 — a long description that wraps\n      · Files: Create `a/b.ts`\n      · Test: `AC-1 (x)`",
        ),
      },
      apply: (s) =>
        s.replace(
          "steps\n      .split(/\\n(?=[ \\t]*-[ \\t]*\\[[ xX]\\][ \\t])/)",
          "steps\n      .split(/\\n/)",
        ),
      probe: (s) => has(findings(s, "wrapped.md"), "WARN", /steps name no `Files:`/),
    },
    {
      name: "an EMPTY ask block accepted (it looks satisfied at close)",
      plans: { "2026-07-30-empty-ask.md": goodPlan({ ask: "TODO\n" }) },
      apply: (s) => s.replace("} else if (placeholder || quoted === 0) {", "} else if (false) {"),
      probe: (s) => !has(findings(s, "empty-ask.md"), "ERROR", /holds no quoted request/),
    },
  ];

  for (const m of mutants) {
    const s = sandbox(m.plans);
    const mutated = m.apply(src);
    assert.notEqual(mutated, src, `mutation "${m.name}" changed nothing — the patch is stale`);
    writeFileSync(join(s.scripts, "plan-audit.mjs"), mutated);

    if (!m.mayCrash) {
      const sanity = audit(s, ["--json"]);
      let ran = false;
      try {
        ran = Array.isArray(JSON.parse(sanity.out).results);
      } catch {
        ran = false;
      }
      assert.ok(
        ran,
        `mutant "${m.name}" did not run — syntax error, not behaviour:\n${sanity.out.slice(0, 300)}`,
      );
    }

    let killed = false;
    try {
      killed = m.probe(s);
    } catch {
      killed = Boolean(m.mayCrash); // a crash only counts when the mutant was expected to break execution
    }
    rmSync(s.root, { recursive: true, force: true });
    assert.ok(killed, `SURVIVING MUTANT — "${m.name}" and the suite still passed. Add a case for it.`);
  }
}

/* ─────────────── the real repo must be untouched ── */
{
  const dirty = spawnSync("git", ["status", "--porcelain"], { cwd: REPO, encoding: "utf8" }).stdout;
  assert.ok(
    !/two-sources|suffixed|ancient|no-ask|wrapped/.test(dirty),
    `the suite leaked fixtures into the real repo:\n${dirty}`,
  );
}

console.log(
  "plan-audit.test.mjs — all 4 historical defects pinned (heading eats a bullet, exact anchor, synonyms, " +
    "inventing history), the verbatim-ask rules, step blocks, commented guidance, the checkin pair, the " +
    "proposal rules, the in-loop hook + --strict, 7 mutants all killed  ✅",
);
