# fleet — Shared rules for every project in this folder

**Two layers. Know which one you are in.** The *agent OS* (conventions, memory, skills, docs, testing, thinking) is
**machine-agnostic** — identical on the NUC, this PC, a laptop, a VPS. The *deployment* layer is **per-target**.

**Every project declares a `target` in `platform/inventory.md §0`** — `nuc` · `local` · `cloud` · `none`. It is DATA:
**read it, never assume.** INVENTORY is the **single source of truth** (app/target/volume/domain/auth) — read before
any lifecycle change; every add/remove-app skill MUST update it. Cross-cutting infra traps → `platform/registries/known-traps.md`.

## Invariants A — platform-wide (every project, every machine, every target)

1. **Secrets only in `.env`** (chmod 600, in `.gitignore`) — never hardcode a token/key in compose, Dockerfile, or code.
2. **Never self-code auth** — no hand-rolled login / password hashing / JWT / session minting, on any target. On `nuc`
   that means Authentik; on `local`/`cloud` an established library — never a bespoke one.
3. **App data lives in a named volume** (`<name>_data`), never a bind-mount, on any target — it must survive a rebuild
   and be movable between targets.
4. **The repo is the source of truth; a running host is a cache.** Nothing is changed only on a host — commit it here.

## Invariants per target → `platform/targets/<target>/README.md` (read the one that matches, ignore the rest)

| `target` | Means | Its law |
|---|---|---|
| `nuc` | git → ghcr → Watchtower → Traefik → `/opt/apps/<name>`. 🔴 host DOWN since 2026-07-22 — a push is a backup, not a release | `targets/nuc/` — 7 invariants (in `architecture-and-operations §0`) + ops · setup · agent rebuild runbook |
| `local` | Docker on a dev machine; ports published to the host, no Traefik/Authentik. **"Deploy" = rebuild the container and verify healthy** | `targets/local/` |
| `cloud` | A VPS / managed runtime — **public the moment it boots**, and billed while idle | `targets/cloud/` (written 2026-07-28, not yet exercised) |
| `none` | Not deployed (meta / shared) | — |

A target is a **choice, not a ranking**: they differ in routing, auth surface and who pays — not in engineering
standard, so moving between them is a config change. Changing a project's target is a lifecycle change: update
`INVENTORY §0` in the same turn and re-read the new target's law first. The three most damaging NUC invariants
(certbot, self-hosted runner, host port-publish) are enforced in code by `invariant-warn.mjs`, not by memory.

## Conventions

- Repo `thiengthb/<repo>`, deploy branch `main`. Each repo needs a `Dockerfile` (`EXPOSE` + `HEALTHCHECK` where possible)
  + `.github/workflows/deploy.yml` (copy from a living ghcr app — `nuc-monitor`/`todo`).
- `target: nuc` only — on the NUC `/opt/apps/<name>/` = `docker-compose.yml` + `.env` + `.gitignore` (a repo compose is
  local-dev ONLY); SSH `ssh thien25@thienminiserver` (key installed; user in the docker group).
- **Dev artifacts = English** (code, comments, `docs/*.md`, skills, specs, commit messages). End-user UI copy = the
  product's language (vi for `todo`); the in-app `/guide` page is the one exempt.
- **Agent ↔ user chat = Vietnamese, always** — every reply/explanation/summary/question/status written TO the user. Does
  NOT override the English dev-artifact rule above; technical tokens (paths, commands, identifiers) stay as-is.
- **Legible decision surface (the user is the supervisor/oracle — they must be able to actually supervise):**
  ① **plain everyday language first** — lead with "what this means / what happens next"; jargon (RICE, MemGPT, tier
  names) is a labelled aside, never the main thread. ② **flag the recommended option** on every option list (chat AND
  docs) with `(khuyến nghị)` + one plain sentence why. ③ **name the gate** at every approve/accept — which skill, which
  workflow step, what the yes/no does next. Detail: memory `legible-proposals-plain-language`.

## Coding — skill `/coding-convention` (MANDATORY before writing/editing code or committing)

Procedure + checklist live in `/coding-convention/SKILL.md`. The actual rules load on demand from
`coding-convention/references/<domain>.md` — pull only the file the task touches:

naming/style → `naming.md` · commits + branch + hooks → `git-commit.md` · TS/JS + Prettier + lint gate →
`typescript-style.md` · frontend stack + 5 UI rules → `ui-rules.md` · React component/hook/state/server-vs-client →
`react-rules.md` · server action / route handler / Prisma / health → `backend-rules.md`.

