# fleet — Shared rules for every project in this folder

**Two layers. Know which one you are in.** The *agent OS* (conventions, memory, skills, docs, testing, thinking) is
**machine-agnostic** — identical on the NUC, this PC, a laptop, a VPS. The *deployment* layer is **per-target**.

**Every project declares a `target` in `platform/inventory.md §0`** — `nuc` · `local` · `cloud` · `none`. It is DATA:
**read it, never assume.** INVENTORY is the **single source of truth** (app/target/volume/domain/auth) — read before
any lifecycle change; every add/remove-app skill MUST update it. Cross-cutting infra traps → `platform/registries/known-traps.md`.

> **This is the always-loaded surface: it holds triggers, invariants and pointers — not spec.** What may move out of
> here (and the one thing that may never: a prohibition) = the 4 exit criteria in
> `platform/standards/documentation.md §7.3`. Heavy spec belongs where its trigger fires — a path-scoped
> `.claude/rules/*.md`, a skill's `references/`, or a `platform/standards/*.md`.

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

A target is a **choice, not a ranking**: they differ in routing, auth surface and who pays — not in engineering standard,
so moving between them is a config change. Changing one is a lifecycle change: update `INVENTORY §0` in the same turn and
re-read the new target's law first. (The three most damaging NUC invariants are enforced by `invariant-warn.mjs`.)

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
  ① **plain everyday language first** — lead with "what this means / what happens next"; jargon is a labelled aside,
  never the main thread. ② **flag the recommended option** on every option list with `(khuyến nghị)` + one plain sentence
  why. ③ **name the gate** at every approve/accept — which skill, which step, what the yes/no does next. ① and ② are
  checked by `legibility-lint.mjs`; ③ is not, so it is on you. Detail: memory `legible-proposals-plain-language`.

## Coding — skill `/coding-convention` (MANDATORY before writing/editing code or committing)

The procedure + the per-domain rule router (naming · git-commit · typescript-style · ui-rules · react-rules ·
backend-rules) live in `/coding-convention/SKILL.md`, which pulls only the domain file the task touches.

Hard invariants stay here because they are prohibitions: English Conventional Commits + `commit-msg` / `pre-commit`
hooks installed at repo-init; ESM + Node ≥ 22; Prettier from the skill's `templates/`; **never commit/push unless asked**.

## Frontend — skill `/react-ui-craft` (MANDATORY for any React/Next UI)

The full law — page-frame std, stack, quality floor, frontend security, the mandatory-UI list, `/ui-pattern-lock` — is
**`.claude/rules/frontend.md`**, path-scoped to `**/*.tsx|jsx|css` + `**/components/**`: it arrives **automatically and
in full** the moment you touch a UI file, and costs nothing on a session that doesn't. Perf → `/react-best-practices`.

## In-app user guide — skill `/user-guide` (MANDATORY for any app with a UI)

Ship a task-oriented in-app `/guide` page with **one tab per machine-facing integration** (Discord, MCP), and update
that tab in the SAME change as a new command/tool. Required tabs + what each must contain: the skill. Reference:
`projects/todo/app/guide/page.tsx`.

## Code reuse across projects — skill `/code-reuse`

Independent repos → reuse isn't free, but reinventing wastes tokens+time. **Before building a feature, IN THIS ORDER:**
① read the catalog **`platform/registries/shared-assets.md`** + grep sibling projects · ② **probe the tools already
installed** — `npx shadcn@latest search @<ns>`: 8 community namespaces resolve with **no config at all** (~3.4k items,
measured 2026-07-30) · ③ **look outside** (web; P2+ only, Quick tier — P1 skips it and says so), then write a verdict row
**including refusals** into `commons/docs/external-patterns.md`. **Writing original code is the LAST step, not the
first** — an outside source may exceed what the user was able to ask for, and surfacing that is the job, not scope creep.
**FOMO brake:** never pre-build for software that *might* come later — a verdict row is cheap, an item is expensive
(`commons`: 27 proven items, **0 installs** so far). The rule of three, the hybrid-share choice (`commons` copy-in vs a
baked `@thiengthb/*` package) and "extract the **glue**, keep the **feature** local" live in the skill. Any
reuse/extraction MUST update `registries/shared-assets.md` in the same change.

## Documentation & Knowledge OS — skills `/project-docs` `/project-plan` `/session-wrap`

Full standard: **`platform/standards/documentation.md`**. Goal: understand a project in one cheap read; knowledge accumulates
across sessions instead of evaporating.
- **Context-loading path (JIT — read on need, NOT reflexively):** a trivial/chat turn or a single-file edit needs NONE
  of these. When a task TOUCHES a project, read that `<project>/docs/00-map.md` (AI-primer); read `INVENTORY §0` only for
  a project-lifecycle / ops change; go deeper (`docs/` + `docs/decisions.md`) only when the task needs it. Front-loading
  all three every session is the per-session token tax to avoid.
- **Two pillars per project:** `docs/00-map.md` (essence·modules·flows·invariants·secrets) + `docs/decisions.md`
  (append-only why-log); **multi-session** work (feature/refactor/migration/hard bug) gets a plan file via
  `/project-plan`. Skeletons, the doc-set per `kind`, and the ledger's index-vs-detail invariant live in the standard and
  in `/session-wrap` Step 4. Infra traps → `registries/known-traps`.
