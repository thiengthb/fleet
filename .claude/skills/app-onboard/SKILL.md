---
name: app-onboard
description: "Onboard a project onto its deploy target and get it actually running — reads `target` from INVENTORY §0 first. On `nuc`: GitHub Actions → ghcr → Watchtower → Traefik → Cloudflare. On `local`: Dockerfile + named volume + a host port + rebuild-and-verify. Use when the user wants to create a new project, deploy an app, add a subdomain, promote a local app to the server, or \"get this app running\"."
---

# Skill: Bring a project onto the NUC platform

You will bring a project into fleet's standard deploy trajectory. Work SEQUENTIALLY
through the 6 stages below; each stage has a VERIFICATION section — don't move on until it passes.
The invariants in `<repo-root>/CLAUDE.md` are law; if a user request
conflicts with an invariant, point out the conflict and ask back before proceeding.

SSH NUC: `ssh thien25@thienminiserver` (key installed). App lives at `/opt/apps/<name>`.

## Step 0 — Read the `target` FIRST (mandatory)

**Which kind of machine is this app on?** Read the project's row in `platform/inventory.md §0`. It is **DATA — read
it, never assume.** The full law per target is in `platform/targets/<target>/README.md`.

| `target` | What this skill does |
|---|---|
| `nuc` | The procedure below. 🔴 **Check `INVENTORY` §NUC STATUS first** — the host has been down since 2026-07-22, so a `git push` deploys nothing. |
| `local` | No ghcr / Watchtower / Traefik / Authentik. Onboarding = Dockerfile + named volume + **pick a free host port** (check `INVENTORY §0` for collisions) + compose + `docker compose up -d --build`, then verify **healthy and serving**. Stages for repo setup, docs and tests apply unchanged. |
| `cloud` | **Not defined yet.** Read `platform/targets/cloud/README.md`, propose the procedure, and get it approved — do not improvise one. No project uses this target today. |
| `none` | This skill does not apply. |

> Unless a section says otherwise, **everything below this line is the `nuc` branch.** This skill was written
> NUC-first and renamed on 2026-07-28; the `local` column is the honest summary, not a second full procedure.

## Stage 0 — Gather information (ask the user if unclear)

You must know all 6 things before creating any file:

1. **Project name** (kebab-case, e.g. `todo-app`) — used as the directory name
   `/opt/apps/<name>`, container_name, and the Traefik router/service name.
2. **GitHub repo** — `thiengthb/<repo>`. No repo yet → create one (ask public/private).
3. **Framework & internal port** the app listens on (Next.js=3000, Express usually
   3000/3001, Vite static→nginx=80…). Read the code to determine it yourself first, only ask
   when unsure.
4. **Public or internal?** Public → which subdomain (`<sub>.thientnse.site`)?
   Check the subdomain isn't already used by another app: grep `Host(` in the
   `/opt/apps/*/docker-compose.yml` files on the NUC.
5. **Any data that needs to persist?** (DB file, uploads…) → named volume
   `<name>_data` mounted where in the container.
6. **Which runtime environment variables** are needed (DB_URL, API key…)? Which are needed
   **at build time** (like `VITE_*`, `NEXT_PUBLIC_*`)? → build-time variables must go through
   a GitHub secret + build-arg, they CANNOT live in `.env` on the NUC.

## Stage 0.5 — Classify: archetype (`kind`) + `domain`

