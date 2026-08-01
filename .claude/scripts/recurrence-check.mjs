#!/usr/bin/env node
// @vi WHAT: Hỏi một câu: một lỗi đã học rồi có đang xảy ra LẠI không? Hiện có 5 phép dò tự động, mỗi phép dò gắn với một bài
//   học có thật.
// @vi WHEN: Tự động trong health-sweep; và trước khi đóng một phiên vừa ghi thêm bài học mới.
// @vi WHY: Đo 2026-07-30: sổ có 224 bài học và chỉ 29 (13%) nêu được một cách kiểm tự động; known-traps có 41 bài và không
//   nêu cái nào. Nghĩa là câu trả lời cho "làm sao đừng lặp lại" gần như luôn là "ghi xuống và nhớ kỹ hơn" — trong
//   khi chính 224 bài đó là bằng chứng cách ấy không đủ.
//
/**
 * recurrence-check.mjs — is a mistake we already learned from happening AGAIN? Report-only.
 *
 * WHY THIS EXISTS. Measured 2026-07-30: the ledger holds **224 lessons and 29 of them (13%) name any
 * mechanical check**; `known-traps.md` holds 41 and names none. So the platform's answer to "how do we
 * not repeat this?" was, almost always, *write it down and remember harder* — against a body of evidence
 * (its own ledger) that remembering harder is exactly what fails. Rules warn you BEFORE; only a tool can
 * tell you the mistake is back.
 *
 * THE DIVISION OF LABOUR, so this file does not grow into a second copy of the hook layer:
 *   - a mistake catchable AT THE MOMENT OF THE WRITE belongs in a hook (secret-guard, invariant-warn,
 *     legibility-lint, plan-audit --hook). Those are listed below as COVERED and never re-implemented here.
 *   - a mistake only visible ACROSS the repo or ACROSS time — a citation that went stale, an index that
 *     drifted back into prose, a tool that quietly stopped finding things — has no single write to hook.
 *     That is what this script checks, and it is the reason it exists at all.
 *
 * EVERY DETECTOR HERE COMES FROM A MISTAKE THAT ACTUALLY HAPPENED. None are hypothetical, and each names
 * the day it was learned. A detector for a mistake nobody has made is how a checker becomes noise.
 *
 * Usage:
 *   node .claude/scripts/recurrence-check.mjs          # run the detectors, then report coverage
 *   node .claude/scripts/recurrence-check.mjs --quiet    # findings only
 *   node .claude/scripts/recurrence-check.mjs --json
 *
 * Exit code: 1 if any detector fires (so it can gate), 0 when clean. Coverage gaps never fail the run.
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, resolve, dirname, relative, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { projectRoots, gitRepos, posix, printWorktreeCaveat } from "./_layout.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const JSON_OUT = process.argv.includes("--json");
const QUIET = process.argv.includes("--quiet");

const walk = (dir, out = []) => {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".git") continue;
    const p = join(dir, e.name);
    e.isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
};

const docs = () =>
  [...walk(join(REPO, "platform")), ...walk(join(REPO, ".claude"))].filter(
    (f) => f.endsWith(".md"),
  );

/* ─────────────────────────────────────────────────────────────────────────────── the detectors ── */

const detectors = [];

/**
 * D1 — a document names a tool that no longer exists.
 * LEARNED 2026-07-30: five files (including the plan TEMPLATE, the autonomy contract and a memory file)
 * still told the reader to rely on `prior-art-check.mjs`, which had been folded into `plan-audit.mjs` in
 * June. Nothing was broken — which is the point: a stale instruction fails silently, by being followed.
 */
