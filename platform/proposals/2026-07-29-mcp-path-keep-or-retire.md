# Proposal — keep or retire the MCP path in `rulebook`?

**Status:** PROPOSED 2026-07-29, awaiting the supervisor. Nothing has been removed.
**Driver:** the Phase 3 verdict + the B′ re-target (`platform/plans/2026-07-29-idea-0023-mcp-platform-server-build.md`)
chose the plugin hook. The MCP server it replaced is still here, and I built it this morning — which is a reason to be
careful about my own judgement, not a reason to keep it.

## In plain terms

The rulebook now delivers rules two ways. Only one of them is in use. The question is whether the other one is a
free option or a slow tax.

## What exactly is at stake

| | Lines | Tests |
| --- | --- | --- |
| **MCP-only** — `server/http.ts`, `server/mcp-server.ts`, `lib/report-lesson.ts`, `lib/request-log.ts` + their tests | **998** | 36 |
| **Shared by both paths** — `lib/check-component.ts`, `rules/frontend.rules.ts`, `scripts/leak-check.mjs`, the plugin artifact test | 1,328 | 54 |

Consumers today: **the MCP server has none.** One `.mcp.json` points at it — `~/projects/scratch-consumer`, the fixture
built at Step 1.4. The quarantine inbox has **no producer** other than that server, so it is currently an empty inbox
guarded by a real gate.

**Not at stake, and not up for discussion:** the promotion gate in `autonomy-gate.mjs` stays either way. It closed a
pre-existing bypass (`cp x .claude/hooks/y.mjs` was ALLOWED unattended) that has nothing to do with this feature and
would have outlived its cancellation.

## The honest case for each

**Keep.** It costs nothing to *run* — nothing is deployed, nothing is billed, no uptime is promised. It is the only
mechanism that can serve a machine that cannot install a plugin (a teammate session, a CI job, an agent on someone
else's box), and Phase 3's verdict was about *hosting economics*, not about the code being wrong. `report_lesson` is
also the only inbound channel this platform has, and the design work in it — untrusted-input handling, the fence, the
minted id, the refusal semantics — is the part that would be expensive to re-derive.

**Retire.** 998 lines and 36 tests are maintained, read, and kept green for a path with zero consumers, and this repo
is now **public** — every reader meets two delivery mechanisms and has to work out which one matters. This platform has
form: it deleted ~6 sessions of orchestration work in July when the harness shipped the same thing natively, and the
ledger's own lesson is that "too much machinery per unit of shipped value" is the disease. An unused mechanism does not
stay correct for free; it rots quietly and is discovered stale at the worst moment.

## Options

| | Option | Cost | Verdict |
|---|---|---|---|
| **A** | **Keep all of it, unchanged, and say so in `00-map`** | 998 lines carried; a reader must be told which path is live | ✅ **Recommended** — see below |
| B | Retire `server/**` + `request-log`, keep `report-lesson` as a library | −565 lines; loses the only inbound channel's transport, keeps its logic | Reasonable if you are confident no non-plugin consumer will appear |
| C | Retire the whole MCP path incl. quarantine + `report_lesson` | −998 lines, and `platform/inbox/quarantine/` becomes dead | Rejected: throws away the untrusted-input design, and the inbox is cheap while empty |
| D | Decide at the 2026-08-12 check-in instead | 0 now | Tempting and wrong — see below |

**Why A (khuyến nghị), stated with its weakness first.** A is the option that does nothing, and "do nothing" is exactly
what a sunk-cost bias would also recommend — so it needs a reason that is not inertia. The reason: **the code is already
finished, tested, and pinned by 36 tests that run in under a second, and its cost is therefore ~0 per week until someone
touches the checker's interface.** Retiring it now buys tidiness, and pays for it by deleting the only channel that
reaches a machine we do not control — a real possibility (agent teams, CI) that Phase 3 never argued against. What A
*does* owe the reader is honesty: `00-map` and the plugin README must say plainly which path is live and that the other
is kept deliberately, so nobody installs the wrong one.

**Why not D.** "Decide later" is how the auto-pilot survived three sessions past its usefulness. The 2026-08-12 check-in
already has one question and it is a different one ("is the hook used?"). Bolting a second decision onto it means both
get answered in a hurry.

## The trigger that makes A falsifiable

A is only defensible while its cost stays near zero. Retire it — Option B or C — the first time **any** of these is true,
and this is the part to hold me to:

1. The checker's interface changes and `server/**` needs edits to keep up (i.e. it stops being free).
2. The 2026-08-12 check-in finds the **hook** unused too — then the whole feature is the question, not this half of it.
3. A second month passes with the MCP server still at zero consumers **and** the quarantine still at zero submissions.

## What I would do on your word

- **A** → two doc edits (`00-map`, plugin README) naming the live path, plus the trigger above recorded in the plan.
- **B** → delete `server/**` + `lib/request-log.*`, keep `lib/report-lesson.*` as a library with its 14 tests, drop the
  `RULEBOOK_LOG_DIR` wiring, update `00-map`/README/INVENTORY, and note in `decisions.md` why the transport went but the
  logic stayed.
- **C** → the above, plus remove `platform/inbox/quarantine/` and tell the supervisor the promotion gate now guards a
  path nothing can reach (still correct, still worth keeping).
