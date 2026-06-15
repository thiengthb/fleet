# INVENTORY — The SINGLE source of truth for the NUC `thienminiserver`

> Every lifecycle change (add/remove/change-domain/change-volume/change-auth-level) **MUST** update
> this file IMMEDIATELY within the same turn of work. The `/nuc-new-project` and `/nuc-remove-project` skills
> are required to edit the table below; `/nuc-health-audit` reconciles this file against reality to catch drift.
> If the table and reality differ → treat it as an incident, investigate (don't trust the table blindly).

Last updated: **2026-06-11** (verified directly from `docker ps`/`docker volume ls` on the NUC).
Latest (2026-06-12): added the **journal** app (`journal.thientnse.site`, Next.js + Postgres/pgvector) — Authentik forward-auth attached (group `journal-access`), the app reads `X-authentik-email`.
Latest (2026-06-12): added the **yakudoku** app (`yakudoku.thientnse.site`, a JP↔VI translation trainer) — monorepo, 1 repo → **3 images** (web public behind Authentik group `yakudoku-access`; the internal core FastAPI is the SOLE writer of the SQLite `yakudoku_data`; a headless Discord bot). Authentik provider pk 4. **MCP server (2026-06-12)** in `yakudoku-web` (`/api/mcp`, a self-issued OAuth shim like todo's) — Claude composes the sentence, core grades it; exempt from forward-auth via the `yakudoku-mcp` router.
Latest (2026-06-13): **yakudoku went MULTI-USER** (migration `b2e7a1c4d9f0`, progress wiped/catalog kept). Per-user scoping by email (`userKey`); core requires **`CORE_SERVICE_TOKEN`** (web/MCP/bot send it) → blocks edge-network spoofing of `X-User-Email`. **MCP is now OAuth-only** (`sub=email`; static `MCP_AUTH_TOKEN` bearer removed) and **`/api/oauth/authorize` moved behind the Authentik gate** (login binds the email; group `yakudoku-access` now also gates MCP-token issuance) — the `yakudoku-mcp` exempt router keeps only the machine paths (`/api/mcp`, `/api/oauth/{token,register,meta}`, `.well-known/*`). Discord is per-user via `/link <code>` → `DiscordLink`. Per-user daily quota `DAILY_REVIEW_CAP=300`. Backup before wipe: `~/yakudoku_data-pre-multiuser.tar.gz` on the NUC.

---

## 0. Project map (domain + kind + path) — classification registry

> **Two orthogonal axes, both metadata on this flat table — NOT nested directories.** Every project sits flat at
> `D:\Projects\MiniServer\<name>`; this table is the index (better than `ls` — it carries description + repo + path + auth).
> - **`domain`** = *what it's for* (browse-by-purpose): `platform` · `product` · `automation` · `shared`. Rows are grouped by it.
> - **`kind`** = *how it's built/deployed* (the operational axis): drives the archetype in `/nuc-new-project` ("Choose
>   archetype") + which invariants apply.
>
> They don't align (e.g. `nuc-monitor` is domain `platform` but kind `python-worker`), which is exactly why a one-dimensional
> directory tree can't express both — a flat table with two columns can. The dev-machine layout ≠ the NUC layout (`/opt/apps`
> + `/opt/infra`). **When to add a `domain`:** only when ≥2 projects share a purpose none of the four captures (else use the
> nearest + let `kind` disambiguate). **When to reconsider physical nesting:** not until this table passes ~25–30 rows AND the
> flat dev folder genuinely impedes navigation — even then prefer a VS Code multi-root workspace over moving independent git repos.

| Domain | Project | kind | Short description | GitHub repo | Dev path | NUC |
|--------|---------|------|-----------|-------------|----------|-----|
| `platform` | **authentik** | `infra` (third party) | Central IdP (pinned image, manual update) | `thiengthb/authentik` (compose) | `MiniServer/authentik` | `/opt/apps/authentik` |
| `platform` | **nuc-monitor** | `python-worker` | Monitors the NUC → Discord — python-worker reference | `thiengthb/nuc-monitor` | `MiniServer/nuc-monitor` | `/opt/apps/nuc-monitor` |
| `platform` | **nuc-ops-bot** | `python-worker` (bot) | Discord ChatOps bot controlling the NUC | `thiengthb/nuc-ops-bot` | `MiniServer/nuc-ops-bot` | `/opt/apps/nuc-ops-bot` |
| `product` | **todo** | `web-app` (Next) | Smart todo + MCP — the **reference implementation** for web-app | `thiengthb/todo` | `MiniServer/todo` | `/opt/apps/todo` |
| `product` | **journal** | `web-app` (Next) | Journal + reflection (Postgres/pgvector) | `thiengthb/journal` | `MiniServer/journal` | `/opt/apps/journal` |
| `product` | **yakudoku** | `monorepo` (→3 images) | JP↔VI translation trainer (web+core+bot) — monorepo reference | `thiengthb/yakudoku` | `MiniServer/yakudoku` | `/opt/apps/yakudoku` |
| `automation` | **n8n** | `infra` (third party) | Workflow automation (pinned image) | `thiengthb/n8n` (workflow) | `MiniServer/n8n` | `/opt/apps/n8n` |
| `automation` | **jobhunter-bot** | `node-bot` (worker) | Discord gateway job-hunting bot — node-bot reference | `thiengthb/jobhunter-bot` | `MiniServer/jobhunter-bot` | `/opt/apps/jobhunter-bot` |
| `shared` | **ui-kit** | `meta` (not deployed) | Shared frontend shadcn registry (copy-in) | `thiengthb/ui-kit` | `MiniServer/ui-kit` | — |
| `shared` | **nuc-platform** | `meta` (control plane) | Foundational docs + **this INVENTORY** + `.claude/skills` | `thiengthb/miniserver-platform` | `MiniServer/` (root) | — |

**The 5 standard `kind`s** (shaping the archetype + the invariants that apply):

- `web-app` — Next.js App Router, public behind Traefik+Authentik, has `components.json`+ui-kit. Follows §12/§16 if it's a complex app.
- `worker` — headless (`node-bot` or `python-worker`): NO Traefik/port, joins `edge` only for egress.
- `monorepo` — 1 repo → multiple images (CI matrix); one image is the sole DB writer if using SQLite.
- `infra` — version-pinned third-party image: NO Watchtower label, update = bump the tag manually.
- `meta` — not deployed to the NUC (shared lib / docs / skill).

**The 4 `domain`s** (purpose buckets for browsing; orthogonal to `kind`):

- `platform` — runs, secures, or observes the system itself (IdP, monitoring, ops control).
- `product` — end-user-facing applications someone opens and uses.
- `automation` — scheduled/triggered workflows & agents (not a daily-use UI).
- `shared` — reusable assets / control plane, not deployed to the NUC.

---

## 1. Apps (`/opt/apps/<name>`)

| App | Domain | Image | Auto-update | Volume | Auth level | Monitor | Image repo |
|-----|--------|-------|-------------|--------|----------|---------|------------|
| **authentik** | `auth.thientnse.site` | `ghcr.io/goauthentik/server:2026.5.2` | ❌ manual (bump `AUTHENTIK_TAG`) | `authentik_certs`, `authentik_database`, `authentik_media`, `authentik_templates` | Central IdP (itself) | ✅ | third party (goauthentik) |
| **n8n** | `n8n.thientnse.site` | `docker.n8n.io/n8nio/n8n:2.25.7` | ❌ manual (pinned image) | `n8n_data` | (n8n's internal auth) | ✅ | third party (n8nio) |
| **todo** | `todo.thientnse.site` | `ghcr.io/thiengthb/todo:latest` | ✅ Watchtower | `todo_data` | forward-auth, restricted to group `todo-access`; **the MCP/OAuth endpoint is exempt** (router `todo-mcp`, auth at the app layer) | ✅ | `thiengthb/todo` |
| **journal** | `journal.thientnse.site` | `ghcr.io/thiengthb/journal:latest` (private) | ✅ Watchtower | (DB in `journal-db`) | forward-auth, restricted to group `journal-access`; the app reads `X-authentik-email` to identify the user (the first living example); **exempt**: `/api/health` + `/api/dev/*` (router `journal-public`, gated by `DEV_TRIGGER_SECRET`) | (not yet) | `thiengthb/journal` (private; the NUC pulls with a PAT in `~/.docker/config.json`) |
| ↳ **journal-db** | — (Postgres+pgvector, only on the closed `journal_internal` network, NOT edge) | `pgvector/pgvector:pg16` | ❌ (third party, pinned `pg16`) | `journal_db` | n/a (not exposed) | — | third party (pgvector) |
| **yakudoku-web** | `yakudoku.thientnse.site` | `ghcr.io/thiengthb/yakudoku-web:latest` (private) | ✅ Watchtower | (none) | forward-auth, group `yakudoku-access` (gates UI **and** MCP-token issuance); **multi-user by email**; web→core sends `X-User-Email`+`CORE_SERVICE_TOKEN`; **exempt**: `/api/health` (`yakudoku-public`) + **machine MCP** `/api/mcp`+`/api/oauth/{token,register,meta}`+`/.well-known/oauth-*` (`yakudoku-mcp` pri 100, **no** authentik, +xfp; app-layer = **OAuth-only**, `sub=email`, key `MCP_OAUTH_SECRET`). **`/api/oauth/authorize` is gated** (falls to UI router → Authentik login binds the email) | (not yet) | `thiengthb/yakudoku` (monorepo) |
| ↳ **yakudoku-core** | — (FastAPI; on `edge` but **no** Traefik = internal; the SOLE DB writer; **multi-user**: per-user `userKey`, requires `CORE_SERVICE_TOKEN`) | `ghcr.io/thiengthb/yakudoku-core:latest` (private) | ✅ Watchtower | `yakudoku_data` (SQLite, mounted `/data`) | n/a (not exposed) | (not yet) | `thiengthb/yakudoku` |
| ↳ **yakudoku-bot** | — (headless Discord worker; `edge` for egress + calling core, **no** Traefik; sends `X-Discord-Id`+`CORE_SERVICE_TOKEN`, user links via `/link <code>` → `DiscordLink`) | `ghcr.io/thiengthb/yakudoku-bot:latest` (private) | ✅ Watchtower | (none) | per-user via Discord account link (multi-user) | ✅ (via core) | `thiengthb/yakudoku` |
| **nuc-monitor** | — (internal, **no** Traefik/edge) | `ghcr.io/thiengthb/nuc-monitor:latest` | ✅ Watchtower | (none) | n/a (not exposed) | itself (monitors the other apps) | `thiengthb/nuc-monitor` |
| **jobhunter-bot** | — (headless worker, **no** Traefik/port; joins `edge` for egress) | `ghcr.io/thiengthb/jobhunter-bot:latest` | ✅ Watchtower | (none) | n/a (not exposed) | ✅ | `thiengthb/jobhunter-bot` |
| **nuc-ops-bot** | — (headless worker, **no** Traefik/port; `edge` egress + closed `ops-internal` to the proxy) | `ghcr.io/thiengthb/nuc-ops-bot:latest` | ✅ Watchtower | (none) | user-ID allowlist + 1 ops channel (inside the bot, not via Authentik) | ✅ | `thiengthb/nuc-ops-bot` |
| ↳ **ops-proxy** | — (sub-container of nuc-ops-bot, only `ops-internal`) | `lscr.io/linuxserver/socket-proxy:latest` | ❌ (third party) | (none) | n/a | — | third party (linuxserver) |
| ↳ **img-proxy** | — (sub-container of nuc-ops-bot, only `ops-internal`) | `lscr.io/linuxserver/socket-proxy:latest` | ❌ (third party) | (none) | n/a | — | third party (linuxserver) |

Notes:
- **nuc-monitor intentionally has NO Traefik/edge/Watchtower-route web** — it uses bridge to send
  Discord messages and mounts `docker.sock` + `/:/host:ro` to read state. Don't "fix it to look like a web app".
- **n8n** and **authentik** use version-pinned third-party images → they do **not** carry the
  `com.centurylinklabs.watchtower.enable=true` label; to upgrade = bump the tag manually then `docker compose up -d`.
- **jobhunter-bot** = a Discord (gateway) bot for the job-hunting system; free chat → calls the n8n webhook
  `Job Search Agent` (`/webhook/job-search`, header `x-bot-secret`). Pair of n8n workflows: **Job Digest**
  (a job newsletter at 08:00 → Discord) + **Job Search Agent**. LLM = Groq free tier; search = Tavily.
  Secrets in `/opt/apps/jobhunter-bot/.env` + n8n credentials (not committed). Repos: `thiengthb/n8n` (workflow) + `thiengthb/jobhunter-bot` (bot).
- **nuc-ops-bot** = a Discord ChatOps bot controlling the NUC (slash commands + confirmation buttons + `/ask` LLM).
  **Root-equivalent power is bound in many layers**: it does NOT touch the real `docker.sock` — it goes through 2 verb-bound socket-proxies
  (`ops-proxy`: CONTAINERS read + ALLOW_START/STOP/RESTARTS, NO create/exec/build; `img-proxy`: only
  IMAGES prune). User-ID allowlist + 1 ops channel; infrastructure containers (traefik/cloudflared/watchtower/authentik*/
  proxy/bot/nuc-monitor) are blocked from operations. Commands: `/ps /top /logs /health` (read) + `/restart /stop /start
  /prune` (write, with a confirmation button) + `/ask` (LLM suggestion). **No `/redeploy`** — deliberately omitted because Watchtower
  already auto-updates within ≤60s; the Watchtower HTTP API is not enabled (keeping the infra minimal). LLM = Groq
  (action-selector, suggestion only, does not self-execute). Secrets `/opt/apps/nuc-ops-bot/.env`. Repo: `thiengthb/nuc-ops-bot`.
  - **Gate-approval control plane (B4, 2026-06-15)** — the bot ALSO runs `gate_approval.py`: a `tasks.loop` polls the
    **private GitHub repo `nuc-agent-gates`** (Contents API via aiohttp) for the autonomous agent's park-requests, posts
    Duyệt/Từ chối buttons, and **RS256-signs** a short-lived approval token (signing key b64 in the bot `.env`). The
    matching **public key is committed** at `.claude/keys/gate-approval.pub.pem` (trust anchor; the local worker verifies
    against it). Authorization on a click reuses `guards.user_allowed` (user-ID + guild + the approval channel). New bot
    `.env` keys (signing key, fine-grained PAT, `GATES_REPO`, `GATE_APPROVAL_CHANNEL_ID`) are delivered via skill
    `/nuc-set-env` (never through the chat). Still **no endpoint / no Traefik** — the gates repo is the only channel.
    Design: `plans/2026-06-14-discord-control-plane.md`; build log: `plans/2026-06-14-autonomous-agent.md` (B4).

## 2. Infra (`/opt/infra`) + outside the system

| Component | Role | Image | Volume | Notes |
|-----------|---------|-------|--------|---------|
| **traefik** | Reverse proxy / router | `traefik:v3.7` | (none) | Docker provider only; `exposedbydefault=false`. Creates the `edge` network. |
| **cloudflared** | Cloudflare Tunnel out to the Internet | `cloudflare/cloudflared:latest` | (none) | TLS handled by Cloudflare (no Let's Encrypt). |
| **watchtower** | Auto-pulls new images (≤60s) | `containrrr/watchtower:latest` | (none) | `DOCKER_API_VERSION=1.44` (mandatory — Docker 29). Only touches containers with the enable label. |
| **netdata** | System monitoring (outside the process) | `netdata/netdata` | `netdatacache`, `netdataconfig`, `netdatalib` | "Outside the system" (doc 01 §4.5). |

## 3. Authentik — providers / applications / groups

Full detail: [`../authentik/docs/auth-apps.md`](../authentik/docs/auth-apps.md) (the main registry).
Summary for a quick reconciliation:

| pk | Provider | Mode | external_host | Application | Restricting group |
|----|----------|------|---------------|-------------|---------------|
| 1 | `NUC SSO (forward-auth domain)` | `forward_domain` | `https://auth.thientnse.site` | `NUC SSO` (slug `nuc-sso`) | — (whole cookie-domain) |
| 2 | `todo` | `forward_single` | `https://todo.thientnse.site` | `Todo` (slug `todo`) | `todo-access` |
| 3 | `journal` | `forward_single` | `https://journal.thientnse.site` | `Journal` (slug `journal`) | `journal-access` |
| 4 | `yakudoku` | `forward_single` | `https://yakudoku.thientnse.site` | `Yakudoku` (slug `yakudoku`) | `yakudoku-access` |

## 4. Network `edge`

Created by infra (`external: true` in every app). Containers currently joined to `edge`: traefik, cloudflared,
authentik-server, n8n, todo, journal, jobhunter-bot, nuc-ops-bot, watchtower,
yakudoku-web, yakudoku-core, yakudoku-bot (all 3 joined to edge; core+bot have NO Traefik label = internal). (nuc-monitor does NOT join edge — intentional;
jobhunter-bot & nuc-ops-bot join edge only for egress, with NO Traefik label. `ops-proxy`/`img-proxy`
do NOT join edge — only on the closed `ops-internal` network with nuc-ops-bot. `journal-db` does NOT join edge — only on the
closed `journal_internal` network with the journal app.)

---

## 5. 🧹 Tech debt / orphans

**Clean as of 2026-06-11.** Cleaned up during the audit pass: the `backend_link_data` volume (link-manager),
`open-webui` (1 GB), `portainer_data` (old Portainer) + dangling images — ~2.6 GB recovered in total.
Every remaining volume belongs to a living app. When `/nuc-health-audit` finds a new orphan → record it here.

---

## 6. Decommissioned apps (history — to avoid confusion)

| App | Old domain | Decommissioned | Notes |
|-----|-----------|---------|---------|
| `link-manager` | `link.thientnse.site` | 2026-06-11 | Container/image/dir + both volumes (`link-manager_data` and `backend_link_data`) deleted; the Authentik groups `link-manager:read|write` deleted. Clean. |
| `anki-jp-tool` | `anki.thientnse.site` | 2026-06-11 | Container/image/volume/dir deleted; no dedicated Authentik provider/group (open app). |