- **Convention:** end of a substantial pass → `/session-wrap`; a non-obvious decision → `decisions.md` (same commit).
- **Is the second brain still working? ONE command, weekly: `node .claude/scripts/health-sweep.mjs`** — read the VERDICT
  line; `drift` is a candidate list and is **never** auto-acted on. The other audit tools, `attic`'s stage→verify→*human*-
  deletes rule, and "after any move, re-run every discovery tool and compare COUNTS" → `documentation.md §7.4`.
- **What every hook and script IS: `platform/registries/tool-catalog.md`** — one generated page, in Vietnamese, for the
  supervisor. Trigger + blocking power are read from `settings.json` + source, so they cannot lie; the prose lives as
  `@vi WHAT/WHEN/WHY` in each tool's own header. **A new tool must add those tags** or `tool-catalog.mjs --check` (in
  the weekly sweep) fails. Never hand-edit the page.

## Agent memory — two tiers, both on native rails (skill `/memory`)

Memory of the **user** (not of the code — that's `decisions.md`). Both tiers ride a mechanism Claude Code enforces
itself; neither is hand-rolled.

**Litmus:** "at a different computer tomorrow, still true and useful?" Yes → **shared `.claude/memory/`** (git-synced to
every machine, wired as the native auto-memory directory, `MEMORY.md` hard-capped — write almost everything here). No →
**`CLAUDE.local.md`** (gitignored, this box only: a local path, a hostname, a tool quirk). **One fact = one place; never
duplicate across tiers.** The caps, the per-machine wiring, and the write + forgetting procedure live in `/memory`;
hygiene is measured by `node .claude/scripts/memory-audit.mjs`, not remembered.

## Autonomous agent — governance (contract `platform/standards/autonomy-contract.md`)

An unattended/headless run (env `CLAUDE_AUTONOMOUS=1`) runs under a deterministic gate, NOT trust.
- **Hard, non-negotiable — these are prohibitions, so they stay here:** never push `main` / deploy / run a destructive
  command unattended; and the agent **NEVER edits its own governance** (`.claude/settings*.json`, `hooks/**`,
  `skills/**`, `memory/**`, any `CLAUDE.md`, `.github/workflows/**`, `.env*`) — it may *propose*, a human decides (the
  CVE-2025-53773 lesson). Enforced by `autonomy-gate.mjs` (PreToolUse), not by good intentions. **Tiers:** T1 read / T2
  reversible-local-branch → autonomous; T3 outward (PR/Discord/dep/CI) → notify+gate; T4 irreversible/high-blast →
  hard-blocked. Test: "undo in <5 min, no external side-effect?" No ⇒ T4.
- **Decide → research-before-design → propose, don't execute.** New work is queued for human approval as a
  research-grounded artifact (≥2 external sources, ≥2 options w/ tradeoffs), never self-entered into the build pipeline —
  pure self-critique is unreliable, so ground gap-analysis in external standards, not the agent's opinion.
- **Two proposers, both propose-don't-install:** `/idea` for FEATURES, `/skill-proposer` for SKILLS (the agent NEVER
  writes to `.claude/skills/`). **The supervisor's accept/reject is the oracle — self-scoring in a closed loop is
  forbidden.** Queues, scoring and the gate's behaviour: the contract; roadmap `plans/2026-06-14-autonomous-agent.md`.

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

> **Reference skills auto-fire by topic** — data, React perf, Docker, MCP, external APIs, Python async, system decisions,
> dependency review, testing (`/testing-standard` routes to the rest), skill authoring. The catalog, the per-skill
> verdicts and which standard each one implements: `platform/registries/skill-candidates.md`.

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
- **Web research is the biggest single sink.** **Search wide, fetch narrow** · **distill at the edge** (a fetch subagent
  returns `claim + 1–2-sentence extract + URL`, never the page) · **tier it and say so before escalating — Quick is the
  DEFAULT** for any unqualified "research X", **Deep** only on an explicit "deep/kỹ/thorough" ask. The main loop owns the
  fetched-URL set — never refetch. What each tier may spend: the standard.

## Project lifecycle & ops — use the right skill, don't improvise

**Check the project's `target` first** (INVENTORY §0) — the `/nuc-*` skills apply to `target: nuc` only.
**onboard/new** → `/app-onboard` · **remove** → `/app-remove` (confirm data loss + no impact FIRST; the teardown order
and the auth/subdomain cleanup are its own procedure) · **audit/cleanup** → `/host-audit` (**report only** — every
destructive action asks) · **protect (login/SSO/authz)** → `/app-protect`, registry + traps in
`projects/authentik/docs/auth-apps.md` · **env/secrets** → `/app-env` (from the LOCAL mirror `~/.nuc-env/<app>.env` over
ssh STDIN; the agent never receives secret values) · **web is broken** → debug by layer DNS → tunnel → Traefik → app,
symptom table in `targets/nuc/architecture-and-operations.md §7`.