detectors.push({
  id: "stale-tool-citation",
  learned: "2026-07-30",
  what: "a document tells the reader to use a script that is not on disk",
  run() {
    const onDisk = new Set(walk(REPO).map((f) => basename(f)));
    // Only citations that look like an instruction: a path, or a name in backticks. Bare prose like
    // "test.mjs" in an example is not a claim about this repo.
    const cite =
      /[`(]([a-z0-9][a-z0-9._-]*\.(?:mjs|sh|ps1))[`)]|((?:\.claude|platform)\/[\w./-]+\.(?:mjs|sh|ps1))/g;
    const hits = [];
    for (const f of docs()) {
      const rel = posix(relative(REPO, f));
      // A record of the past is not an instruction, and neither is a proposal for something not built yet.
      // First cut of this detector reported 38 hits, of which 34 were closed plans faithfully describing the
      // auto-pilot control plane that was DELETED on 2026-07-28 — correct documents, flagged as rot. The
      // filter is the same one the July rename used for `sed`: history and proposals are out of scope.
      if (rel.startsWith("platform/ledger/") || rel.startsWith("platform/log/"))
        continue;
      if (
        rel.startsWith("platform/proposals/") ||
        rel.startsWith("platform/skill-proposals/")
      )
        continue;
      const text = readFileSync(f, "utf8");
      if (/^status:\s*(done|abandoned|superseded|rejected)\b/im.test(text))
        continue; // a closed plan is a record
      for (const m of text.matchAll(cite)) {
        const raw = m[1] || m[2];
        const name = basename(raw);
        if (onDisk.has(name)) continue;
        if (/^(test|util|config|index|evil|y|www)\.(mjs|sh)$/.test(name))
          continue; // generic example names
        // A proposal file is `<name>.mjs.proposed`: the `.mjs` inside it is not a claim that `<name>.mjs`
        // exists. The detector's own first run reported this as drift — a checker gets audited too.
        // OFF-BY-ONE, found by recurrence-check.test.mjs on 2026-07-30. This used to slice from
        // `+ m[0].length - 1`, i.e. from the LAST character of the match, so the comparison was against
        // "s.proposed" and could never be true — dead code. It went unnoticed because the on-disk check on
        // the next line covers every draft that exists in this repo; the gap only shows when a document
        // cites a `.proposed` draft that lives somewhere else, which is a false positive nobody had hit yet.
        if (text.slice(m.index + m[0].length).startsWith(".proposed")) continue;
        if (onDisk.has(`${name}.proposed`)) continue;
        // A document that names the tool IN ORDER TO SAY it is gone is the fix, not the defect. Without
        // this, repairing a stale citation by explaining the supersession makes the detector fire forever
        // — and a check that cannot be satisfied gets muted. Scoped to the sentence, not the file, so a
        // page can retire one tool and still be caught recommending another.
        const lineStart = text.lastIndexOf("\n", m.index) + 1;
        const lineEnd = text.indexOf("\n", m.index);
        const line = text.slice(
          lineStart,
          lineEnd === -1 ? undefined : lineEnd,
        );
        // The second family: a tool named IN ORDER TO REJECT IT. An "Approach & tradeoffs" section that says
        // "ruled out — a dedicated `cadence-check.mjs` hook, because …" is doing exactly what the plan standard
        // asks for (≥2 options ruled out, named concretely). Firing on it would punish the best available
        // documentation and push authors toward vague alternatives nobody can evaluate — found 2026-07-30, when
        // this detector fired on the very plan that ruled the tool out.
        if (
          /supersed|retired|no longer|not installed|replaced by|removed|deleted|folded in/i.test(
            line,
          ) ||
          /ruled out|decided against|rejected|not built|never built/i.test(line)
        )
          continue;
        // An UNCHECKED plan step names a file it intends to create — intent, not a stale citation. A
        // CHECKED one naming a missing file is the opposite: a step marked done whose output is not there,
        // which is worth every bit of the alarm. So the box matters, and only `[ ]` is excused.
        if (/^\s*-\s*\[ \]/.test(line)) continue;
        hits.push({ file: rel, name });
      }
    }
    // One row per (file, tool) pair, deduped.
    const seen = new Set();
    return hits.filter((h) => {
      const k = `${h.file}|${h.name}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  },
  format: (h) => `${h.file} → ${h.name}`,
});

/**
 * D2 — the ledger INDEX is carrying detail again.
 * LEARNED 2026-07-28: the rule "the index is one scannable row, the detail lives in the month file" held
 * from day one and eroded anyway — the index reached 421KB (~105K tokens) with single rows over 2,500
 * characters, and had to be split by a script. Prose rules erode; this is the measurement that says so.
 */
detectors.push({
  id: "ledger-index-carrying-detail",
  learned: "2026-07-28",
  what: "a knowledge-ledger index row has grown past a scannable headline",
  run() {
    const p = join(REPO, "platform/registries/knowledge-ledger.md");
    if (!existsSync(p)) return [];
    /*
     * LIMIT is set from the file's own measured state, not from the written rule, and the difference is
     * itself a finding. The standard says "headline ≤120 chars"; after the 2026-07-28 mechanical split the
     * 224 accepted rows run 70–246 chars (median 222). A detector at 220 would have fired on 108 of them
     * on the day it was written — the fastest way to make a check ignored. So it fires at 400, which no
     * healthy row approaches and every pre-split row (2,500+) blew past, and it reports the gap between
     * the rule and reality separately instead of pretending one of them does not exist.
     */
    const LIMIT = 400;
    const DOCUMENTED = 120 + 100; // headline cap + a generous allowance for the date cell and the link
    const rows = readFileSync(p, "utf8")
      .split("\n")
      .map((line, i) => ({ line, n: i + 1 }))
      .filter(({ line }) => /^\|\s*20\d\d-/.test(line));
    const over = rows.filter((r) => r.line.length > DOCUMENTED).length;
    const hits = rows
      .filter((r) => r.line.length > LIMIT)
      .map(({ line, n }) => ({ n, len: line.length, head: line.slice(0, 70) }));
    if (over && !hits.length)
      hits.note = `${over}/${rows.length} rows exceed the documented ${DOCUMENTED}-char shape but none is prose — drift from the rule, not a return of the 2026-07 blow-up`;
    return hits;
  },
  format: (h) => `line ${h.n}: ${h.len} chars — ${h.head}…`,
});

/**
 * D3 — a discovery tool has quietly stopped finding things.
 * LEARNED 2026-07-30: moving nine repos into `projects/` made four tools return smaller, true-LOOKING
 * answers with no error at all (13 git repos → 4; 63 plans → 0; 22 duplicate groups → 0). The check is
 * deliberately not a stored baseline, which would go stale: it counts the same thing a second, independent
 * way and asserts the two agree. A number that only one method produces cannot be wrong out loud.
 */
detectors.push({
  id: "discovery-regression",
  learned: "2026-07-30",
  what: "a tool that enumerates the fleet disagrees with a direct filesystem count",
  run() {
    const out = [];
    // git repos: walk the tree ourselves (2 levels) vs what _layout reports
    const direct = [];
    const scan = (dir, depth) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (
          !e.isDirectory() ||
          e.name.startsWith(".") ||
          e.name === "node_modules"
        )
          continue;
        const full = join(dir, e.name);
        if (existsSync(join(full, ".git"))) direct.push(full);
        else if (depth < 2) scan(full, depth + 1);
      }
    };
    scan(REPO, 1);
    if (existsSync(join(REPO, ".git"))) direct.push(REPO);
    const viaLayout = gitRepos(REPO).length;
    if (direct.length !== viaLayout)
      out.push({
        what: "git repos",
        direct: direct.length,
        tool: viaLayout,
        tip: "_layout.mjs projectRoots()",
      });

    // plan files: find them directly vs what plan-audit reports it scanned
    const directPlans = [
      ...(existsSync(join(REPO, "platform/plans"))
        ? readdirSync(join(REPO, "platform/plans")).filter((f) =>
            f.endsWith(".md"),
          )
        : []),
      ...projectRoots(REPO).flatMap((p) => {
        const d = join(p.dir, "docs", "plans");
        return existsSync(d)
          ? readdirSync(d).filter(
              (f) => f.endsWith(".md") && !f.startsWith("_"),
            )
          : [];
      }),
    ].length;
    let auditPlans = null;
    try {
      const r = execSyncQuiet(
        `node ${JSON.stringify(join(REPO, ".claude/scripts/plan-audit.mjs"))} --json`,
      );
      auditPlans = JSON.parse(r).scanned ?? null;
    } catch {
      /* the audit failing is its own problem, reported by tool-check */
    }
    if (auditPlans !== null && auditPlans !== directPlans)
      out.push({
        what: "plan files",
        direct: directPlans,
        tool: auditPlans,
        tip: "plan-audit.mjs findPlanFiles()",
      });
    return out;
  },
  format: (h) =>
    `${h.what}: filesystem says ${h.direct}, ${h.tip} says ${h.tool}`,
});

/**
 * D4 — a mutation suite that never checks whether its mutant could RUN.
 * LEARNED 2026-07-30, five times in one day across five different suites and three different mechanisms:
 * `if (false)` on a branch whose successor dereferenced the null it was guarding; an unbalanced-paren patch;
 * a temporal-dead-zone reference. Each time the mutant crashed, the probe saw "not the healthy output", and
 * the suite reported a killed mutant. **A mutant that only crashes proves the suite notices a broken file —
 * it says nothing about the behaviour the mutant claimed to remove.** So a green mutation run can certify
 * nothing at all, which is the worst possible failure in the one mechanism that exists to prove a check can
 * fail (`standards/testing.md §2.5`).
 *
 * WHY IT COMPARES TO A BASELINE instead of firing on every offender. Measured the day it was written: 11 of
 * 22 mutation suites gate on this, 11 do not — all 11 predate the lesson. Firing on all 11 would put
 * `health-sweep` into BROKEN on day one over a known backlog, and a checker that starts red is a checker
 * people mute. So the backlog is DECLARED here with its date, and the detector fires only when the number
 * GOES UP: a new suite written without the gate is a repeat of the mistake, while the existing 11 are work
 * queued in the open. Close them and lower the baseline in the same commit.
 */
detectors.push({
  id: "crash-only-mutants-unguarded",
  learned: "2026-07-30",
  what: "a mutation suite does not assert its mutant still RUNS, so a crash can be miscounted as a kill",
  run() {
    // Measured by this detector itself on 2026-07-30: 11 of 22 mutation suites, all predating the lesson.
    // The first draft said 9 — an eyeballed count of a shell listing, wrong by two. The number a check
    // gates on has to come from the check (memory: report-state-from-the-tool).
    const BASELINE = 11;
    const GATE =
      /crashed instead of|did not run —|mayCrash|syntax error, not|it is a syntax error/;
    const suites = walk(join(REPO, ".claude")).filter((f) =>
      f.endsWith(".test.mjs"),
    );
    const mutating = [];
    const unguarded = [];
    for (const f of suites) {
      let text = "";
      try {
        text = readFileSync(f, "utf8");
      } catch {
        continue;
      }
      if (!/SURVIVING MUTANT/.test(text)) continue; // not a mutation suite
      mutating.push(f);
      if (!GATE.test(text)) unguarded.push(posix(relative(REPO, f)));
    }
    const hits =
      unguarded.length > BASELINE
        ? unguarded.map((file) => ({ file, over: unguarded.length - BASELINE }))
        : [];
    if (!hits.length && unguarded.length)
      hits.note =
        `${unguarded.length}/${mutating.length} mutation suites do not assert the mutant still runs ` +
        `(declared backlog, baseline ${BASELINE} on 2026-07-30) — a crash-only mutant proves nothing. ` +
        `Fires only if this number rises; lower the baseline as they are closed.`;
    return hits;
  },
  format: (h) => `${h.file} — ${h.over} suite(s) over the declared baseline`,
});

/**
 * D5 — a plan says `status: done` while still carrying unticked steps.
 * LEARNED 2026-07-30. The fleet-rename plan was `status: done` with `D3c` unticked, and its text — "the
 * GitHub repo is still `thiengthb/miniserver-platform`" — was read by a later session, repeated to the user
 * as current state, and used to offer them work. One `gh repo view` disproved it: the repo had been renamed
 * the day before. **An unticked box in a closed plan is not a to-do, it is an assertion about the world,
 * and it keeps asserting long after it stops being true.** The same shape as
 * `#2026-07-29-a-handoff-whose-missed-half-is-self-healing-shaped` (a half-done handoff that fails quietly)
 * and a second instance of the memory `report-state-from-the-tool` — which is why this is a detector rather
 * than a fourth restatement of "measure, don't recite".
 *
 * BASELINE, for the same reason as D4: 4 of 66 plans trip it today, all predating the lesson, and one of
 * them (`2026-07-30-tool-test-coverage`) is a *deliberately named* partial. Firing on all four would start
 * the checker red. It fires when the number RISES; close them and lower the baseline in the same commit.
 * The fix for an offender is one of: tick it, delete it, or move it to `## Open questions` where an open
 * item belongs and cannot read as a closed plan's leftover.
 */
detectors.push({
  id: "done-plan-with-unticked-steps",
  learned: "2026-07-30",
  what: "a plan marked done still carries unticked steps, whose text then gets quoted as current state",
  run() {
    const BASELINE = 4; // measured by this detector on 2026-07-30: 4 of 66 plans
    const offenders = [];
    let plans = 0;
    for (const f of walk(join(REPO, "platform", "plans")).filter((f) =>
      f.endsWith(".md"),
    )) {
      let text = "";
      try {
        text = readFileSync(f, "utf8");
      } catch {
        continue;
      }
      const status = /^status:\s*([^\s#]+)/m.exec(text)?.[1];
      if (!status) continue;
      plans++;
      if (status !== "done") continue;
      const open = (text.match(/^- \[ \]/gm) || []).length;
      if (open) offenders.push({ file: posix(relative(REPO, f)), open });
    }
    const hits =
      offenders.length > BASELINE
        ? offenders.map((o) => ({ ...o, over: offenders.length - BASELINE }))
        : [];
    if (!hits.length && offenders.length)
      hits.note =
        `${offenders.length}/${plans} plans are marked done with unticked steps (declared backlog, ` +
        `baseline ${BASELINE} on 2026-07-30) — an unticked box in a closed plan asserts a state nobody ` +
        `re-measures. Fires only if this number rises; lower the baseline as they are closed.`;
    return hits;
  },
  format: (h) =>
    `${h.file} — ${h.open} unticked step(s) in a plan marked done (${h.over} over the declared baseline)`,
});

/* ───────────────────────────────────────────────────────────────────────────────────────── D6 ──
 * "I could not look" must never be returned as "there is nothing there."
 *
 * THREE instances in one day (2026-07-31), in three different tools, each producing a confident wrong answer
 * rather than an error:
 *   · `platform-report` — a git-log spawn that threw on Windows, caught, returning an empty history map, so
 *     EVERY age in the repo read as unknown and unknown age drifts a file toward WATCH.
 *   · `attic` — a shell `grep` that cannot run under cmd.exe, caught, returning no mentions, so the guard
 *     against a wrongful retirement answered "nobody references this file" every single time.
 *   · `reuse-scan` — a canonical registry read from a path that did not exist, returning an empty Set, so
 *     eleven artifacts that already live in `commons` were reported as EXTRACT.
 * Third instance ⇒ this stops being a lesson and becomes a check (skill `/session-wrap` Step 4b).
 *
 * WHAT IS FLAGGED, deliberately narrow. Only a `catch` that returns an **empty COLLECTION** and says nothing:
 * an empty array / Set / Map / object, or a variable initialised as one. That is the shape a caller cannot
 * distinguish from real data. NOT flagged: a catch that returns `null` or `""` (a sentinel the caller has to
 * handle), and not one that speaks — `die`, `throw`, `process.exit` or a `console` line. Measured against all
 * 44 silent catches in the tool tree, that narrowing leaves exactly the dangerous ones: 4 candidates, of which
 * 3 were sentinels or already disclosing, and the 1 real hit was the `platform-report` history map, fixed in
 * the same commit as this detector. Hence a baseline of ZERO — a new one is a finding, not a backlog item.
 */
detectors.push({
  id: "silent-empty-on-failure",
  learned: "2026-07-31",
  what: "a catch that returns an empty collection, so 'I could not look' is read downstream as 'nothing is there'",
  run() {
    const hits = [];
    for (const dir of ["scripts", "hooks"]) {
      const base = join(REPO, ".claude", dir);
      if (!existsSync(base)) continue;
      for (const name of readdirSync(base)) {
        if (!name.endsWith(".mjs") || name.endsWith(".test.mjs")) continue;
        const file = join(base, name);
        let src = "";
        try {
          src = readFileSync(file, "utf8");
        } catch {
          continue;
        }
        const re = /catch\s*(?:\([^)]*\))?\s*\{([\s\S]*?)\}/g;
        let m;
        while ((m = re.exec(src))) {
          const body = m[1];
          // Anything that SPEAKS is fine — the caller is told the difference.
          if (/die\(|throw |process\.exit|console\./.test(body)) continue;
          const ret =
            /return\s*(\[\s*\]|new Set\(\s*\)|new Map\(\s*\)|\{\s*\}|[A-Za-z_$][\w$]*)\s*;/.exec(
              body,
            );
          if (!ret) continue;
          const what = ret[1];
          // A bare identifier only counts when it was declared as an empty collection nearby — otherwise this
          // would flag every `return cached;`.
          if (/^[A-Za-z_$][\w$]*$/.test(what)) {
            const decl = new RegExp(
              `(?:const|let)\\s+${what}\\s*=\\s*(?:\\[\\s*\\]|new Set\\(\\s*\\)|new Map\\(\\s*\\)|\\{\\s*\\})`,
            );
            if (!decl.test(src.slice(0, m.index))) continue;
          }
          hits.push({
            file: posix(relative(REPO, file)),
            line: src.slice(0, m.index).split(/\r?\n/).length,
            returns: what,
          });
        }
      }
    }
    return hits;
  },
  format: (h) =>
    `${h.file}:${h.line} — a caught failure returns the empty \`${h.returns}\` and says nothing; the caller ` +
    `cannot tell "nothing found" from "the check did not run". Print the reason (or die), then return.`,
});

/* ───────────────────────────────────────────────────────────────────────────────────────── D7 ──
 *
 * "A control arm can be confounded into always agreeing" was written into the ledger on **2026-07-27**, worded
 * correctly, and on **2026-08-01** a single eval walked into it **three times**: the success path needed a shell
 * command the spawn denied (published as NULL/NEGATIVE — a false null that would have demoted a real rule), then
 * the control arm was handed the answer in `CLAUDE.md`, then again in the prompt. Four runs of the instrument to
 * get one usable comparison.
 *
 * `/behavioural-eval` rule 3 already said it. Prose lost, so this is the check the fourth occurrence owes
 * (`/session-wrap` Step 4b). It asks the one question nobody asks: **can the compliant arm even comply?**
 *
 * Deliberately keyed on the TEST file, not the eval: the claim has to be an assertion somebody runs, not a
 * sentence in a header. And deliberately loose about HOW — the three evals answer it three different ways (no
 * tool needed · file edits only · a permitted command) — because a detector that dictated the mechanism would be
 * wrong for two of the three. Measured at 0 firing when shipped, after adding the missing case to two suites.
 */
detectors.push({
  id: "eval-with-no-reachability-assertion",
  learned: "2026-08-01",
  what: "a model-in-the-loop eval never asserts that its own success path is reachable, so a null may be an artefact",
  run() {
    const hits = [];
    for (const f of walk(join(REPO, ".claude", "scripts"))) {
      const rel = posix(relative(REPO, f));
      if (!/\/eval-[\w-]+\.mjs$/.test(rel) || rel.endsWith(".test.mjs")) continue;
      const test = f.replace(/\.mjs$/, ".test.mjs");
      if (!existsSync(test)) {
        hits.push({ file: rel, why: "has no test file at all, so nothing asserts its success path is reachable" });
        continue;
      }
      if (!/reachab/i.test(readFileSync(test, "utf8"))) {
        hits.push({ file: posix(relative(REPO, test)), why: "no case mentions reachability of the success path" });
      }
    }
    return hits;
  },
  format: (h) =>
    `${h.file} — ${h.why}. Add a case proving the compliant arm CAN comply (a permitted command, an existing ` +
    `write target, or "success needs no tool"). Without it a NULL result cannot be told from a denied tool.`,
});

const execSyncQuiet = (cmd) =>
  execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });

/* ───────────────────────────────────────────────── what is already enforced somewhere else ── */

/**
 * Lesson classes that DO have a mechanical guard, so this script stays out of their way. Kept here rather
 * than in a fourth registry: the point of the list is to be read next to the detectors, and a separate
 * file would drift from both.
 */
const COVERED = [
  [
    "a hardcoded secret outside .env",
    "secret-guard.mjs (+ its test, 2026-07-30)",
  ],
  [
    "certbot / self-hosted runner / published host ports",
    "invariant-warn.mjs (+ its test, 2026-07-30)",
  ],
  ["the agent editing its own governance unattended", "autonomy-gate.mjs"],
  ["a plan with a check-in date but no runbook", "plan-checkin.mjs"],
  [
    "a plan missing prior art, acceptance criteria, or the verbatim ask",
    "plan-audit.mjs --hook",
  ],
  [
    "jargon with no plain gloss; an option list with no recommendation",
    "legibility-lint.mjs",
  ],
  ["memory index drift, orphans, cap breach", "memory-audit.mjs"],
  ["the same artefact built in three projects", "reuse-scan.mjs"],
  ["deleting something on one number instead of two", "usage-census.mjs"],
  [
    "a guard that was never proved able to fail",
    "tool-check.mjs + §2.5 mutation testing",
  ],
];

/* ──────────────────────────────────────────────────────────────────────────────────── report ── */

const results = detectors.map((d) => ({
  id: d.id,
  learned: d.learned,
  what: d.what,
  hits: d.run(),
  format: d.format,
}));
const fired = results.filter((r) => r.hits.length);

if (JSON_OUT) {
  console.log(
    JSON.stringify(
      {
        detectors: results.map(({ id, learned, what, hits }) => ({
          id,
          learned,
          what,
          hits,
        })),
        covered: COVERED,
      },
      null,
      2,
    ),
  );
  process.exit(fired.length ? 1 : 0);
}

// Measured 2026-08-01: 0 firing in the main tree, **1 firing** inside a worktree — `stale-tool-citation`
// scores 3 HIT because the documents that cite those tools live in sibling repos the worktree does not have.
// A fabricated recurrence is the most expensive false positive this tool can produce: its whole contract is
// "a mistake we already recorded has come back", so a fake one sends someone re-fixing something that is fine.
printWorktreeCaveat(REPO);
console.log(
  `recurrence-check — ${detectors.length} detector(s), ${fired.length} firing\n`,
);
for (const r of results) {
  const tag = r.hits.length ? `${r.hits.length} HIT` : "clean";
  console.log(`── ${r.id}  [${tag}]  (learned ${r.learned})`);
  if (!QUIET) console.log(`   ${r.what}`);
  for (const h of r.hits) console.log(`   • ${r.format(h)}`);
  if (r.hits.note) console.log(`   note: ${r.hits.note}`);
  console.log("");
}

if (!QUIET) {
  console.log(`── already guarded elsewhere (not re-checked here):`);
  for (const [lesson, by] of COVERED)
    console.log(`   ${lesson}\n      → ${by}`);
  console.log(`
THE RULE THIS SCRIPT SERVES. A lesson written down twice has already proved that writing it down does not
work. The second time, it gets a guard — a hook if there is a write to catch it at, a detector here if the
evidence only shows up across the repo or across time — or the plan says out loud why it cannot have one.
Measured 2026-07-30: 29 of 224 ledger lessons named any check at all. That ratio is the backlog.`);
}

process.exit(fired.length ? 1 : 0);
