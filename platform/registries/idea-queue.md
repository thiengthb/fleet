# 10 — Idea Queue (platform-native backlog)

> The platform's **living backlog of its own ideas** — distinct from `registries/skill-candidates.md` (external community-skill
> verdicts). This is the front door of the autonomy **Layer C "Proposer"**. Managed by skill **`/idea`**; design +
> rationale in `plans/2026-06-14-phase1-idea-queue-proposal.md`; parent vision in `plans/2026-06-14-agent-os-evolution.md`.
>
> **Propose-don't-execute:** the agent may capture / score / rank / push back / dedup autonomously, but an idea becomes
> a plan ONLY when the supervisor sets `outcome: accept`. No-response is **not** approval.

## Rules

- **States:** `inbox` (captured, ungated) → `active` (gated-in, ranked) → `analyzing` (top-1 deep-dive) → `proposed`
  (has a `proposal.md`, awaiting human) → `done` (became a plan / shipped) · `deferred` (someday/maybe, has
  `revisit_when`) · `dead` (pruned — keep the tombstone + reason, don't delete the block).
- **Graduation (`outcome: accept` → plan):** on accept the idea graduates to a `docs/plans/`/`platform/plans/`
  roadmap and moves under `## Done` with a **`graduated_plan: <path>`** link. Graduation creates a **`draft`** plan
  only; a human accepts before it executes. Propose-don't-execute survives the automation:
  accept ⇒ a *draft* plan, never a running one.
- **Gate FIRST, score SECOND:** an idea enters `active` only after a feasibility+fit gate (`moscow: must|should|could|wont`
  + "does it fit the system?"). `wont` / no-fit → `deferred` or `dead`.
- **Ranking:** coarse RICE `base = reach×impact×confidence / effort` (ordinal HINT, not truth — real rigor lives in the
  proposal). `rank = base × (1 + 0.15 × interest)`. **Interest bonus is capped at 15%** — it breaks ties / nudges, it
  **never** lets a lower-value idea leapfrog a higher one. Gate is absolute; interest is a Delighter-tier bonus.
- **Interest model (Phase 2 — `interest ∈ [0,1]` is DERIVED, never hand-typed):** ground it ONLY in human signals —
  the supervisor's `outcome: accept/reject` history on *similar* past ideas (Reflexion oracle) + the explicit
  `## Interest signals` prefs in `.claude/memory/user-profile.md`. **Confidence-weight** it (Hu 2008): one verdict = a
  weak nudge, a consistent pattern = stronger; at this data scale (~10–30 verdicts) confidence stays low, which is *why*
  the cap is 15%. **Never** derive interest from the agent's own enthusiasm for an idea (closed-loop self-scoring degrades
  — Reflexion). **Re-derive each `/idea sort`** (recency-decayed); never freeze a stale score. Use coarse buckets
  (≈0.2/0.4/0.6/0.8), not false-precision. Grounding: `plans/2026-06-14-phase2-interest-model-proposal.md`.
- **Exploration floor (anti-feedback-loop):** the interest bonus + the gate would, over many sorts, homogenize the queue
  toward past accepts and starve novel ideas (Mansoury CIKM'20: the bias **compounds** per round — the cap alone is not
  enough). So every `/idea sort` MUST surface **≥1 "wildcard"** — a novel / dissimilar / orthogonal-to-history idea —
  exempt from the interest term (ranked on `base` only), and flag it as the wildcard. If none exists, say so explicitly.
- **WIP cap:** keep `active` ≤ 5 (Kanban). Over the cap → defer the lowest-ranked. Re-sort after every big feature ships.
- **Oracle = supervisor accept/reject.** Record it in `outcome:` with the *why* — that verbal signal (Reflexion) biases
  future agent proposals away from rejected patterns. Self-scoring in a closed loop is forbidden (it degrades — see proposal §Prior art).
- **Dedup:** new idea similar to an existing one → set `dedup_of:` + **flag the supervisor** to re-analyze jointly; don't silently merge.
- **Prune:** `deferred` that fails re-scoring twice, or is fundamentally unfit → `dead` (tombstone + reason).

## Where ideas come from — three triggers, not a standing research job

Added 2026-07-28. The queue's failure mode is not running dry; it is filling with things nobody asked for while the
one thing that mattered goes unnoticed. "Continuously research how to improve the agent" sounds right and is a trap:
the answer changes roughly once per harness release, so polling burns sessions to find nothing, and self-improvement
research has no stopping rule — there is always another framework, another paper, another "10x your agent" post. A
loop with no stopping rule optimises for reading, not for capability.

| Trigger | Fires when | Budget | Wired as |
|---|---|---|---|
| **T1 — release** *(highest yield)* | the harness version changes | **one question**, once: "did it just ship something we hand-rolled?" | `harness-drift-check.mjs` (SessionStart) + `.claude/harness-baseline.json` |
| **T2 — pain** | a measured threshold trips: an audit reports a cap breach or drift, a file blows its size budget, the same correction happens twice | scoped to the question the pain already asked | `memory-audit.mjs`, `skill-audit.mjs`, `plan-checkin.mjs`, `memory-wiring-check.mjs` |
| **T3 — curiosity** | nothing in particular | **≤1× per month**, and may produce **only** a proposal | manual; deliberately not automated |

**All three produce entries here. None of them execute.** That is unchanged — the supervisor's accept is still the
oracle (`Rules` above).

**Cheap and boring first.** On 2026-07-28 a research pass scouted ~40 external sources on agent memory; the single
highest-value finding came from none of them. It came from `code.claude.com/docs/en/memory` — the official docs of the
tool the agent was already running inside, which had shipped a native memory system with *enforced* index caps while
the platform maintained a hand-rolled equivalent. **"Standing on the shoulders of giants" usually means the giant you
are already standing on.** Read the changelog and docs of your own tooling before scouting the field.

**What is NOT measured, and should be.** Every improvement this platform has made was justified by argument, never by
measurement. "Did the agent follow the rule more often after the rule was written?" has never been answered once. The
success metric for this loop is not *"something new was read"* — it is *"a rule that used to be violated stopped being
violated"*, which is answerable from the day-log and git. Until a `/behavioural-eval` actually runs, treat every claim
of self-improvement here as unverified.

---

## Queue

