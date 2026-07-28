---
title: Build — MCP platform server: tier-2 rule delivery (verdict, not rulebook) + quarantined lesson backflow
kind: system-change # feature | system-change | fix | refactor | chore
status: active # draft → active → done | abandoned — supervisor approved 2026-07-29, Phase 1 authorized
created: 2026-07-29
updated: 2026-07-29
related:
  [
    platform/plans/2026-07-28-idea-0023-mcp-platform-server-proposal.md (the ACCEPTED RFC — sources · options · pre-mortem · counter-case),
    platform/registries/idea-queue.md (idea-0023 accepted 2026-07-28; idea-0013 is ARMED by this plan),
    platform/plans/2026-07-28-fleet-rename-and-restructure.md (gate 1 — done; rewrote every path this build references),
    .claude/scripts/rule-classify.mjs (Step 0's kill-switch — PASS 58.9%; its labels are this build's input),
    .claude/scripts/rule-classify-sample.json (the hand-labelled data file — which rules are tier-2),
    .claude/rules/frontend.md (the rulebook slice the thin slice enforces),
    platform/standards/ui-layout.md (PageShell std — the second rule source for review_component),
    platform/registries/shared-assets.md (row 1 — the MCP OAuth shim, DUPLICATED 2×; this is the 3rd consumer),
    platform/targets/cloud/README.md (written 2026-07-28, NOT yet exercised — Phase 4 is its first exercise),
    platform/inventory.md (§0 — gains a row when the server exists),
    .claude/hooks/autonomy-gate.mjs (governance — the quarantine path must join its block list; agent PROPOSES only),
  ]
checkin: 2026-08-12 # 2 weeks after the thin slice — "built and then never used" is this platform's named failure mode
checkin_every: 14d
checkin_owner: agent
---

<!--
  Forward-looking roadmap. The retrospective "why" is distilled into decisions.md / the ledger at /session-wrap.
  Standard: platform/standards/documentation.md §5.5. Keep the checklist in sync as you execute.
-->

## Goal

A second project on this machine, holding **only a ~6-line `.mcp.json`**, receives a real frontend-rule violation from
this platform's MCP server — and the rule text that produced it **never appears on that project's disk or in its
transcript**. Plus: one lesson reported from that project lands in a quarantine inbox that **no subsequent session can
read** until a human promotes it.

That is the whole of "done" for Phases 1–2. Hosting, auth and the rest of the rulebook are scoped here but deliberately
not built until the thin slice has run (§Phase 4).

## Context

`idea-0023` was **accepted 2026-07-28** (Option A). Graduation was sequenced behind two gates, both now clear:
the `fleet` rename landed (it rewrote every path this build references), and **Step 0's kill-switch PASSED** —
58.9% of the rulebook is verification-shaped (95% CI ≈ 46–72%, n=56 of 515 rule statements), above the pre-committed
40% floor. The NUC is down since 2026-07-22, so "the platform assumes one machine" is not a hypothetical.

## Prior art & sources

Carried from the accepted proposal (full annotations there — not restated here, per the anti-duplication rule):

