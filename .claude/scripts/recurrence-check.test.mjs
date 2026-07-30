// Test for recurrence-check.mjs — the tool that asks whether a mistake we already learned from is BACK.
// Run: node .claude/scripts/recurrence-check.test.mjs
//
// WHY THIS EXISTS. This script is the platform's answer to its own worst measured statistic: 29 of 224
// ledger lessons name any mechanical check at all, so the standing answer to "how do we not repeat this?"
// has been *remember harder* — against a 224-entry body of evidence that remembering harder is what fails.
//
// A detector like this fails in two ways, and the second is the one that kills it:
//   FALSE NEGATIVE — the mistake comes back and nothing says so. The script becomes decoration.
//   FALSE POSITIVE — it fires on correct documents. Then it gets muted, and the false negatives arrive free.
//
// Both are represented below, but the false-positive list is much longer, because that is where this
// script's real history is. Its first run reported 38 hits of which 34 were CLOSED PLANS faithfully
// describing a control plane that had been deleted — correct documents, flagged as rot. Later the same day
// it fired on a plan for naming, in an "Approach & tradeoffs" section, the hook that plan had just RULED
// OUT: the standard demands ≥2 options ruled out concretely, and the detector punished exactly that. Each
// exemption below is therefore a case, and each one names the mistake it came from — because the next
// person tempted to "simplify" this filter needs to see what it costs.
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
const SCRIPT = join(HERE, "recurrence-check.mjs");

const write = (p, body) => {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, body);
};

/**
 * A sandbox repo. `plan-audit.mjs` is copied in because D3 SPAWNS it to cross-check the plan count — the
 * whole design of that detector is "count the same thing two independent ways", so the second way has to
 * be really present.
 */
function sandbox(files = {}, { planAuditStub = null } = {}) {
  const root = mkdtempSync(join(tmpdir(), "recurrence-check-"));
  const scripts = join(root, ".claude", "scripts");
  mkdirSync(scripts, { recursive: true });
  copyFileSync(SCRIPT, join(scripts, "recurrence-check.mjs"));
  copyFileSync(join(HERE, "_layout.mjs"), join(scripts, "_layout.mjs"));
  if (planAuditStub === null) copyFileSync(join(HERE, "plan-audit.mjs"), join(scripts, "plan-audit.mjs"));
  else writeFileSync(join(scripts, "plan-audit.mjs"), planAuditStub);
  mkdirSync(join(root, "platform", "plans"), { recursive: true });
  for (const [rel, body] of Object.entries(files)) write(join(root, rel), body);
  return { root, scripts };
}