Both axes go into the `INVENTORY §0` row (they are orthogonal — see §0). From the purpose +
framework in Stage 0, attach the project to **one `kind`** (the technical archetype below). Each `kind`
has a **living reference implementation** — COPY from it instead of rewriting; only change what differs.
(Don't duplicate a static template into the skill → avoids drift; the source of truth is the reference app.)

| archetype | Reference (copy from) | Take what | Specifics |
|-----------|----------------------|--------|---------|
| `web-app` (Next) | `projects/todo/` | `Dockerfile` (standalone multi-stage), `.github/workflows/deploy.yml`, `components.json` + the `@thiengthb` registry declaration (commons), `.dockerignore`, `next.config` (`output:'standalone'`) | Public: 4 Traefik labels. Follow `/coding-convention` + `/react-ui-craft`. Protection = Authentik forward-auth (`/app-protect`). |
| `python-worker` | `projects/nuc-monitor/` | `Dockerfile` (python slim), `deploy.yml`, sample `requirements.txt` | Headless: NO Traefik/port. Join `edge` only if egress is needed. |
| `node-bot` | `projects/jobhunter-bot/` | `Dockerfile` (node), `deploy.yml`, `package.json` (ESM, Node ≥22) | Headless Discord worker: NO Traefik. Secrets in NUC `.env`. |
| `monorepo` (→N images) | `projects/yakudoku/` | CI **matrix** building N images from 1 repo, layout `web/ core/ bot/`, compose with multiple services | One image is the **sole DB writer** if using SQLite; internal images do NOT get Traefik labels. |
| `infra` (third-party) | `projects/n8n/` or `projects/authentik/` | `docker-compose.yml` + `.env` | Version-pinned image, NO Watchtower label; update = bump the tag manually. No CI build. |

**Then pick its `domain`** (the purpose axis for browsing, orthogonal to `kind` — `INVENTORY §0`):
`platform` (runs/secures/observes the system) · `product` (end-user-facing app) · `automation`
(scheduled/triggered workflow & agents) · `shared` (reusable asset / control plane, not deployed). If none of
the four fits **and** no sibling shares the new purpose, use the nearest — do NOT invent a domain for a single project.

**Mandatory for every archetype with CODE** (`web-app`/`worker`/`monorepo`): install the repo conventions right away
(Stage 3 item 0 — Prettier + commit-msg + pre-commit hook). After creating the project, **update
`inventory.md` §0** (add the row with its `domain` + `kind` + path, placed under its domain group) — anti-drift,
and **run `/project-docs scaffold`** so the project is
born with the standard doc set (`docs/00-map.md` + `docs/decisions.md`, web-app adds 01/02/03 — see
`platform/standards/documentation.md`). Born-documented.

## Stage 1 — Dockerfile in the repo

If the repo already has a Dockerfile: check it builds and `EXPOSE`s the right port, then
go to stage 2. None yet → write one following these principles:

- Multi-stage (deps → build → runner), final image as small as possible, `NODE_ENV=production`.
- Run as a non-root user if possible (`USER node`).
- `EXPOSE <port>` for the exact port the app listens on.
- Should have a `HEALTHCHECK` (wget/curl the health endpoint) — `docker ps` will show (healthy).
- Next.js: needs `output: 'standalone'` in next.config; **living reference: `projects/todo/Dockerfile`**
  (Next.js standalone multi-stage). Python/other apps: `projects/nuc-monitor/Dockerfile`.
- Create/check `.dockerignore` (node_modules, .git, .env…).

**VERIFICATION:** test-build locally if the dev machine has Docker; if not, let CI
build in stage 3 act as the check.

## Stage 2 — CI workflow in the repo

Create `.github/workflows/deploy.yml` — the gold standard is the file of the same name in **every
living ghcr app**: `<repo-root>/nuc-monitor/.github/workflows/deploy.yml` (the lean version, no
build-arg) or `todo\.github\workflows\deploy.yml`. Copy verbatim then adjust exactly 2 spots if needed:

- `file:` — the Dockerfile path (omit if the Dockerfile is at root).
- `build-args:` — keep only if there are build-time variables (stage 0 item 6); remember to
  create the corresponding secret on GitHub: repo → Settings → Secrets → Actions.

The mandatory skeleton must stay intact: trigger `push: main` + `workflow_dispatch`,
`permissions: packages: write`, ghcr login with `GITHUB_TOKEN`,
metadata-action tag `latest` + `type=sha,prefix=,format=short`, cache `type=gha`,
`concurrency` to prevent overlapping builds.

**VERIFICATION:** valid YAML (re-read the file), no hardcoded secrets.

## Stage 3 — Push & verify the image

0. **Set up repo conventions** (if not done): copy `.prettierrc` + `.prettierignore` from
   `.claude/skills/coding-convention/templates/` into the repo (`npm i -D prettier`, add the `format` script),
   and copy `hooks/commit-msg` + `hooks/pre-commit` into `<repo>/.git/hooks/` (commit-msg enforces Conventional
   Commits; pre-commit reminds to update docs — non-blocking). All code must follow the `/coding-convention` skill.
1. Commit (English message, like `ci: build & push image to ghcr`) — **ask the
   user before pushing** if this is the first time touching this repo in the session.
2. `git push origin main`.
3. Watch the build: poll `https://api.github.com/repos/thiengthb/<repo>/actions/runs?per_page=1`
   (status/conclusion) or poll the image from the NUC:
   `docker manifest inspect ghcr.io/thiengthb/<repo>:latest`.
4. Build fails → read the annotations via the API check-runs. Known errors:
   - "account is locked due to a billing issue" → the user must clear it at
     github.com/settings/billing; temporarily build by hand on the NUC (see doc 02 item 4.5).
   - fails at the push-image step → repo Settings → Actions → Workflow permissions
     → Read and write.

**VERIFICATION:** `docker manifest inspect ghcr.io/thiengthb/<repo>:latest`
run from the NUC returns OK.

## Stage 4 — Declare the app on the NUC

Create `/opt/apps/<name>/` with 3 files. Compose template (fill in the `<...>` spots):

```yaml
name: <name>

services:
  app:
    image: ghcr.io/thiengthb/<repo>:latest
    container_name: <name>
    restart: unless-stopped
    env_file:
      - .env
    networks:
      - edge
    # ONLY add volumes if the app has persistent data:
    volumes:
      - app_data:/<data-path-in-container>
    labels:
      - "com.centurylinklabs.watchtower.enable=true"
      # --- 4 PUBLIC lines: delete them all if the app is internal-only ---
      - "traefik.enable=true"
      - "traefik.http.routers.<name>.rule=Host(`<sub>.thientnse.site`)"
      - "traefik.http.routers.<name>.entrypoints=web"
      - "traefik.http.services.<name>.loadbalancer.server.port=<PORT>"

networks:
  edge:
    external: true

# ONLY when there is a volume:
volumes:
  app_data:
    name: <name>_data
```

- `.env`: the real runtime variables (chmod 600). `.gitignore`: contains `.env`.
- The app has NO `ports:` block — that would violate invariant #2.
- The Traefik router/service name must be unique across the whole NUC (a duplicate silently
  overrides routes) — already checked in stage 0 item 4.

Then: `cd /opt/apps/<name> && docker compose up -d`.

**VERIFICATION:** `docker compose ps` Up (healthy if there's a HEALTHCHECK);
logs show no errors.

## Stage 5 — Acceptance (all 4 required, 5 for a public app)

```bash
# ① App is on edge alongside traefik:
docker network inspect edge --format '{{range .Containers}}{{.Name}} {{end}}'
# ② Traefik has picked up the route (public app):
curl -s -H "Host: traefik.localhost" http://127.0.0.1:8080/api/http/routers | grep <name>
# ③ Public URL is alive:
curl -s -o /dev/null -w "%{http_code}" https://<sub>.thientnse.site   # → 200
# ④ Watchtower sees the app (wait ≤70s):
docker logs watchtower --since 2m | tail -2    # Scanned goes up, Failed=0
# ⑤ (recommended) The full automatic cycle: push a small commit,
#    confirm the watchtower log "Found new image ... Stopping ... Started"
```

A failure at any step → the debug table in `platform/targets/nuc/architecture-and-operations.md` section 7.
If acceptance doesn't pass, do NOT report completion to the user.

## Stage 6 — Report

Summarize for the user: URL (if public), file location on the NUC, current image+tag,
how to roll back (pin the SHA tag), which env variables are empty and need the user to fill them in. Remind:
from now on it's just `git push origin main`.
