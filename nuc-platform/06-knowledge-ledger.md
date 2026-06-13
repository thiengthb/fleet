# 06 — Cross-project knowledge log (index)

> **Index** of the platform's memorable lessons — does NOT copy content, only **one line per lesson + a pointer**
> to the full place. Two sources: (a) lessons **spanning multiple projects** (recorded right here), (b) lessons **for a single
> project** (living in `<project>/docs/decisions.md`, only pointed to here).
>
> Established 2026-06-12. Built up by the `/session-wrap` skill. Recording standard: see `05-documentation-standard.md §5`.

---

## How to use

- Starting something new and want to know "have we tripped on anything related?" → scan the table below, follow the pointer to the detail.
- Learned something **cross-project** (applies to ≥2 projects, or to the platform itself) → add one line to section A.
- Learned something **for a single project** → record it fully in `<project>/docs/decisions.md`, then (if worth others
  knowing) add a pointer line in section B.
- **System/infrastructure**-level traps (Docker/Traefik/Watchtower/Authentik) do NOT go here — their place is
  `02-known-traps.md`. This file handles **development/product/decision** knowledge.

---

## A. Cross-project lessons (content here)

| Date | Lesson (one line) | Applies to | Detail |
|------|------------------|--------|----------|
| 2026-06-12 | **Compute DYNAMICALLY instead of storing derived columns** (streak, delay, progress…) to avoid stale data when the source changes. | every app with stats | `todo/docs/02-technical.md §2` (the "Dynamically computed values" table) |
| 2026-06-12 | **`CLAUDE.md` thin + heavy spec split into `docs/`** — don't let the auto-loaded file bloat, it costs context every turn. | every project | `05-documentation-standard.md §2`; `todo/CLAUDE.md` (slimmed sample 641→327 lines) |
| 2026-06-12 | **Endpoints called by client-machines (MCP/OAuth/webhook/health) must NOT sit behind forward-auth** — split into their own router, auth at the app layer. | web-app with Authentik | `CLAUDE.md` invariant #8; `coding-convention §9`; `authentik/docs/auth-apps.md` |
| 2026-06-13 | **Adopt a community skill by ADAPTING, not copying** — read scripts line-by-line (drop if non-essential), strip invariant-conflicts, kill dangling refs, re-scope the description, run the conflict grep-guard. | every skill added to `.claude/skills/` | `/skill-authoring`; `nuc-platform/07-SKILL-CANDIDATES.md` |
| 2026-06-13 | **Don't pre-install a skill before its triggering need** — it's clutter + a context tax; defer "situational" ones with a note instead. | every skill add | `07-SKILL-CANDIDATES.md §1b` |
| 2026-06-13 | **A frozen security/IOC list gives false confidence** ("scan passed" against a stale list) — prefer live advisories + `npm/pip audit` over a baked-in scanner. | supply-chain hygiene | `/supply-chain-guard` |
| 2026-06-13 | **Multi-user MCP: gate ONLY `/api/oauth/authorize` behind Authentik** (the browser step) so it learns the email and binds it into the OAuth token (`sub=email`); keep `/api/mcp`+`/token` exempt. Drop shared static bearers — they can't identify a user. Thread per-request identity into the core client with `AsyncLocalStorage` (mcp-handler tools don't get the request). No token in the Claude JSON → works for free tier. | web-app with MCP + Authentik + multi-user | `yakudoku/docs/decisions.md` (2026-06-13 MCP entry); `authentik/docs/auth-apps.md` (yakudoku §) |
| 2026-06-13 | **"Internal-only" ≠ trusted on the shared `edge` network**: an app that forwards an identity header (`X-User-Email`) to a sibling backend must gate it with a shared **service token** (backend 401s without it) + resolve the user server-side + verify row ownership (IDOR). Any edge container could otherwise spoof it. | any app with a separate backend on `edge` | `yakudoku/docs/decisions.md` (2026-06-13 service-token entry); `core/app/auth.py` |
| 2026-06-13 | **A local project checkout can lag the remote by dozens of commits — `git fetch` before analyzing/editing it.** A stale `todo` checkout nearly caused redoing work (slim CLAUDE.md + docs split) already shipped on remote. | every project not always open locally | this session; remote `todo` was 40+ commits ahead |
| 2026-06-13 | **Add `paths-ignore: ['\*\*.md','docs/\*\*']` to each app's `deploy.yml`** so docs-only pushes don't trigger a wasted CI build + Watchtower redeploy. | every deployed app | `todo`/`yakudoku` `deploy.yml` |
| 2026-06-13 | **A project may already satisfy the doc-set via an equivalent file — don't force `01/02/03` if `INSTRUCTION.md` + `00-map` already cover it** (a 2nd source of truth just drifts). | per-project docs | `yakudoku` (`INSTRUCTION.md` = authoritative, 571 lines) |
| 2026-06-13 | **Remove a skill with no triggering need** (anti-clutter): `/saas-multi-tenant` was adopted then removed — its description loaded every session for zero use. | every skill add | `07-SKILL-CANDIDATES.md §1`; counterpart to "don't pre-install" |
| 2026-06-13 | **Organize projects by metadata on a flat table, NOT nested directories** — two orthogonal axes (`domain`=purpose for browsing, `kind`=archetype for ops) can't both fit a 1-D dir tree; a flat `INVENTORY §0` with two columns can. Nesting would break ~58 hardcoded paths across 16 docs/skills + add a 3rd dev≠NUC≠GitHub layout, for ~10 *independent* git repos (no monorepo gain). A metadata label scales better than a dir bucket (no bucketing-at-creation, no boundary problem, multi-label OK). Reconsider physical nesting only past ~25–30 rows, and even then prefer a VS Code multi-root workspace. | every project / platform org | `INVENTORY §0` (domain+kind axes) |
| 2026-06-13 | **Model choice is session-level, NOT per-task** — switching mid-session re-reads full history + drops the prompt cache (*costs* tokens), and `/model` Enter persists a GLOBAL default (`s` = session-only). Real token lever = Opus orchestrates+reviews while cheaper **subagents** do isolated bulk work under review (no contamination). Rejected a switch-per-task skill (agent can't self-switch). **Announce every subagent downgrade** (`label: task → model`, notify-don't-gate) = the user's staffing control surface. Discipline = the *right* amount, never the minimum. | every session / token discipline | `CLAUDE.md §"Model routing"`; `07-SKILL-CANDIDATES.md §5f` |
| 2026-06-13 | **Evaluated OpenClaw (viral autonomous-agent daemon, marketed as an n8n replacement) → DECLINED to adopt.** "Replaces n8n" is a false binary: n8n = deterministic workflow (keep it for high-volume/zero-variance), OpenClaw = autonomous reasoning agent — different categories, many teams run both. We already own its "brain" (Claude Code = skills + MCP + file-memory) and its headline *chat-to-control-the-NUC* feature as **`nuc-ops-bot`** — built SAFER: verb-bound socket-proxies (no raw `docker.sock`) + LLM-suggests/human-confirms, vs OpenClaw's full-shell *self-execute* + a skill marketplace with flagged supply-chain abuse (Cisco/Gartner/Trend Micro). Upgrade path for agent power = deepen `nuc-ops-bot` / widen the MCP tool layer / scheduled runs — NOT a 3rd always-on daemon. If ever trialed: `kind:node-worker`, PRIVATE-only (never public Traefik), pin version (no Watchtower), sandbox + vet every skill. | platform org / automation / agent capability | this session; `nuc-ops-bot` (`INVENTORY §1`); `CLAUDE.md` invariants #4/#7/#8 |

