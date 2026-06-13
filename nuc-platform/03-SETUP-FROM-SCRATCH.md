# DOCUMENT 3 — REBUILD EVERYTHING FROM ZERO (SETUP FROM SCRATCH)

> Use when: the NUC's OS is reinstalled, you switch to a new machine, or you want to stand up a
> second identical server. Work **sequentially top to bottom**, each step has a **VERIFY** command —
> if the verification doesn't pass, do NOT move to the next step.
>
> Estimated time: 45–90 minutes (not counting OS install).
> References: architecture & operations in `01-architecture-and-operations.md`,
> known traps in `02-known-traps.md`.

---

## TABLE OF CONTENTS

- [Step 0 — Checklist of things you must have in hand BEFORE starting](#bước-0)
- [Step 1 — Operating system & user](#bước-1)
- [Step 2 — Install Docker Engine](#bước-2)
- [Step 3 — Tailscale & SSH from the dev machine](#bước-3)
- [Step 4 — Restore app data (if you have a backup)](#bước-4)
- [Step 5 — Cloudflare Tunnel (create new or reuse)](#bước-5)
- [Step 6 — Platform layer /opt/infra (traefik + cloudflared)](#bước-6)
- [Step 7 — Configure Cloudflare: wildcard hostname + DNS](#bước-7)
- [Step 8 — Login to ghcr.io + Watchtower](#bước-8)
- [Step 9 — Deploy the app (link-manager and every other app)](#bước-9)
- [Step 10 — Whole-system acceptance test](#bước-10)
- [Appendix A — Backup & Restore data](#phụ-lục-a)
- [Appendix B — The GitHub side for a brand-NEW repo](#phụ-lục-b)
- [Appendix C — Known traps (read before arguing with the system)](#phụ-lục-c)

---

<a id="bước-0"></a>
## STEP 0 — CHECKLIST OF THINGS TO HAVE IN HAND BEFORE STARTING

| # | What you need | Where to get it | Notes |
|---|---|---|---|
| 1 | USB to install Ubuntu Server LTS | ubuntu.com | Server edition, no GUI needed |
| 2 | Cloudflare account managing the domain `thientnse.site` | dash.cloudflare.com | Nameservers already pointed to Cloudflare |
| 3 | GitHub account `thiengthb` | github.com | Billing NOT locked (check settings/billing) |
| 4 | GitHub PAT scope `read:packages` | github.com/settings/tokens → classic | For the NUC to pull images. Create it ahead of time, write it on paper / in a password manager |
| 5 | Backup of the data volume (if recoverable from the old machine) | Appendix A | Without it, the app starts with an empty DB |
| 6 | Dev machine (Windows) with an SSH key | `%USERPROFILE%\.ssh\id_ed25519` | If the key is lost, create a new one: `ssh-keygen -t ed25519` |

**Fixed conventions throughout this document** (change if your environment differs):
- NUC hostname: `thienminiserver` — operating user: `thien25`
- Domain: `thientnse.site` — registry: `ghcr.io/thiengthb/<repo>`
- Platform at `/opt/infra`, apps at `/opt/apps/<name>`
- Shared Docker network: `edge`

---

<a id="bước-1"></a>
## STEP 1 — OPERATING SYSTEM & USER

1. Install Ubuntu Server LTS, set the hostname `thienminiserver`, create the user `thien25`
   (tick "Install OpenSSH server" in the installer).
2. Log in, update the system:
   ```bash
   sudo apt update && sudo apt -y full-upgrade
   sudo apt -y install curl git ca-certificates
   ```

**✅ VERIFY:** `hostname` outputs `thienminiserver`; `id` shows the user in the `sudo` group.

---

<a id="bước-2"></a>
## STEP 2 — INSTALL DOCKER ENGINE

Install the official version (do NOT use Ubuntu's snap/docker.io — version often mismatched):

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker thien25     # let the user use docker without sudo
# Log out / log back in (or: newgrp docker) for the group to take effect
```

**✅ VERIFY:**
```bash
docker --version && docker compose version   # both run without sudo
docker run --rm hello-world                  # pull + run OK = network & daemon OK
```

> ⚠️ **Remember from the old case** (Document 2): Docker Engine ≥ 29 requires client
> API ≥ 1.40. Every image version in this document was chosen for compatibility —
> **don't downgrade traefik below v3.7** on your own, don't delete watchtower's
> `DOCKER_API_VERSION`.

---

<a id="bước-3"></a>
## STEP 3 — TAILSCALE & SSH FROM THE DEV MACHINE

### 3.1. Tailscale (to SSH remotely without opening ports)
```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up        # open the URL that appears, log in to your Tailscale account
tailscale ip -4          # note down the IP 100.x.y.z
```

### 3.2. Install the dev machine's SSH key onto the NUC
On the **Windows dev machine** (PowerShell):
```powershell
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh thien25@thienminiserver "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```
(Enter the password one last time — from then on it uses the key.)

**✅ VERIFY:** from the dev machine: `ssh thien25@thienminiserver "echo OK; groups"`
→ prints `OK` without asking for a password, `groups` includes `docker`.

---

<a id="bước-4"></a>
## STEP 4 — RESTORE APP DATA (if you have a backup)

> Do this BEFORE deploying the app so it sees the data the moment it opens its eyes. No backup →
> skip; the volume will be created empty. How to make a backup: Appendix A.

```bash
# Create the volume with the exact name the app's compose will reference:
docker volume create link-manager_data
# Pour in the backup (a tar backup file made per Appendix A):
docker run --rm -v link-manager_data:/data -v $HOME:/backup alpine \
  sh -c "tar xzf /backup/link-manager_data.tar.gz -C /data"
```

**✅ VERIFY:**
```bash
docker run --rm -v link-manager_data:/data alpine ls -la /data   # see links.db
```

---

<a id="bước-5"></a>
## STEP 5 — CLOUDFLARE TUNNEL

### Case A — the old tunnel still exists (only the NUC was reset, Cloudflare untouched)
Nothing to create. Get the token back: **Cloudflare One → Networks → Tunnels →
select the tunnel → Configure** → copy the token (the `eyJ...` string). Move to Step 6.

### Case B — create a brand-new tunnel
1. **Cloudflare One → Networks → Tunnels → Create a tunnel** → choose
   `Cloudflared` → name it (e.g. `nuc-platform`).
2. The setup page shows an install command — **DO NOT run that command** (we run cloudflared
   via Docker in Step 6). Only **copy the token** `eyJ...`.
3. **Note down the Tunnel ID** (a UUID `xxxxxxxx-xxxx-...`, shown in the tunnel
   list) — Step 7 needs it to create DNS.

> The token and the Tunnel ID are two different things: the token is for cloudflared to run,
> the Tunnel ID is for DNS to point at.

---

<a id="bước-6"></a>
## STEP 6 — PLATFORM LAYER `/opt/infra`

### 6.1. Create the directories
```bash
sudo mkdir -p /opt/infra /opt/apps
sudo chown -R thien25:thien25 /opt/infra /opt/apps
```

### 6.2. Create `/opt/infra/docker-compose.yml` — EXACT CONTENT:

```yaml
services:
  traefik:
    image: traefik:v3.7        # >= v3.7 MANDATORY with Docker 29 (see Document 2)
    container_name: traefik
    restart: unless-stopped
    command:
      - "--api.dashboard=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--providers.docker.network=edge"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.traefik.address=:8080"
      - "--log.level=INFO"
      - "--accesslog=true"
    ports:
      - "127.0.0.1:8080:8080"   # dashboard ONLY binds localhost
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.dashboard.rule=Host(`traefik.localhost`)"
      - "traefik.http.routers.dashboard.service=api@internal"
      - "traefik.http.routers.dashboard.entrypoints=traefik"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks:
      - edge

  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: cloudflared
    restart: unless-stopped
    command: tunnel run
    environment:
      - TUNNEL_TOKEN=${TUNNEL_TOKEN}
    networks:
      - edge
    depends_on:
      - traefik

networks:
  edge:
    name: edge
    driver: bridge        # the infra layer CREATES the network; every app REFERENCES it external
```

### 6.3. Create `/opt/infra/.env` (paste the token from Step 5):
```bash
cat > /opt/infra/.env << 'EOF'
TUNNEL_TOKEN=eyJ...PASTE_THE_REAL_TOKEN_HERE...
EOF
chmod 600 /opt/infra/.env
echo ".env" > /opt/infra/.gitignore
```

### 6.4. Launch
```bash
cd /opt/infra
docker compose up -d
```

**✅ VERIFY (all 3 must pass):**
```bash
docker compose ps           # 2 containers Up
docker logs cloudflared 2>&1 | grep -c "Registered tunnel connection"   # >= 1 (usually 4)
docker logs traefik --tail 20    # must NOT have any ERR line
#   → if you see "client version ... is too old": traefik image < v3.7, fix the image!
```

---

<a id="bước-7"></a>
## STEP 7 — CONFIGURE CLOUDFLARE: WILDCARD HOSTNAME + DNS

> Do this on the web dashboard. Goal: configure ONCE, so that adding apps later
> never requires coming back here.

### 7.1. Public Hostname (routing inside the tunnel)
**Cloudflare One → Networks → Tunnels → your tunnel → Public Hostname →
Add a public hostname:**
- Subdomain: `*` — Domain: `thientnse.site`
- Service: Type `HTTP` — URL `traefik:80`
  (cloudflared reaches traefik by CONTAINER NAME because they're on the same `edge` network)

If there are still old entries pointing straight at some app → **delete them all**, keep only the wildcard.

### 7.2. DNS record (Cloudflare does NOT auto-create one for the wildcard)
**Cloudflare dashboard → thientnse.site → DNS → Records:**
- **Delete** every old CNAME of the form `<sub> → <old-uuid>.cfargotunnel.com` (pointing at a
  dead tunnel — the very culprit of the old 530 error, see Document 2 section 3).
- **Add:** Type `CNAME` — Name `*` —
  Target `<TUNNEL-ID>.cfargotunnel.com` — Proxy: **ON** (orange cloud).
  (`<TUNNEL-ID>` from Step 5; current tunnel as of 2026-06: `f725123c-a055-4119-92ec-32db3c1df4ea`)

**✅ VERIFY (from any machine):**
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://abc-xyz-123.thientnse.site
```
- **404** = PASS — the chain DNS → tunnel → traefik is open (traefik returns 404 because
  no app accepts that host yet). 
- **530** = DNS points at the wrong tunnel-id → re-check 7.2.
- **timeout/SSL error** = DNS hasn't propagated yet, wait 1–2 minutes and retry.

---

<a id="bước-8"></a>
## STEP 8 — LOGIN GHCR.IO + WATCHTOWER

### 8.1. Login to ghcr on the NUC (PAT `read:packages` from Step 0)
```bash
echo '<GITHUB_PAT>' | docker login ghcr.io -u thiengthb --password-stdin
# Must see: Login Succeeded
```

### 8.2. Create `/opt/infra/watchtower.yml` — EXACT CONTENT:

```yaml
name: watchtower        # its own project — do NOT drop this line
                        # (shares the directory with the infra compose; without name it
                        #  joins the same project -> --remove-orphans deletes traefik by accident)

services:
  watchtower:
    image: containrrr/watchtower:latest
    container_name: watchtower
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      # Mount the WHOLE DIRECTORY, not a single file:
      # docker login writes a new file (new inode) -> mounting a single file clings to dead credentials
      - /home/thien25/.docker:/config:ro
    environment:
      - DOCKER_CONFIG=/config
      - DOCKER_API_VERSION=1.44      # MANDATORY with Docker 29 — do not delete
      - WATCHTOWER_POLL_INTERVAL=60  # seconds
      - WATCHTOWER_CLEANUP=true      # delete old images after update
      - WATCHTOWER_LABEL_ENABLE=true # ONLY watch containers with the label enabled
    networks:
      - edge

networks:
  edge:
    external: true
```

### 8.3. Launch
```bash
cd /opt/infra
docker compose -f watchtower.yml up -d
```

**✅ VERIFY (wait ~70 seconds for the first scan cycle):**
```bash
docker logs watchtower 2>&1 | tail -3
# Must see:  Session done Failed=0 Scanned=0 Updated=0
#   Scanned=0 is CORRECT right now (no app carries a label yet).
# If you see "client version 1.25 is too old": missing DOCKER_API_VERSION -> re-check 8.2
```

---

<a id="bước-9"></a>
## STEP 9 — DEPLOY THE APP

> The sample below is link-manager. **Every other app is done identically**, changing 5 places: name,
> image, volume, subdomain, port.

### 9.1. Create `/opt/apps/link-manager/docker-compose.yml`:

```yaml
name: link-manager

services:
  app:
    image: ghcr.io/thiengthb/linkmanager:latest
    container_name: link-manager
    restart: unless-stopped
    env_file:
      - .env
    networks:
      - edge
    volumes:
      - link_data:/data          # SQLite data lives outside the container
    labels:
      # --- enable auto-update ---
      - "com.centurylinklabs.watchtower.enable=true"
      # --- PUBLIC: delete the 4 lines below if you want the app to run INTERNALLY only ---
      - "traefik.enable=true"
      - "traefik.http.routers.link-manager.rule=Host(`link.thientnse.site`)"
      - "traefik.http.routers.link-manager.entrypoints=web"
      - "traefik.http.services.link-manager.loadbalancer.server.port=3001"

networks:
  edge:
    external: true

volumes:
  link_data:
    name: link-manager_data
    external: true        # if Step 4 already created the volume (restore). Volume does NOT
                          # exist yet? -> change to "external: false" or run:
                          # docker volume create link-manager_data
```

### 9.2. Create `/opt/apps/link-manager/.env`:
```bash
cat > /opt/apps/link-manager/.env << 'EOF'
DB_PATH=/data/links.db
CORS_ORIGIN=*
# Enable API auth: set it to the SAME value as the API_KEY secret on GitHub
# (so the VITE_API_KEY baked into the frontend matches). Empty = open API.
API_KEY=
# AI link search (Google Gemini) — empty turns the feature off
GEMINI_API_KEY=
AI_MODEL=
EOF
chmod 600 /opt/apps/link-manager/.env
echo ".env" > /opt/apps/link-manager/.gitignore
```

### 9.3. Launch
```bash
cd /opt/apps/link-manager
docker compose up -d
```

**✅ VERIFY:**
```bash
docker compose ps                          # Up (healthy) after ~15 seconds
docker compose logs --tail 10              # app reports running at :3001
docker network inspect edge --format '{{range .Containers}}{{.Name}} {{end}}'
#   -> must include all of: cloudflared traefik watchtower link-manager
curl -s https://link.thientnse.site/api/health    # {"ok":true}
```

---

<a id="bước-10"></a>
## STEP 10 — WHOLE-SYSTEM ACCEPTANCE TEST

Run each in turn, ALL must pass:

```bash
# ① 4 system containers + the app all Up:
docker ps --format "table {{.Names}}\t{{.Status}}"

# ② Traefik has the app's route (outside the dashboard):
curl -s -H "Host: traefik.localhost" http://127.0.0.1:8080/api/http/routers \
  | grep -o '"rule":"[^"]*"'
#   -> see Host(`link.thientnse.site`)

# ③ The public site is alive:
curl -s -o /dev/null -w "%{http_code}\n" https://link.thientnse.site    # 200

# ④ A random subdomain returns 404 (the wildcard chain is open):
curl -s -o /dev/null -w "%{http_code}\n" https://khong-ton-tai.thientnse.site  # 404

# ⑤ Watchtower sees the app and ghcr auth is OK:
docker logs watchtower --since 2m 2>&1 | tail -2
#   -> Session done Failed=0 Scanned=1   (no 403/auth line)

# ⑥ Test the full auto-deploy cycle end to end (from the dev machine):
#    edit any one line -> git push origin main -> wait 2-4 minutes:
docker logs watchtower -f     # see "Found new image ... Stopping ... Started"
```

Passing ⑥ too = the automatic system is fully self-contained. **STOP. DONE.**

---

<a id="phụ-lục-a"></a>
## APPENDIX A — BACKUP & RESTORE DATA

### Back up a volume (do it periodically, or RIGHT BEFORE resetting the server)
```bash
# One tar file per volume (e.g. link-manager_data):
docker run --rm -v link-manager_data:/data -v $HOME:/backup alpine \
  sh -c "tar czf /backup/link-manager_data.tar.gz -C /data ."
# Pull the file back to the dev machine for safekeeping (run from the dev machine):
scp thien25@thienminiserver:~/link-manager_data.tar.gz D:\Backups\
```
Things to back up besides the volume: `/opt/infra/.env` (the tunnel token),
`/opt/apps/*/.env` (app secrets). That's all — everything else can be rebuilt
from this document + the image on ghcr.

### Restore: see Step 4.

### List every volume that holds data
```bash
docker volume ls
docker run --rm -v <volume-name>:/v alpine du -sh /v
```

---

<a id="phụ-lục-b"></a>
## APPENDIX B — THE GITHUB SIDE FOR A BRAND-NEW REPO

(The `linkmanager` repo already has the workflow — this section is for a NEW app/repo.)

1. The repo needs a `Dockerfile` (remember `EXPOSE <port>`).
2. Create `.github/workflows/deploy.yml` — copy it verbatim from the `linkmanager` repo
   (`.github/workflows/deploy.yml`), usually NO edits needed; only edit if:
   - the Dockerfile isn't at `docker/Dockerfile` → edit `file:`
   - no build-arg needed → delete the `build-args:` block
3. Push to `main` → the Actions tab must be green → the profile's Packages tab has the
   package `ghcr.io/thiengthb/<repo>`.
4. If the build fails with **0 steps run**: check the annotation — we once hit
   *"account is locked due to a billing issue"* → unlock at github.com/settings/billing.
5. If it fails at the image push step: repo Settings → Actions → General →
   Workflow permissions → **Read and write permissions**.

---

<a id="phụ-lục-c"></a>
## APPENDIX C — KNOWN TRAPS (learned the hard way, see Document 2 for details)

| # | Trap | Consequence if forgotten | Prevention |
|---|---|---|---|
| 1 | Traefik < v3.7 on Docker ≥ 29 | Provider dies silently, every route 404, container still "Up" | Pin `traefik:v3.7`+; after a Docker upgrade you must read the traefik log |
| 2 | Watchtower missing `DOCKER_API_VERSION=1.44` | Dies right at startup ("client version 1.25 is too old") | Keep the env in watchtower.yml |
| 3 | Mounting the single `config.json` file into watchtower | After re-login to ghcr, watchtower is blind to the credential (403) | Mount the whole `~/.docker` directory + `DOCKER_CONFIG=/config` |
| 4 | `watchtower.yml` missing its own `name:` | `--remove-orphans` deletes traefik/cloudflared by accident | Keep the `name: watchtower` line |
| 5 | DNS record pointing at an old tunnel-id | 530 across the board even though the tunnel is alive | Use only ONE wildcard record; a new tunnel requires fixing the `*` record |
| 6 | Moving the directory holding a running compose | Orphaned stack, editing the config has no effect | Invariant location: `/opt/infra`, `/opt/apps/<name>`; to move: down → move → up |
| 7 | App forgetting `networks: [edge]` or a wrong `loadbalancer.server.port` | 502 | Checklist the 5 labels + network when adding an app (Step 9) |
| 8 | Secrets in compose / forgetting `.gitignore` | Token leaks when sharing the file | Secrets ONLY in `.env` chmod 600 + `.gitignore` |
| 9 | Bringing down the infra stack while apps are still running | Error deleting the busy edge network | Sequence: down apps first, infra after; up is the reverse |
| 10 | Forgetting to back up `.env` before a reset | Lose the tunnel token + secrets, have to recreate from scratch | Appendix A: back up the volume + both groups of `.env` files |
