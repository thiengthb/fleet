# fleet — Shared rules for every project in this folder

**Two layers. Know which one you are in.** The *agent OS* (conventions, memory, skills, docs, testing, thinking) is
**machine-agnostic**. The *deployment* layer is **per-target**.

**Every project declares a `target` in `platform/inventory.md §0`** — `nuc` · `local` · `cloud` · `none`. It is DATA:
**read it, never assume.** INVENTORY is the **single source of truth** (app/target/volume/domain/auth) — read before any
lifecycle change; every add/remove-app skill MUST update it. Infra traps → `platform/registries/known-traps.md`.

> **This file is the always-loaded surface: triggers, prohibitions and pointers — not spec.** What may leave (and the one
> thing that may never: a prohibition) = the 4 exit criteria in `platform/standards/documentation.md §7.3`. The word
> budget and the presence of every prohibition are enforced by `.claude/scripts/claude-md-budget.mjs`, not by intentions.

## Invariants A — platform-wide (every project, every machine, every target)

1. **Secrets only in `.env`** (chmod 600, in `.gitignore`) — never hardcode a token/key in compose, Dockerfile, or code.
2. **Never self-code auth** — no hand-rolled login / password hashing / JWT / session minting, on any target. `nuc` ⇒
   Authentik; `local`/`cloud` ⇒ an established library, never a bespoke one.
3. **App data lives in a named volume** (`<name>_data`), never a bind-mount, on any target — it must survive a rebuild
   and be movable between targets.
4. **The repo is the source of truth; a running host is a cache.** Nothing is changed only on a host — commit it here.

## Invariants per target → `platform/targets/<target>/README.md` (read the one that matches, ignore the rest)

`nuc` 🔴 host DOWN since 2026-07-22 — a push is a backup, not a release · `local` Docker on a dev machine, "deploy" =
rebuild the container and verify healthy · `cloud` public the moment it boots and billed while idle · `none` not deployed.
Each target's law, topology and ops live in its own README; the three most damaging NUC invariants are also enforced by
`invariant-warn.mjs`. A target is a **choice, not a ranking** — same engineering standard, different routing, auth
surface and who pays. Changing one is a lifecycle change: re-read the new target's law FIRST, and update `INVENTORY §0`
in the same turn.

## Conventions

- **Dev artifacts = English** (code, comments, `docs/*.md`, skills, specs, commit messages). End-user UI copy = the
  product's language (vi for `todo`); the in-app `/guide` page is the one exempt.
- **Agent ↔ user chat = Vietnamese, always** — every reply/explanation/summary/question/status written TO the user. Does
  NOT override the English dev-artifact rule above; technical tokens (paths, commands, identifiers) stay as-is.
- **Legible decision surface (the user is the supervisor/oracle — they must be able to actually supervise):** ① plain
  everyday language first, jargon a labelled aside · ② flag the recommended option with `(khuyến nghị)` + one plain
  sentence why — ① and ② are checked by `legibility-lint.mjs` · ③ **name the gate** at every approve/accept (which skill,
  which step, what the yes/no does next) — **not checked, so it is on you.** Detail: memory
  `legible-proposals-plain-language`.
- Repo `thiengthb/<repo>`, deploy branch `main`. The per-repo Dockerfile/workflow shape lives in `/app-onboard`; the NUC
  host layout and SSH access live in `platform/targets/nuc/`.

## Coding — skill `/coding-convention` (MANDATORY before writing/editing code or committing)

The procedure + the per-domain rule router (naming · git-commit · typescript-style · ui-rules · react-rules ·
backend-rules) live in `/coding-convention/SKILL.md`, which pulls only the domain file the task touches.

Prohibitions stay here: English Conventional Commits + `commit-msg` / `pre-commit` hooks installed at repo-init; ESM +
Node ≥ 22; Prettier from the skill's `templates/`; **never commit/push unless asked**.

## Frontend — skill `/react-ui-craft` (MANDATORY for any React/Next UI)

