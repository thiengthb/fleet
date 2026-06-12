# INVENTORY — The SINGLE source of truth for the NUC `thienminiserver`

> Every lifecycle change (add/remove/change-domain/change-volume/change-auth-level) **MUST** update
> this file IMMEDIATELY within the same turn of work. The `/nuc-new-project` and `/nuc-remove-project` skills
> are required to edit the table below; `/nuc-health-audit` reconciles this file against reality to catch drift.
> If the table and reality differ → treat it as an incident, investigate (don't trust the table blindly).

Last updated: **2026-06-11** (verified directly from `docker ps`/`docker volume ls` on the NUC).
Latest (2026-06-12): added the **journal** app (`journal.thientnse.site`, Next.js + Postgres/pgvector) — Authentik forward-auth attached (group `journal-access`), the app reads `X-authentik-email`.
Latest (2026-06-12): added the **yakudoku** app (`yakudoku.thientnse.site`, a JP↔VI translation trainer) — monorepo, 1 repo → **3 images** (web public behind Authentik group `yakudoku-access`; the internal core FastAPI is the SOLE writer of the SQLite `yakudoku_data`; a headless Discord bot). Authentik provider pk 4. **MCP server (2026-06-12)** in `yakudoku-web` (`/api/mcp`, a self-issued OAuth shim like todo's) — Claude composes the sentence, core grades it; exempt from forward-auth via the `yakudoku-mcp` router.

---

## 0. Project map (kind + path) — classification registry

> Classified by **`kind`** rather than nested directories: every project sits flat at `D:\Projects\MiniServer\<name>`,
> scanning this table tells you the essence of each one. `kind` determines the **archetype** when creating a new one (skill
> `/nuc-new-project` → "Choose archetype"). The dev-machine layout ≠ the NUC layout (`/opt/apps` + `/opt/infra`).

| Project | kind | Short description | GitHub repo | Dev path | NUC |
|---------|------|-----------|-------------|----------|-----|
| **todo** | `web-app` (Next) | Smart todo + MCP — the **reference implementation** for web-app | `thiengthb/todo` | `MiniServer/todo` | `/opt/apps/todo` |
| **journal** | `web-app` (Next) | Journal + reflection (Postgres/pgvector) | `thiengthb/journal` | `MiniServer/journal` | `/opt/apps/journal` |
| **yakudoku** | `monorepo` (→3 images) | JP↔VI translation trainer (web+core+bot) — monorepo reference | `thiengthb/yakudoku` | `MiniServer/yakudoku` | `/opt/apps/yakudoku` |
| **jobhunter-bot** | `node-bot` (worker) | Discord gateway job-hunting bot — node-bot reference | `thiengthb/jobhunter-bot` | `MiniServer/jobhunter-bot` | `/opt/apps/jobhunter-bot` |
| **nuc-ops-bot** | `python-worker` (bot) | Discord ChatOps bot controlling the NUC | `thiengthb/nuc-ops-bot` | `MiniServer/nuc-ops-bot` | `/opt/apps/nuc-ops-bot` |
| **nuc-monitor** | `python-worker` | Monitors the NUC → Discord — python-worker reference | `thiengthb/nuc-monitor` | `MiniServer/nuc-monitor` | `/opt/apps/nuc-monitor` |
| **authentik** | `infra` (third party) | Central IdP (pinned image, manual update) | `thiengthb/authentik` (compose) | `MiniServer/authentik` | `/opt/apps/authentik` |
| **n8n** | `infra` (third party) | Workflow automation (pinned image) | `thiengthb/n8n` (workflow) | `MiniServer/n8n` | `/opt/apps/n8n` |
| **ui-kit** | `meta` (not deployed) | Shared frontend shadcn registry (copy-in) | `thiengthb/ui-kit` | `MiniServer/ui-kit` | — |
| **nuc-platform** | `meta` (control plane) | Foundational docs + **this INVENTORY** + `.claude/skills` | `thiengthb/miniserver-platform` | `MiniServer/` (root) | — |

**The 5 standard `kind`s** (shaping the archetype + the invariants that apply):

- `web-app` — Next.js App Router, public behind Traefik+Authentik, has `components.json`+ui-kit. Follows §12/§16 if it's a complex app.
- `worker` — headless (`node-bot` or `python-worker`): NO Traefik/port, joins `edge` only for egress.
- `monorepo` — 1 repo → multiple images (CI matrix); one image is the sole DB writer if using SQLite.
- `infra` — version-pinned third-party image: NO Watchtower label, update = bump the tag manually.
- `meta` — not deployed to the NUC (shared lib / docs / skill).

---

## 1. Apps (`/opt/apps/<name>`)

| App | Domain | Image | Auto-update | Volume | Auth level | Monitor | Image repo |
|-----|--------|-------|-------------|--------|----------|---------|------------|
| **authentik** | `auth.thientnse.site` | `ghcr.io/goauthentik/server:2026.5.2` | ❌ manual (bump `AUTHENTIK_TAG`) | `authentik_certs`, `authentik_database`, `authentik_media`, `authentik_templates` | Central IdP (itself) | ✅ | third party (goauthentik) |
| **n8n** | `n8n.thientnse.site` | `docker.n8n.io/n8nio/n8n:2.25.7` | ❌ manual (pinned image) | `n8n_data` | (n8n's internal auth) | ✅ | third party (n8nio) |
| **todo** | `todo.thientnse.site` | `ghcr.io/thiengthb/todo:latest` | ✅ Watchtower | `todo_data` | forward-auth, restricted to group `todo-access`; **the MCP/OAuth endpoint is exempt** (router `todo-mcp`, auth at the app layer) | ✅ | `thiengthb/todo` |
| **journal** | `journal.thientnse.site` | `ghcr.io/thiengthb/journal:latest` (private) | ✅ Watchtower | (DB in `journal-db`) | forward-auth, restricted to group `journal-access`; the app reads `X-authentik-email` to identify the user (the first living example); **exempt**: `/api/health` + `/api/dev/*` (router `journal-public`, gated by `DEV_TRIGGER_SECRET`) | (not yet) | `thiengthb/journal` (private; the NUC pulls with a PAT in `~/.docker/config.json`) |
| ↳ **journal-db** | — (Postgres+pgvector, only on the closed `journal_internal` network, NOT edge) | `pgvector/pgvector:pg16` | ❌ (third party, pinned `pg16`) | `journal_db` | n/a (not exposed) | — | third party (pgvector) |
| **yakudoku-web** | `yakudoku.thientnse.site` | `ghcr.io/thiengthb/yakudoku-web:latest` (private) | ✅ Watchtower | (none) | forward-auth, group `yakudoku-access`; web reads `X-authentik-email`→`X-User-Email` to core; **exempt**: `/api/health` (router `yakudoku-public`) + **MCP** `/api/mcp`+`/api/oauth`+`/.well-known/oauth-*` (router `yakudoku-mcp` priority 100, **no** authentik, +xfp; app-layer auth = bearer `MCP_AUTH_TOKEN`/OAuth shim) | (not yet) | `thiengthb/yakudoku` (monorepo) |
| ↳ **yakudoku-core** | — (FastAPI; on `edge` but **no** Traefik = internal; the SOLE DB writer) | `ghcr.io/thiengthb/yakudoku-core:latest` (private) | ✅ Watchtower | `yakudoku_data` (SQLite, mounted `/data`) | n/a (not exposed) | (not yet) | `thiengthb/yakudoku` |
| ↳ **yakudoku-bot** | — (headless Discord worker; `edge` for egress + calling core, **no** Traefik) | `ghcr.io/thiengthb/yakudoku-bot:latest` (private) | ✅ Watchtower | (none) | allowlist via Discord (not configured yet) | ✅ (via core) | `thiengthb/yakudoku` |
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
