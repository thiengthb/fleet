# DOCUMENT 2 — DISSECTION: WHY THE OLD SYSTEM FAILED & HOW IT WAS FIXED

> This is the "autopsy" report of the old architecture on the NUC `thienminiserver`,
> carried out on 2026-06-07 BEFORE deleting anything — to understand the root
> causes, not patch blindly. Each section contains: **symptom → evidence →
> failure mechanism → fix → lesson**.

---

## TABLE OF CONTENTS

1. [The scene before cleanup](#1-hiện-trường-trước-khi-dọn)
2. [Root cause #1 — Traefik v3.5 kills the Docker provider on Docker 29 (the main one)](#2-lỗi-gốc-1)
3. [Root cause #2 — DNS pointing at a "ghost" tunnel → all sites 530](#3-lỗi-gốc-2)
4. [Errors during the rebuild (and handled on the spot)](#4-lỗi-phát-sinh-khi-dựng-lại)
5. [Foundational architectural problems of the old system](#5-vấn-đề-kiến-trúc-nền)
6. [Summary: the chain of events leading to the "unexplained failure"](#6-tổng-kết-chuỗi-sự-kiện)
7. [Lessons learned](#7-bài-học-rút-ra)

---

## 1. THE SCENE BEFORE CLEANUP

Results of the **read-only** diagnostic commands (`docker ps -a`, `docker network ls`,
`docker compose ls`, `docker logs`, `docker network inspect`):

| Container | Image | Network | State at examination |
|---|---|---|---|
| traefik | traefik:v3.5 | `infrastructure` | Up — but the Docker provider was **completely dead** |
| cloudflared | cloudflared:latest | `infrastructure` | Up — tunnel registered 4 connections (healthy!) |
| link-manager-api | built locally on the NUC | `infrastructure` | Up, healthy, publishing 3001 to the host |
| portainer | portainer-ce | `infrastructure` | Up |
| netdata | netdata | `host` | Up (unrelated) |

Key observations:
- The `edge` network **never existed**. But every container was on the same
  `infrastructure` network → **the "different network causes 502" failure was NOT the culprit this time**
  (this was the first surprise — the most common failure scenario was not what happened).
- `https://link.thientnse.site` and `https://portainer.thientnse.site` both returned
  **HTTP 530** (Cloudflare origin error) — even though the tunnel on the NUC reported connected.
- `docker compose ls` pointed at paths that **no longer existed** (details in section 5.1).

---

## 2. ROOT CAUSE #1 — TRAEFIK v3.5 KILLS THE DOCKER PROVIDER ON DOCKER 29
### (This is exactly your "unexplained failure")

### Symptom
Every route through traefik returned 404. No matter how correctly the labels were set, it was useless. No error message appeared to the web user beyond the blank 404 page.

### Evidence (traefik log, looping endlessly every few seconds)
```
ERR Failed to retrieve information of the docker client and server host
    error="Error response from daemon: client version 1.24 is too old.
           Minimum supported API version is 1.40, please upgrade your client
           to a newer version" providerName=docker
ERR Provider error, retrying in 954.33254ms ...
```

### The failure mechanism — explained at the root

1. Every tool that talks to Docker (traefik, watchtower, portainer, the `docker`
   command itself) uses the **Docker Engine API** over the socket `/var/run/docker.sock`,
   and must declare "I speak API version X".
2. **The NUC has Docker Engine 29.5.2 installed** — this version **dropped support for all
   APIs < 1.40** (Docker's policy of cutting off old APIs).
3. **Traefik v3.5 (and every earlier release) hard-pins API version `1.24` in
   source code** — a very old number, chosen long ago for broad compatibility. There is no
   config flag to change it; even the standard `DOCKER_API_VERSION` environment variable
   is **overridden by the hard-pinned value** (tested for real during the rebuild — see section 4.1).
4. Result: the daemon rejects it right at the handshake step → **the Docker provider never
   starts** → traefik can't read any container/label →
   **the route table is permanently empty** → every request matching any rule has none → 404.
5. Traefik still shows "Up" normally in `docker ps`, web 80/443 still accepts connections
   — so from the outside **there is no sign at all that it's broken**. The error only shows in
   the log. This is why it became an "unexplained failure": the component is broken
   but not dead, doesn't crash, doesn't restart-loop.

### Why did it work before?
Almost certainly the system once ran on an older Docker version (with a lower min API).
A single **upgrade of Docker Engine to 29** (or a machine reinstall) silently
pulled the rug out from under traefik. Nobody changed the traefik config — so the
feeling of "it just broke on its own" is accurate: the thing that changed was Docker, not the config.

### Evidence that you wrestled with its consequences
The history of cloudflared's ingress config (read from the log) shows the trial-and-error process:
```
v1: *.thientnse.site         → http://traefik:80          (standard architecture, wildcard)
v2: api.thientnse.site       → http://traefik:80
v3: linkmgt.thientnse.site   → http://traefik:80
v4: portainer.thientnse.site → http://traefik:80
v5: + link.thientnse.site    → http://traefik:80
v6: link.thientnse.site      → http://link-manager-api:3001   ← BYPASS traefik, point straight at the app!
```
Step v6 is the classic firefight: because traefik could never route (due to the bug
above), you pointed the tunnel **straight at the app container**, bypassing traefik. It worked
— but it broke the architecture: every new app then has to touch Cloudflare again, the
public/private-by-label mechanism becomes meaningless, and the wildcard is abandoned.

### Fix (done)
- **Upgraded traefik to v3.7.4** (build 2026-06-05). From v3.7, traefik uses a new/negotiable
  API version with modern daemons → the provider came back to life instantly:
  the log cleared of errors, the routers from labels appeared in traefik's API within seconds.
- Verification process: after swapping the image, calling
  `curl -H "Host: traefik.localhost" http://127.0.0.1:8080/api/http/routers`
  showed the router registered from the Docker label → concluded the provider works.

### Lesson
- `docker ps` showing "Up" **does not mean healthy**. You must read the log of each infra
  component after upgrading anything.
- Upgrading Docker Engine is a change with **the potential to break every tool clinging to the socket**
  (traefik, watchtower, portainer…). In future, after upgrading Docker → check the logs of the whole cluster immediately.

---

## 3. ROOT CAUSE #2 — DNS POINTING AT A "GHOST" TUNNEL → ALL SITES 530

### Symptom
`link.thientnse.site`, `portainer.thientnse.site` returned **HTTP 530** (Cloudflare
error 1033: origin unreachable) — while `docker logs cloudflared` on the NUC
clearly showed "Registered tunnel connection" × 4, i.e. the tunnel was alive and healthy.

### The failure mechanism
A working public hostname needs **2 pieces to match**:
1. **DNS record**: `<sub>.thientnse.site` → CNAME `<tunnel-id>.cfargotunnel.com`
2. **Tunnel config**: the tunnel `<tunnel-id>` has an ingress rule for that hostname.

A 530/1033 error = piece (1) points at a tunnel-id with **no live connection**.
On your machine there had been several tunnels through the various attempts (an old tunnel named
`nuc-server`). The old DNS records were created against the old tunnel; the old tunnel died/was
replaced → the record became "pointing at a ghost". The new tunnel (`f725123c-…`) was healthy but
**no record pointed at it** → Cloudflare had no path down to the NUC.

This is an "up in the sky" (Cloudflare) layer bug — all debugging on the NUC is a dead end because
on the NUC there is genuinely **nothing wrong**. The symptom is deceptive: "tunnel connected
but the site is dead".

### Fix (done — you operated on the dashboard following instructions)
1. Delete the old per-host public hostnames (`portainer.…`, `link.…` pointing straight at the app).
2. Add **a single wildcard**: `*.thientnse.site → http://traefik:80`.
3. Delete the old per-host DNS records (pointing at the ghost tunnel), add **one wildcard record**:
   `CNAME * → f725123c-a055-4119-92ec-32db3c1df4ea.cfargotunnel.com` (proxied).
4. Verify: `curl https://test-wildcard.thientnse.site` returns **traefik's 404**
   — a 404 here is GOOD NEWS: it proves the chain DNS → tunnel → traefik is now
   wide open (it's just that no app accepts that host yet). The 530 error is gone.

### Lesson
- Wildcard once, lives forever: from now on **adding a new app never touches
  Cloudflare** → no more chance to ever create a record mismatched with the tunnel-id.
- When you hit 530/1033: compare the **tunnel-id in the DNS record** with the **running tunnel-id**
  (`docker logs cloudflared` or the dashboard) — that's a one-shot check that nails it.

---

## 4. ERRORS THAT AROSE DURING THE REBUILD (handled on the spot in the process)

This section is recorded so you understand why the new config has certain "odd" details.

### 4.1. Tried `DOCKER_API_VERSION=1.44` on traefik v3.5 — FAILED (recorded on purpose)
The original plan used `traefik:v3.3` (per the template) + the `DOCKER_API_VERSION` env.
In reality: **traefik ignores this env** (the hard-pinned value in code overrides it), the error
stayed exactly the same. Conclusion by experiment: with traefik, **only upgrading the version**
fixes it → settled on v3.7. This is why the infra compose has NO such env for traefik.

### 4.2. Watchtower 1.7.1 also died from the same API disease (pinned 1.25)
```
level=error msg="Error response from daemon: client version 1.25 is too old.
                 Minimum supported API version is 1.40..."
```
Unlike traefik, watchtower **DOES** read the `DOCKER_API_VERSION` env → adding
`DOCKER_API_VERSION=1.44` to the environment makes it run. That's why
`/opt/infra/watchtower.yml` has this env line — **do not delete it**.

### 4.3. Two compose files in the same directory = same project → "orphan" warning
`watchtower.yml` sits in the same `/opt/infra` as the main compose → compose treats it as the same
project `infra`, threatening "Found orphan containers ([traefik cloudflared])". The hidden danger:
someone running `docker compose -f watchtower.yml down --remove-orphans`
would **accidentally delete traefik + cloudflared**. Fix: add `name: watchtower` to the top of
`watchtower.yml` — it becomes its own project, no more collision.

### 4.4. Watchtower blind to credentials after re-login to ghcr (the subtlest bug)
Symptom: watchtower reports `403 Forbidden, auth: "not present"` when checking
the image — even though a manual `docker pull` on the NUC works fine.

Mechanism: the original config mounted a **single file**
`/home/thien25/.docker/config.json:/config.json:ro`. A bind-mounted file clings to the
**inode**. When you run `docker login` again (changing the PAT), docker **writes a
new file** (new inode) instead of editing the old one → watchtower still clings to the old inode → it sees
dead credential content.

Fix: mount **the whole directory** + specify where to read the config:
```yaml
volumes:
  - /home/thien25/.docker:/config:ro
environment:
  - DOCKER_CONFIG=/config
```
From now on you can re-login freely, watchtower always reads the new file. Verified: the scan cycle
afterward `Session done Failed=0 Scanned=1` — clean.

### 4.5. GitHub Actions fail with 0 steps run — account billing-locked
The first run of the new workflow failed with **no step running**. Annotation:
> "The job was not started because your account is locked due to a billing issue."

Meaning: the workflow is correct, but the `thiengthb` account is billing-locked → GitHub won't
provision a `ubuntu-latest` VM. (This is also quite likely the historical reason that forced you
to use a **self-hosted runner on the NUC** previously!)

Temporary handling (done): build the image **once by hand on the NUC** from the existing clone,
tag `latest` + `25e663c`, push to ghcr with a `write:packages` PAT → Phase 5 could
proceed. Still owed: unlock at `github.com/settings/billing` →
re-run the workflow → from then on, CI is fully automatic.

---

## 5. FOUNDATIONAL ARCHITECTURAL PROBLEMS OF THE OLD SYSTEM
### (Not yet "on fire" but time bombs — all removed in the new build)

### 5.1. "Orphaned" compose projects — losing the ability to manage the stack
The old `docker compose ls` pointed at:
```
cloudflared   /home/thien25/homelab/cloudflared/docker-compose.yml      ← DOES NOT EXIST
traefik       /home/thien25/homelab/traefik/docker-compose.yml          ← DOES NOT EXIST
```
The real files had been moved to `~/homelab/infrastructure/...` **after** the containers
were created — the containers keep running but "lost their birth certificate": you can no longer
`docker compose down/up/restart` by project, and editing the new file has no effect on the running
container (it was born from the file at the old path). The system fell into a state of
"editing the config forever and seeing nothing change".
**New build:** the file location is invariant: `/opt/infra` and `/opt/apps/<name>`. To
move it you must `down` at the old place → move → `up` at the new place.

### 5.2. TUNNEL_TOKEN sitting naked in docker-compose.yml
The tunnel token was hardcoded in plaintext right in the old compose file — a file like this is very
easy to accidentally commit to git/share when asking for help. A leaked token = someone else running an
impersonating tunnel. **New build:** the token is in `/opt/infra/.env` (chmod 600) + `.gitignore`;
the compose only references `${TUNNEL_TOKEN}`.

### 5.3. Traefik dashboard exposing `0.0.0.0:8080` + `api.insecure: true`
Anyone on the LAN/Tailnet opening `http://<nuc-ip>:8080` sees the entire route map,
container names, internal ports. **New build:** bind `127.0.0.1:8080` — only viewable
via SSH tunnel.

### 5.4. Building the image right on the NUC via a self-hosted runner
The old workflow `deploy-backend.yml` ran `runs-on: self-hosted` — build + deploy
right on the NUC. Consequences: the NUC bears the build load (RAM/CPU/disk — pruning recovered 1.3GB of
build-cache garbage), GitHub has a "door" to run commands on the home machine (security risk), and the
build machine = the run machine so breaking one breaks both. **New build:** build 100% on
GitHub's runner; the NUC only pulls images — one-way, clean, safe.

### 5.5. App publishing a port straight to the host
The old `link-manager-api` published `0.0.0.0:3001` → anyone on the LAN/Tailnet could call the
API directly without going through traefik. **New build:** the app publishes NO port; only traefik reaches
it over the `edge` network.

### 5.6. Traefik config split between file and flags — half-and-half
The old traefik had both `traefik.yml` (file) and flags in the compose, two places defining things
that overlapped (the file declared entrypoints web/websecure, the flags declared providers…). Hard
to tell which one took effect. **New build:** 100% flags in compose — one source of truth.

---

## 6. SUMMARY: THE CHAIN OF EVENTS LEADING TO THE "UNEXPLAINED FAILURE"

Piecing all the evidence together, the story almost certainly went like this:

1. The system originally ran fine: traefik (old Docker) + the old tunnel + per-host records.
2. **Docker Engine was upgraded to 29** (or the machine reinstalled) → traefik v3.x pinned to
   API 1.24 immediately went **blind to Docker** → every route died → web 404. Nothing
   "crashed" so it couldn't be traced.
3. You tried to fix it: changed the tunnel config many times (6 ingress versions), created
   a new tunnel/record, and finally **bypassed traefik** by pointing straight at the app — a temporary success.
4. During the trial-and-error, the DNS record and tunnel-id became **mismatched** → adding a 530
   error on top of the 404 error — two errors at two different layers stacked on top of each other,
   making every single diagnosis come out contradictory ("tunnel connected but the site is dead",
   "label correct but 404").
5. Moving the directory (`homelab/traefik` → `homelab/infrastructure/traefik`)
   orphaned the containers from their compose project → editing the config no longer had any effect →
   the feeling that "nothing you do makes any difference".

**In one sentence:** *what killed the old system was not a wrong config, but one silent Docker
upgrade + the chain of firefighting afterward that knocked DNS/tunnel/config files out of phase
with each other across three different layers.*

---

## 7. LESSONS LEARNED

1. **Diagnose first, delete after.** Every root cause above was found with read-only
   commands before removing anything. Had we deleted right at the start, the "Docker 29
   vs old traefik" lesson would have come back to bite us again on the new build (the original template
   uses v3.3 — would have hit the exact same thing).
2. **"Up" ≠ "healthy".** After any infra change, read the log of each infra container:
   `docker logs traefik|cloudflared|watchtower --tail 30`.
3. **One error per layer — debug by the flow.** DNS → tunnel → traefik → app.
   Pinpoint which layer the request dies at before fixing anything
   (the debugging table in Document 1 section 7).
4. **Wildcard whatever you can.** One `*` record + one `*` ingress = a whole class of
   "record mismatched with tunnel" errors gone forever.
5. **The compose file path is the stack's identity.** Don't move the directory
   holding the compose of a running container.
6. **Secrets go in `.env` + `.gitignore`, no exceptions.** Even on "just a home machine".
7. **Mount the credential directory, not a single file** — `docker login` swaps the
   inode, a bind-mounted file becomes a snapshot of the past.
8. **Pin versions deliberately.** `traefik:v3.7` (new enough to live with Docker 29,
   minor-pinned so it won't jump a major on its own). The `latest` tag is only for things with a
   watcher (the app managed by watchtower, rollback-able via the SHA tag).

---

## 8. LATER TRAP (2026-07-18): a native module's binding vanishes in a Next `standalone` Docker build

**Symptom.** `sakubun` container built fine, started, then crashed at first DB access with
`better-sqlite3: Could not locate the bindings file` (tried `build/Release/better_sqlite3.node` etc.).
It had worked on every previous rebuild.

**Trigger.** A dependency was added with `npm install <pkg>` run on a **Windows** dev box, which
regenerated `package-lock.json`. (No relation to the added package itself.)

**Failure mechanism (two compounding causes).**
1. A lockfile regenerated on a **different OS** can make `npm ci` on Linux **skip better-sqlite3's
   native build** (its install/prebuild step doesn't run as before). Verified: `docker build --target
   build` then `run ls node_modules/better-sqlite3/build/Release` → empty.
2. Next `output: 'standalone'` traces files with `@vercel/nft`; the `.node` binding is loaded by the
   `bindings` package via a **runtime filesystem lookup nft can't trace**, so the standalone prune drops
   it (leaving only `lib/` + `package.json`).

**Fix (Dockerfile, deterministic).**
- deps stage: `RUN npm ci && npm rebuild better-sqlite3` — `npm rebuild` re-runs the install script and
  **prebuild-install fetches the prebuilt** `.node`. (A *source* build — `--build-from-source` — FAILS:
  node-gyp times out fetching node headers in the build sandbox. Use the prebuilt path.)
- runtime stage: `COPY --from=build /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3`
  over the pruned standalone copy. `next.config.ts` `outputFileTracingIncludes` did **not** help (there
  was no binding in the build stage to include).

**Lesson.** ① Any project with a **native dep** (`better-sqlite3`, `sharp`, …) + Next `standalone` must
force-restore the binding (`npm rebuild` + `COPY` into standalone) — don't trust nft to carry it. ② After
adding ANY dependency (especially from a non-Linux machine), **rebuild and confirm the container actually
starts** (`docker inspect -f '{{.State.Health.Status}}'` + `docker logs`), because a native transitive
dep can lose its binding silently while the image build still succeeds. Detail: `sakubun/docs/decisions.md`
2026-07-18.

## 9. LATER TRAP (2026-07-19): `docker compose up -d --build` silently kept the OLD image (full cache hit)

**Symptom.** After editing source, `docker compose up -d --build <svc>` printed "Container … Running"
(not "Recreated") and the container kept running the OLD code. The build produced a **byte-identical image
(same sha)** — every layer was a cache hit — so `compose up` saw no change and didn't recreate.

**Why.** `--build` reuses the BuildKit layer cache; when the resulting image digest equals what's already
running, `compose up` treats the service as up-to-date and skips recreation. The image `CreatedAt` also
stays at the original build time (top layer unchanged) — that's the tell.

**Fix / verify.** When a rebuild must pick up source changes and you suspect a stale image:
`docker compose build --no-cache <svc>` then `docker compose up -d --force-recreate <svc>`. Then VERIFY
the new code is actually live — never trust "Running": confirm `docker ps` CreatedAt is fresh, compare
`docker inspect <svc> -f '{{.Image}}'` (or `docker images <img>`) sha before-vs-after, and grep a known new
string inside the running bundle (`docker exec <svc> sh -c "grep -rl <marker> .next"`). Applies to the
LOCAL docker-compose dev deploys (the NUC's Watchtower pull path is unaffected — it keys on a new tag).

## 10. LATER TRAP (2026-07-20): compose PREFIXES a named volume, and the wrong name fails SILENTLY

**Symptom.** A restore "succeeds" and the app comes back empty, or a backup runbook looks correct and
does nothing.

**Cause.** A volume declared in `docker-compose.yml` as

```yaml
volumes:
  sakubun_data:
```

does NOT exist on the host under that name. Compose prefixes it with the project name (the directory),
so the real volume is `sakubun_sakubun_data`. Check with `docker volume ls`.

**Why it is dangerous rather than merely wrong.** `docker run -v sakubun_data:/data ...` does not
error. Docker treats an unknown name as a request to CREATE a volume, so the command happily makes an
empty one and the restore writes into a volume nothing reads. The user sees no failure and believes
their data is back.

**Rule.** Before putting a `docker run -v <name>:...` line into a runbook, a `/guide` page or any
user-facing copy, confirm the name with `docker volume ls`. In sakubun the stale bare name had been
sitting in `app/guide/page.tsx` for weeks before a restore test exposed it.

**Related.** `sakubun/scripts/verify-restore.sh` (proves the round-trip end to end),
`sakubun/docs/decisions.md` 2026-07-20 "A backup is a claim until a restore has been performed".

## 11. LATER TRAP (2026-07-21): a root-seeded volume makes an app running as `USER node` hit "readonly database"

**Symptom.** Seeding a throwaway volume with a real SQLite DB (to verify an image build), the container's
`prisma migrate deploy` fails at startup with **`SQLite database error: attempt to write a readonly database`** —
even though the file is present and readable, and the same image runs fine against its own fresh volume.

**Cause.** The DB was piped in via a **root** helper container
(`docker run -i -v vol:/data alpine sh -c 'cat > /data/sakubun.db'`), so `/data` AND the file are **root-owned**.
The app image runs as `USER node` (uid 1000). SQLite's write path — and Prisma's SQLite migrations, which use a
RedefineTables rebuild — must create a **journal/WAL file in the directory**, not just write the file. A
root-owned directory is read-only to uid 1000, so the whole migration is "readonly".

**Why it hides.** The normal flow never trips it: the app container starts with an EMPTY volume and creates the
DB itself, so everything is already `node`-owned. The trap only appears when you pre-seed a volume from outside.

**Rule.** After seeding a volume for an app that runs as non-root, `chown -R <uid>:<gid> /data` to the app's user
(uid 1000 for `node:alpine`). Bake it into the seed step: `sh -c 'cat > /data/db && chown -R 1000:1000 /data'`.

**Related.** `sakubun/scripts/verify-image.sh`, `sakubun/docs/decisions.md` 2026-07-21 "Verify a rebuilt image
against a COPY of the real volume".


## 12. LATER TRAP (2026-07-21): `build: .` + `migrate deploy`-at-start bakes UNCOMMITTED WIP into the live image

**Symptom.** You are ready to rebuild the live container to ship a merged, pushed feature — but the working
tree ALSO holds someone's in-progress WIP (a modified `schema.prisma`, an untracked new migration dir). A plain
`docker compose up -d --build` (or `docker build .`) would silently ship that WIP.

**The failure mechanism.** The Dockerfile does `COPY . .` from the **working directory**, not from git — so a
modified `prisma/schema.prisma` and an untracked `prisma/migrations/<wip>/` land in the image. Worse, the runtime
`CMD` runs `prisma migrate deploy` on startup, which applies **every** migration in the image — so the WIP
migration hits the **live volume** (real data), not just the image. Committed-and-pushed ≠ what gets built.

**Fix.** Build the image from a **clean git worktree at the exact pushed commit**, never from the dirty tree:
`git worktree add ../.build <commit>; docker build -t <img> ../.build`, then `docker compose up -d --no-build`
(so compose uses the pre-built image instead of re-building from `.`). The author's WIP is left untouched in the
main tree. `--no-build` is the load-bearing flag — without it `up` may rebuild from the dirty context.

**Lesson.** When `build: .` meets a shared working tree, "what's committed" and "what builds" diverge. Pin the
build to a commit (worktree) and forbid the implicit rebuild (`--no-build`). Verify: `grep -c 'model Group' the
worktree schema` before building. (Belt: back up the live volume first — the OLD image's `/api/backup` is still
un-authed pre-cutover.)

**Related.** `sakubun/Dockerfile` (`COPY . .`, `CMD … migrate deploy`), `sakubun/docker-compose.yml` (`build: .`).

## 13. LATER TRAP (2026-07-21): better-auth rejects `localhost` when `baseURL` is the public domain

**Symptom.** After deploying an authed app (better-auth) reachable both on `localhost:PORT` (the host) and
`https://app.domain` (the tunnel), sign-in/up from the localhost page fails with HTTP **403** and the container
logs `ERROR [Better Auth]: Invalid origin: http://localhost:PORT` (code `INVALID_ORIGIN`).

**The failure mechanism.** better-auth validates the request `Origin` against `baseURL` (set to the public domain
for correct prod cookies/callbacks). A same-app request from `localhost` is a DIFFERENT origin → rejected. The
public URL works (origin matches); localhost does not.

**Fix.** Add `trustedOrigins: ['http://localhost:PORT', 'https://app.domain', …]` to the better-auth config (keep
`baseURL` = the domain). Then BOTH work. Note: the fix only takes effect on the next image rebuild — until then
use the public URL. Guard the operator against a mid-deploy dead-end: tell them "register via the public URL now,
localhost after the rebuild".

**Lesson.** `baseURL` is single-valued but a home-server app has two legitimate origins (host + tunnel).
`trustedOrigins` is the multi-origin knob; set it the moment the app is reachable on more than one host.

**Related.** `sakubun/lib/auth.ts` (`trustedOrigins`), `sakubun/docs/decisions.md` 2026-07-21.

## 14. LATER TRAP (2026-07-21): Cloudflare Access gating a whole host also blocks the app's MACHINE endpoint

**Symptom.** An MCP client (Claude Desktop via `mcp-remote`) can't connect to a home-server app's
`/api/mcp`, failing with `Streamable HTTP error: Unexpected content type: text/html` — even though the
Bearer token is correct and the human can log into the web UI just fine.

**The failure mechanism.** The host (`sakubun.thientnse.site`) sits behind a **Cloudflare Access** application
(operator-only, added to keep the app private pre-auth). CF Access gates **every path on the host**, including
`/api/mcp`. A browser carries the CF Access cookie so the human gets through; a **machine** client has no CF
Access credential, so CF returns a **302 → `*.cloudflareaccess.com` login (HTML)** instead of forwarding to the
app. `mcp-remote` POSTs JSON and gets HTML back → "Unexpected content type: text/html". The app's own Bearer
token never even reaches it. Confirm with `curl -sD - -X POST https://host/api/mcp …` → look for
`Www-Authenticate: Cloudflare-Access` + a `Location:` to `cloudflareaccess.com`.

**Fix.** A machine endpoint must NOT sit behind interactive SSO (the platform invariant: never forward-auth an
endpoint a machine client calls automatically — the app already guards it with a Bearer token). Carve `/api/mcp`
out of CF Access: **Zero Trust → Access → Applications → Add → Self-hosted**, subdomain + **Path `api/mcp`**,
policy **Action = Bypass / Include = Everyone**. Access matches the most specific path, so only `/api/mcp` is
released; the rest of the host stays gated. Verify: the same curl now returns the app's **`401` + `Content-Type:
application/json` + `Www-Authenticate: Bearer`** (the app's own gate), and an `initialize` with a real token
returns the MCP `serverInfo`.

**Lesson / anti-regression.** ① Whenever a host is put behind Cloudflare Access (or any edge SSO), **any machine
endpoint on it must be explicitly bypassed** — the app authorizes machines itself. ② A later `/nuc-health-audit`
will see `/api/mcp` "unprotected at the edge" and may be tempted to re-add Access to it — **do not**; that
re-breaks MCP. The Bypass carve-out is deliberate and load-bearing.

**Related.** `sakubun/app/api/[transport]/route.ts` (`withMcpAuth` Bearer gate), `sakubun/lib/mcp-key.ts`
(`verifyMcpToken`), `sakubun/docs/decisions.md` 2026-07-21.