The full law is **`.claude/rules/frontend.md`**, path-scoped to UI files: it arrives **automatically and in full** the
moment you touch one, and costs nothing on a session that doesn't. Perf → `/react-best-practices`.

## In-app user guide — skill `/user-guide` (MANDATORY for any app with a UI)

Ship a task-oriented in-app `/guide` page with **one tab per machine-facing integration**, and update that tab in the
SAME change as a new command/tool. The required tabs and what each must contain: the skill. Reference:
`projects/todo/app/guide/page.tsx`.

## Code reuse across projects — skill `/code-reuse`

Independent repos → reuse isn't free, but reinventing wastes tokens+time. **Before building a feature, IN THIS ORDER:**
① read the catalog **`platform/registries/shared-assets.md`** + grep sibling projects · ② **probe the tools already
installed** (`npx shadcn@latest search @<ns>`) · ③ **look outside** (web; P2+ only, Quick tier — P1 skips it and says
so), then write a verdict row **including refusals** into `commons/docs/external-patterns.md`. **Writing original code is
the LAST step, not the first** — an outside source may exceed what the user was able to ask for, and surfacing that is
the job, not scope creep. **FOMO brake:** never pre-build for software that *might* come later — a verdict row is cheap,
an item is expensive. Any reuse/extraction MUST update `registries/shared-assets.md` in the same change.

## Documentation & Knowledge OS — skills `/project-docs` `/project-plan` `/session-wrap`