- [Claude Code — MCP](https://code.claude.com/docs/en/mcp) — remote `type: "http"` in project-scope `.mcp.json`,
  `${VAR}` in `headers`, server-pushed `instructions`, `list_changed`. **Avoid:** assuming a committed `.mcp.json` is
  auto-trusted — it sits at `⏸ Pending approval` in an untrusted folder, which is a *Step 1.4 test case*, not a footnote.
- [Claude Code — plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces) — the only way to ship hooks
  (local executables). **Avoid:** treating it as confidentiality — installed plugins sit readable at `~/.claude/plugins/`.
- [Claude Code — agent teams](https://code.claude.com/docs/en/agent-teams) — teammates load MCP servers like a regular
  session, so an MCP-delivered ruleset reaches every teammate while the lead's conversation does not.
- [Claude Code — security](https://code.claude.com/docs/en/security) — **cuts against us**: our backflow channel makes
  *us* the consumer of untrusted input. Phase 2 is designed around this, not despite it.

**In-repo (binding):** `registries/shared-assets.md` row 1 — the MCP self-issued OAuth shim is `DUPLICATED — extract at
the 3rd app`. **This server is the third app**, so `idea-0013` fires — but for **Phase 4, not Phase 1** (see below).

## Approach & tradeoffs

**Three design calls this plan makes that the proposal left open.** Each is the kind of thing that is cheap now and
expensive after the code exists.

### A. The server is **co-located** with the rulebook (`fleet/rulebook/`) — its own repo, same folder

It reads `platform/**` and `.claude/rules/**` straight off disk via `../`. A project that had to *fetch* the rulebook
would nest a distribution problem inside the distribution solution, and drift is then guaranteed. When Phase 4 moves it
to `cloud`, CI bakes the rulebook into the image at build time (the pattern `/code-reuse` already prescribes for
`@thiengthb/*`). **Ruled out:** folding it into `commons` (commons works by being *installed*; rules are *read*, and
`shared-assets.md` already says rules do not move there); a project living somewhere else entirely (needs a sync job
nobody would maintain).

> **CORRECTED 2026-07-29, at Step 1.3, by trying to commit it.** This section first said "*inside this repo*" — the
> same git repo as `platform/`. That is wrong, and `.gitignore` said so immediately: `fleet/` is an **allowlist** repo
> tracking only the meta layer (`/*` then `!/platform/`, `!/.claude/`, `!/CLAUDE.md`), because **every app here is a
> deliberately independent git repo** — verified: `sakubun`, `todo`, `commons`, `journal` each have their own remote.
> `rulebook/` was silently untracked.
>
> The error was conflating two things that sounded like one: **co-location** (same parent folder ⇒ reads the rulebook
> off disk with no sync — the actual requirement) and **co-versioning** (same git repo — what I wrote, and what the
> layout forbids). Co-location delivers the entire benefit. `rulebook` is now its own repo at `fleet/rulebook/`, like
> every sibling, with the convention `commit-msg` + `pre-commit` hooks installed at init.
>
> Worth keeping because of *how* it was caught: not by review, and not by re-reading `.gitignore`, but by the build
> failing to commit. A design doc cannot notice that it disagrees with a repo layout; ten minutes of thin slice can.

**Name settled here rather than at Step 1.3:** `rulebook`, not `fleet-mcp`. It names what the thing serves rather than
the transport it happens to use (Phase 4 adds a plugin marketplace beside MCP, and the name should survive that), and
it survives the folder/remote disagreement the placeholder name would have inherited. Precedent: `commons`.

### B. `review_component` is **deterministic**, not an LLM call — for the thin slice

Step 0's finding is sharper than "58.9% passes": the verification-shaped half is precisely the **artifact-decidable**
half — icon set, hardcoded colors, `forwardRef`, `dangerouslySetInnerHTML`, Server Action authz, secrets in the client
bundle. Those are checkable with a parser and no model. That buys determinism, zero token cost, an auditable verdict —
and it keeps the confidentiality claim honest: **an LLM checker would send the rule text to a third-party API**, which
is a different security story than "the rules never leave the server". **Ruled out:** server-side LLM review (Phase 4
question, once there is evidence the deterministic half is insufficient); shipping the rules to the client to check
locally (that is tier 1 — the thing this design exists to avoid).

### C. Degraded mode = **fail-open with an unsuppressible warning**, and it is recorded

The pre-mortem left this genuinely open. Decision: a review that cannot run must not stop someone writing code — an
outage would become a work stoppage, and the copy-based model we are replacing has no such failure. But fail-open is
only honest if the failure is *visible*: the tool returns an explicit `degraded: true` verdict, never a silent pass.
**Ruled out:** fail-closed (turns our uptime into everyone's uptime); silent fail-open (a green that means nothing is
worse than a red — the platform's own ledger says this).

### Sequencing: `idea-0013` is a Phase-4 prerequisite, **not a Phase-1 one**

The proposal called the OAuth-shim extraction a prerequisite. Precisely: it blocks **exposing the server off-machine**.
Phase 1 runs on `localhost` against a scratch project with no auth at all, so requiring the extraction first would
invert thin-slice-first and delay the only step that can still falsify the design.

## Acceptance criteria (Given / When / Then)

- **AC-1** — *(the verdict travels, the rule does not)* — Given a scratch project on this machine holding only a
  `.mcp.json` pointing at the server, When it calls `review_component` on a component that uses an emoji as an icon and
  a hardcoded hex color, Then it receives a violation naming the line and the required fix, **and** a grep of that
  project's disk + its session transcript (`~/.claude/projects/*/*.jsonl`) finds **zero** verbatim sentences from
  `.claude/rules/frontend.md`.
- **AC-2** — *(clean code passes, and the checker is not a rubber stamp)* — Given a component that satisfies the same
  rules, When reviewed, Then zero violations — and the suite contains at least one **mutation case** per rule (flip the
  compliant fixture, assert the violation appears), so a checker that always returns "clean" fails the tests.
- **AC-3** — *(the server can update the client's instructions without touching the client repo)* — Given the consuming
  project's files are unchanged, When the server's `instructions` block is edited and the client reconnects, Then the
  new text is in effect.
- **AC-4** — *(untrusted-folder reality)* — Given a *fresh* untrusted folder with a committed `.mcp.json`, When a session
  starts, Then the server shows `⏸ Pending approval` and delivers nothing until approved — documented as the real
  onboarding step, not discovered later.
- **AC-5** — *(quarantine is a wall, not a convention)* — Given a lesson submitted via `report_lesson`, When any subsequent
  session runs, Then the lesson is not in any auto-loaded path, and a write that would move it into `.claude/**`,
  `platform/standards/**` or a `CLAUDE.md` is **blocked by `autonomy-gate.mjs`** — verified by a test that attempts it.
- **AC-6** — *(degraded is loud)* — Given the server is unreachable, When `review_component` is called, Then the client
  receives an explicit degraded/unavailable result, never an empty-violations "clean".

## Steps

**Phase 1 — the thin slice (localhost, no auth, no hosting). Build → run → observe before any governance or docs work.**

- [x] 1.1 — **DONE 2026-07-29.** 9 tier-2 frontend rules extracted as data (`icon-set`, `emoji-as-icon`,
      `hardcoded-color`, `forward-ref`, `dangerous-html`, `toast-library`, `client-secret`, `animated-property`,
      `debug-logging`), each with the file kinds it applies to and a severity. Step 0's `class: "V"` was used as the
      **criterion**, not as the list — the 60-line sample is a measurement draw, not a rulebook. The file carries the
      one constraint that makes this tier 2: `message`/`fix` are DERIVED verdicts, never a rulebook sentence ·
      Files: Created `rulebook/rules/frontend.rules.ts` · Test: `AC-2` ✅
- [x] 1.2 — **DONE 2026-07-29.** `checkComponent(source, {filename}) → Violation[]` — pure, no I/O, no model, no deps.
      Comments are blanked (preserving line/column) before matching. **33 tests, tsc clean, prettier clean.** Structure
      per rule: compliant fixture · mutation · near-miss. A meta-test fails if any declared rule has no firing case, so
      the rule list and the suite cannot drift apart; another asserts no verdict contains a load-bearing rulebook
      phrase — AC-1's leak test pulled down to unit level so it cannot regress between runs ·
      Files: Created `rulebook/lib/check-component.{ts,test.ts}`, `package.json`, `tsconfig.json`, `.prettierrc`
      (copied from the coding-convention template — without it Prettier had silently used its own defaults) ·
      Test: `AC-2` ✅ — **and the suite was itself mutation-tested**, see below
- [ ] 1.3 — Wrap it as **one** MCP tool `review_component` over HTTP, plus a server-supplied `instructions` block.
      Reuse the `mcp-handler` shape already running in `todo` + `sakubun` (extend-don't-rebuild) · Files: Create
      `fleet-mcp/` (Next route handler at `/api/mcp`), `fleet-mcp/Dockerfile`, `.env` (chmod 600) · Test: `AC-3`, `AC-6`
- [ ] 1.4 — **Run it end-to-end from a scratch project** holding only `.mcp.json` — including the untrusted-folder
      approval step, recorded as it actually behaves · Files: Create a scratch project outside this repo ·
      Test: `AC-1`, `AC-4`
- [ ] 1.5 — **The falsification gate, and it is the point of Phase 1:** grep the scratch project's disk *and* its
      session transcripts for verbatim rulebook sentences. **A non-zero count means tier 2 leaks and the confidentiality
      claim is false as built** — stop and fix before Phase 2, do not explain it away · Files: — · Test: `AC-1`

**Phase 2 — backflow, quarantine-only (an inbox nobody reads automatically).**

- [ ] 2.1 — `report_lesson()` writes to `platform/inbox/quarantine/<iso-date>-<id>.md`, with a `README` stating in the
      first line that nothing here is trusted input · Files: Create `platform/inbox/quarantine/README.md`,
      `fleet-mcp/lib/report-lesson.ts` · Test: `AC-5`
- [ ] 2.2 — **PROPOSE** (do not apply) the `autonomy-gate.mjs` change adding the quarantine→governance promotion path
      to the block list. **The agent must not edit its own gate** — this is the CVE-2025-53773 rule and it is not
      negotiable; the file goes to `platform/proposals/` for a human commit, with the test written and passing against a
      `.proposed` drop-in · Files: Create `platform/proposals/2026-07-29-quarantine-promotion-gate.md` +
      `autonomy-gate.mjs.proposed` + test · Test: `AC-5` (attempted promotion is BLOCKED)
- [ ] 2.3 — Promotion is a **human commit**, documented as a runbook (read → judge → hand-copy → commit), never a tool ·
      Files: Modify `platform/inbox/quarantine/README.md` · Test: manual

**Phase 3 — the honest gate: did the thin slice earn Phase 4?**

- [ ] 3.1 — Answer, with evidence, the counter-case the proposal itself raised: **is Option B (private plugin
      marketplace, offline, free) the better answer after all?** Compare on what Phase 1 actually cost, what tier 2
      actually covered, and whether the confidentiality benefit is real or theatre · Files: append a dated section to
      this plan · Test: a written verdict with numbers, not an impression
- [ ] 3.2 — Record the outcome in `registries/idea-queue.md` (idea-0023) + `decisions.md`; if the verdict is "Option B",
      **say so and stop** — a sunk thin slice is not a reason to build a server · Files: Modify the queue · Test: manual

**Phase 4 — off-machine (SCOPED, NOT AUTHORIZED BY THIS PLAN; needs its own accept after Phase 3).**

These four are listed so Phase 3's verdict is made against a known cost, not a vague "and then more". They are
intentionally left without `Files:`/`Test:` — **naming files for work that is not authorized is how a scoped list turns
into a commitment.** Each gets them in its own plan, after its own accept.

- [ ] 4.1 — `idea-0013`: extract `@thiengthb/mcp-auth` (this is the 3rd consumer — the rule-of-three has fired) ·
      Files: — · Test: deferred to Phase 4's own plan
- [ ] 4.2 — Host it: first real exercise of `targets/cloud/README.md`; add the INVENTORY row with `target: cloud` ·
      Files: — · Test: deferred to Phase 4's own plan
- [ ] 4.3 — Private plugin marketplace for the **hooks** (they cannot ride MCP — local executables) ·
      Files: — · Test: deferred to Phase 4's own plan
- [ ] 4.4 — Widen tier 2 past the frontend rules to the rest of the artifact-decidable 58.9% ·
      Files: — · Test: deferred to Phase 4's own plan

## Check-in runbook

**What this gate decides** — whether the thin slice is *in use* or was built and abandoned. This platform's own
milestone reflection (2026-07-28) names the disease: *"too much machinery per unit of shipped value"* — "verified but
never used" is the failure mode, and it is invisible without a dated look. **A FAILING result forbids Phase 4** and
sends this plan to `abandoned` (or back to Option B), regardless of how much of Phases 1–3 is built.

1. `git -C /home/thien/projects/fleet log --oneline --since=<created> -- fleet-mcp/` — has the server been touched?
2. Count real calls: `grep -c review_component fleet-mcp/logs/*.jsonl` (or the server's request log). **Read the
   number.** Pass = **≥1 call from a project that is not a test fixture**, in the last 14 days.
3. Zero calls but the code exists ⇒ that IS the finding. Do not roll the gate forward a third time hoping — record it
   in §Phase 3 as evidence for the counter-case.
4. **Close the loop** — write the outcome into this plan under a dated heading, then either tick the gated step and
   clear `checkin:`, or roll `checkin:` forward by 14d **stating explicitly what is still missing**.

## Out of scope

- **Anything touching the NUC.** `target` for this work is `local` (Phases 1–3) then `cloud` (Phase 4). The NUC is down
  and is not on this path.
- **The agent editing `autonomy-gate.mjs`, `.claude/settings*.json`, hooks, skills or any `CLAUDE.md`.** Step 2.2
  produces a proposal; a human commits it.
- **Tier 3 (`generate_component`)** — the proposal scoped it as a tier and this plan does not build it. We pay the
  tokens and the latency, and no evidence yet says tier 2 is insufficient.
- **Promoting anything out of quarantine automatically**, in any phase, for any reason.

## Open questions / risks

- **Naming.** `fleet-mcp` is a placeholder. Cheap to change before the directory exists, annoying after — settle it at
  Step 1.3, not later. (The GitHub repo is still `thiengthb/miniserver-platform`; the folder is `fleet`. Those already
  disagree, so pick a name that survives either.)
- **The counter-case is still live and this plan must not bury it.** RICE ranks idea-0023 at 1.35, *below* idea-0015
  (5.23). Phase 3 exists specifically so "we already built some of it" cannot become the argument.
- **Step 0 measured the rulebook, not the checker.** 58.9% verification-shaped is a claim about what *could* be checked
  from the artifact; it is not evidence that a deterministic checker catches those rules well. Step 1.2's mutation
  cases are the first real test of that, and they can still fail.

### Step 1.2's test suite was itself mutation-tested — and one mutant survived

33/33 green on the first run is the result this platform has learned to distrust, so three mutants were run against
the checker to ask whether the suite constrains anything:

| Mutant | Result |
| --- | --- |
| `checkComponent` always returns `[]` | **killed** — 14 failed |
| comments no longer stripped before matching | **killed** — 1 failed |
| the per-rule file-kind gate replaced by `() => true` | **SURVIVED — 33/33 still green** |

The third is the finding. Every rule's `applies: ['tsx','jsx',…]` list was decoration: nothing asserted that a
markup rule stays off a `.ts` module or a stylesheet. Four tests were added (a hex constant in a plain `.ts` palette
must NOT be flagged; the same literal in `.tsx` must be; a `console.log` in that `.ts` still must be, because that
rule does declare `ts`) and the mutant now dies. **A suite that survives its own mutant is measuring nothing** — and
the only reason this was found is that killing the checker was tried on purpose, rather than reading the green.

## Decisions to distill

- The dividing line that makes this design work, in one sentence: **a rule that shapes generation must be transmitted;
  a rule that only verifies output need not be** — and Step 0 showed the transmitted half has a name (*the process
  spine*: research before designing, propose don't execute, thin-slice first), because those rules leave no trace in the
  artifact, which is exactly why they cannot be reviewed into existence.
- A confidentiality claim is only worth what its falsification test is worth. Step 1.5 greps the consumer's transcript;
  without that step "the rules never leave the server" is an architecture diagram, not a fact.
- An LLM-based rule checker would have shipped the rulebook to a third-party API — the deterministic checker is a
  *security* choice first and a cost choice second.
- Fail-open is defensible; **silent** fail-open is not. An empty violation list must be distinguishable from
  "the reviewer never ran".
- The distribution mechanism must not itself need distributing: the server reads the rulebook from the same repo the
  rulebook lives in.
