# DOCUMENT 4 — AI AGENT RUNBOOK: REBUILDING THE NUC PLATFORM AFTER A RESET

> **The reader of this file is an AI agent (Claude Code), not a human.**
>
> When the user (Teruhiro) says something like: *"My NUC got reset, rebuild the system
> per the runbook"* — read this ENTIRE file before running the first command,
> then carry it out sequentially. This file is the agent-oriented version of
> `03-SETUP-FROM-SCRATCH.md`: same destination, but spelling out **what the agent can do
> on its own, what it must ask the user for, what to ask the user, and how to verify**.
>
> Two foundational documents to read alongside (same directory):
> - `01-architecture-and-operations.md` — the target architecture to reach.
> - `02-known-traps.md` — the traps that have caused failures. Do NOT repeat them.

---

## 0. WORKING RULES (non-negotiable)

1. **Sequentially, one PHASE at a time, stop at every 🛑 CHECKPOINT** to wait for the user to
   confirm/provide information. No jumping ahead.
2. **Every destructive command (`down`, `rm`, `prune`, overwriting files) must list the exact
   things affected and ask first** — even when the machine is "freshly reset" (the user may have
   already installed something, or the reset wasn't as clean as they think).
3. **Secrets**: tokens/PATs/keys may only be written into `.env` chmod 600 on the NUC.
   Do not echo secrets to the log/chat unless the user pastes them in themselves. Every directory
   holding a `.env` must have a `.gitignore` containing `.env`.
4. A command fails → stop, read the log, diagnose, propose — do not blindly guess and keep going.
5. After each phase: a short summary of what was done + what the next phase is.
6. Check your memory (this project's `MEMORY.md`) — it may hold newer information
   than this file (token changed, version changed…). On conflict → trust the newer
   memory, and ask the user when in doubt.

---

## 1. ASSESS THE SITUATION FIRST (Phase 0)

Ask the user / self-check to determine the **extent of the loss** — this decides which phases to run:

| Question | If PRESENT | If LOST |
|---|---|---|
| Is the NUC still SSH-able? (`Test-NetConnection thienminiserver -Port 22`) | Move on to the next check | Ask the user to install OS + OpenSSH + Tailscale (they have `03-SETUP-FROM-SCRATCH.md` steps 1–3) |
| Does the dev machine's SSH key still work? (`ssh -o BatchMode=yes thien25@thienminiserver "echo OK"`) | Skip section 2.2 | Do section 2.2 (bootstrap SSH) |
| Docker on the NUC? (`docker --version`) | Note the version — **if ≥ 29, all the API constraints in this file apply** | User installs: `curl -fsSL https://get.docker.com \| sudo sh` + `usermod -aG docker thien25` |
| Does the old Cloudflare tunnel still exist? (ask the user, or check the dashboard) | Only need the token, do NOT touch DNS | Phase 4 must also do the tunnel-create + DNS-wildcard-fix part |
| Do the GitHub repo + workflow still exist? | (Almost certainly yes — resetting the NUC doesn't affect GitHub) Skip the repo side | See `03` Appendix B |
| Is there a backup of the data volume? (ask the user) | Restore in Phase 5 BEFORE bringing the app up | The app starts with an empty DB — tell the user clearly |

🛑 **CHECKPOINT 0** — Present the filled-in assessment table to the user, confirm the list of
phases to run. Wait for agreement.

---

## 2. CONNECT FROM THE DEV MACHINE (Phase 1)

### 2.1. Standard info (re-confirm with the user if different)
- Host: `thienminiserver` (Tailscale, was once `100.126.231.94`)
- User: `thien25` (in the `docker` group, has sudo; sudo password = user password — the user will provide it if needed)
- Dev machine: Windows, working in `D:\Projects\MiniServer\`

### 2.2. Bootstrap the SSH key (only when the key doesn't work yet)
The dev machine is Windows PowerShell 5.1, **no sshpass**. The verified working method
(session 2026-06-07):

```powershell
# 1. Create the key if it doesn't exist:
ssh-keygen -t ed25519 -N '""' -f "$env:USERPROFILE\.ssh\id_ed25519" -C "claude-code@windows"
# 2. Install Posh-SSH to authenticate with the password ONCE (ask the user for the password):
Install-PackageProvider -Name NuGet -MinimumVersion 2.8.5.201 -Force -Scope CurrentUser
Install-Module Posh-SSH -Scope CurrentUser -Force -AllowClobber
# 3. Use New-SSHSession + Invoke-SSHCommand to append the pubkey to ~/.ssh/authorized_keys
#    (mkdir -p ~/.ssh; chmod 700; chmod 600 authorized_keys)
```
Or more simply: ask the user to run `! type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh thien25@thienminiserver "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"` and enter the password.

**✅ VERIFY:** `ssh -o BatchMode=yes thien25@thienminiserver "echo OK; groups"`
→ `OK` + the groups include `docker`.

> Operational note: running long commands on the NUC via `ssh thien25@thienminiserver '<command>'`
> with the Bash tool (Git Bash) avoids quoting errors better than PowerShell. Avoid Go templates
> with `$` in PowerShell — it swallows the variables.

---

## 3. SURVEY & CLEAN THE GROUND (Phase 2 — only when the NUC isn't completely clean)

Run the READ-ONLY command set, report to the user:
```bash
docker ps -a ; docker network ls ; docker compose ls -a ; docker volume ls
docker network inspect edge 2>/dev/null || echo "edge does not exist yet"
```
Old junk present → list exactly what you intend to delete, **🛑 ask for confirmation**, only then
`down`/`rm`/`prune -f` (NOT `-a`, NOT `--volumes` unless the user approves).
**Any volume named `*_data` is absolutely kept** unless the user says to drop it.

---

## 4. STAND UP THE INFRASTRUCTURE (Phases 3–4)

The file content **verbatim** comes from `03-SETUP-FROM-SCRATCH.md` Steps 6 and 8 —
do NOT reconstruct it from memory. The sequence and the points agents often get wrong:

### 4.1. `/opt/infra` (traefik + cloudflared)
```bash
sudo mkdir -p /opt/infra /opt/apps && sudo chown -R thien25:thien25 /opt/infra /opt/apps
# (sudo over SSH without a tty: use `echo <password> | sudo -S ...` — ask the user for the password)
```
- Write `docker-compose.yml` per `03` Step 6.2. **Traefik MUST be ≥ v3.7** —
  this is hard lesson #1 (Document 02 section 2): the old version pins Docker API 1.24,
  Docker ≥ 29 rejects it → the provider dies silently, every route 404, the
  `DOCKER_API_VERSION` env does NOT save traefik (tried, failed).
- 🛑 **token CHECKPOINT**: ask the user for the `TUNNEL_TOKEN` (Cloudflare One →
  Tunnels → Configure). Write it into `/opt/infra/.env` chmod 600. If the user still has a
  `.env` backup, reuse it.
- `docker compose up -d` then **✅ VERIFY**:
  - `docker logs cloudflared | grep -c "Registered tunnel connection"` ≥ 1
  - `docker logs traefik --tail 20` **has no ERR** ("client version ... too old" = wrong image)
  - `curl -s -H "Host: traefik.localhost" http://127.0.0.1:8080/api/http/routers` returns JSON with the dashboard router → the provider is alive.

### 4.2. Cloudflare (only when the tunnel/DNS changes)
The agent can't do the dashboard on its own (unless the user provides an API token with
Zone.DNS:Edit + Tunnel:Edit). Guide the user per `03` Step 7:
wildcard hostname `*.thientnse.site → http://traefik:80` + DNS
`CNAME * → <TUNNEL-ID>.cfargotunnel.com` (proxied), delete per-host records pointing at the old tunnel.

**✅ VERIFY (important — distinguishes the 3 states):**
`curl -s -o /dev/null -w "%{http_code}" https://any-random.thientnse.site`
- `404` = PASS (chain open, traefik returns 404 because no app yet)
- `530` = DNS points at the wrong tunnel-id (lesson #2, Document 02 section 3)
- timeout = DNS hasn't propagated / tunnel isn't running

### 4.3. Watchtower
- 🛑 Ask the user to login to ghcr on the NUC: `echo '<PAT read:packages>' | docker login ghcr.io -u thiengthb --password-stdin` (or the user pastes the PAT for the agent to run).
- Write `/opt/infra/watchtower.yml` per `03` Step 8.2. **3 critical details**
  (each one is an error actually hit, Document 02 section 4):
  1. `name: watchtower` at the top of the file (missing → same project as infra → `--remove-orphans` deletes traefik by accident).
  2. `DOCKER_API_VERSION=1.44` in env (missing → watchtower dies: "client version 1.25 is too old").
  3. Mount **the directory** `/home/thien25/.docker:/config:ro` + `DOCKER_CONFIG=/config` (mounting a single file → re-login makes watchtower blind to the credential, 403 "auth not present").
- **✅ VERIFY:** wait ~70s, `docker logs watchtower | tail -3` →
  `Session done Failed=0 Scanned=0` (Scanned=0 is correct because no app carries a label yet).

---

## 5. RESTORE & DEPLOY THE APP (Phase 5)

1. **Restore the volume FIRST** (if there's a backup): `03` Step 4. link-manager's standard
   volume: `link-manager_data` (SQLite at `/data/links.db`).
2. The image on ghcr.io **still exists after resetting the NUC** (it lives on GitHub) —
   no need to rebuild anything. Check: `docker manifest inspect ghcr.io/thiengthb/linkmanager:latest`.
3. Stand up `/opt/apps/link-manager/` per `03` Step 9 (compose + `.env` + `.gitignore`).
   `.env` from the user's backup; no backup → use the template in `03` 9.2
   and **tell the user clearly** which variables are empty (`API_KEY`, `GEMINI_API_KEY`).
4. Other apps (if added after 2026-06): ask the user for the list, or check
   memory; do each app following the `/nuc-new-project` skill mold.
5. `docker compose up -d` for each app.

---

## 6. WHOLE-SYSTEM ACCEPTANCE TEST (Phase 6 — mandatory before reporting done)

Run all 6 checks in `03` Step 10. Summary of pass thresholds:
1. `docker ps` — all containers present, no restart-loop.
2. The Traefik API has the route for each public app.
3. `curl https://<app>.thientnse.site` → 200 (and the old data shows up if restored).
4. A random subdomain → 404.
5. Watchtower: `Failed=0 Scanned=<number of apps>`, no 403.
6. (If the user agrees) push a small commit → confirm watchtower auto-pulls within ≤60s+build time.

**Not passing all → may not report completion.** Passing all → summarize: what was
stood up, which secrets the user still owes, and update your memory (file
`nuc-platform-setup` — edit what changed: new tunnel ID? new version? new app?).

---

## 7. QUICK LOOKUP FOR ERRORS DURING THE REBUILD

| What you see | Means | What to do |
|---|---|---|
| traefik log "client version 1.24 too old" | traefik image < v3.7 | Change the image, do NOT try the env workaround (useless with traefik) |
| watchtower "client version 1.25 too old" | Missing `DOCKER_API_VERSION=1.44` | Add the env |
| watchtower 403 "auth not present" | Stale credential (single-file mount) or not logged in | Mount the directory + re-login |
| curl wildcard returns 530 | DNS points at an old/dead tunnel-id | Compare the tunnel-id in the DNS record with the running tunnel |
| curl app returns 404 | Traefik has no route yet | Label the app: enable/Host/port; is the app on the edge network? |
| curl app returns 502 | Route exists, calling the app fails | App missing `networks: [edge]` or wrong `loadbalancer.server.port` |
| Actions fail with 0 steps | GitHub billing lock | User unlocks at github.com/settings/billing; temporary: build by hand on the NUC, push with a write:packages PAT |
| compose reports an orphan at /opt/infra | watchtower.yml missing `name:` | Add `name: watchtower` |
| `docker compose ls` points at a non-existent path | Orphaned stack (file was moved) | Bring it down with `docker rm` directly, rebuild it in the right place |

---

*This file was written by Claude (Opus 4.8) right after the first build on 2026-06-07,
while every wound was still fresh. If you-the-future-version find reality differs from this
file (new version, new error), update this file and the memory after the work is done.*
