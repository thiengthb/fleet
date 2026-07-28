# DOCUMENT 1 — ARCHITECTURE & OPERATIONS OF THE NUC AUTO-DEPLOY PLATFORM

> Built 2026-06-07. Domain: `thientnse.site`. Server: NUC `thienminiserver`
> (Ubuntu, Docker Engine 29.5.2, reachable via Tailscale `100.126.231.94`).
>
> This document describes the **entire operational flow** of the system, every component,
> every configuration file, and all operational tasks you will need. After reading this document
> you should be able to control the system on your own without asking anyone.

---

## TABLE OF CONTENTS

1. [The big picture](#1-bức-tranh-tổng-thể)
2. [Deploy flow: from `git push` to a live web update](#2-luồng-deploy)
3. [Request flow: from browser to container](#3-luồng-request)
4. [Anatomy of each component](#4-giải-phẫu-từng-thành-phần)
5. [Directory tree & every configuration file](#5-cây-thư-mục--từng-file-cấu-hình)
6. [Operations cookbook](#6-sổ-tay-vận-hành)
7. [Debugging table for incidents](#7-bảng-debug)
8. [Security — what was done and what to remember](#8-bảo-mật)

---

## 0. INVARIANTS — `target: nuc` ONLY

> Moved here from `CLAUDE.md` on 2026-07-28 when the platform split into a machine-agnostic agent OS and a per-target
> deployment layer. These bind **only** to a project whose `target` is `nuc` in `INVENTORY.md §0`. A `target: local`
> project (running under Docker on a PC or laptop) is NOT bound by any of them — it has no Traefik, no `edge` network,
> no Watchtower and no Authentik. Checking the target first is the whole point; assuming `nuc` is the old bug.

Deploy chain (built 2026-06-07):
`git push main → GitHub Actions → ghcr.io/thiengthb/<repo> (:latest + :<sha>) → Watchtower pulls (≤60s) → Traefik → Cloudflare Tunnel → *.thientnse.site`

5. **NUC only PULLs images** — no self-hosted runner, no SSH-deploy from CI, no build-on-NUC (except deliberate firefighting).
6. **One shared Docker network `edge`** — infra (`/opt/infra`) creates it; apps reference `external: true`, never publish
   ports to the host (only Traefik reaches apps over the network).
7. **Public = label** — Traefik `exposedbydefault=false`; an app is public **iff** it has the 4 `traefik.*` labels. A new
   subdomain needs no Cloudflare change (the wildcard `*.thientnse.site` already catches it).
8. **Dual image tag `latest` + short git-SHA** — rollback = pin the SHA tag in the NUC compose, do NOT revert git.
9. **TLS by Cloudflare** — do not configure Let's Encrypt/certbot anywhere.
10. **Traefik ≥ v3.7; Watchtower needs `DOCKER_API_VERSION=1.44`** (Docker 29 dropped API < 1.40 — a violation fails
    silently, see doc 02).
11. **Auth = Authentik** (IdP `auth.thientnse.site`, `/opt/apps/authentik`). Protect an app = forward-auth (middleware
    `authentik@docker`); authorize = app reads the `X-authentik-*` headers; link users by **email**. **NEVER**
    forward-auth an endpoint a machine client calls automatically. Authentik = prebuilt image → NO Watchtower label
    (update manually, bump `AUTHENTIK_TAG`).

---

## 1. THE BIG PICTURE

```
┌─────────────────────── DEV MACHINE (Windows) ───────────────────────┐
│  D:\Projects\MiniServer\link-manager   (clone repo)             │
│                  │                                              │
│                  │ git push origin main                         │
└──────────────────┼──────────────────────────────────────────────┘
                   ▼
┌─────────────────────── GITHUB ──────────────────────────────────┐
│  repo: thiengthb/linkmanager                                    │
│  .github/workflows/deploy.yml                                   │
│       │  (GitHub Actions, GITHUB'S runner — not the NUC)        │
│       │  build Docker image from docker/Dockerfile              │
│       ▼                                                         │
│  ghcr.io/thiengthb/linkmanager:latest  +  :<short-git-sha>      │
└──────────────────┬──────────────────────────────────────────────┘
                   │ (the NUC actively PULLS — GitHub has no
                   │  access to the NUC at all. Safe.)
                   ▼
┌─────────────────────── NUC thienminiserver ─────────────────────┐
│                                                                 │
│  Docker network: edge  (bridge, shared by EVERYTHING)           │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                                                           │ │
│  │  watchtower ──(poll ghcr.io every 60s)──► sees new image  │ │
│  │      │            then pulls it + recreates the app       │ │
│  │      ▼                                                    │ │
│  │  link-manager (app)  ◄── traefik v3.7 ◄── cloudflared     │ │
│  │  /opt/apps/link-manager   /opt/infra      /opt/infra      │ │
│  │  volume: link-manager_data (SQLite — survives any deploy) │ │
│  │                                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│  netdata (host network — monitors the machine, separate system)│
└──────────────────▲──────────────────────────────────────────────┘
                   │ Cloudflare Tunnel (outbound QUIC,
                   │ NO port opened to the Internet)
┌──────────────────┴──────────────────────────────────────────────┐
│                       CLOUDFLARE                                │
│  DNS:    CNAME  *  →  f725123c-….cfargotunnel.com  (proxied)    │
│  Tunnel: public hostname  *.thientnse.site → http://traefik:80  │
│  TLS:    Cloudflare handles HTTPS (no Let's Encrypt needed)     │
└──────────────────▲──────────────────────────────────────────────┘
                   │ https://link.thientnse.site
              USER
```

### The 4 design principles (violate them and it breaks)

| # | Principle | Reason |
|---|---|---|
| 1 | **One single `edge` network**, infra CREATES it, apps REFERENCE it (`external: true`) | Traefik can only forward to containers on the same network. Different network = 502. |
| 2 | **`exposedbydefault=false`** — Traefik only exposes containers with `traefik.enable=true` | This is the public/private switch for each app. |
| 3 | **TLS is handled by Cloudflare** | The tunnel is already encrypted; inside the internal network traefik↔app runs plain HTTP. Do not configure Let's Encrypt. |
| 4 | **The NUC only PULLS, takes no commands from outside** | No GitHub runner on the NUC, no open ports. Even if the GitHub token leaks, nobody can get into the NUC. |

---

## 2. DEPLOY FLOW

### What happens when you `git push origin main` — step by step

**Step 1 — GitHub Actions triggers** (file `.github/workflows/deploy.yml`):
- Trigger: push to `main` (or click the *Run workflow* button manually — `workflow_dispatch`).
- Runs on `ubuntu-latest` — GITHUB'S virtual machine, thrown away after use. The NUC is not involved in the build step at all.
- `concurrency: group: build-and-push` — two consecutive pushes don't build on top of each other; the later one queues up.

**Step 2 — Build the image:**
- `docker/login-action` logs into ghcr.io with `GITHUB_TOKEN` — this token is issued automatically by GitHub for each workflow run, no configuration needed. The `packages: write` permission is declared right inside the workflow file.
- `docker/metadata-action` produces 2 tags:
  - `ghcr.io/thiengthb/linkmanager:latest` — always the most recent build.
  - `ghcr.io/thiengthb/linkmanager:<sha>` (e.g. `25e663c`) — frozen forever per commit. **This is the lifeline for rollback.**
- `docker/build-push-action` builds from `docker/Dockerfile` (context = repo root so it can pull in both `backend/` and `frontend/`), passes the build-arg `VITE_API_KEY` from the repo secret `API_KEY` (baked into the frontend bundle), then pushes both tags to ghcr.io.
- `cache-from/to: type=gha` — layer cache stored on GitHub, making subsequent builds much faster.

**Step 3 — Watchtower on the NUC detects it** (within 60 seconds at most):
- Watchtower polls ghcr.io every `WATCHTOWER_POLL_INTERVAL=60` seconds.
- It ONLY looks at containers carrying the label `com.centurylinklabs.watchtower.enable=true` (because `WATCHTOWER_LABEL_ENABLE=true` is set). Any container without the label — including traefik, cloudflared — is ignored by watchtower and never auto-updated.
- It compares the digest of the local image with the digest in the registry (HEAD request, authenticated with the credential mounted from user `thien25`'s `~/.docker`).

**Step 4 — The blood transfusion:**
- Digest differs → watchtower pulls the new image → stops the old container → creates a new container **with the exact same configuration** (network, volume, labels, env preserved) → starts it.
- `WATCHTOWER_CLEANUP=true` → the old image no longer used by anyone is deleted right away, saving disk.
- The `link-manager_data` volume (SQLite) is a **named volume living outside the container** → the data is untouched.

**Step 5 — Traefik sees it on its own:**
- Traefik listens to Docker events via `/var/run/docker.sock`. A new container comes up (carrying the `traefik.*` labels) → the route re-registers itself within seconds. No traefik restart needed, nothing to do.

**Total time: push → web updated ≈ 2–4 minutes.** No SSH, no manual steps.

### Which data survives, which dies on each deploy?

| Item | Fate |
|---|---|
| Code, static files in the image | **Fully replaced** with the image |
| `/data/links.db` (SQLite) | **Survives** — lives in the `link-manager_data` volume |
| Environment variables | **Survives** — re-read from `/opt/apps/link-manager/.env` |
| Container ID, logs of the old container | Lost (old logs are deleted with the container) |

---

## 3. REQUEST FLOW

### What happens when someone opens `https://link.thientnse.site`

```
Browser
  │ ① DNS: link.thientnse.site = CNAME * → f725123c-….cfargotunnel.com
  │    (proxied — returns Cloudflare's IP, does NOT expose your home IP)
  ▼
Cloudflare edge (TLS terminated here — HTTPS handled by Cloudflare)
  │ ② Matches the wildcard public hostname *.thientnse.site
  │    → pushes the request down the f725123c tunnel
  ▼
cloudflared (container on the NUC — keeps 4 outbound QUIC connections ready)
  │ ③ Per the ingress config: service = http://traefik:80
  │    "traefik" resolves because cloudflared and traefik are on the SAME edge network
  │    (Docker's internal DNS resolves container names)
  ▼
traefik :80 (entrypoint "web")
  │ ④ Compares the Host header against the routers registered from labels:
  │    Host(`link.thientnse.site`) → service link-manager, port 3001
  │    Matches no router → returns traefik's blank 404 page
  ▼
link-manager :3001 (Express serving API + static frontend)
  │ ⑤ Returns the response, going back along the same path
  ▼
Browser receives HTML/JSON, with HTTPS + Cloudflare CDN
```

**The key points to engrave:**
- **No NUC port is open to the Internet.** The tunnel is a connection the NUC actively dials out to Cloudflare. Your home router needs no port-forwarding at all.
- A request "passes through" 3 layers of names: the wildcard DNS (Cloudflare) → the wildcard hostname (tunnel) → the Host rule (traefik). **Adding a new app only touches the 3rd layer** (the label in the app's compose) — the top 2 layers are wildcards, already in place.
- Traefik dashboard: NOT exposed to the Internet, only bound to `127.0.0.1:8080` on the NUC. View it via an SSH tunnel (see section 6.7).

---

## 4. ANATOMY OF EACH COMPONENT

### 4.1. Traefik v3.7 — the router (reverse proxy)

- **Job:** receive every request from cloudflared, look at the Host header, forward it to the right container.
- **How it learns routes:** it reads the Docker socket (`/var/run/docker.sock`, mounted read-only). Each container with `traefik.*` labels is a "route declaration". Containers come up/down → routes self-add/remove. **There is no route configuration file at all** — every route lives in the labels of each app.
- **Why it must be v3.7+:** Docker Engine 29 requires client API ≥ 1.40; traefik ≤ v3.5 hard-pins API 1.24 → kills the provider (see Document 2). **DO NOT downgrade traefik below 3.7.**
- Important flags:
  - `--providers.docker.exposedbydefault=false` — by default expose NObody.
  - `--providers.docker.network=edge` — always talk to apps over the edge network (even if an app accidentally joins several networks).
  - `--entrypoints.web.address=:80` — the port that receives traffic from cloudflared.

### 4.2. cloudflared — the tunnel out to the Internet

- **Job:** keep 4 persistent outbound QUIC connections to Cloudflare. Requests from the Internet pour into this tunnel instead of hitting your home IP.
- **Where the config lives:** the "run" part (token) is in `/opt/infra/.env`; the "routing" part (public hostname → service) lives **on the Cloudflare dashboard** (tunnel `f725123c`, Public Hostname tab), pushed down to cloudflared automatically — changing it on the web takes effect instantly, no restart needed.
- Current config: a single line `*.thientnse.site → http://traefik:80`.
- **The token = the tunnel's key.** Whoever has the token can impersonate your tunnel. The token only lives in `/opt/infra/.env` (chmod 600, with `.gitignore`).

### 4.3. Watchtower — the auto-update sentinel

- **Job:** poll the registry every 60s, see a new image → pull, recreate the container.
- **Scope:** ONLY containers with the label `com.centurylinklabs.watchtower.enable=true`. Currently: only `link-manager`.
- **Credential:** mounts **the whole directory** `/home/thien25/.docker` (not a single file) + env `DOCKER_CONFIG=/config`. Reason: `docker login` writes a new file (new inode) — if you mount a single file, watchtower will cling to the old file forever and lose authentication after each re-login (this bit us once, see Document 2 section 3.4).
- **`DOCKER_API_VERSION=1.44`** in env — mandatory with Docker 29; without it watchtower dies right at startup.
- Runs as **its own compose project** (`name: watchtower`) even though the file sits inside the shared `/opt/infra` — so that a `docker compose down` of the infra stack doesn't take it down by accident, and vice versa.

### 4.4. link-manager — the sample app (every future app follows the same mold)

- Image: `ghcr.io/thiengthb/linkmanager:latest` — pre-built on GitHub, the NUC only pulls.
- Listens on port **3001** (NOT published to the host — traefik reaches it over the edge network).
- Healthcheck is built into the Dockerfile (`wget /api/health`) — `docker ps` shows `(healthy)`.
- Env read from `/opt/apps/link-manager/.env`: `DB_PATH`, `API_KEY`, `CORS_ORIGIN`, `GEMINI_API_KEY`, `AI_MODEL`.
- 5 labels = the app's entire "identity":
  ```yaml
  - "com.centurylinklabs.watchtower.enable=true"                          # allow auto-update
  - "traefik.enable=true"                                                 # allow exposing
  - "traefik.http.routers.link-manager.rule=Host(`link.thientnse.site`)"  # which subdomain
  - "traefik.http.routers.link-manager.entrypoints=web"                   # into traefik's port 80
  - "traefik.http.services.link-manager.loadbalancer.server.port=3001"    # which port the app listens on
  ```

### 4.5. netdata — outside the system

Runs on the `host` network, unrelated to edge/traefik/watchtower. Monitors the machine's resources. Leave it alone.

---

## 5. DIRECTORY TREE & EVERY CONFIGURATION FILE

### On the NUC

```
/opt/infra/                       ← PLATFORM LAYER (touch with care)
├── docker-compose.yml            ← traefik + cloudflared + CREATES the edge network
├── watchtower.yml                ← watchtower (its own compose project named "watchtower")
├── .env                          ← TUNNEL_TOKEN (chmod 600, ABSOLUTELY never commit)
└── .gitignore                    ← contains ".env"

/opt/apps/                        ← APPLICATION LAYER (one directory per app)
└── link-manager/
    ├── docker-compose.yml        ← ghcr image + labels + references edge (external)
    ├── .env                      ← API_KEY, GEMINI_API_KEY… (chmod 600)
    └── .gitignore                ← contains ".env"

/home/thien25/.docker/config.json ← ghcr.io credential (PAT write:packages)
/home/thien25/actions-runner/     ← OLD runner, no longer used, can be deleted
```

### Inside the GitHub repo (each project)

```
linkmanager/
├── .github/workflows/deploy.yml  ← build & push to ghcr (runs on GitHub's runner)
├── docker/Dockerfile             ← multi-stage: build Vite frontend → Node backend
├── docker/docker-compose.yml     ← local dev only, NOT the deploy version
├── backend/  frontend/
```

> **The source of truth at deploy time is `/opt/apps/<name>/docker-compose.yml` on the NUC**,
> not the compose in the repo. The compose in the repo is only for local-machine dev.

### Who creates the `edge` network, who references it?

- `/opt/infra/docker-compose.yml` **CREATES** it:
  ```yaml
  networks:
    edge:
      name: edge
      driver: bridge
  ```
- Every other file (watchtower.yml, app compose) **REFERENCES** it:
  ```yaml
  networks:
    edge:
      external: true
  ```
- Operational consequence: **`docker compose down` of the infra stack will try to delete the edge network** and fail if apps are still running. The correct sequence when you need to bring everything down: down the apps first → down infra after. When bringing it back up: up infra first → up apps after.

---

## 6. OPERATIONS COOKBOOK

> SSH into the NUC: `ssh thien25@thienminiserver` (key already installed from this Windows machine).

### 6.1. Deploy new code (the daily task)

```bash
git push origin main
# Done. Wait 2-4 minutes. No SSH needed.
```
Follow along if you want:
- The **Actions** tab on GitHub — watch the build.
- `ssh thien25@thienminiserver "docker logs watchtower --since 5m"` — watch watchtower pull.

### 6.2. Add a NEW project (public)

**On the GitHub repo (once):**
1. Write a `Dockerfile` (remember `EXPOSE <port>`).
2. Copy the whole `.github/workflows/deploy.yml` from the linkmanager repo over. Only edit it if the Dockerfile lives elsewhere (`file:`) or you need a different build-arg.
3. Push → you get the image `ghcr.io/thiengthb/<repo>:latest`.

**On the NUC (once):**
```bash
mkdir -p /opt/apps/<name>
# Copy docker-compose.yml from /opt/apps/link-manager as a template, change 5 places:
#   name: <name>            image: ghcr.io/thiengthb/<repo>:latest
#   container_name: <name>  volume (if the app has data)
#   3 traefik labels: router/service name, Host(`<sub>.thientnse.site`), port
# Create .env + .gitignore
cd /opt/apps/<name> && docker compose up -d
```
**NO need to touch Cloudflare** — the wildcard `*.thientnse.site` catches every subdomain.

### 6.3. Add a project running INTERNALLY (not public)

Like 6.2 but **delete the 4 `traefik.*` label lines** (keep the watchtower label if you still want auto-update). The container still sits on the edge network and other apps can reach it by container name (`http://<name>:<port>`), but the Internet doesn't see it — because traefik has `exposedbydefault=false` and there is no route.

### 6.4. ROLLBACK when a new build has a bug

```bash
ssh thien25@thienminiserver
cd /opt/apps/link-manager
nano docker-compose.yml      # change:  image: ghcr.io/thiengthb/linkmanager:latest
                             # to:       image: ghcr.io/thiengthb/linkmanager:<good-sha>
docker compose up -d         # takes effect within seconds
```
- Find the `<good-sha>`: GitHub → repo → Packages → linkmanager → tag list; or `git log --oneline`.
- ⚠️ While pinned to a SHA, watchtower still polls but the SHA tag never changes → **auto-update is temporarily frozen**. After fixing the bug, switch back to `:latest` + `docker compose up -d` to resume auto-update.

### 6.5. Turn public on/off for a running app

```bash
cd /opt/apps/<name>
# Edit docker-compose.yml: add/remove the 4 traefik.* lines
docker compose up -d    # traefik updates the route within seconds
```

### 6.6. View logs

```bash
docker logs link-manager --tail 50 -f     # app
docker logs traefik --tail 50             # routing + access log
docker logs cloudflared --tail 50         # tunnel
docker logs watchtower --since 10m        # recent auto-updates
```

### 6.7. Open the Traefik dashboard (safely, via SSH tunnel)

```powershell
ssh -L 8080:localhost:8080 thien25@thienminiserver
# keep the SSH session, open the browser: http://localhost:8080/dashboard/
# (no need to set a Host header — the dashboard router accepts Host(`traefik.localhost`),
#  if you get 404, add "127.0.0.1 traefik.localhost" to hosts and open http://traefik.localhost:8080)
```
The dashboard shows: which routers are alive, which service they point to, which port — **the first place to look when a route isn't working**.

### 6.8. Restart each layer

```bash
# App only:
cd /opt/apps/link-manager && docker compose restart
# The whole infra layer (apps lose network for a few seconds but don't die):
cd /opt/infra && docker compose restart
# Watchtower:
cd /opt/infra && docker compose -f watchtower.yml restart
```

### 6.9. After the NUC reboots

Nothing to do. Every container is `restart: unless-stopped` — Docker brings them back up in the correct dependency order. Check for peace of mind: `docker ps` (all 5: traefik, cloudflared, watchtower, link-manager, netdata).

### 6.10. Change/add a secret for an app

```bash
nano /opt/apps/link-manager/.env     # edit the value
cd /opt/apps/link-manager && docker compose up -d   # recreate to pick up the new env
```
⚠️ Note for link-manager's `API_KEY` in particular: this value is also **baked into the frontend at build time** (build-arg `VITE_API_KEY` from the GitHub secret `API_KEY`). To enable authentication you must set it in **both places** identically: GitHub repo → Settings → Secrets → `API_KEY`, and the `.env` on the NUC → then re-run the workflow to build a new frontend.

### 6.11. Re-login to ghcr on the NUC (PAT expired)

```bash
echo '<new-PAT>' | docker login ghcr.io -u thiengthb --password-stdin
# Watchtower mounts the whole ~/.docker directory so it picks up the new credential AUTOMATICALLY, no restart needed.
```

### 6.12. Restore automatic builds (still owed)

The GitHub account is currently **billing-locked** → Actions can't run yet (the first image was built by hand on the NUC). After unlocking at `github.com/settings/billing`: go to the repo → Actions → pick the failed run → **Re-run all jobs** (or push any commit). A green build + watchtower pulling it = the automatic cycle is self-contained from then on.

---

## 7. DEBUGGING TABLE

> The golden rule: trace the request flow in section 3 — DNS → tunnel → traefik → app — and pinpoint WHICH LAYER the request DIES AT using the signs below.

| Symptom | Means it dies at the layer | Check | Common fix |
|---|---|---|---|
| Error 1033/530 from Cloudflare | Tunnel | Does `docker logs cloudflared` show "Registered tunnel connection"? Does the DNS record point to the right `f725123c-….cfargotunnel.com`? | Restart cloudflared; fix the DNS record to point at the correct tunnel ID |
| Blank 404 page (response from traefik) | Traefik has no route | Does the dashboard (section 6.7) show the app's router? Is the `traefik.enable=true` label set? Is `Host()` spelled correctly? | Fix the label, `docker compose up -d` the app again |
| 502 Bad Gateway | Traefik sees the route but can't reach the app | `docker network inspect edge --format '{{range .Containers}}{{.Name}} {{end}}'` — is the app in the list? Does the port in the label = the port the app listens on? | App missing `networks: [edge]`; or wrong `loadbalancer.server.port` |
| App runs fine locally but doesn't pick up the new build | Watchtower | `docker logs watchtower --since 5m` — any "403"/"auth not present"? `Scanned=0`? | 403: re-login to ghcr (section 6.11). Scanned=0: app missing the watchtower.enable label |
| GitHub build fails entirely, 0 steps run | GitHub Actions | The job's annotation (Actions tab) | "billing issue" → unlock billing; "permissions" → Settings → Actions → Workflow permissions |
| Traefik log: "client version X is too old" | Traefik vs Docker API | `docker logs traefik` | traefik image < v3.7 — upgrade it (see Document 2) |
| Everything dies after fiddling with compose | The edge network got deleted/recreated | `docker network ls` | Bring up in order: infra first, apps after (section 5) |

**Quick whole-system diagnostic command (run this first when there's an incident):**
```bash
ssh thien25@thienminiserver '
docker ps --format "table {{.Names}}\t{{.Status}}";
echo "--- edge:"; docker network inspect edge --format "{{range .Containers}}{{.Name}} {{end}}";
echo "--- routers:"; curl -s -H "Host: traefik.localhost" http://127.0.0.1:8080/api/http/routers | grep -o "\"rule\":\"[^\"]*\"";
echo "--- tunnel:"; docker logs cloudflared --tail 3 2>&1'
```

---

## 8. SECURITY

**Done:**
- The NUC opens no port to the Internet (outbound-only tunnel). The router does no port-forwarding.
- The traefik dashboard only binds `127.0.0.1` — you have to SSH to view it.
- `exposedbydefault=false` — new containers are NOT public by default.
- Secrets (`TUNNEL_TOKEN`, `API_KEY`…) only live in `.env` chmod 600 + `.gitignore`; not in compose, not on GitHub.
- GitHub holds no NUC credentials (pull-based). Watchtower only has a packages-scoped PAT.
- The Docker socket mounted for traefik is **read-only**.

**To remember:**
- ⚠️ The link-manager API is currently **open** (API_KEY empty — the app log warns about it). To lock it: section 6.10.
- ⚠️ The tunnel token in `/opt/infra/.env` — if leaked, someone else can impersonate the tunnel. If you suspect a leak: Cloudflare One → tunnel → rotate token, paste it back into `.env`, `docker compose up -d`.
- The ghcr PAT on the NUC should, long term, only hold the `read:packages` scope (the `write` scope is currently only needed for the manual build; it can be swapped for a read-only PAT once CI is running).
- The ghcr image is currently attached to a public repo. If you switch the repo to private, the package goes private with it — watchtower can still pull thanks to the PAT.