<!-- newest/active near top; sorted by rank within active. one block per idea, stable id.
     2026-06-19 SUPERVISOR GATE: idea-0014 (Restic backup) ACCEPTED → proposal → graduated to build plan
     platform/plans/2026-06-19-idea-0014-nuc-backup.md (status: active). idea-0013 (extract MCP OAuth)
     DEFERRED → revisit when journal/3rd app adds MCP.
     last /idea sort: 2026-07-06 (C3 autonomous gap-analysis); interest re-derived (coarse, oracle-based).
     idea-0012 done (graduated 2026-06-17 → build plan).
     2026-07-06 NEW INBOX: idea-0016 (pinned-image staleness alert) + idea-0017 (journal MCP, WILDCARD).
     2026-07-08 C3 gap-analysis pass: +idea-0018 (sacrificial-record testing gap). Ranking/interest of
     existing active ideas NOT re-derived this pass (scoped to gap-analysis only, per supervisor ask).
     2026-07-17 C3 gap-analysis pass: +idea-0019 (live-refresh/session-state parity check for todo/journal)
     + idea-0020 (codify MCP model-in-the-loop eval into standards/testing.md). Scoped to gap-analysis only
     (no re-sort/re-rank of existing actives, no promotion past inbox), per supervisor ask.
     2026-07-21 C3 gap-analysis pass: +idea-0021 (verify NUC backup script's SQLITE_DBS/PG_DUMPS volume/container
     names against the 2026-07-20 compose-prefix trap, before the accepted idea-0014 backup plan's first run).
     Scoped to gap-analysis only (no re-sort/re-rank of existing actives, no promotion past inbox); considered a
     2nd candidate (cross-project no-emoji-test enforcement gap, ledger #134) but could not verify sibling repos
     from this machine (only miniserver-platform is checked out here) — held back rather than propose ungrounded.
     2026-07-24 C3 gap-analysis pass: +idea-0022 (backfill the guide-coverage drift gate, shipped in sakubun
     2026-07-23, to todo/yakudoku — the ledger entry's own stated scope). Scoped to gap-analysis only (no
     re-sort/re-rank of existing actives, no promotion past inbox); inbox already held 6 un-gated ideas
     (0016-0021) so only 1 new candidate proposed rather than padding the backlog — "at most 1-2" does not mean
     "always 2". Considered but held back as ungrounded: the 2026-07-24 streak-beacon pattern (ledger, scoped
     "todo IF it adds streaks" — a hypothetical, todo has no streak feature today, not a live gap) and the
     2026-07-22 EROFS/disk-full trap's NUC corollary (real risk in principle, but the NUC is currently down per
     memory `nuc-down-deploy-local-only` — proposing NUC-disk monitoring now is premature until it's back up).
     2026-07-28: idea-0023 (MCP platform server) captured from the supervisor, gated pass, analyzed in one pass
     (research was already done in-session: 5 external sources, 4 options) → state `proposed`, AWAITING THE HUMAN-ACCEPT
     GATE. idea-0013's revisit trigger is ARMED but deliberately NOT fired (a proposed 3rd consumer is not a consumer);
     it fires iff idea-0023 is accepted. No /idea sort run — this was a capture+analyze, not a re-rank cadence.

     2026-07-29 /idea sort (post-feature cadence, after idea-0023 shipped). **7 inbox ideas had NEVER been gated**
     (`gate: null` since 2026-07-06..07-24), so the queue's ordering was decoration. All 7 gated + scored; interest
     re-derived per idea from human signals ONLY (user-profile §Interest signals + 9 accepts / 0 rejects in the
     `outcome:` log, all on governance / Knowledge-OS / infra-EXTENSION work — confidence stays low, hence coarse
     buckets and the 15% cap). `interest_why:` records the derivation per idea so it is auditable.
     **Two feasibility deferrals, both because `target` beats rank:** idea-0015 (Watchtower, rank 5.23) and idea-0016
     both live on the NUC, **down since 2026-07-22** — 0015 had been sitting at #1 the entire time it was impossible.
     **New top-1: idea-0018 (rank 6.05)**, actionable today and needing no host.
     **Wildcard surfaced: idea-0017** (journal MCP server), ranked on `base` only per the exploration floor. It displaced
     nothing: the two feasibility deferrals freed the room, so the WIP-5 is 0018 · 0021 · 0020 · 0022 · 0017-as-wildcard.
     (First pass of this sort DID displace idea-0022 to make room — wrong, because it assumed idea-0015 stayed active.
     Counted the survivors instead of asserting them.)
     **One pushback: idea-0020's own evidence went stale** — `/behavioural-eval` now exists and `testing.md` §2.5
     cites it, so it survives at a fraction of scope, and is flagged as a FOLD candidate with idea-0018 (same file,
     same propose-only constraint) for the supervisor to decide. No gap-analysis pass was run: nothing
     externally-grounded surfaced that isn't already captured, and "nothing worth proposing" is a first-class outcome. -->


## Inbox (captured — awaiting supervisor gate before entering active)

### idea-0025 — Make the agent's reporting + process-explanation legible to a human BY DESIGN, not by reminder
state: proposed · source: **user** (2026-07-29, unprompted, after a session he approved 11+ times and then said *"tôi vẫn chưa hiểu mình đang làm gì lắm"*) · created: 2026-07-29 · updated: 2026-07-29
proposal: platform/plans/2026-07-29-idea-0025-legible-reporting-proposal.md — **the research refuted this idea's own scope-guess (a)**: readability/length scoring does not measure comprehension (the plain-language field dropped it in the 1970s), and the curse-of-knowledge literature says the bias survives being warned about, which kills "write a better reminder" as a fix. What survives is a closed-vocabulary jargon lint at two moments + enforcement of the `(khuyến nghị)` rule `CLAUDE.md` already mandates. Awaiting the supervisor's accept/reject
gate: pass · moscow: should · reach: 3 impact: 3 confidence: 0.7 effort: 2 · base: 3.15 · interest: 0.8 · **rank: 3.53**
interest_why: the user RAISED it himself and asked for it to be queued — the strongest interest signal available (stronger than an accept, which is only a yes to my framing). Also sits in "agent governance / Knowledge OS", his explicit lean.
> **The problem, in his words:** he is a human, so reporting and explaining process must be shaped for the easiest
> possible human understanding — not merely accurate and complete. On 2026-07-29 he approved 11+ recommendations in one
> session and only afterwards said he did not really understand what he was doing. **The failure signal was silence and
> agreement, not objection** — which is the worst shape for a control system whose whole premise is that a human
> supervises.
> **Why a reminder is not the fix (and why this is an idea, not a memory line):** the rule ALREADY existed. `CLAUDE.md`
> §"Legible decision surface" mandates plain language first, and `.claude/memory/legible-proposals-plain-language.md`
> has said so since 2026-06-16. Both were violated repeatedly in the same session that produced them. A rule that is
> already written and still not followed is not a knowledge problem — it is a **design** problem, and this platform's own
> ledger has the pattern for that (`enforce-rules-with-gates`: restructure so compliance is easiest → measure → gate
> only if prose lost).
> **Immediate mitigation already applied 2026-07-29** (so this idea is about the durable version, not the stopgap): the
> default report shape is now three plain sentences — *did / decide / next* — with technical detail written to files
> instead of chat. He chose that shape and confirmed it worked. **That is a convention, and conventions are what just
> failed.**
> **Scope guess for `/idea analyze` to firm up:** (a) can the three-sentence shape be MEASURED rather than remembered —
> e.g. a Stop-hook that flags a report over N lines or containing un-glossed internal jargon (`RICE`, `WIP cap`,
> `exploration floor`, `T1–T4`, `propose-don't-execute`) — bearing in mind the honest limit that a hook can count lines
> but cannot judge clarity; (b) a glossary the agent must link to on first use per session; (c) whether the deeper fix is
> to cut process surface rather than explain it better (the `/idea` skill's own scope-discipline clause says to cut the
> ritual if it costs more attention than it returns). **Research this before designing**: expert-to-novice explanation,
> progressive disclosure, and readability measurement — do NOT design it from my own intuition about what is clear, which
> is exactly the bias that produced the problem.
> **Counter-case to carry into the analysis:** the cheapest real fix may be *less machinery to explain*, not better
> explanation of the same machinery. If so, this idea should recommend deleting process and then close.

---

### idea-0024 — The HAND-WRITTEN half of the graduation-thesis doc set (SRS · User Stories · Use Cases · UI/UX · Threat Model)
state: parked · source: user (2026-07-29) · created: 2026-07-29 · updated: 2026-07-29 · revisit_when: the supervisor has the university's rubric / đề cương in hand
gate: defer · moscow: could · interest: n/a (explicitly NOT a platform-optimisation item — see below)
> **Parked on purpose, by the supervisor, with the reason stated plainly:** *"tôi chưa hiểu rõ đồ án tốt nghiệp của tôi
> sẽ viết document như thế nào, đợi một dịp khi tôi nắm rõ thì ta sẽ active phần này"*. The blocker is not effort, it is
> **not knowing the marking scheme** — and writing an SRS against a guessed rubric produces the one thing worse than no
> document: a long one that is wrong in ways nobody checks.
>
> **What is parked here** (everything that cannot be derived from an existing artifact): `SRS` (ISO/IEC/IEEE 29148:2018
> — **not** IEEE 830, which is superseded) · `User Stories` + `Acceptance Criteria` · `Use Cases` · `Wireframe` /
> `Mockup` / `Prototype` · `Design System` (write-up; the rules already exist in `.claude/rules/frontend.md`) ·
> `Product Vision` / `BRD` / `Market Research` · `Threat Model` (STRIDE) · `Security Requirements`.
>
> **What is NOT parked** — the derivable half is being built now as `docgen` (see `docgen/docs/00-map.md`), because it
> costs近 zero and cannot drift: ERD + Data Dictionary from `schema.prisma`, C4 from `inventory.md`, Coding Standard /
> Git Workflow from the `coding-convention` references, Test Plan from `standards/testing.md`, Decision Log + ADRs from
> each project's `decisions.md`, Development Log from `platform/log/`, Changelog from Conventional Commits.
>
> **Honest scoring note, recorded because it is unusual for this queue.** The supervisor pre-emptively conceded the
> platform value: *"hiện tại những phần này có thể chưa có tác dụng tối ưu cho platform … có thể khi xong đồ án, có một
> vài phần doc có thể bị lược bỏ và desolve, vứt vào sọt rác."* So this is deliberately **not** RICE-scored against
> platform benefit — it would rank last and that ranking would be answering a question nobody asked. It is a personal
> deliverable with a real external deadline, and the queue records it as such rather than pretending otherwise.
> The design consequence is concrete: `docgen` is a **separate repo, reading fleet read-only, deletable in one `rm`** —
> chosen so that "vứt vào sọt rác" stays cheap. A feature that is expected to be thrown away should be built so it can be.
>
> **Activation trigger:** the rubric arrives ⇒ map each required section to (a) already generated, (b) derivable, or
> (c) genuinely hand-written, and only then estimate. Do not start before that; the rubric is the requirement doc.

---

### idea-0015 — Migrate Watchtower → maintained drop-in fork `nickfedor/watchtower`
state: deferred · source: agent (Quick-research finding 2026-06-20) · created: 2026-06-20 · updated: 2026-06-20 · revisit_when: the NUC is back up — Watchtower runs there, so a migration cannot be applied or verified while the host is off (down since 2026-07-22). **This idea has ranked #1 the whole time it was unactionable**, which is what reading `target` before trusting a rank is for
gate: pass · moscow: should · reach: 3 impact: 2 confidence: 0.8 effort: 1 · base: 4.8 · interest: 0.6 · **rank: 5.23**
proposal: null · outcome: null
> **External signal (web, 2026-06-20):** `containrrr/watchtower` repo ARCHIVED 2025-12-17 — maintainers stepped away, no
> further patches/security fixes. Auto-pull still works today but the tool is now unmaintained. Touches **Invariant #7**
> (Watchtower needs `DOCKER_API_VERSION=1.44`) and the whole NUC deploy chain (every app auto-updates via it).
> Recommended path per sources = drop-in fork `nickfedor/watchtower` (full API compat, claims "just change the image").
> Cheap + platform-wide risk mitigation → high base. **NOT yet verified:** the drop-in claim + that `DOCKER_API_VERSION=1.44`
> still applies — confirm in `/idea analyze` (Standard research) before any change. Sources: linuxiac, GitHub Discussion
> #2135, craftmycloud, linuxhandbook.
> *Interest 0.6:* similar shape to accepted idea-0014 (ops/data-safety) + idea-0012 (ops/reliability) — supervisor has
> accepted concrete ops-risk mitigations on real-risk grounds.

---

### idea-0005 — Phase 4: token-aware batching + estimation-accuracy research
state: deferred · source: user · created: 2026-06-14 · updated: 2026-06-14 · revisit_when: a WIP slot frees up (rank 0.85, lowest of the gated set)
gate: pass · moscow: could · reach: 2 impact: 1 confidence: 0.8 effort: 2 · base: 0.8 · interest: 0.4 · **rank: 0.85**
proposal: null · outcome: null
> `cost: S/M/L` on plan steps + post-hoc calibration; a batch runner reads `cost` not a fixed step count. Research confirmed
> a-priori token forecasting is unreliable (r≈0.39) → enforcement (p99 + hard cap), not prediction. Modest payoff; lower rank.

---

### idea-0021 — Verify the NUC backup script's volume/container names against the newly-documented compose-prefix trap before first run
state: done · source: agent (C3 gap-analysis 2026-07-21) · created: 2026-07-21 · updated: 2026-07-29 (was 2026-07-21)
gate: pass · moscow: should · reach: 1 impact: 3 confidence: 0.9 effort: 1 · base: 2.70 · interest: 0.4 · **rank: 2.86**
interest_why: infra correctness grounded in a documented trap, but neither governance nor Knowledge-OS; no explicit lean either way
outcome: **done 2026-07-29 — and the premise inverted.** The worry was that `backup.env.example`'s bare volume names were
wrong. Audited every compose file in the repo: **they are CORRECT**, because `n8n` and `yakudoku/deploy` pin an explicit
`name:`, which turns compose's prefixing off. The trap is live in three OTHER volumes instead — `sakubun_data`,
`journal_db`, `todo_data`. **Done:** `sakubun` pinned to `sakubun_sakubun_data` (verified with `docker volume ls`, then
rebuilt: same volume, DB still 3,592,192 B, healthy + 200) · `backup.env.example` now says inline why its bare names must
NOT be "fixed" · `known-traps.md §10` carries the full per-volume audit table · **`restic-restore-test.sh` rewritten from
a printed "VERIFY MANUALLY" reminder into real assertions** (it asserted nothing, so a snapshot of empty dumps exited 0).
**Blocked on the NUC, recorded not guessed:** `journal_db` / `todo_data` real names — pinning them from inference is the
trap's worst direction. **Two bugs in my own new script, found by dry-running it, not by reading it:** it reported "not a
database" for a real 3.5 MB DB when the `sqlite3` CLI was simply absent, and its summary claimed "the backup would NOT
restore" when the truth was "this host could not check". Both fixed; PASS and FAIL paths each exercised.
> **Documented gap:** `registries/known-traps.md` §10 (added 2026-07-20, commit `2d1c756`) and knowledge-ledger line
> 2026-07-20 ("compose PREFIXES a named volume with the project name … every project on this platform") document
> that a `docker-compose.yml` volume named e.g. `sakubun_data` actually exists on the host as
> `sakubun_sakubun_data`, and that quoting the bare name in a runbook/script is wrong in the silent-failure
> direction — sakubun had exactly this bug sitting in `app/guide/page.tsx` for weeks, only caught by
> `verify-restore.sh` (ledger 2026-07-20, "a backup is a claim until a restore has been performed").
> **Where this applies on the platform's own accepted backup plan (idea-0014, `platform/plans/2026-06-19-idea-0014-nuc-backup.md`, status active):**
> `platform/backup/backup.env.example` line 19 sets `SQLITE_DBS=yakudoku_data:db.sqlite3,n8n_data:database.sqlite`
> — **bare, un-prefixed volume names**, the exact pattern the trap warns about — and `restic-backup.sh:56` builds
> `src="/var/lib/docker/volumes/$vol/_data/$rel"` directly from that config, i.e. the same class of path
> construction as the `docker run -v <name>` case that silently created an empty volume in the sakubun incident.
> (Checked: the raw `restic backup $VOLUME_PATHS` step backs up `/var/lib/docker/volumes` by filesystem path, not
> by docker-cli volume name, so that step is NOT exposed — only the SQLite-dump and `PG_DUMPS` container-name
> config surfaces are.) The plan's own step 1 ("Verify volumes + engines on the live NUC … `docker volume ls`")
> already exists but is unchecked, and neither the script comments nor `backup.env.example` cross-reference the
> newly-added trap doc, so step 1 could be done without the specific "must be the compose-prefixed name" nuance
> in mind. **Not yet verified:** whether this fails loud (the script's `set -e`/`ERR` trap + optional Discord
> webhook) or goes unnoticed — that depends on live NUC config not checked from this machine.
> **Scope guess (for `/idea analyze` or a direct plan addendum — supervisor's call, small either way):** (a) run
> `docker volume ls` on the NUC and correct `SQLITE_DBS`/`PG_DUMPS` to the real prefixed names before first backup,
> (b) add a one-line cross-reference from `restic-backup.sh`/`backup.env.example` to `registries/known-traps.md §10`, (c)
> confirm `restic-restore-test.sh`'s manual row-count check would actually catch an empty/wrong-source dump.
> *RICE (pre-gate, rough):* Reach 2 (one script, but it is the single mitigation for ALL 8 platform volumes) ·
> Impact 3 (an unverified backup is the platform's highest documented risk resurfacing under a false sense of
> safety) · Confidence 0.7 (the bare-name mismatch is directly observed in committed config; loud-vs-silent
> failure not yet confirmed live) · Effort 1 (verification + a doc cross-reference, reuses the plan's existing
> step 1) → base 4.2 · interest 0.6 (same shape as accepted idea-0014 — a concrete, real-risk data-safety gap) ·
> **rank ≈ 4.58**

---

### idea-0022 — Backfill the guide-coverage drift gate (sakubun) to todo/yakudoku's `/guide` pages
state: deferred · source: agent (C3 gap-analysis 2026-07-24) · created: 2026-07-24 · updated: 2026-07-29 (was 2026-07-24) · revisit_when: **the next time `todo` is worked on** — supervisor's call 2026-07-29: kept as a REMINDER attached to that repo rather than as queue work, because it is only worth doing while someone is already in that codebase. `yakudoku` rides along whenever it happens.
gate: pass · moscow: should · reach: 2 impact: 2 confidence: 0.8 effort: 2 · base: 1.60 · interest: 0.8 · **rank: 1.79**
interest_why: EXTENDS a gate that already exists in sakubun to its siblings — "extending existing infra over parallel systems" is the strongest stated lean; docs continuity
> **Documented gap, stated by its own source:** `registries/knowledge-ledger.md` 2026-07-23 ("Keep the in-app guide in
> sync with features is a rule too") records that sakubun's `/guide` had drifted ~10 features behind the code
> silently, and ships the fix as a `docs/guide-coverage.json` registry (route/MCP-prompt/capability → `ref`
> string that must appear in the guide source) + a test that fails on an unclassified route/prompt or a stale
> `ref`, plus a once-per-session PreToolUse nudge before a route/MCP-catalog edit. **The ledger line's own scope
> field says "any app with an in-app `/guide` (sakubun now; **todo/yakudoku next**)"** — i.e. the follow-up was
> already named, not inferred by this pass. `inventory.md` confirms both are live production web-apps with an
> in-app guide mandated by `CLAUDE.md`'s `/user-guide` skill (`todo/app/guide/page.tsx` is literally the skill's
> reference impl) and both run an MCP server (`todo` row 34/66; `yakudoku` row 36/70-71) — the exact
> route-drift **and** MCP-prompt-drift surfaces the gate targets. Without it, todo/yakudoku have no mechanism
> to catch a shipped feature/tool that never made it into their guide, same failure mode sakubun just had.
> **Not yet verified** (no other repo checked out on this machine): whether todo/yakudoku's guides are already
> drifted today, or just lack the gate pre-emptively — either way the mechanism is missing. Scope for `/idea
> analyze`: port `guide-coverage.json` + `lib/guide-coverage.test.ts` + `.claude/hooks/guide-coverage-reminder.mjs`
> from sakubun (already-built, already-proven — a copy-in per `/code-reuse`, not a redesign).
> *RICE (pre-gate, rough):* Reach 2 (todo + yakudoku, both confirmed live with a guide + MCP surface) · Impact 2
> (prevents silent doc drift, same class as the incident that motivated the gate — not a security hole but a
> real supervisor-legibility gap, echoing CLAUDE.md's own "legible decision surface" invariant) · Confidence 0.8
> (mechanism already built + proven once, low design uncertainty — porting, not inventing) · Effort 2 (three
> files × two separate codebases, more than a single doc edit) → base 1.6 · interest 0.6 (same shape as accepted
> idea-0012 — extending an already-shipped, already-proven gate/monitoring pattern to sibling apps on a
> documented, source-named gap) · **rank ≈ 1.74**

---

### idea-0016 — Pinned-image staleness alerting for n8n + Authentik
state: deferred · source: agent (C3 gap-analysis 2026-07-06) · created: 2026-07-06 · updated: 2026-07-29 (was 2026-07-06) · revisit_when: the NUC is back up (down since 2026-07-22) — alerting on the staleness of images on a dead host measures nothing
gate: pass · moscow: should · reach: 2 impact: 3 confidence: 0.7 effort: 2 · base: 2.10 · interest: 0.4 · **rank: 2.23**
interest_why: security work, but a NET-NEW alerting mechanism is an explicit "leans away"; and it is unactionable while the host is off
> **External signal:** INVENTORY §1 documents n8n (`2.25.7`) and Authentik (`2026.5.2`) as manually-pinned
> images with no Watchtower label and **no staleness alert** — the platform has zero mechanism to detect when a
> security patch or new version is released for these two apps. Authentik is the central IdP; a missed CVE patch
> is a critical exposure. External prior art: **Renovate Bot** (MIT, 50k+ GitHub stars — widely adopted for
> Docker Compose version bumping, issues auto-PRs when a new tag appears); alternative: a lightweight nuc-monitor
> scheduled check against the GitHub Releases API + a Discord alert (reusing the existing alert path). Neither
> option is in the queue today.
> *RICE (pre-gate, rough):* Reach 2 · Impact 3 · Confidence 0.8 · Effort 2 → base 2.4 · interest 0.6
> (similar shape to accepted idea-0014/0012/0015 — ops-risk mitigation on real documented gaps) · **rank ≈ 2.62**

---

### idea-0017 — journal MCP server (exploration-floor WILDCARD)
state: active · source: agent (C3 gap-analysis 2026-07-06, exploration-floor WILDCARD) · created: 2026-07-06 · updated: 2026-07-29 (was 2026-07-06)
gate: pass · moscow: could · reach: 1 impact: 2 confidence: 0.5 effort: 3 · base: 0.33 · interest: 0.2 (SKIPPED — wildcard) · **rank: 0.33**
interest_why: WILDCARD — ranked on `base` only, interest term SKIPPED by the exploration floor. Its own interest would be low (a net-new service in a third app is an explicit "leans away"), which is exactly the starvation the floor exists to prevent
> **Documented trigger + external signal:** (1) idea-0013 is deferred with
> `revisit_when: "journal (or any 3rd app) adds an MCP server"` — this idea IS that trigger. (2)
> `registries/shared-assets.md` flags the MCP OAuth shim as "DUPLICATED — extract candidate (built 2×; extract at 3rd
> app)"; journal = the 3rd consumer, activating the rule-of-three extraction of `@thiengthb/mcp-auth`. (3) Both
> sibling web-apps (`todo`, `yakudoku`) already expose MCP servers using the near-identical shim — journal is the
> only `web-app` without one. **Product gap:** Claude can create todos and practice sessions via MCP but cannot
> create or retrieve journal entries. Implementation path: copy the OAuth shim from yakudoku (auth 38, oauth 86,
> token 63, authorize 124, register 32 lines) + define journal-specific tools (create entry, search entries,
> retrieve by date).
> *WILDCARD flag:* orthogonal to the ops/testing/autonomy accept history → ranked on base only, no interest term.
> *RICE (pre-gate, rough):* Reach 2 · Impact 2 · Confidence 0.7 · Effort 2 → base 1.4 · **rank 1.4 (base, wildcard)**

---

### idea-0018 — Codify the "sacrificial record" rule into the testing standard (live-verification-vs-real-data gap)
state: done · source: agent (C3 gap-analysis 2026-07-08) · created: 2026-07-08 · updated: 2026-07-29 (was 2026-07-08)
gate: pass · moscow: should · reach: 3 impact: 2 confidence: 0.9 effort: 1 · base: 5.40 · interest: 0.8 · **rank: 6.05**
interest_why: codifies a dated incident into the durable standard = Knowledge-OS + governance, both explicit "leans toward"; extends an existing standard rather than adding a system
proposal: platform/plans/2026-07-29-idea-0018-sacrificial-record-proposal.md
outcome: **accept — Option A + the idea-0020 fold** (2026-07-29, supervisor — "accept A + fold"). Graduated NOT to a plan but straight to a governance drop-in (`platform/proposals/testing.md.proposed`, **+22 lines in 2 places**): the entire build is one file edit, and a plan file for that is the ceremony tax `/project-plan` says to skip. `done` once a human commits it — the agent must not, `platform/standards/**` became governance the same day.
installed: **INSTALLED 2026-07-29 by the agent at the supervisor's explicit request in a supervised session (`7ca43ea`) — the propose-only constraint binds UNATTENDED runs; a present, deciding human is the gate the rule exists to guarantee. The supervisor read the diff first.**
> **Documented gap:** the 2026-07-06 `sakubun` incident — a live `submit_review` verification wrote a fake rating
> onto the user's REAL item 「中」, corrupting its FSRS schedule; recovery only worked because `ReviewLog` happened
> to be append-only (delete the injected rows, replay the rest through `ts-fsrs`). This was distilled to a
> knowledge-ledger line scoped **"every app with user state / any live verification"** (platform-wide, not
> sakubun-only) — but `standards/testing.md` (the canonical routing doc, shipped by idea-0010, `done`) has **no
> rule** covering "verify a write path without touching real user data"; grep for
> sacrificial/fixture/seed/production-data turns up nothing. Every app with user-writable state and a live/MCP
> verification step (`todo`, `journal`, `yakudoku`, `sakubun`) can hit the same incident, and not all of them have
> an append-only log to make recovery possible the way sakubun's did.
> **External prior art:** the "canary"/synthetic-record pattern (AWS CloudWatch Synthetics, industry canary
> testing) — verify a live write path against a dedicated synthetic/marked record, never a real user's, and
> clean up or replay after. Sources: sreschool.com "What is Canary check?", AWS Cloud Operations Blog
> ("Testing and debugging Amazon CloudWatch Synthetics canary locally").
> **Scope guess (for `/idea analyze` to firm up):** add a short rule + a copy-in helper pattern (create a
> marked/`__test__` record → verify → delete or replay) to `standards/testing.md`, referencing the sakubun
> incident as the worked example. Small effort — mostly a doc addition + a reusable snippet, not new
> infrastructure.
> *RICE (pre-gate, rough):* Reach 3 (todo/journal/yakudoku/sakubun all have user-writable state + live
> verification) · Impact 2 (process fix, not itself a security hole — but the failure mode is data corruption)
> · Confidence 0.7 · Effort 1 → base 4.2 · interest 0.6 (similar shape to accepted idea-0010 [testing discipline]
> and idea-0014 [data-safety] — supervisor has accepted both a testing-standard fix and a data-safety-driven gap
> before) · **rank ≈ 4.58**

---

### idea-0019 — Live-refresh + sessionStorage UI-state parity check for todo/journal (external-writer staleness)
state: deferred · source: agent (C3 gap-analysis 2026-07-17) · created: 2026-07-17 · updated: 2026-07-29 (was 2026-07-17) · revisit_when: an external-writer staleness bug is actually observed in todo or journal — this is an audit of a generalisation, not a reported defect
gate: pass · moscow: could · reach: 2 impact: 2 confidence: 0.7 effort: 2 · base: 1.40 · interest: 0.6 · **rank: 1.53**
interest_why: extends an existing pattern to siblings (mild lean toward), but the ledger generalised it BY PATTERN, not by verified audit — so the premise itself is unaudited
> **Documented gap:** two dated 2026-07-14 knowledge-ledger lessons (#106, #107) generalize sakubun's fixes to
> **named siblings by pattern, not by verified audit**: (1) "any RSC app with an external writer (sakubun MCP;
> **todo/journal bots**)" needs a client `router.refresh()` on window-focus + light poll, because a Server-Component
> page won't see writes made out-of-band; (2) "table-heavy web apps (sakubun; **todo/journal lists**)" need
> sessionStorage-backed UI state because plain `<Link>` nav drops URL query params. `inventory.md` confirms **todo**
> ships a live MCP write path (`todo` = "Smart todo + MCP", row 34/66) — a real external writer, same shape as the
> sakubun MCP that motivated the fix. No idea/audit currently checks whether todo (the platform's **reference
> web-app**, copied by other repos) already has this staleness handling or is silently missing it.
> **Not yet verified:** whether todo already implements an equivalent (may already be fine) — this is a
> check-and-backfill candidate, not a confirmed bug. Scope for `/idea analyze`: (a) read todo's list/detail pages
> for a live-refresh or polling mechanism, (b) if absent, port `sakubun/components/live-refresh.tsx` +
> `use-session-state.ts` (small, already-built, already reused-once components) rather than re-deriving from scratch.
> *RICE (pre-gate, rough):* Reach 2 (todo confirmed MCP writer; journal unconfirmed) · Impact 2 (stale-UI correctness
> bug, not security) · Confidence 0.6 (gap existence unverified — audit first) · Effort 1 (copy-in from sakubun,
> `registries/shared-assets.md` code-reuse candidate) → base 2.4 · interest 0.5 (similar shape to accepted idea-0012 —
> extending an already-shipped, already-proven pattern to sibling apps on a documented coverage gap) · **rank ≈ 2.58**

---

### idea-0020 — Codify "MCP model-in-the-loop eval" as its own testing-standard rule (unit-tests-can't-catch-this gap)
state: done · source: agent (C3 gap-analysis 2026-07-17) · created: 2026-07-17 · updated: 2026-07-29 (was 2026-07-17)
gate: pass · moscow: could · reach: 3 impact: 1 confidence: 0.7 effort: 1 · base: 2.10 · interest: 0.8 · **rank: 2.35**
interest_why: same family as idea-0018 (standard + Knowledge-OS), but see the PUSHBACK: most of what it asked for now exists
pushback: **its stated evidence is now STALE, checked 2026-07-29.** The block says *"Grep confirms `standards/testing.md` has zero mention of 'model-in-the-loop' or 'eval'"* — that was true when it was captured (2026-07-17) and is not any more: the `/behavioural-eval` skill now exists and `standards/testing.md` §2.5 references it by name. What is genuinely still missing is **one routing row** in the pyramid — no tier routes "does the calling model handle this tool result correctly" to that skill — so the idea survives at a fraction of its original scope (impact 1, effort 1). **FOLD CANDIDATE, supervisor's call:** it and idea-0018 are both single-row additions to the same governance file, both propose-only since `platform/standards/**` became governance on 2026-07-29 — one proposal and one human commit would do both. Not merged silently, per the dedup rule.
proposal: platform/plans/2026-07-29-idea-0018-sacrificial-record-proposal.md (**folded into idea-0018's proposal as an optional second row** — the supervisor accepts A-only or A+fold; not merged, presented)
outcome: **accept, folded** (2026-07-29, supervisor). Survives as ONE `§1` pyramid row routing model-in-the-loop seams to `/behavioural-eval` — the rest of what it asked for already existed by the time it was analysed.
installed: **INSTALLED 2026-07-29 as one `§1` pyramid row (`7ca43ea`), placed ABOVE End-to-end: a model-in-the-loop eval is non-deterministic by construction, and the table sorts by determinism. First draft had it below E2E — caught by re-reading the diff, not by writing it.**
> **Documented gap:** three separate dated knowledge-ledger incidents from one MCP server (sakubun) — 2026-07-06
> (#56, display-contract paraphrasing), 2026-07-09 (#98 restated), 2026-07-11 (#98, a required-schema-field dead-end
> for model recovery) — each explicitly states **"unit tests can't catch this"** / needs **"a model-in-the-loop
> eval"**, and scopes the lesson to **"every MCP server (yakudoku, sakubun, future)"**. `standards/testing.md`
> (the canonical routing doc, itself shipped by idea-0010) has a pyramid row for **"Cross-repo HTTP seams (…MCP)"**
> routed to consumer-driven contract tests (§4) — but a contract test checks request/response SHAPE, not whether the
> calling model paraphrases/reorders/mishandles a tool result or a required-arg rejection. Grep confirms
> `standards/testing.md` has zero mention of "model-in-the-loop" or "eval". **todo** and **yakudoku** both run MCP
> servers in production today (`inventory.md` rows 34/66, 10) — the same failure class is live risk there too, not
> just in local-only sakubun.
> **Scope guess (for `/idea analyze` to firm up):** add a tier/row to `standards/testing.md` distinct from the
> contract-test row — "MCP tool-schema / display-contract behavior" → model-in-the-loop eval (a subagent role-playing
> the client, graded on pass criteria), referencing `sakubun/eval/display-contract-eval.md` as the worked template.
> Doc-only addition, no new infra.
> *RICE (pre-gate, rough):* Reach 3 (todo, yakudoku, every future MCP app route through this standard) · Impact 2
> (process/testing-discipline fix, prevents a recurring class of model-behavior bugs) · Confidence 0.8 (pattern
> already proven 3× in practice, low design uncertainty — mostly transcribing a working recipe) · Effort 1 (doc
> addition) → base 4.8 · interest 0.6 (same shape as accepted idea-0010 — a testing-standard codification) ·
> **rank ≈ 5.23**

---

## Done (graduated to an accepted plan / shipped — kept for the Reflexion trail)

### idea-0023 — Rule delivery without shipping the rulebook (built as an MCP server, SHIPPED as a plugin hook)
state: done · source: user (2026-07-28, two consecutive framings: multi-machine harness, then "only expose a small surface") · created: 2026-07-28 · updated: 2026-07-28
gate: pass · moscow: should · reach: 3 impact: 3 confidence: 0.6 effort: 4 · base: 1.35 · interest: 0.8 · **rank: 1.51**
proposal: platform/plans/2026-07-28-idea-0023-mcp-platform-server-proposal.md
outcome: **accept** (2026-07-28, supervisor — "làm theo đề xuất của bạn"), Option A (hybrid: MCP for skills/rules
at tiers 1+2, private plugin marketplace for hooks). **Graduation deliberately SEQUENCED, not immediate:** the
`fleet` rename (`platform/` → `platform/`, plan `2026-07-28-fleet-rename-and-restructure.md`) rewrites every
path this build would reference, and the `cloud` target it needs does not exist as data until that plan's B3/B4.
Writing the build plan first would mean writing it twice. **Step 0 (the kill-switch measurement — classify the
rulebook generation-shaping vs verification-shaped, reject if <40% verification-shaped) does NOT depend on the
rename and can run at any time.**
blocks_on: idea-0013 (extract `@thiengthb/mcp-auth`) — its `revisit_when` is ARMED by this idea, and fires only if this one is accepted
**PHASE 3 VERDICT 2026-07-29 — Phase 4 NOT authorized; a re-target is PROPOSED, awaiting the supervisor.** Phases 1–3
built and closed in one session (69 tests). The finding that decides it: **Step 0 measured the rulebook, not the tool
shape.** 58.9% verification-shaped is a property of the rules; `review_component` is stateless, single-file and
model-free, and re-classifying the same 33 statements against *that* leaves 36% clearly decidable, 21% partly, and
**42% needing repo state, host state, a running UI or judgment** ⇒ the tool reaches **~21–34% of the rulebook**, not
58.9%. Meanwhile the confidentiality delta over simply shipping the compiled rule data is **4.4 KB** (vs the ~760 KB
that made the RFC reject Option B), and the checker is **pure**, so it can run on the consumer's machine.
**Proposed re-target — B′:** ship the checker + rule data through the private plugin marketplace **that Step 4.3 already
required for hooks**, as a hook. Offline, free, no OAuth extraction, no `cloud` row — and **enforced deterministically**
rather than depending on the consuming model choosing to call a tool (n=1 evidence that it does). Detail + red-team:
`platform/plans/2026-07-29-idea-0023-mcp-platform-server-build.md` §Phase 3 verdict. **The 2026-07-28 accept was the
supervisor's; only the supervisor reverses it — the agent proposes.**
`idea-0013` stays ARMED-not-fired: it was a prerequisite of Phase 4, and Phase 4 is not authorized.
**RE-TARGET ACCEPTED 2026-07-29 (supervisor — "Chuyển sang B′").** The 2026-07-28 Option-A accept is superseded from
Phase 4 onward; Phases 1–3 stand as the evidence that produced the change. Phase 5 thin slice is **built and verified**:
`rulebook` is now itself a plugin marketplace, both manifests pass `claude plugin validate --strict`, and the hook fires
on every UI write (exit 2 on an error-severity violation, silent when clean). **The slice paid for itself immediately** —
it exposed that `emoji-as-icon` was line-scoped and brace-blind, so it had been missing nearly all real JSX while 33
tests stayed green. **5.5 done the same day:** installed at user scope from a local marketplace path (no repo touched, no push), 1 hook,
**~0 tokens per session**; scanned 333 real UI files across 4 apps → 24 findings in 11 files, of which **three classes
were false positives** now fixed, plus a reasoned `rulebook-allow` exception for code the rule cannot judge. **5.6: published** — `github.com/thiengthb/rulebook` (public), marketplace resolves from GitHub — **and applied to
`sakubun`**: 14 findings → 0, split 8 real whole-file exceptions (new `rulebook-allow-file:` directive) + 6 that were
not exceptions but drift from that repo's own palette module. Container rebuilt, healthy + 200. The
**5.7 done — and it was a checker-accuracy pass:** of the last 6 findings, **3 were false positives** (Extended_Pictographic
is not "an emoji" — `↔`/`⚙`/`™` render as text; the data-SVG exemption only matched a literal `viewBox`), 2 were real
(→ lucide icons), 1 was a written exception. **0 findings across all 333 UI files in 4 apps.** **Nothing left to build**
— the used-vs-merely-built gate is now the only open item and it cannot be answered early by design
(`checkin: 2026-08-12`).
> **External signal (verified against official docs, 2026-07-28):** a remote MCP server can deliver rules JIT into another
> machine's context with **nothing written to that machine's disk**, revocably (per-token), with every request logged, and
> can push a server-supplied `instructions` block into the consumer's system prompt — so the rulebook updates without ever
> touching the consumer repo. Agent-teams docs confirm teammates load MCP servers the same as a regular session, so an
> MCP-delivered ruleset reaches every teammate while the lead's conversation does not.
> **Core design:** three exposure tiers — *transmit the rule* (t1) / *transmit the verdict* (t2, rules never leave the
> server) / *transmit the result* (t3). Dividing line: **generation-shaping rules must be transmitted; verification-shaped
> rules need not be.** Hooks cannot ride MCP (local executables) → hybrid with a private plugin marketplace.
> **Two file-level consequences if accepted:** `idea-0013` becomes a prerequisite (building a 3rd copy of the OAuth glue
> would violate `/code-reuse` on the very change meant to demonstrate reuse), and `INVENTORY §0` needs a 4th `target`
> value `cloud` (the service must be reachable off-machine while the NUC is down → neither `nuc` nor `local`).
> **Honest ranking note:** base 1.35 ranks BELOW idea-0015 (5.23). That is not a scoring artifact — RICE is correctly
> reporting a large, speculative effort. The proposal's Counter-case argues that if the supervisor's real priority is
> "reach every machine" rather than "don't expose the core", **Option B (private plugin marketplace) is the cheaper
> correct answer and this should be rejected in its favour.**
> **Kill-switch pre-committed before any code:** classify the rulebook generation-shaping vs verification-shaped; if
> **under 40% is verification-shaped**, Option A collapses into Option C and this is rejected, not rescoped.
> *Interest 0.8:* the supervisor asked for it directly and twice, and every prior user-sourced agent-OS/leverage idea
> (0010 testing discipline, 0011 skill-proposer, 0003 day-log memory, 0001 interest model) was accepted. Not derived from
> the agent's own enthusiasm.

---


### idea-0014 — NUC volume backup strategy (ops data-safety)
state: done · source: agent (C3 gap-analysis 2026-06-18, exploration-floor WILDCARD) · created: 2026-06-18 · updated: 2026-06-19
gate: pass · moscow: must · reach: 3 impact: 3 confidence: 0.9 effort: 3 · base: 2.7 · interest: n/a (wildcard — base only) · rank: 2.7
proposal: platform/plans/2026-06-19-idea-0014-nuc-backup-proposal.md
graduated_plan: platform/plans/2026-06-19-idea-0014-nuc-backup.md
outcome: **accept** (2026-06-19, supervisor) — Option B (Restic → Backblaze B2, app-consistent DB dumps via pg_dump/SQLite
.backup, systemd timer, nuc-monitor Discord alert). Graduated to the build plan above (status: active).
> **Reflexion signal:** an ops/data-safety gap accepted on real-risk grounds (the highest un-mitigated risk on the
> platform — zero backup of 8 data volumes on one machine). The exploration-floor WILDCARD (orthogonal to the prior
> autonomy/knowledge-OS/testing accepts) paid off — bias future sorts toward surfacing concrete data-safety/ops gaps.

---

### idea-0012 — nuc-monitor coverage gap: extend monitoring to journal + yakudoku
state: done · source: agent (C3 gap-analysis 2026-06-17) · created: 2026-06-17 · updated: 2026-06-17
gate: pre-assessed pass · moscow: should · reach: 2 impact: 2 confidence: 0.9 effort: 1 · base: 3.6 · interest: 0.3 · rank: 3.76
proposal: plans/2026-06-17-nuc-monitor-app-health-proposal.md
outcome: **accept — Option D** (2026-06-17, supervisor re-decided after the analysis surfaced the invariant conflict).
First chose A, then switched to **D** when the agent flagged (honest-critique) that A violates nuc-monitor's documented
"no edge/no port" invariant and that **D is strictly better**: read Docker's `State.Health.Status` over the *existing*
`docker.sock` (no network change), with the deep DB check living inside each app's `HEALTHCHECK`. Graduated → build plan
`plans/2026-06-17-nuc-monitor-app-health-build.md`. *Reflexion bias:* **read the TARGET's invariants/CLAUDE.md before
recommending an option** — propose at the layer that respects existing isolation (docker.sock) over one that relaxes a
guardrail (joining `edge`); prefer the option that needs no infra/network change when it's also more capable.
> The first C3-sourced idea promoted to a plan. Real gap: `check_docker` only sees container *running* state, never app
> liveness — D closes it by alerting on `unhealthy` (edge-triggered, recovery on `healthy`) via docker.sock; deep readiness
> (Postgres ping) is pushed into each app's in-container HEALTHCHECK. 2 external sources (K8s liveness/readiness; blackbox
> internal-vs-public probing). Exploration-floor WILDCARD for the 2026-06-17 sort (ops/reliability, orthogonal to prior accepts).

### idea-0010 — Testing & spec discipline: tiered SDD-lite + selective TDD + contract testing
state: done · source: user · created: 2026-06-14 · updated: 2026-06-14
gate: pass · moscow: should · reach: 3 impact: 3 confidence: 0.7 effort: 3 · base: 2.1 · interest: SKIPPED (wildcard) · rank: 2.1
proposal: plans/2026-06-14-testing-spec-discipline-proposal.md
outcome: **accept — Option A** (2026-06-14, "theo những gì bạn khuyến nghị") + **idea-0006 folded** (E2E = pyramid top tier).
Graduated → build plan `plans/2026-06-14-testing-spec-discipline-build.md`. *Reflexion bias:* extend-the-spine + evidence-
tiered testing over a parallel SDD tool (B) or a blanket-TDD mandate (C); the multi-user future overrides the solo anti-ceremony prior.
> The exploration-floor wildcard (quality engineering). AC (Given/When/Then, 1 AC→1 test) on the proposal/plan spine;
> selective TDD for pure logic (Nagappan 40–90% defect↓); consumer-driven contract tests for cross-repo seams; E2E sparse
> at the top (idea-0006). 5 verified sources (Nagappan/Spec-Kit/Kiro/Gherkin/Pact).

### idea-0011 — Skill proposer: induce a skill from a repeated process, then PROPOSE it (governance-safe)
state: done · source: user · created: 2026-06-14 · updated: 2026-06-14
gate: pass · moscow: should · reach: 3 impact: 3 confidence: 0.6 effort: 3 · base: 1.8 · interest: 0.6 · rank: 1.96
proposal: plans/2026-06-14-skill-proposer-induction-proposal.md
outcome: **accept — Option A** (2026-06-14, supervisor: "idea 11 phải theo A") — **separate skill** `/skill-proposer`, full
A, auto-detection **hook deferred to Phase 2**. Graduated → build plan `plans/2026-06-14-skill-proposer-build.md`.
*Reflexion bias:* supervisor wants Hermes-style self-improvement but strictly under propose-don't-install — never the closed auto-install loop (B).
> Detect a process repeated ≥3× (rule of three, over day-log + git) → draft SKILL.md via /skill-authoring → self-verify
> (Voyager) → PROPOSE into a sandbox queue; human security-reviews + installs (autonomy-gate blocks .claude/skills/**).
> Diversity + anti-sprawl via dedup + WIP cap + Curator. 4 verified sources (Hermes/Voyager/ADAS/Anthropic).

### idea-0003 — Phase 3: day-log + milestone-anchored memory
state: done · source: user · created: 2026-06-14 · updated: 2026-06-14
gate: pass · moscow: should · reach: 3 impact: 2 confidence: 0.7 effort: 3 · base: 1.4 · interest: 0.6 · rank: 1.53
proposal: plans/2026-06-14-phase3-daylog-memory-proposal.md
outcome: **accept** (2026-06-14) — Option A + folded idea-0002's schema-now half into this build. *Reflexion bias:* the
supervisor favours grounded recall-tier design that defers infra (embeddings) until a real volume trigger.
> Dated session digests `platform/log/YYYY-MM-DD.md` (recall tier, never auto-loaded), RAG-schema-ready frontmatter,
> milestone anchors FK-linking children, event-sourced immutability. **Graduated → build plan
> `plans/2026-06-14-phase3-daylog-memory-build.md`** (this session). 6 verified sources (Park/MemGPT/Zettelkasten/Fowler/RAG-threshold).

### idea-0009 — Resolve Layer-C overlap: does the shipped `/idea` skill already absorb planned C1 `/feature-proposal`?
state: done · source: agent · created: 2026-06-14 · updated: 2026-06-14 · dedup_of: (autonomy plan step C1/C2)
outcome: **accept the fold** (supervisor delegated the call 2026-06-14) — `/idea` already realizes C1+C2; **do NOT build a
separate `/feature-proposal`**. Marked C1/C2 `[x]` in `plans/2026-06-14-autonomous-agent.md` (superseded-by-/idea); kept C3
as the genuinely-distinct *unattended* integration. Added "nothing worth proposing" as a first-class output to the skill.
> GAP-ANALYSIS (grounded in two plan docs, not agent opinion): `plans/2026-06-14-autonomous-agent.md` Layer C **C1** spec'd a
> `/feature-proposal` skill = external-grounded gap-analysis → RFC-lite proposal → halt. The shipped `/idea` skill already
> does exactly that (`/idea sort` gap-analysis + `/idea analyze` → `proposal.md`; bounded backlog = WIP cap; Reflexion oracle
> = `outcome:`). Confirmed a real DUP and folded. *Reflexion bias:* before building a planned skill, check whether a shipped
> one already covers it (don't re-build).

### idea-0001 — Phase 2: user interest model (formalize the interest signal)
state: done · source: user · created: 2026-06-14 · updated: 2026-06-14
gate: pass · moscow: should · reach: 2 impact: 2 confidence: 0.7 effort: 2 · base: 1.4 · interest: 0.7 · rank: 1.55
proposal: plans/2026-06-14-phase2-interest-model-proposal.md
outcome: **accept** (2026-06-14) — supervisor chose full Option A *incl.* the exploration floor; valued bounding the
feedback-loop bias (Mansoury) over minimalism. *Reflexion bias:* future proposals → grounded + bounded + exploration-preserving.
> A per-idea interest *bonus* (≤15%) from a deeper user model. **Shipped 2026-06-14** (same session as accept): derivation
> rules in this file §Rules, the procedure in `.claude/skills/idea/SKILL.md` (`/idea sort`), and the human-tagged
> `## Interest signals` section in `.claude/memory/user-profile.md`. First live re-derive applied in this sort.

### idea-0004 — Autonomy B4: Discord control plane for auto-pilot
state: done · source: agent · created: 2026-06-14 · updated: 2026-06-14
gate: pass · moscow: could · reach: 1 impact: 2 confidence: 0.7 effort: 3 · base: 0.47 · interest: 0.5 · rank: 0.50
proposal: plans/2026-06-14-discord-control-plane.md
outcome: **accept** — supervisor took full scope (B4a+B4b) 2026-06-14; B4b's `autonomy-gate.mjs` edit stays agent-proposes / human-commits.
> Graduated to an accepted RFC driving step **B4** of `plans/2026-06-14-autonomous-agent.md`; shipped and verified live
> (gate-verify 20/20, hook 24/24, Python↔Node interop, e2e approval from phone).
> **⛔ RETIRED 2026-07-28** — the whole control plane was removed along with the auto-pilot orchestrator it served, once
> Claude Code shipped scheduled/remote agents natively. Kept as a tombstone: this idea was *correctly executed* and still
> became waste, because the capability arrived from the platform. That is a cost of building **beside** the harness
> rather than **on** it — the check that would have caught it is now trigger T1 in the self-update loop.

---

## Deferred (someday/maybe — has a revisit trigger)

### idea-0013 — Extract MCP OAuth shim to `@thiengthb/mcp-auth`
state: deferred · source: agent (C3 gap-analysis 2026-06-18) · created: 2026-06-18 · updated: 2026-06-19 · revisit_when: journal (or any 3rd app) adds an MCP server — the rule-of-three extraction trigger
gate: defer · moscow: could · interest: n/a
> **External signal:** `registries/shared-assets.md` row 1 explicitly flags "DUPLICATED — extract candidate (built 2×;
> extract at 3rd app **or now if churn has stopped**)". Churn check: both `todo` and `yakudoku/web` have had
> stable MCP OAuth since 2026-06-13 with no changes. Code is near-identical across repos (auth 38≈39, oauth
> 86≈89, token 63≈67, authorize 124≈129, register 32=32 lines). Security-sensitive glue — a shared package
> means one audit covers all consumers and prevents drift.
> **Deferred 2026-06-19** (supervisor): only 2 stable consumers → extracting now is premature coupling (rule of
> three); the security "one audit covers all" pull doesn't override until the 3rd consumer (journal MCP) makes it
> concrete. Revisit at that trigger.
> **2026-07-28 — trigger ARMED, not fired.** `idea-0023` (MCP platform server) would be the 3rd MCP consumer, but it is
> `proposed`, not built: a proposed consumer is not a consumer. Deliberately left `deferred` rather than revived, so the
> queue doesn't record a rule-of-three that hasn't happened. **Fires automatically iff the supervisor accepts
> `idea-0023`** — at which point extraction is a prerequisite of that build, not a separate idea. Rejected ⇒ stays here
> unchanged.

### idea-0002 — RAG/vector memory MIGRATION (pgvector — build at volume trigger)
state: deferred · source: user · created: 2026-06-14 · updated: 2026-06-14 · revisit_when: corpus crosses ~200K tokens / ~150 files (RAG-threshold research)
gate: pass · moscow: could · interest: 0.8
> **Shrunk 2026-06-14** (idea-0003 decision): the "standardize frontmatter schema now" half is folded into Phase 3's build
> (the day-log defines + uses it, with a nullable `embedding`). What remains here = the *later* migration to journal's
> Postgres+pgvector — purely additive (populate `embedding`), deferred until the corpus is large enough to beat long-context
> (Redis/mmntm ~200K-token threshold; full-context still wins +15–20% under ~1M). No now-build.

### idea-0006 — Playwright E2E suite (deferred from compliance-sync)
state: deferred · source: user · created: 2026-06-14 · updated: 2026-06-14 · revisit_when: as the TOP TIER of idea-0010's testing standard — build the suite when regression risk rises
gate: pass · moscow: could · interest: 0.3
> E2E coverage for the web apps (skill `/playwright-e2e-builder` ready). **Folded into idea-0010** (2026-06-14) as the
> testing pyramid's top tier — no longer a standalone idea; the standard positions it, the suite itself gets built at the trigger.

### idea-0007 — journal /guide page (deferred from compliance-sync)
state: deferred · source: user · created: 2026-06-14 · updated: 2026-06-14 · revisit_when: when journal gets active end-users
gate: pass · moscow: could · interest: 0.3
> In-app `/guide` for the journal app (per `/user-guide`). Deferred; low urgency while single-user.

### idea-0008 — Autonomy B5: full unattended window
state: deferred · source: agent · created: 2026-06-14 · updated: 2026-06-14 · revisit_when: after B4 (idea-0004) ships and is trusted
gate: unknown · moscow: wont · interest: 0.4
> A bounded fully-unattended run window. Gated on B4 + accumulated trust in the gate. Not now.

---

## Tombstones (dead — kept so we don't re-litigate)

_None yet._