function run(s, args = []) {
  const r = spawnSync(process.execPath, [join(s.scripts, "recurrence-check.mjs"), ...args], {
    encoding: "utf8",
    timeout: 120_000,
    cwd: s.root,
  });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

/** The detector map from --json. */
function detectors(s) {
  const { out } = run(s, ["--json"]);
  const j = JSON.parse(out);
  return Object.fromEntries(j.detectors.map((d) => [d.id, d]));
}

const d1 = (s) => detectors(s)["stale-tool-citation"].hits;

/* ═══════════════════ 1. D1 fires on a stale instruction — in both citation shapes ══════════════ */
{
  const s = sandbox({
    "platform/standards/a-standard.md": "Run `ghost-tool.mjs` before committing.\n",
    "platform/registries/a-registry.md":
      "The sweep lives at `.claude/scripts/other-ghost.mjs` and must be run weekly.\n",
  });
  const hits = d1(s);
  assert.equal(hits.length, 2, `both shapes must be caught:\n${JSON.stringify(hits)}`);
  assert.ok(
    hits.some((h) => h.name === "ghost-tool.mjs" && h.file === "platform/standards/a-standard.md"),
    "the backticked-name form",
  );
  assert.ok(
    hits.some((h) => h.name === "other-ghost.mjs"),
    "the path form",
  );
  assert.equal(run(s).code, 1, "a firing detector must exit 1 so it can gate");
  rmSync(s.root, { recursive: true, force: true });
}

/* ═══════════════════ 2. D1's exemptions — every one from a real false positive ══════════════════ */
{
  const s = sandbox({
    // (a) the tool actually exists — plan-audit.mjs is copied into this sandbox
    "platform/standards/exists.md": "Run `plan-audit.mjs` to check a plan.\n",
    // (b) a RECORD of the past is not an instruction (34 of the first run's 38 hits were this)
    "platform/ledger/2026-06.md": "We used to run `auto-pilot.mjs` every night.\n",
    "platform/log/2026-06-01.md": "Ran `auto-pilot.mjs` and it worked.\n",
    // (c) a proposal describes something not built yet
    "platform/proposals/a-proposal.md": "It would install `future-tool.mjs`.\n",
    "platform/skill-proposals/a-skill.md": "The skill would call `future-skill-tool.mjs`.\n",
    // (d) a CLOSED plan is a record, whatever directory it is in
    "platform/plans/2026-06-01-closed.md":
      "---\ntitle: x\nstatus: done\ncreated: 2026-06-01\n---\n\nWe ran `gone-tool.mjs` nightly.\n",
    // (e) generic example names are not claims about this repo
    "platform/standards/generic.md":
      "For example `test.mjs`, `util.sh`, `config.mjs`, `index.mjs`, `evil.sh`, `y.sh` and `www.sh`.\n",
    // (f) a `.proposed` draft: the `.mjs` inside the filename is not a claim the tool exists
    "platform/standards/draft-ref.md": "See `platform/proposals/2026-07-29-thing.mjs.proposed`.\n",
    // (g) …and a name whose `.proposed` draft is on disk
    "platform/proposals/2026-07-29-staged.mjs.proposed": "// a draft\n",
    "platform/standards/staged-ref.md": "The draft for `2026-07-29-staged.mjs` is queued.\n",
    // (h) naming a tool IN ORDER TO SAY IT IS GONE is the fix, not the defect
    "platform/standards/retired.md":
      "`prior-art-check.mjs` was superseded by plan-audit.mjs in June.\n" +
      "`old-thing.mjs` is no longer installed.\n" +
      "`another.mjs` was folded in to the sweep.\n",
    // (i) naming a tool IN ORDER TO REJECT IT — the 2026-07-30 false positive on a compliant plan
    "platform/plans/2026-07-30-open.md":
      "---\ntitle: x\nstatus: active\ncreated: 2026-07-30\n---\n\n" +
      "## Approach & tradeoffs\n\n" +
      "**Ruled out — a dedicated `cadence-check.mjs` SessionStart hook.** Two clocks can disagree.\n" +
      "Also decided against `second-thing.mjs` for the same reason.\n" +
      "A third option, `never-built.mjs`, was never built.\n",
    // (j) an UNCHECKED step names a file it INTENDS to create
    "platform/plans/2026-07-30-intent.md":
      "---\ntitle: y\nstatus: active\ncreated: 2026-07-30\n---\n\n" +
      "## Steps\n\n- [ ] Step 1 — create `.claude/scripts/not-yet-written.mjs`\n",
  });

  const hits = d1(s);
  assert.deepEqual(
    hits,
    [],
    "EVERY exemption here came from a real false positive; a hit means one of them has been lost:\n" +
      JSON.stringify(hits, null, 2),
  );
  assert.equal(run(s).code, 0, "a clean run must exit 0");
  rmSync(s.root, { recursive: true, force: true });
}

/* ═══════ 3. …but a CHECKED step whose output is missing is the opposite, and must fire ══════════
 * A step marked done naming a file that is not there means the work was recorded as finished and was not.
 */
{
  const s = sandbox({
    "platform/plans/2026-07-30-claimed.md":
      "---\ntitle: y\nstatus: active\ncreated: 2026-07-30\n---\n\n" +
      "## Steps\n\n- [x] Step 1 — created `.claude/scripts/claimed-but-absent.mjs`\n",
  });
  const hits = d1(s);
  assert.equal(hits.length, 1, `a ticked step naming a missing file must fire:\n${JSON.stringify(hits)}`);
  assert.equal(hits[0].name, "claimed-but-absent.mjs");
  rmSync(s.root, { recursive: true, force: true });
}

/* ─────────────────── 4. one row per (file, tool) — a repeated citation is not louder ── */
{
  const s = sandbox({
    "platform/standards/repeated.md":
      "Run `ghost-tool.mjs`.\nThen run `ghost-tool.mjs` again.\nAnd `ghost-tool.mjs` once more.\n",
  });
  assert.equal(d1(s).length, 1, "deduped by file+tool, or one sloppy page drowns the report");
  rmSync(s.root, { recursive: true, force: true });
}

/* ═══════════════════ 5. D2 — the ledger index carrying detail again ══════════════════
 * The threshold is set from the file's MEASURED state, not the written rule, and the gap between the two is
 * reported separately rather than pretended away. A detector that fires on 108 of 224 healthy rows on the
 * day it ships is a detector nobody keeps.
 */
{
  const short = "| 2026-07-01 | a short scannable headline | [→](ledger/2026-07.md#x) |";
  const documentedOver = `| 2026-07-02 | ${"a".repeat(230)} | [→](ledger/2026-07.md#y) |`;
  const prose = `| 2026-07-03 | ${"b".repeat(500)} | [→](ledger/2026-07.md#z) |`;

  // (a) all rows healthy → clean, and no note
  const clean = sandbox({
    "platform/registries/knowledge-ledger.md": `# index\n\n| date | headline | → |\n|---|---|---|\n${short}\n`,
  });
  assert.deepEqual(detectors(clean)["ledger-index-carrying-detail"].hits, [], "a short row is fine");
  assert.doesNotMatch(run(clean).out, /note:/, "no note when nothing exceeds the documented shape");
  rmSync(clean.root, { recursive: true, force: true });

  // (b) rows past the DOCUMENTED shape but not prose → no hit, but say so
  const drifted = sandbox({
    "platform/registries/knowledge-ledger.md": `# index\n\n${short}\n${documentedOver}\n`,
  });
  assert.deepEqual(
    detectors(drifted)["ledger-index-carrying-detail"].hits,
    [],
    "230 chars is drift from the rule, not a return of the 421KB blow-up",
  );
  assert.match(
    run(drifted).out,
    /1\/2 rows exceed the documented 220-char shape but none is prose/,
    "the gap between the rule and reality must be REPORTED, not silently tolerated",
  );
  rmSync(drifted.root, { recursive: true, force: true });

  // (c) a row that is genuinely prose → fire, with the line number and length
  const blown = sandbox({
    "platform/registries/knowledge-ledger.md": `# index\n\n${short}\n${prose}\n`,
  });
  const hits = detectors(blown)["ledger-index-carrying-detail"].hits;
  assert.equal(hits.length, 1, `a 500-char row is the disease returning:\n${JSON.stringify(hits)}`);
  assert.equal(hits[0].n, 4, "the line number must be exact — it is what makes the finding actionable");
  assert.ok(hits[0].len > 400);
  rmSync(blown.root, { recursive: true, force: true });

  // (d) only INDEX rows are measured; a long prose paragraph elsewhere in the file is not a row
  const proseElsewhere = sandbox({
    "platform/registries/knowledge-ledger.md": `# index\n\n${"c".repeat(900)}\n\n${short}\n`,
  });
  assert.deepEqual(
    detectors(proseElsewhere)["ledger-index-carrying-detail"].hits,
    [],
    "the header prose of the index is not an index row",
  );
  rmSync(proseElsewhere.root, { recursive: true, force: true });

  // (e) no ledger at all → silent, not a crash
  const none = sandbox({});
  assert.deepEqual(detectors(none)["ledger-index-carrying-detail"].hits, []);
  rmSync(none.root, { recursive: true, force: true });
}

/* ═══════════════════ 6. D3 — two independent counts of the same thing must agree ══════════════
 * The 2026-07-30 folder move made four tools return smaller, TRUE-LOOKING answers with no error at all.
 * A number only one method produces cannot be wrong out loud, so this detector recounts independently.
 */
{
  // (a) agreement → silent
  const ok = sandbox({
    "platform/plans/2026-07-30-a.md": "---\ntitle: a\nstatus: active\ncreated: 2026-07-30\n---\n",
    "platform/plans/2026-07-30-b.md": "---\ntitle: b\nstatus: active\ncreated: 2026-07-30\n---\n",
  });
  assert.deepEqual(
    detectors(ok)["discovery-regression"].hits,
    [],
    "the filesystem and plan-audit must agree on a healthy tree",
  );
  rmSync(ok.root, { recursive: true, force: true });

  // (b) the tool under-reports (the exact 2026-07-30 shape: 63 plans → 0) → fire
  const blind = sandbox(
    {
      "platform/plans/2026-07-30-a.md": "---\ntitle: a\nstatus: active\ncreated: 2026-07-30\n---\n",
      "platform/plans/2026-07-30-b.md": "---\ntitle: b\nstatus: active\ncreated: 2026-07-30\n---\n",
    },
    { planAuditStub: 'console.log(JSON.stringify({ scanned: 0, errors: 0, warns: 0, results: [] }));\n' },
  );
  const hits = detectors(blind)["discovery-regression"].hits;
  assert.equal(hits.length, 1, `a discovery tool reporting 0 of 2 must be caught:\n${JSON.stringify(hits)}`);
  assert.equal(hits[0].what, "plan files");
  assert.equal(hits[0].direct, 2);
  assert.equal(hits[0].tool, 0);
  assert.match(run(blind).out, /filesystem says 2, plan-audit\.mjs findPlanFiles\(\) says 0/, "both numbers, and whose they are");
  rmSync(blind.root, { recursive: true, force: true });

  // (c) the cross-checking tool being BROKEN is not this detector's finding — it is tool-check's
  const broken = sandbox(
    { "platform/plans/2026-07-30-a.md": "---\ntitle: a\nstatus: active\ncreated: 2026-07-30\n---\n" },
    { planAuditStub: "process.exit(1);\n" },
  );
  assert.deepEqual(
    detectors(broken)["discovery-regression"].hits,
    [],
    "a crashing plan-audit must not be reported here as a discovery regression — one finding, one owner",
  );
  rmSync(broken.root, { recursive: true, force: true });
}

/* ─────────────── 7. the report must name what is covered ELSEWHERE, or this file grows a copy of it ── */
{
  const s = sandbox({});
  const { out } = run(s);
  assert.match(out, /already guarded elsewhere \(not re-checked here\)/, "the division of labour is stated");
  assert.match(out, /secret-guard\.mjs/, "…and names the guard that owns each class");
  assert.match(
    out,
    /29 of 224 ledger lessons named any check at all\. That ratio is the backlog/,
    "the measurement that justifies the whole script must stay in the output",
  );
  assert.doesNotMatch(run(s, ["--quiet"]).out, /already guarded elsewhere/, "--quiet is findings only");
  rmSync(s.root, { recursive: true, force: true });
}

/* ═══════════════════ 8. the suite must NOTICE a broken detector (mutation) ══════════════════ */
{
  // LF-normalized: on a CRLF working tree (Windows) every multi-line mutation patch below would go stale.
  const src = readFileSync(SCRIPT, "utf8").replace(/\r\n/g, "\n");

  const RECORD = {
    "platform/ledger/2026-06.md": "We used to run `auto-pilot.mjs` every night.\n",
  };
  const RETIRED = {
    "platform/standards/retired.md": "`prior-art-check.mjs` was superseded by plan-audit.mjs.\n",
  };
  const RULED_OUT = {
    "platform/standards/ruled.md": "**Ruled out — a dedicated `cadence-check.mjs` hook.**\n",
  };
  const INTENT = {
    "platform/plans/2026-07-30-intent.md":
      "---\ntitle: y\nstatus: active\ncreated: 2026-07-30\n---\n\n## Steps\n\n- [ ] Step 1 — create `.claude/scripts/not-yet.mjs`\n",
  };
  const CLOSED = {
    "platform/plans/2026-06-01-closed.md":
      "---\ntitle: x\nstatus: done\ncreated: 2026-06-01\n---\n\nWe ran `gone-tool.mjs` nightly.\n",
  };

  const mutants = [
    {
      name: "the ledger/log exemption dropped (records flagged as rot)",
      files: RECORD,
      apply: (s) =>
        s.replace(
          'if (rel.startsWith("platform/ledger/") || rel.startsWith("platform/log/"))\n        continue;',
          "",
        ),
      probe: (s) => d1(s).length === 1,
    },
    {
      name: "the closed-plan exemption dropped (34 of the first run's 38 hits)",
      files: CLOSED,
      apply: (s) =>
        s.replace(
          'if (/^status:\\s*(done|abandoned|superseded|rejected)\\b/im.test(text))\n        continue;',
          "",
        ),
      probe: (s) => d1(s).length === 1,
    },
    {
      name: "the supersession phrases dropped (repairing a citation makes it fire forever)",
      files: RETIRED,
      apply: (s) =>
        s.replace(
          "/supersed|retired|no longer|not installed|replaced by|removed|deleted|folded in/i.test(\n            line,\n          ) ||",
          "false ||",
        ),
      probe: (s) => d1(s).length === 1,
    },
    {
      name: "the ruled-out phrases dropped (the 2026-07-30 false positive returns)",
      files: RULED_OUT,
      apply: (s) =>
        s.replace(
          "/ruled out|decided against|rejected|not built|never built/i.test(line)",
          "false",
        ),
      probe: (s) => d1(s).length === 1,
    },
    {
      name: "an unchecked step treated as a citation (intent read as rot)",
      files: INTENT,
      apply: (s) => s.replace('if (/^\\s*-\\s*\\[ \\]/.test(line)) continue;', ""),
      probe: (s) => d1(s).length === 1,
    },
    {
      name: "the prose threshold dropped to 100 (fires on healthy rows)",
      files: {
        "platform/registries/knowledge-ledger.md":
          `# index\n\n| 2026-07-01 | ${"a".repeat(150)} | [→](ledger/2026-07.md#x) |\n`,
      },
      apply: (s) => s.replace("const LIMIT = 400;", "const LIMIT = 100;"),
      probe: (s) => detectors(s)["ledger-index-carrying-detail"].hits.length === 1,
    },
    {
      name: "the two-count comparison inverted (fires when they AGREE)",
      files: {
        "platform/plans/2026-07-30-a.md": "---\ntitle: a\nstatus: active\ncreated: 2026-07-30\n---\n",
      },
      apply: (s) =>
        s.replace(
          "if (auditPlans !== null && auditPlans !== directPlans)",
          "if (auditPlans !== null && auditPlans === directPlans)",
        ),
      probe: (s) => detectors(s)["discovery-regression"].hits.length === 1,
    },
    {
      name: "the gate removed (a firing detector exits 0)",
      files: { "platform/standards/a.md": "Run `ghost-tool.mjs`.\n" },
      apply: (s) => s.replace(/process\.exit\(fired\.length \? 1 : 0\);\s*$/, "process.exit(0);"),
      probe: (s) => run(s).code === 0 && d1(s).length === 1,
    },
  ];

  for (const m of mutants) {
    const s = sandbox(m.files);
    const mutated = m.apply(src);
    assert.notEqual(mutated, src, `mutation "${m.name}" changed nothing — the patch is stale`);
    writeFileSync(join(s.scripts, "recurrence-check.mjs"), mutated);

    const sanity = run(s, ["--json"]);
    let ran = false;
    try {
      ran = Array.isArray(JSON.parse(sanity.out).detectors);
    } catch {
      ran = false;
    }
    assert.ok(ran, `mutant "${m.name}" did not run — syntax error, not behaviour:\n${sanity.out.slice(0, 300)}`);

    const killed = m.probe(s);
    rmSync(s.root, { recursive: true, force: true });
    assert.ok(killed, `SURVIVING MUTANT — "${m.name}" and the suite still passed. Add a case for it.`);
  }
}

/* ─────────────── the real repo must be untouched ── */
{
  const dirty = spawnSync("git", ["status", "--porcelain"], { cwd: REPO, encoding: "utf8" }).stdout;
  assert.ok(!/ghost-tool|a-standard|knowledge-ledger\.md$/.test(dirty), `fixtures leaked:\n${dirty}`);
}

console.log(
  "recurrence-check.test.mjs — D1 both citation shapes + 10 exemptions each from a real false positive, " +
    "the ticked-step inversion, dedup, D2's three bands and its rule-vs-reality note, D3 agreement / " +
    "under-report / broken-crosschecker, the covered-elsewhere list, 8 mutants all killed  ✅",
);