Hard invariants (SKILL only loads procedure): English Conventional Commits + `commit-msg` / `pre-commit` hooks installed
at repo-init; ESM + Node ≥ 22; Prettier from the skill's `templates/`; never commit/push unless asked.

## Frontend — skill `/react-ui-craft` (MANDATORY for any React/Next UI)

Full law lives in **`.claude/rules/frontend.md`**, path-scoped to `**/*.tsx|jsx|css` + `**/components/**` — it loads
automatically and in full the moment you touch a UI file, and costs nothing on sessions that don't. It carries: the
`PageShell` page-frame std (`platform/standards/ui-layout.md`), the React 19 + Next App Router + Tailwind v4 +
shadcn/ui + Motion stack, the ship-by-default quality floor + frontend security, the mandatory-UI list (shadcn only ·
CSS-var theming · sonner · **lucide icons only** · no emoji as icon), and `/ui-pattern-lock`. Perf → `/react-best-practices`.

## In-app user guide — skill `/user-guide` (MANDATORY for any app with a UI)

Ship a task-oriented in-app `/guide` page. **One tab per machine-facing integration:** Discord → setup + command table +
notification types + troubleshooting; MCP → endpoint+auth, how to connect, tool table, safety. New command/tool ⇒ update
the tab **in the same change**. Reference: `projects/todo/app/guide/page.tsx`.

## Code reuse across projects — skill `/code-reuse`

Independent repos → reuse isn't free, but reinventing wastes tokens+time. **Before building a feature:** read the catalog
**`platform/registries/shared-assets.md`** + grep sibling projects for prior art. **Rule of three:** 1× build local · 2× log
as DUPLICATED · 3× same-shape+stable ⇒ extract (earlier = premature coupling). **Hybrid share:** visual → `commons`
copy-in; heavy+stable+security glue (e.g. the MCP OAuth shim) → a `@thiengthb/*` package baked at CI build; lighter →
copy-in. Extract the **glue**, keep the **feature** local. Any reuse/extraction MUST update `registries/shared-assets.md` in the
same change.

## Documentation & Knowledge OS — skills `/project-docs` `/project-plan` `/session-wrap`

Full standard: **`platform/standards/documentation.md`**. Goal: understand a project in one cheap read; knowledge accumulates
across sessions instead of evaporating.
- **Context-loading path (JIT — read on need, NOT reflexively):** a trivial/chat turn or a single-file edit needs NONE
  of these. When a task TOUCHES a project, read that `<project>/docs/00-map.md` (AI-primer); read `INVENTORY §0` only for
  a project-lifecycle / ops change; go deeper (`docs/` + `docs/decisions.md`) only when the task needs it. Front-loading
  all three every session is the per-session token tax to avoid. **Keep each `CLAUDE.md` thin** (rules+invariants+pointers);
  heavy spec lives in `docs/` (it costs context every turn).
- **Two pillars per project:** `docs/00-map.md` (essence·modules·flows·invariants·secrets) + `docs/decisions.md`
  (append-only why-log). A web-app adds `01-product`/`02-technical`/`03-user-guide` (`standards/documentation` §3).
- **Multi-session work** (feature/refactor/migration/hard bug) → persist a plan via `/project-plan` in
  `docs/plans/YYYY-MM-DD-<slug>.md` (complements `/plan` mode; small same-session changes get no file).
- **Skills:** `/project-docs` scaffolds/audits the doc-set · `/project-plan` persists a multi-session plan · `/session-wrap`
  closes a session (write `decisions.md`, update `00-map`, distill finished plans, and for a cross-project lesson: full
  entry in `platform/ledger/YYYY-MM.md` **+** one index row in `registries/knowledge-ledger.md` — **never paste detail into
  the index**, that is how it reached 421KB). Infra traps → `registries/known-traps`.
