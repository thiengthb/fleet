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

/** Today, so a fixture that must not look "dangling" never crosses the 10-day staleness threshold with age. */
const TODAY = new Date().toISOString().slice(0, 10);

const levels = (r, level) => r.findings.filter((f) => f.level === level).map((f) => f.msg);
const has = (r, level, re) => levels(r, level).some((m) => re.test(m));

/** A plan that satisfies every rule, so a case can break exactly one thing. */
function goodPlan({
  kind = "system-change",
  status = "active",
  created = "2026-07-30",
  /**
   * Defaults to `created`, which is what most cases want. A case that needs an OLD `created` (to trigger the
   * pre-standard exemption) must override this, or the dangling check fires on top and the fixture stops being
   * "one thing broken". Pass `TODAY` rather than a literal: a hardcoded date would silently cross the 10-day
   * staleness threshold later and fail this suite for reasons that have nothing to do with the code.
   */
  updated = created,
  priorArt = "- [Source one](https://example.org/a) — what we learn\n- [Source two](https://example.net/b) — and this\n",
  ask = "> làm cho tôi cái này\n",
  // Overridable so a case can vary ONLY the styling of an acceptance criterion or a step label. Both defaults
  // are the plainest form; the styled forms are what broke on 2026-07-31.
  ac = "- **AC-1** — Given a thing, When it happens, Then it is observable.",
  steps = "- [ ] Step 1 — do the thing · Files: Create `a/b.ts` · Test: `AC-1 (how)`",
  // Overridable so a case can delete the execute-half block without touching anything else. A good plan has
  // it: the default fixture must satisfy every rule, or "one thing broken" cases stop being one thing.
  beforeExecuting = "## Before executing a batch\n\n1. Is the premise still true?\n",
  extra = "",
} = {}) {
  return `---
title: a fixture plan
kind: ${kind}
status: ${status}
created: ${created}
updated: ${updated}
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

${ac}

## Steps

${steps}

${beforeExecuting}
## Out of scope

Nothing else.
${extra}`;
}