Full standard: **`platform/standards/documentation.md`** (supervisor's own audit tools: its §7.4).
- **Context-loading path (JIT — read on need, NOT reflexively):** a trivial/chat turn or a single-file edit needs none of
  it. Task TOUCHES a project → read that `<project>/docs/00-map.md`; read `INVENTORY §0` only for a lifecycle/ops change;
  go deeper (`docs/`, `docs/decisions.md`) only when the task needs it. Front-loading all three is the token tax to avoid.
- **Triggers:** end of a substantial pass → `/session-wrap` · a non-obvious decision → `docs/decisions.md` in the same
  commit · multi-session work → a plan file via `/project-plan` · a cross-project lesson → the ledger · an infra trap →
  `registries/known-traps`.
- **Is the second brain still working? ONE command, weekly: `node .claude/scripts/health-sweep.mjs`** — read the VERDICT
  line; `drift` is a candidate list and is **never** auto-acted on.
- **`platform/registries/tool-catalog.md` says what every hook and script IS** — generated; **never hand-edit it**. A new
  tool must carry `@vi WHAT/WHEN/WHY` in its own header or `tool-catalog.mjs --check` fails.

## Agent memory — two tiers, both on native rails (skill `/memory`)

Memory of the **user** (not of the code — that's `decisions.md`). **Litmus:** "at a different computer tomorrow, still
true and useful?" Yes → shared **`.claude/memory/`** (git-synced to every machine, wired as the native auto-memory
directory, capped). No → **`CLAUDE.local.md`** (gitignored, this box only). **One fact = one place; never duplicate
across tiers.** The caps, the per-machine wiring and the write + forgetting procedure live in `/memory`; hygiene is
measured by `node .claude/scripts/memory-audit.mjs`, not remembered.

## Autonomous agent — governance (contract `platform/standards/autonomy-contract.md`)

An unattended/headless run (env `CLAUDE_AUTONOMOUS=1`) runs under a deterministic gate, NOT trust. The T1–T4 tiers, the
queues, the scoring and the gate's behaviour live in the contract. **The prohibitions, which stay here:**

- never push `main` / deploy / run a destructive command unattended;
- the agent **NEVER edits its own governance** (`.claude/settings*.json`, `hooks/**`, `skills/**`, `memory/**`, any
  `CLAUDE.md`, `.github/workflows/**`, `.env*`) — it may *propose*, a human decides (the CVE-2025-53773 lesson).
  Enforced by `autonomy-gate.mjs` (PreToolUse), not by good intentions;
- **two proposers, both propose-don't-install:** `/idea` for FEATURES, `/skill-proposer` for SKILLS — the agent **NEVER
  writes to `.claude/skills/`**. **The supervisor's accept/reject is the oracle — self-scoring in a closed loop is
  forbidden.**
- **Decide → research-before-design → propose, don't execute.** New work is queued for human approval as a
  research-grounded artifact (≥2 external sources, ≥2 options w/ tradeoffs), never self-entered into the build pipeline.

## Thinking & process — match weight to the change (P-tiers), practice-first

**Practice-first: aim for a working, run-it-and-see result FAST; add ceremony only where the stakes earn it.** Tier by
reversibility × blast-radius:

- **P1 — trivial / reversible** (copy/text, a small fix, a shape built before): `/coding-convention` only. **SKIP**
  brainstorm / research / plan-file / docs. Build → run → done.
- **P2 — medium** (a small feature, one module, a non-obvious bug): + tests + `/verification-before-completion`. Research
  ONLY on a real unknown (Quick tier), **never by default**.
- **P3 — large / irreversible / novel** (architecture, a new dependency, security, schema/data, topology): the full spine
  — `/idea` → `/brainstorming` → research-before-design (≥2 sources) → proposal → `/project-plan` → docs. A human accepts
  before an idea becomes a plan. **Do NOT run this spine for P1/P2** — that's the ceremony tax to cut.
- **Thin-slice first:** build the smallest END-TO-END thing that actually RUNS before governance / docs / exhaustive
  tests. Machinery-before-value is how a feature dies across sessions — "verified" but never used.
- **`/honest-critique` at every decision point** (always; it's cheap). **No reflexive "You're absolutely right!"**
- **Before commit:** `/lint-and-validate` → `/verification-before-completion` (run it, read the output, THEN claim).
  **Debug:** `/systematic-debugging` (root cause first; ≥3 failed fixes ⇒ question the architecture).

Reference skills auto-fire by topic; the catalog and per-skill verdicts: `platform/registries/skill-candidates.md`.

## Model routing, parallelism & web research — the token levers (detail + §3 parallel/async: `platform/standards/token-and-research.md`)

**Target the *right* amount, never the *minimum*** — never trade away reasoning depth; only cut wasted context and
over-powered staffing on mechanical work.
- **Model choice is session-level** (the agent cannot switch itself): architectural / security / multi-file / ambiguous /
  UI-craft → **Opus**; a whole session of well-specified bulk-mechanical work → Sonnet. **`/model` gotcha: Enter
  persists globally — press `s` for this session only.**
- **The lever with no quality tradeoff:** Opus stays the main loop; delegate heavy-but-mechanical work to
  **cheaper-model subagents** under Opus review, and **announce every downgrade up front** (`label: 2–3-word task →
  model`). But for internal investigation the main loop already holds context for, work **directly** — a cold subagent
  costs more.
- **Web research is the biggest single sink.** **Search wide, fetch narrow** · **distill at the edge** · **tier it and
  say so before escalating — Quick is the DEFAULT** for any unqualified "research X", **Deep** only on an explicit
  "deep/kỹ/thorough" ask. The main loop owns the fetched-URL set — **never refetch**.

## Project lifecycle & ops — use the right skill, don't improvise

**Check the project's `target` first** (INVENTORY §0) — the `/nuc-*` skills apply to `target: nuc` only.
**onboard/new** → `/app-onboard` · **remove** → `/app-remove` (confirm data loss + no impact FIRST; the teardown order is
its own procedure) · **audit/cleanup** → `/host-audit` (**report only** — every destructive action asks) · **protect
(login/SSO/authz)** → `/app-protect` · **env/secrets** → `/app-env` (**the agent never receives secret values**) ·
**web is broken** → debug by layer DNS → tunnel → Traefik → app, symptom table in
`targets/nuc/architecture-and-operations.md §7`.