- **Convention:** end of a substantial pass → `/session-wrap`; a non-obvious decision → `decisions.md` (same commit).
- **Is the second brain still working? ONE command: `node .claude/scripts/health-sweep.mjs`** (weekly, the
  supervisor's own check — read the VERDICT line). It runs every checker and labels what each *clean* result
  actually proves. `BROKEN` blocks other work; `drift` is a candidate list and is **never** auto-acted on.
  Per-file metrics for a human to audit the agent with → `platform-report.mjs` (monthly). Retiring anything →
  **`attic.mjs` only**: stage → ≥30 days + ≥4 sessions → verify → *the human* deletes. It has no delete command
  by design; the burden of proof is on removal (memory `preserve-data-prove-before-removing`, plan
  `plans/2026-07-30-second-brain-audit.md`). **After any move/rename, re-run every discovery tool and compare
  COUNTS to a pre-change baseline** — one folder move silently broke five of them, all still exiting 0.

## Agent memory — two tiers, both on native rails (skill `/memory`)

Memory of the **user** (not of the code — that's `decisions.md`). Both tiers ride a mechanism Claude Code enforces
itself; neither is hand-rolled. Mechanics + write procedure live in `/memory` — keep this thin.

- **Shared → `.claude/memory/`** (git-synced, on every machine), wired as the native **auto-memory** directory via
  `autoMemoryDirectory` in each machine's gitignored `.claude/settings.local.json`. That buys enforcement, not just
  convention: `MEMORY.md` capped at **200 lines / 25KB** (a write past it *errors*; content past it is silently dropped
  at load), an automatic `modified` timestamp per file, and a merge/drop-stale nudge as the index fills. Topic files are
  **not** preloaded — read on demand. Write almost everything here.
- **Local → `CLAUDE.local.md`** (gitignored, this box only): a local path, hostname, a tool quirk. *Not* a second memory
  directory — Claude Code supports exactly one, and a second has no index and never loads (that bug hid a Docker note
  for 4 days; found 2026-07-28).

**Litmus:** "at a different computer tomorrow, still true and useful?" Yes → shared. No → `CLAUDE.local.md`.
**One fact = one place; never duplicate across tiers.** Hygiene is measured, not remembered:
`node .claude/scripts/memory-audit.mjs` reports size, index drift, orphans, overlap and staleness — report-only, a human
decides. A new machine needs `git pull` **plus** its own `settings.local.json`; `.claude/hooks/memory-wiring-check.mjs`
says so at session start if it's missing.

## Autonomous agent — governance (contract `platform/standards/autonomy-contract.md`)

An unattended/headless run (env `CLAUDE_AUTONOMOUS=1`) runs under a deterministic gate, NOT trust. Durable contract +
tiers: `standards/autonomy-contract.md`; roadmap: `plans/2026-06-14-autonomous-agent.md`.
- **Hard, non-negotiable:** never push `main` / deploy / run a destructive command unattended; and the agent **NEVER
  edits its own governance** (`.claude/settings*.json`, `hooks/**`, `skills/**`, `memory/**`, any `CLAUDE.md`,
  `.github/workflows/**`, `.env*`) — it may *propose*, a human commits (the CVE-2025-53773 lesson). Enforced by
  `autonomy-gate.mjs` (PreToolUse), not by good intentions. **Tiers:** T1 read / T2 reversible-local-branch →
  autonomous; T3 outward (PR/Discord/dep/CI) → notify+gate; T4 irreversible/high-blast → hard-blocked. Test: "undo in
  <5 min, no external side-effect?" No ⇒ T4.
- **Decide → research-before-design → propose, don't execute.** New work is proposed as a research-grounded artifact
  (≥2 external sources, ≥2 options w/ tradeoffs) queued for human approval — never self-entered into the build pipeline.
  Pure self-critique is unreliable ⇒ ground gap-analysis in external standards, not the agent's opinion.
- **Two proposers, both propose-don't-install:** `/idea` + `registries/idea-queue.md` for FEATURES (gate-then-score ranking; the
  supervisor's accept/reject is the oracle — self-scoring in a closed loop is forbidden), and `/skill-proposer` +
  `skill-proposals/` for SKILLS (induces a draft from a process repeated ≥3×; the agent NEVER writes to
  `.claude/skills/` — drafting = T2, installing = a human move = T4, gate-blocked).

## Thinking & process — match weight to the change (P-tiers), practice-first

**Practice-first: aim for a working, run-it-and-see result FAST; add ceremony only where the stakes earn it.** Match
process weight to the change, mirroring the autonomy T1–T4 by reversibility × blast-radius:

| Tier | The change | Process |
|---|---|---|
| **P1 — trivial / reversible** | copy/text, a small fix, a CRUD shape built before | `/coding-convention` only. **SKIP** brainstorm / research / plan-file / docs. Build → run → done |
| **P2 — medium** | a small feature, one module, a non-obvious bug | + tests + `/verification-before-completion`. Research ONLY on a real unknown (a Quick-tier lookup), **never by default** |
| **P3 — large / irreversible / novel** | architecture, a new dependency, security, schema/data, topology | Full spine: `/brainstorming` → research-before-design (≥2 sources, tiered) → proposal → `/project-plan` → docs |

- **Thin-slice first:** build the smallest END-TO-END thing that actually RUNS (build → execute →
  observe) BEFORE governance / docs / exhaustive tests. Machinery-before-value is how a feature dies across sessions —
  "verified" but never used.
- **`/honest-critique`** — at every decision point (always; it's cheap): truth over comfort, lead with the counter-case,
  red-team your own output, concede fast. **No reflexive "You're absolutely right!"**
- **The spine is P3-only:** `/idea` (backlog: capture · gate-then-score · push back on biased/infeasible/dup) →
  `/brainstorming` (frame + 2-3 approaches + tradeoffs) → `/project-plan` (persist multi-session work). Propose-don't-execute:
  a human accepts before an idea becomes a plan. **Do NOT run this spine for P1/P2** — that's the ceremony tax to cut.
- **Before commit (scale depth to the change):** `/lint-and-validate` → `/verification-before-completion` (run it, read
  the output, THEN claim). **Debug:** `/systematic-debugging` (root cause first; ≥3 failed fixes ⇒ question the architecture).

> **Reference skills (auto-fire by topic):** data → `/prisma-expert`+`/database-design` · React perf →
> `/react-best-practices` · Dockerfile → `/docker-expert` · MCP → `/mcp-builder` · external-API →
> `/api-integration-specialist` · Python async → `/async-python-patterns` · system decision → `/architecture` ·
> deps → `/dependabot-review`+`/supply-chain-guard` · testing → `/testing-standard` (router; standard
> `platform/standards/testing.md`) → `/vitest-server-actions`+`/playwright-e2e-builder` · authoring a skill →
> `/skill-authoring`. Catalog + verdicts: `platform/registries/skill-candidates.md`.

## Model routing, parallelism & web research — the token levers (detail: `platform/standards/token-and-research.md` — incl. §3 parallel/async: subagents · worktrees · background · `/schedule`)

**Target the *right* amount, never the *minimum*** — never trade away reasoning depth; only cut wasted context and
over-powered staffing on mechanical work.
- **Session-level model choice** (the agent cannot switch itself). Architectural / security / multi-file / ambiguous /
  UI-craft → **Opus**; a whole session of well-specified bulk-mechanical work → Sonnet. **`/model` gotcha: Enter
  persists globally — press `s` for this session only.**
- **The lever with no quality tradeoff:** Opus stays the main loop (orchestrator + reviewer); delegate heavy-but-mechanical
  work (wide reads, fan-out search, bulk transforms) to **cheaper-model subagents** — their context is isolated, and Opus
  reviews before accepting. **Announce every downgrade up front**, one line each: `label: 2–3-word task → model`. But for
  internal investigation the main loop already holds context for, work **directly** — a cold subagent costs more.
- **Web research is the biggest single sink.** ① **Search wide, fetch narrow** — never WebFetch unless a snippet is
  *both* load-bearing *and* insufficient. ② **Distill at the edge** — a fetch subagent returns `claim + 1–2-sentence
  extract + URL`, never the page. ③ **Tier it, and say so before escalating: Quick** (DEFAULT for any unqualified
  "research X": 1–2 WebSearch, ≤2 fetches, **no fan-out**) → **Standard** (1 Haiku scout → Opus picks ≤5 URLs → Sonnet
  fetch+distill → Opus synthesize) → **Deep** (ONLY on an explicit "deep/kỹ/thorough" ask; ≤12 pages). ④ The main loop
  owns the fetched-URL set — never refetch.

## Project lifecycle & ops — use the right skill, don't improvise

**Check the project's `target` first** (INVENTORY §0) — the `/nuc-*` skills apply to `target: nuc` only.
**onboard/new** → `/app-onboard` · **remove** → `/app-remove` (confirm data loss + no impact FIRST; then
code → container+volume+image+dir → Authentik provider/group → subdomain 404s → update INVENTORY + `auth-apps.md`) ·
**audit/cleanup** → `/host-audit` (**report only** — every destructive action asks) · **protect (login/SSO/authz)**
→ `/app-protect`, registry + traps in `projects/authentik/docs/auth-apps.md` · **env/secrets** → `/app-env` (from the
LOCAL mirror `~/.nuc-env/<app>.env` over ssh STDIN; the agent never receives secret values) · **web is broken** → debug
by layer DNS → tunnel → Traefik → app, symptom table in `targets/nuc/architecture-and-operations.md §7`.