---

## B. Pointers to each project's knowledge log

> Each project has its own `docs/decisions.md` (if established). This table is just a table of contents — read the detail in that file.

| Project | Knowledge log | Notes |
|---------|-------------|--------|
| todo | `todo/docs/decisions.md` | **Established 2026-06-13** — seeded with the foundational whys (behavioral invariant, dynamic-compute, rolling-roadmap, in-process MCP + sync rules, stateless OAuth shim, schedule trust boundary, tab-role naming). Full Knowledge OS doc-set in place (00-map + 01–04). |
| journal | `journal/docs/decisions.md` | _(to be established in Phase 2)_ |
| yakudoku | `yakudoku/docs/decisions.md` | **Established 2026-06-13** — multi-user (shared catalog + per-user `userKey`, service-token trust, MCP OAuth `sub=email`, Discord `/link`, wipe-migration); grading/judge design, MCP expansion, JP word-lookup (Word/Kanji/DictEntry); + thin CLAUDE.md added 2026-06-13. |
| jobhunter-bot | `jobhunter-bot/docs/decisions.md` | _(to be established in Phase 2)_ |
| nuc-monitor | `nuc-monitor/docs/decisions.md` | _(to be established in Phase 2)_ |
| nuc-ops-bot | `nuc-ops-bot/docs/decisions.md` | _(to be established in Phase 2)_ |

> When a project establishes its `decisions.md`, change "_(to be established…)_" to a real note + the date. A project
> without a line here that already has a `decisions.md` → add the line (the job of `/session-wrap`).
