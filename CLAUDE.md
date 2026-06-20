# MiniServer — Shared rules for every project in this folder

Every project in `D:\Projects\MiniServer\` deploys to the NUC `thienminiserver` via a fixed chain (built 2026-06-07):

```
git push main → GitHub Actions build → ghcr.io/thiengthb/<repo> (:latest + :<sha>)
→ Watchtower on the NUC auto-pulls (≤60s) → Traefik → Cloudflare Tunnel → *.thientnse.site
```

**`nuc-platform/INVENTORY.md` = the SINGLE source of truth** (every app/volume/domain/auth/monitor) — read it before any
project-lifecycle change; every add/remove-app skill MUST update it (anti-drift). Other docs: `01-architecture-and-operations.md`
(ops), `02-known-traps.md` (traps), `03-SETUP-FROM-SCRATCH.md` (rebuild). **NUC reset / needs rebuilding → follow
`04-agent-rebuild-runbook.md`.**

## Invariants — MUST NOT be violated in any project

1. **NUC only PULLs images** — no self-hosted runner, no SSH-deploy from CI, no build-on-NUC (except deliberate firefighting).
2. **One shared Docker network `edge`** — infra (`/opt/infra`) creates it; apps reference `external: true`, never publish
   ports to the host (only Traefik reaches apps over the network).
3. **Public = label** — Traefik `exposedbydefault=false`; an app is public **iff** it has the 4 `traefik.*` labels. A new
   subdomain needs no Cloudflare change (the wildcard `*.thientnse.site` already catches it).
4. **Secrets only in `.env`** (chmod 600, in `.gitignore`) — never hardcode a token/key in compose, Dockerfile, or code.
5. **Dual image tag `latest` + short git-SHA** — rollback = pin the SHA tag in the NUC compose, do NOT revert git.
6. **TLS by Cloudflare** — do not configure Let's Encrypt/certbot anywhere.
7. **Traefik ≥ v3.7; Watchtower needs `DOCKER_API_VERSION=1.44`** (Docker 29 dropped API < 1.40 — a violation fails
   silently, see doc 02).
8. **Auth = Authentik** (IdP `auth.thientnse.site`, `/opt/apps/authentik`) — never self-code login / password hashing /
   JWT / session minting. Protect an app = forward-auth (middleware `authentik@docker`); authorize = app reads the
   `X-authentik-*` headers; link users by **email**. **NEVER** forward-auth an endpoint a machine client calls
   automatically. Authentik = prebuilt image → NO Watchtower label (update manually, bump `AUTHENTIK_TAG`).

## Conventions

- Repo `thiengthb/<repo>`, deploy branch `main`. Each repo needs a `Dockerfile` (`EXPOSE` + `HEALTHCHECK` where possible)
  + `.github/workflows/deploy.yml` (copy from a living ghcr app — `nuc-monitor`/`todo`).
- On the NUC: `/opt/apps/<name>/` = `docker-compose.yml` + `.env` + `.gitignore` (any repo compose is local-dev ONLY).
  App data = a named volume (`<name>_data`), no bind-mount.
- SSH: `ssh thien25@thienminiserver` (key installed; user in the docker group).
- **Dev artifacts = English** (code, comments, `docs/*.md`, skills, specs, commit messages). End-user UI copy = the
  product's language (vi for `todo`); the in-app `/guide` page is the one exempt.
- **Agent ↔ user chat = Vietnamese, always** — every reply/explanation/summary/question/status written TO the user. Does
  NOT override the English dev-artifact rule above; technical tokens (paths, commands, identifiers) stay as-is.
- **Legible decision surface (the user is the supervisor/oracle — they must be able to actually supervise):**
  ① **Explain in plain, everyday language first** — lead with "what this means / what happens next"; keep jargon (RICE,
  MemGPT, tier names) as a labelled aside, never the main thread. ② **Flag the recommended option** — on every option
  list (chat AND docs) mark my pick `(khuyến nghị)` + one plain sentence why; don't make the user infer it. ③ **Name the
  gate at every approve/accept** — state which skill + which workflow step the gate belongs to and what the user's yes/no
  does next (e.g. "đây là bước *human-accept* của `/idea` → `/project-plan`"). Detail: memory `legible-proposals-plain-language`.

## Coding — skill `/coding-convention` (MANDATORY before writing/editing code or committing)

Procedure + checklist live in `/coding-convention/SKILL.md`. The actual rules load on demand from
`coding-convention/references/<domain>.md` — pull only the file the task touches:

- naming / general style (`const`/`===`/early return) → `references/naming.md`
- commit message + branch + hook setup → `references/git-commit.md`
- TS / JS, Prettier, lint/build gate → `references/typescript-style.md`
- mandatory frontend stack + 5 UI rules → `references/ui-rules.md`
- React component / hook / state / server-vs-client → `references/react-rules.md`
- server action / route handler / Prisma / health endpoint → `references/backend-rules.md`

Hard invariants (SKILL only loads procedure): English Conventional Commits + `commit-msg` / `pre-commit` hooks installed
at repo-init; ESM + Node ≥ 22; Prettier from the skill's `templates/`; never commit/push unless asked.

## Frontend — skill `/react-ui-craft` (MANDATORY for any React/Next UI)

Owns architecture/composition/state/motion/UX-states/security (`/coding-convention` owns naming/commits/Prettier). Read
`SKILL.md` first; open a ref (`architecture`/`components`/`motion`/`ux`/`security`) when needed — the 7-step + full detail
live there.
- **Stack (running in `todo`):** React 19 (Server Components/Actions, `use`, `useActionState`, `useOptimistic`,
  ref-as-prop — **NO `forwardRef`**) + Next.js App Router *or* React+Vite + Tailwind v4 (`@theme`+OKLCH, **no
  `tailwind.config.js`**) + shadcn/ui + Motion v12 + TS. Different stack → keep the principles, don't rewrite.
- **Quality floor (ship by default):** accessible · responsive ≥360px · motion-safe · type-safe (Zod at the boundary) ·
  performant (animate only `transform`/`opacity`) · handle EVERY state (loading/empty/error/optimistic). **Security:** no
  secret in the client bundle (only `NEXT_PUBLIC_*`/`VITE_*` reach it); Server Actions/Route Handlers auth + Zod-validate
  server-side and return a minimal DTO; no unsanitized `dangerouslySetInnerHTML`; no prod stack traces.
- **Mandatory UI:** shadcn/ui only · dark/light via CSS vars (**no hardcoded colors**) · sonner toast · lucide icons ·
  build the reusable thing ONCE.

## In-app user guide — skill `/user-guide` (MANDATORY for any app with a UI)

Ship an in-app `/guide` page, task-oriented. **One tab per machine-facing integration:** Discord bot/webhook → a Discord
tab (setup, command table, notification types, troubleshooting); MCP server → an MCP tab (endpoint+auth, how to connect,
tool table, safety). Keep tabs in sync with code (new command/tool ⇒ update the tab in the same change). Reference:
`todo/app/guide/page.tsx`.

## Code reuse across projects — skill `/code-reuse`

Independent repos (no monorepo) → reuse isn't free, but reinventing wastes tokens+time. **Before building a feature:** read
the catalog **`nuc-platform/08-SHARED-ASSETS.md`** + grep sibling projects for prior art first. **Rule of three:** 1× build
local · 2× log as DUPLICATED · 3× same-shape+stable ⇒ extract (earlier = premature coupling). **Hybrid share:** visual →
`ui-kit` copy-in; heavy+stable+security glue (e.g. the MCP OAuth shim, dup'd todo↔yakudoku) → a `@thiengthb/*` package
(baked at CI build); lighter → copy-in/template. Extract the **glue**, keep the **feature** local. Any reuse/extraction MUST
update `08-SHARED-ASSETS.md` in the same change.

## Documentation & Knowledge OS — skills `/project-docs` `/project-plan` `/session-wrap`

Full standard: **`nuc-platform/05-documentation-standard.md`**. Goal: understand a project in one cheap read; knowledge accumulates
across sessions instead of evaporating.
- **Context-loading path (JIT — read on need, NOT reflexively):** a trivial/chat turn or a single-file edit needs NONE
  of these. When a task TOUCHES a project, read that `<project>/docs/00-map.md` (AI-primer); read `INVENTORY §0` only for
  a project-lifecycle / ops change; go deeper (`docs/` + `docs/decisions.md`) only when the task needs it. Front-loading
  all three every session is the per-session token tax to avoid. **Keep each `CLAUDE.md` thin** (rules+invariants+pointers);
  heavy spec lives in `docs/` (it costs context every turn).
- **Two pillars per project:** `docs/00-map.md` (essence·modules·flows·invariants·secrets) + `docs/decisions.md`
  (append-only why-log). A web-app adds `01-product`/`02-technical`/`03-user-guide` (05 §3).
- **Multi-session work** (feature/refactor/migration/hard bug) → persist a plan via `/project-plan` in
  `docs/plans/YYYY-MM-DD-<slug>.md` (complements `/plan` mode; small same-session changes get no file).
- **Skills:** `/project-docs` scaffolds/audits the doc-set · `/project-plan` persists a multi-session plan · `/session-wrap`
  closes a session (write `decisions.md`, update `00-map`, distill finished plans, add a cross-project line to
  `06-knowledge-ledger.md`). Infra traps → `02-known-traps`.
- **Convention:** end of a substantial pass → `/session-wrap`; a non-obvious decision → `decisions.md` (same commit).
  The pre-commit hook reminds (non-blocking) when code changes but docs don't.

## Agent memory — multi-machine (skill `/memory`)

The agent's memory of the **user** is **two-tier**, so it travels across machines via git instead of being trapped on
one box. Mechanics (frontmatter, index upkeep, the write procedure) live in skill `/memory` — keep this thin.

- **Shared (default) → `.claude/memory/` in the repo** — carried by `git push/pull`, so it's present on *every* machine
  (auto-loaded each session via the `@.claude/memory/MEMORY.md` import below). Holds facts true regardless of machine:
  who the user is, preferences, feedback, project intent, references. **Write almost everything here.** This OVERRIDES
  the default home-directory memory path the harness describes.
- **Local → `~/.claude/projects/<hash>/memory/`** — native home dir, NOT synced (its folder name is the repo's absolute
  path hashed, so it differs per machine anyway). ONLY for facts bound to *this physical machine* (a local path, hostname,
  locally-installed tool version/quirk).

**Litmus (auto-pick the tier):** "If I sat at a different computer tomorrow, would this fact still be true and useful?"
Yes → shared (repo). No → local (home). **One fact = one file = one tier; never duplicate across tiers** (drift).
Knowledge *about the project/code* still goes to `decisions.md`, NOT memory. New machine = just `git pull`, nothing to set up.

@.claude/memory/MEMORY.md

## Autonomous agent — governance (contract `nuc-platform/09-autonomy-contract.md`)

An unattended/headless run (env `CLAUDE_AUTONOMOUS=1`) operates under a deterministic gate, NOT trust. Keep this thin —
durable contract + decision tiers in `09-autonomy-contract.md`; build roadmap in `plans/2026-06-14-autonomous-agent.md`.
- **Hard, non-negotiable:** never push `main` / deploy / run a destructive command unattended; and the agent **NEVER
  edits its own governance** (`.claude/settings*.json`, `hooks/**`, `skills/**`, `memory/**`, any `CLAUDE.md`,
  `.github/workflows/**`, `.env*`) — it may *propose*, a human commits (the CVE-2025-53773 lesson). Enforced by
  `autonomy-gate.mjs` (PreToolUse), not by good intentions.
- **Tiers:** T1 read / T2 reversible-local-branch → autonomous; T3 outward (PR/Discord/dep/CI) → notify+gate; T4
  irreversible/high-blast → hard-blocked. Test: "undo in <5 min, no external side-effect?" No ⇒ T4.
- **Decide → research-before-design → propose, don't execute.** New work is proposed as a research-grounded artifact
  (≥2 external sources, ≥2 options w/ tradeoffs) and queued for human approval — never self-entered into the build
  pipeline. Pure self-critique is unreliable ⇒ ground gap-analysis in external standards, not the agent's opinion.
- **Layer C (Proposer) front door = skill `/idea` + `nuc-platform/10-idea-queue.md`** — the idea backlog where
  gap-analysis lands, gets ranked (feasibility gate first, then a capped interest bonus), and the supervisor's
  accept/reject is the oracle that biases future proposals (Reflexion). Self-scoring in a closed loop is forbidden.
- **Proposer for SKILLS = skill `/skill-proposer` + `nuc-platform/skill-proposals/`** (sibling of `/idea`, which proposes
  FEATURES) — induces a DRAFT skill from a process repeated ≥3× and files it into the sandbox for a **human to review +
  install**. **Propose-don't-install:** the agent NEVER writes to `.claude/skills/` (drafting the sandbox = T2; installing
  = a human move = T4, gate-blocked). Adapts Hermes' detect+draft, refuses its auto-install (ADAS/Anthropic safety).

## Thinking & process — match weight to the change (P-tiers), practice-first

**Practice-first: aim for a working, run-it-and-see result FAST; add ceremony only where the stakes earn it.** Match
process weight to the change, mirroring the autonomy T1–T4 by reversibility × blast-radius:

| Tier | The change | Process |
|---|---|---|
| **P1 — trivial / reversible** | copy/text, a small fix, a CRUD shape built before | `/coding-convention` only. **SKIP** brainstorm / research / plan-file / docs. Build → run → done |
| **P2 — medium** | a small feature, one module, a non-obvious bug | + tests + `/verification-before-completion`. Research ONLY on a real unknown (a Quick-tier lookup), **never by default** |
| **P3 — large / irreversible / novel** | architecture, a new dependency, security, schema/data, topology | Full spine: `/brainstorming` → research-before-design (≥2 sources, tiered) → proposal → `/project-plan` → docs |

- **Thin-slice first (the auto-pilot lesson):** build the smallest END-TO-END thing that actually RUNS (build → execute →
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
> `nuc-platform/11-testing-standard.md`) → `/vitest-server-actions`+`/playwright-e2e-builder` · authoring a skill →
> `/skill-authoring`. Catalog + verdicts: `nuc-platform/07-SKILL-CANDIDATES.md`.

## Model routing — staff work by weight (token discipline)

**Targets the *right* amount, never the *minimum*** — never trade away the reasoning depth the task needs; only cut
wasted context + over-powered staffing on mechanical work.

Model choice is **session-level**, not per-task (switching mid-session re-reads full history + drops the prompt cache =
*costs* tokens; the agent can't switch itself anyway — only the user can).
- **`/model` gotcha:** **Enter = persists to global `~/.claude/settings.json`** (new default for ALL sessions); press
  **`s`** to switch THIS session only.
- **Session rubric (set once):** architectural / security / multi-file / ambiguous / UI-craft / a strong-model-shaped
  codebase → **Opus** (lean Opus when unsure — weak-model contamination is asymmetric). A whole session of well-specified
  bulk-mechanical work → Sonnet.
- **The real token lever (no quality tradeoff):** Opus = main loop (orchestrator + reviewer); delegate heavy-but-mechanical
  work (wide reads, fan-out search, bulk transforms, migrations) to **cheaper-model subagents** (Agent tool per-agent
  `model: 'sonnet'|'haiku'`). Their context is isolated (the real saving) and Opus reviews before accepting. Don't flip
  `CLAUDE_CODE_SUBAGENT_MODEL` globally (cross-session side-effect).
- **Announce every downgrade (notify, don't gate):** before spawning a subagent weaker than the main loop, state it up
  front — one line each `label: 2–3-word task → model` (e.g. `Explore: grep auth usages → haiku`). Same-model subagents
  get no line. This is the user's control surface over staffing.
- **Suggest a session switch** only when the WHOLE session is mismatched — once, and tell them to use **`s`** (session-only).

### Web research — the biggest token sink (read before any research / `/deep-research`)

A WebFetch dumps a whole page (~5–50k tokens) into context; fan-out × pages × Opus-rate × refetch is how "30 min of
research = a whole session". **Default to the cheapest tier; escalate only when a tier proves insufficient, and say so
before escalating.** Four rules:
1. **Search wide, fetch narrow.** WebSearch snippets are cheap and usually answer the question. NEVER WebFetch a page
   unless a snippet is *both* load-bearing for the conclusion *and* insufficient on its own. Most facts come from snippets.
2. **Distill at the edge, synthesize at the center.** A fetch subagent's raw page MUST die in its isolated context — it
   returns ONLY `claim + 1–2-sentence extract + URL`, never the page or long quotes. That way page-tokens are paid once,
   at cheap-model rate, and never re-billed into the main Opus thread every subsequent turn.
3. **Model by job (research flavour of the token lever).** Mechanical web work → cheap model; judgment → Opus main loop:

   | Research task | Model |
   |---|---|
   | Plan questions, assign disjoint sources, set the page budget, synthesize the cited report, resolve contradictions | **Opus (main loop)** |
   | Scout: WebSearch only → titles+snippets+URLs, **no fetch** | **Haiku** |
   | Fetch one greenlit URL → 3–8-line extract + cite (raw page dies here) | **Sonnet** (Haiku if trivial) |
   | Adversarially verify ONE load-bearing claim, 1 pass | **Sonnet** |
4. **Hard caps + dedup.** Main loop owns the fetched-URL set, assigns disjoint sources, never refetches. Three tiers:
   - **Quick lookup (DEFAULT for any unqualified "research X"):** main loop self-runs 1–2 WebSearch, fetches ≤2 pages
     only when a snippet is load-bearing+insufficient. **No subagent fan-out.** Most "research" is really this.
   - **Standard** (escalate when Quick falls short): 1 Haiku scout → Opus picks ≤5 URLs → Sonnet fetch+distill (disjoint)
     → Opus synthesize. **≤5 pages, ≤1 verify pass.**
   - **Deep** (ONLY on an explicit "deep/kỹ/thorough" ask): ≤2 scouts, ≤12 pages, dedup URLs, verify only load-bearing
     claims. The only tier allowed near the old cost — never the silent default.

## Project lifecycle & ops — use the right skill, don't improvise

| When | Skill | Key points |
|------|-------|-----------|
| New project / onboard to NUC | **`/nuc-new-project`** | gather info → Dockerfile → workflow → push & verify image → create `/opt/apps/<name>` → acceptance |
| Remove / decommission | **`/nuc-remove-project`** | delete local code → tear down container+volume+image+dir → clean Authentik provider/group → verify the subdomain 404s → update `INVENTORY.md`+`auth-apps.md`; confirm data loss + no impact first |
| Health audit / cleanup | **`/nuc-health-audit`** | reconcile `INVENTORY.md` vs reality (drift, orphan volume/image, hanging provider), subdomains alive, Watchtower, disk/RAM, secret hygiene; **report only** — every destructive action asks the user |
| Protect an app (login/SSO/authz) | **`/nuc-protect-app`** | forward-auth gate / group policy / in-app authz via `X-authentik-*` (`headers()` in Next). Registry + traps: `authentik/docs/auth-apps.md` |
| Set an app's env/secrets on the NUC | **`/nuc-set-env`** | push `KEY=VALUE` from a LOCAL mirror `~/.nuc-env/<app>.env` → `/opt/apps/<app>/.env` over ssh STDIN; idempotent upsert, atomic, chmod 600, auto-heals malformed lines; **agent never receives secret values** (directs the user to the mirror + script). Front-ends `.ps1`/`.sh`; merge runs on the NUC |
| Web is broken | debug by layer | DNS → tunnel → Traefik → app, symptom table in `01-architecture-and-operations §7`; pinpoint the failing layer before fixing |