/* ═══════════ 0. THE 2026-07-31 REGRESSIONS: "missing" must not be reachable by STYLING ═══════════
 *
 * Two checks answered "absent" about text that was present and merely formatted differently, on this repo's own
 * harness-reexamination plan — which carried SEVEN acceptance criteria and was reported as having none.
 *
 *   `**AC-1 (R1) — …**`  the id STARTS the bold span instead of filling it, and the old pattern required the
 *                        id to be the entire bold span, so it counted zero
 *   `_Test: AC-1._`      italics put an underscore before `Test`, and underscore is a WORD character, so a
 *                        word-boundary anchor never matched — every step read as unverifiable
 *
 * (Both patterns are quoted in the code below rather than here: writing a regex containing an asterisk-slash
 *  inside a block comment ends the comment, which is how the first draft of this very comment broke the file.)
 *
 * This is the third instance on this platform of a checker reporting something present as missing, and the
 * reason it matters is not politeness: a false "missing" is indistinguishable from a real finding, so it teaches
 * the reader that the checker is noise. Both directions are pinned here — the styled forms must COUNT, and the
 * genuinely-absent case must still be caught.
 */
{
  const s = sandbox({
    "2026-07-31-styled-ac.md": goodPlan({
      ac: "- **AC-1 (R1) — outside consensus, not opinion.** Given a claim, When it has two sources, Then adopt it.",
      steps: "- [ ] Step 1 — do the thing\n      _Files: `a/b.ts`._ · _Test: AC-1._",
    }),
  });
  const r = findings(s, "styled-ac.md");
  assert.ok(
    !has(r, "ERROR", /no `AC-n` acceptance criteria/),
    `an AC id that STARTS the bold span must count:\n${levels(r, "ERROR").join("\n")}`,
  );
  assert.ok(
    !has(r, "WARN", /steps name no `Test:`/),
    `an italicised _Test:_ label must count:\n${levels(r, "WARN").join("\n")}`,
  );
  assert.ok(
    !has(r, "WARN", /steps name no `Files:`/),
    `an italicised _Files:_ label must count:\n${levels(r, "WARN").join("\n")}`,
  );
}
{
  // The other direction, so the fix above is a relaxation of SHAPE and not of SUBSTANCE.
  const s = sandbox({
    "2026-07-31-really-missing.md": goodPlan({
      ac: "We will know it works when it feels right.",
      steps: "- [ ] Step 1 — do the thing, somewhere, somehow",
    }),
  });
  const r = findings(s, "really-missing.md");
  assert.ok(has(r, "ERROR", /no `AC-n` acceptance criteria/), "prose with no AC id must still be an ERROR");
  assert.ok(has(r, "WARN", /steps name no `Test:`/), "a step with no Test label must still warn");
  assert.ok(has(r, "WARN", /steps name no `Files:`/), "a step with no Files label must still warn");
  // And the label must be a label, not a coincidence inside another word.
  const s2 = sandbox({
    "2026-07-31-latest.md": goodPlan({ steps: "- [ ] Step 1 — ship the Latest: build" }),
  });
  assert.ok(
    has(findings(s2, "latest.md"), "WARN", /steps name no `Test:`/),
    '"Latest:" must not be mistaken for a Test: label — the lookbehind exists for this',
  );
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

/* ═══════════ 10b. BATCH D2: a shape gap on a CLOSED plan is LEGACY, and the ERROR count is live-only ══
 * All 105 shape ERRORs in the repo were on plans already closed, so the headline number described the
 * repo's history and nothing anyone could act on — and the ~20 live ones hid inside it. The gap must stay
 * VISIBLE (a silent exemption is how a checker becomes decorative), so it is reported under its own level
 * and its own total, and only the live count is allowed to gate.
 */
{
  const BROKEN_SHAPE = (status) => `---
title: a plan missing most of its sections
kind: system-change
status: ${status}
created: 2026-07-20
updated: 2026-07-20
---

## Goal

x
`;
  const s = sandbox({
    "2026-07-20-closed.md": BROKEN_SHAPE("done"),
    "2026-07-20-superseded.md": BROKEN_SHAPE("superseded"),
    "2026-07-20-live.md": BROKEN_SHAPE("active"),
  });

  const live = findings(s, "2026-07-20-live.md");
  assert.ok(
    has(live, "ERROR", /missing required section `## Context`/),
    "a LIVE plan still gets a hard ERROR — that is the whole point of the count",
  );

  for (const name of ["2026-07-20-closed.md", "2026-07-20-superseded.md"]) {
    const r = findings(s, name);
    assert.deepEqual(
      levels(r, "ERROR"),
      [],
      `a closed plan must carry no ERROR: ${name}\n${JSON.stringify(r.findings)}`,
    );
    assert.ok(
      has(r, "LEGACY", /missing required section `## Context`/),
      `…and the same gap must still be REPORTED as LEGACY, not dropped: ${name}`,
    );
  }

  const j = JSON.parse(audit(s, ["--json"]).out);
  assert.ok(j.legacy >= 2, `the legacy total must be its own number, got ${j.legacy}`);
  assert.ok(
    j.errors > 0 && j.errors < j.legacy + j.errors,
    "the error total must count live plans only",
  );

  // --strict is the CI gate: a repo full of closed plans must not fail it, a live shape gap must.
  assert.equal(audit(s, ["--strict"]).code, 1, "a live shape ERROR must fail --strict");
  const closedOnly = sandbox({ "2026-07-20-closed.md": BROKEN_SHAPE("abandoned") });
  assert.equal(
    audit(closedOnly, ["--strict"]).code,
    0,
    "…while closed plans alone must never fail it — otherwise the gate can never be satisfied",
  );
  assert.match(
    audit(closedOnly).out,
    /LEGACY: [1-9]/,
    "the legacy count must be printed even when nothing is actionable",
  );
  rmSync(s.root, { recursive: true, force: true });
  rmSync(closedOnly.root, { recursive: true, force: true });
}

/* ═══════════ 10c. a shape WARN on a CLOSED plan is LEGACY too — but a WARN *about* being closed is not ══
 * Batch D2 downgraded ERRORs on closed plans and exempted WARNs wholesale, reasoning it for the one WARN that
 * is genuinely about being closed. Measured 2026-07-31: 74 of 92 WARNs were on closed plans, 62 of them the
 * `Files:`/`Test:` shape checks — the same unrepairable-without-editing-history case. So the exemption is now
 * opt-IN (`keepWhenClosed`), and this case pins BOTH halves: the shape WARN must move, the about-being-closed
 * WARN must stay. Without the second half, "relaxing" the tier would have silenced a finding that is real.
 */
{
  // Steps with no `Files:`/`Test:` → shape WARNs. No `## Decisions to distill` → the actionable-when-closed WARN.
  const SHAPELESS_STEPS = (status) => `---
title: a plan whose steps name nothing
kind: system-change
status: ${status}
created: 2026-07-20
updated: 2026-07-20
---

## The ask, verbatim

> làm cho tôi cái này

## Goal

One sentence.

## Context

Why now.

## Prior art & sources

- [Source one](https://example.org/a) — what we learn
- [Source two](https://example.net/b) — and this

## Approach & tradeoffs

Chosen: x.

## Acceptance criteria

- **AC-1** — Given a thing, When it happens, Then it is observable.

## Steps

- [ ] Step 1 — do the thing
- [ ] Step 2 — do the other thing

## Out of scope

- not this
`;

  const live = sandbox({ "2026-07-20-live.md": SHAPELESS_STEPS("active") });
  const rLive = findings(live, "live.md");
  assert.ok(
    has(rLive, "WARN", /steps name no `Files:`/),
    `on a LIVE plan the shape gap must stay a WARN — it is repairable today\n${JSON.stringify(rLive.findings)}`,
  );

  const closed = sandbox({ "2026-07-20-closed.md": SHAPELESS_STEPS("done") });
  const rClosed = findings(closed, "closed.md");
  assert.ok(
    !has(rClosed, "WARN", /steps name no `Files:`/),
    "on a CLOSED plan the shape gap must NOT be a WARN — repairing it would edit the record",
  );
  assert.ok(
    has(rClosed, "LEGACY", /steps name no `Files:`/),
    "…and it must still be REPORTED as LEGACY, never dropped — a silent exemption is how a checker rots",
  );
  // The other half: this one is ABOUT being closed, so it must survive as an actionable WARN.
  assert.ok(
    has(rClosed, "WARN", /no `## Decisions to distill`/),
    `a WARN about being closed must stay a WARN\n${JSON.stringify(rClosed.findings)}`,
  );

  rmSync(live.root, { recursive: true, force: true });
  rmSync(closed.root, { recursive: true, force: true });
}

/* ═══════════ 11. the suite must NOTICE a broken checker (mutation) ═══════════ */
/* ═══════════ THE TWO OUTPUT MODES MUST AGREE ON `clean` ═══════════
 *
 * `clean` used to be computed inside the text branch only, so `--json` published `results` and left consumers to
 * invent the headline. On 2026-07-31 one did: `results.filter(r => !r.findings.length)` looks right, gave 8/68
 * where the tool reports 10/68, and three measurements were spent hunting a regression that never existed. The
 * two differ because **a plan carrying only INFO findings is clean**.
 *
 * So the contract under test is not a formula, it is an agreement: whatever `clean` means, both modes must say
 * the same number. The fixture set deliberately contains an INFO-only plan, because without one the naive
 * derivation and the real one return the same value and the mutant below would be unobservable.
 */
{
  const s = sandbox({
    // pre-standard date => one INFO; every step ticked => the execute-half check stays silent.
    "2026-01-01-info-only.md": goodPlan({
      created: "2026-01-01",
      updated: TODAY,
      steps: "- [x] Step 1 — done · Files: `a/b.ts` · Test: `AC-1 (how)`",
    }),
    "2026-07-30-spotless.md": goodPlan(),
    "2026-07-30-warned.md": goodPlan({ beforeExecuting: "" }),
  });

  const j = JSON.parse(audit(s, ["--json"]).out);
  const infoOnly = j.results.find((r) => r.rel.endsWith("info-only.md"));
  assert.ok(
    infoOnly.findings.length > 0 && infoOnly.findings.every((f) => f.level === "INFO"),
    `the fixture must produce an INFO-ONLY plan or this case proves nothing; got: ${JSON.stringify(infoOnly.findings)}`,
  );

  const text = audit(s).out;
  const m = /clean: (\d+)\/(\d+)/.exec(text);
  assert.ok(m, `the text report must state a clean count:\n${text}`);
  assert.equal(
    j.clean,
    Number(m[1]),
    `--json clean (${j.clean}) disagrees with the text report (${m?.[1]}):\n${text}`,
  );
  assert.equal(j.scanned, Number(m[2]), "the two modes disagree on how many files were scanned");
  assert.equal(j.clean, 2, `an INFO-only plan and a spotless one are both clean; got ${j.clean}\n${text}`);
}

/* ═══════════ THE EXECUTE HALF (community-harness-mining C2, adopted 2026-07-31) ═══════════
 *
 * fleet had authoring discipline and none for executing a plan. The rule now lives as a block in the plan
 * itself, because the plan is the artefact an executor opens; this checker is only responsible for the block
 * being PRESENT, and only where there is still something to execute.
 *
 * The three cases below are the boundary, and each exists because the naive version of this check would have
 * been noise: measured the same day on this repo, `plan-audit` was emitting 92 WARNs of which 74 sat on
 * closed plans. A finding on a plan nobody will open again is indistinguishable from a finding that matters.
 */
{
  const s = sandbox({
    "2026-07-31-no-exec-block.md": goodPlan({ beforeExecuting: "" }),
    "2026-07-31-all-ticked.md": goodPlan({
      steps: "- [x] Step 1 — done already · Files: `a/b.ts` · Test: `AC-1 (how)`",
      beforeExecuting: "",
    }),
    "2026-07-31-closed-plan.md": goodPlan({ status: "done", beforeExecuting: "" }),
    "2026-07-31-has-exec-block.md": goodPlan(),
  });
  const RE = /no `## Before executing a batch`/;

  assert.ok(
    has(findings(s, "no-exec-block.md"), "WARN", RE),
    "an active plan with unticked steps and no execute-half block must warn",
  );
  assert.ok(
    !has(findings(s, "all-ticked.md"), "WARN", RE),
    "a plan whose every step is ticked has nothing left to execute — warning about it is noise",
  );
  assert.ok(
    !has(findings(s, "closed-plan.md"), "WARN", RE) &&
      !has(findings(s, "closed-plan.md"), "LEGACY", RE),
    "a closed plan must not be asked for an execution gate at all — not even as LEGACY",
  );
  assert.ok(
    !has(findings(s, "has-exec-block.md"), "WARN", RE),
    "the block being present must silence it, or the check is unsatisfiable",
  );
}

/**
 * Counted, not written down. The summary line used to end with the literal string "8 mutants all killed", and
 * on the day three mutants were added it reported 8 — a test suite reciting a remembered number about itself,
 * which is the same defect (`memory: report-state-from-the-tool`) this platform has already been bitten by
 * twice in one session. The loop below asserts every mutant dies, so this counter cannot overstate.
 */
let mutantsKilled = 0;

{
  // LF-normalized: on a CRLF working tree (Windows) every multi-line mutation patch below would go stale.
  const src = readFileSync(SCRIPT, "utf8").replace(/\r\n/g, "\n");

  const mutants = [
    {
      // The exact wrong derivation a reader reached for on 2026-07-31. It is observable ONLY because the
      // fixture set contains an INFO-only plan; with a spotless-vs-dirty set it would be an equivalent
      // mutation that "survives" no matter how good the cases are.
      name: "`clean` in --json re-derived as 'no findings at all', disagreeing with the text report",
      plans: {
        "2026-01-01-m-info.md": goodPlan({
          created: "2026-01-01",
          updated: TODAY,
          steps: "- [x] Step 1 — done · Files: `a/b.ts` · Test: `AC-1 (how)`",
        }),
      },
      apply: (s) =>
        s.replace(
          "const clean = results.length - dirty.length;",
          "const clean = results.filter((r) => !r.findings.length).length;",
        ),
      /**
       * Probed by VALUE, not by agreement — and the first draft of this mutant probed agreement and SURVIVED,
       * which is the fix working. Both modes now read one shared `clean`, so mutating that definition moves
       * both numbers together and they still agree. Agreement is structural; only the definition is testable
       * here. The divergence property gets its own mutant below.
       */
      probe: (s) => JSON.parse(audit(s, ["--json"]).out).clean !== 1,
    },
    {
      name: "--json re-derives `clean` for itself, diverging from the text report (the pre-fix shape)",
      plans: {
        "2026-01-01-m-info2.md": goodPlan({
          created: "2026-01-01",
          updated: TODAY,
          steps: "- [x] Step 1 — done · Files: `a/b.ts` · Test: `AC-1 (how)`",
        }),
      },
      apply: (s) =>
        // Anchored on `{ scanned: files.length, clean,` alone — the surrounding call was reformatted on
        // 2026-08-01 when the worktree caveat joined the payload, and a patch pinned to the whole
        // `JSON.stringify(...)` prefix went stale and failed as "changed nothing". A mutation target should be
        // the smallest text that identifies the behaviour, not the line it happens to sit on.
        s.replace(
          "{ scanned: files.length, clean,",
          "{ scanned: files.length, clean: results.filter((r) => !r.findings.length).length,",
        ),
      probe: (s) => {
        const j = JSON.parse(audit(s, ["--json"]).out);
        const m = /clean: (\d+)\//.exec(audit(s).out);
        return j.clean !== Number(m[1]);
      },
    },
    {
      name: "the execute-half check stops caring whether the plan is still open",
      plans: { "2026-07-31-m-closed.md": goodPlan({ status: "done", beforeExecuting: "" }) },
      apply: (s) => s.replace("status === 'active' && open > 0", "open > 0"),
      // Killed through the LEGACY channel, not WARN: the closed-plan downgrade turns this WARN into LEGACY on
      // a `status: done` file, so probing for WARN would report the mutant as surviving when it is loose.
      probe: (s) =>
        has(findings(s, "m-closed.md"), "LEGACY", /no `## Before executing a batch`/) ||
        has(findings(s, "m-closed.md"), "WARN", /no `## Before executing a batch`/),
    },
    {
      name: "the execute-half check counts ticked steps as work still to do",
      plans: {
        "2026-07-31-m-ticked.md": goodPlan({
          steps: "- [x] Step 1 — done already · Files: `a/b.ts` · Test: `AC-1 (how)`",
          beforeExecuting: "",
        }),
      },
      apply: (s) => s.replace("status === 'active' && open > 0", "status === 'active' && items.length > 0"),
      probe: (s) => has(findings(s, "m-ticked.md"), "WARN", /no `## Before executing a batch`/),
    },
    {
      name: "the execute-half presence test inverted (warns when the block IS there)",
      plans: { "2026-07-31-m-present.md": goodPlan() },
      apply: (s) =>
        s.replace(
          "section(text, 'Before executing a batch') === null",
          "section(text, 'Before executing a batch') !== null",
        ),
      probe: (s) => has(findings(s, "m-present.md"), "WARN", /no `## Before executing a batch`/),
    },
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
      // `status: active`, not `done`. Batch D2 turns every ERROR on a CLOSED plan into LEGACY, so on a closed
      // fixture this mutant is unobservable through the ERROR channel and reported itself as surviving. The
      // exemption still matters exactly where it is observable: an OLD plan that is still live.
      plans: {
        "2026-06-01-ancient.md":
          "---\ntitle: old\nstatus: active\ncreated: 2026-06-01\nupdated: 2026-06-02\n---\n\n" +
          "## Goal\n\nx\n\n## Context\n\nx\n\n## Approach & tradeoffs\n\nx\n\n## Steps\n\n- [ ] Step 1\n\n## Out of scope\n\nx\n",
      },
      apply: (s) => s.replace("const preStandard = !!fm.created &&", "const preStandard = false &&"),
      probe: (s) => has(findings(s, "ancient.md"), "ERROR", /missing `kind:`/),
    },
    {
      name: "the WARN downgrade removed (the WARN count goes back to describing history — the 2026-07-31 defect)",
      plans: {
        "2026-07-20-closed.md":
          "---\ntitle: closed with shapeless steps\nkind: system-change\nstatus: done\ncreated: 2026-07-20\n" +
          "updated: 2026-07-20\n---\n\n## The ask, verbatim\n\n> x\n\n## Goal\n\nx\n\n## Context\n\nx\n\n" +
          "## Prior art & sources\n\n- [a](https://a.example.org/x) — x\n- [b](https://b.example.net/y) — y\n\n" +
          "## Approach & tradeoffs\n\nx\n\n## Acceptance criteria\n\n- **AC-1** — Given, When, Then.\n\n" +
          "## Steps\n\n- [ ] Step 1 — bare\n\n## Out of scope\n\n- x\n",
      },
      apply: (s) => s.replace("if (f.level === 'ERROR' || f.level === 'WARN')", "if (f.level === 'ERROR')"),
      probe: (s) => has(findings(s, "closed.md"), "WARN", /steps name no `Files:`/),
    },
    {
      name: "keepWhenClosed ignored (the one WARN that IS actionable gets silenced with the rest)",
      plans: {
        "2026-07-20-nodistill.md":
          "---\ntitle: closed, hands nothing off\nkind: system-change\nstatus: done\ncreated: 2026-07-20\n" +
          "updated: 2026-07-20\n---\n\n## The ask, verbatim\n\n> x\n\n## Goal\n\nx\n\n## Context\n\nx\n\n" +
          "## Prior art & sources\n\n- [a](https://a.example.org/x) — x\n- [b](https://b.example.net/y) — y\n\n" +
          "## Approach & tradeoffs\n\nx\n\n## Acceptance criteria\n\n- **AC-1** — Given, When, Then.\n\n" +
          "## Steps\n\n- [ ] Step 1 — do it · Files: `a/b.ts` · Test: `AC-1 (how)`\n\n## Out of scope\n\n- x\n",
      },
      // Drop the guard: now EVERY warn on a closed plan is downgraded, including the actionable one. This is the
      // over-correction the fix had to avoid, so the suite must catch it as surely as it catches the under-fix.
      apply: (s) => s.replace("if (f.keepWhenClosed) continue;", ""),
      probe: (s) => !has(findings(s, "nodistill.md"), "WARN", /no `## Decisions to distill`/),
    },
    {
      name: "the closed-plan downgrade removed (the ERROR count goes back to describing history)",
      plans: {
        "2026-07-20-closed.md":
          "---\ntitle: closed and shapeless\nkind: system-change\nstatus: done\ncreated: 2026-07-20\n" +
          "updated: 2026-07-20\n---\n\n## Goal\n\nx\n",
      },
      apply: (s) => s.replace("if (CLOSED.has(status)) {", "if (false) {"),
      probe: (s) => has(findings(s, "2026-07-20-closed.md"), "ERROR", /missing required section/),
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
    mutantsKilled += 1;
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
  "plan-audit.test.mjs — all 6 historical defects pinned (heading eats a bullet, exact anchor, synonyms, " +
    "a bold-span AC id, an italicised Test label, " +
    "inventing history), the verbatim-ask rules, step blocks, commented guidance, the checkin pair, the " +
    "proposal rules, the in-loop hook + --strict, the closed-plan LEGACY split with a live-only gate, " +
    `the execute-half block scoped to open plans, ${mutantsKilled} mutants all killed  ✅`,
);
