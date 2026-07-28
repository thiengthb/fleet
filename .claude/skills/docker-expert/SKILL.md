---
name: docker-expert
description: Author and optimize a single app's Dockerfile — multi-stage builds, layer-cache ordering, small/secure base images, non-root user, EXPOSE + HEALTHCHECK, .dockerignore, BuildKit cache. Use when writing or improving a Dockerfile. NOT for compose/networking/secrets/deploy — those are platform-defined (the NUC only PULLs; CI builds; see /app-onboard).
---

# Docker Expert — Dockerfile authoring (platform-adapted, narrowed)

> **Adapted from** `development/docker-expert` (`davila7/claude-code-templates`). **Heavily narrowed:** the upstream skill
> is mostly Docker-Compose orchestration, build-on-host validation, multi-arch, and Docker `secrets:` — all of which
> **conflict with platform invariants**. This skill is scoped to **Dockerfile authoring** only. Living reference:
> `todo`'s `Dockerfile`.

## ⛔ NOT this skill's job (platform invariants — don't touch here)

- **Compose / orchestration / networking / secrets / deploy** → platform-defined. The NUC compose just pulls an `image:`
  from ghcr; ONE shared `edge` network (no per-app `frontend`/`backend` networks); secrets live in **`.env` (chmod 600)**,
  never Docker `secrets:` nor baked into ENV/layers. See `/app-onboard` + `platform/targets/nuc/architecture-and-operations.md`.
- **Building** happens in **GitHub Actions** (`deploy.yml`), pushing `:latest` + `:<sha>` to ghcr — **the NUC never
  builds**. Don't add compose-level image-build steps to a deploy flow (the NUC compose pulls, never builds).
  (`docker build` locally just to test a Dockerfile is fine.)
- **No multi-arch** — the NUC is single-arch (amd64); skip `buildx --platform`.

## Dockerfile authoring (the value)

### Multi-stage + layer caching (deps before source)
```dockerfile
# deps — cached unless package*.json changes
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# build
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# runtime — small, non-root
FROM node:22-alpine AS runtime
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S app -u 1001 -G nodejs
COPY --from=build --chown=app:nodejs /app/.next/standalone ./
COPY --from=build --chown=app:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=app:nodejs /app/public ./public
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/ >/dev/null 2>&1 || exit 1
CMD ["node", "server.js"]
```

### Principles
- **Order for cache:** copy `package*.json` + install **before** copying source. Source changes shouldn't bust the deps layer.
- **Multi-stage:** build tools stay in the build stage; the runtime image carries only artifacts (`.next/standalone` for a
  Next standalone build) + prod deps.
- **Small + secure base:** `alpine` (or `distroless` for a pure-runtime image). Pin the major (`node:22-alpine`).
- **Non-root:** create a user, `chown` copied files, `USER` before `CMD`. Never run as root.
- **`EXPOSE <port>` + `HEALTHCHECK`** (platform convention — every repo's Dockerfile should have both where possible).
- **`.dockerignore`:** exclude `node_modules`, `.next`, `.git`, `.env`, tests — shrinks build context + avoids leaking `.env`.
- **BuildKit cache mounts** (`--mount=type=cache,target=/root/.npm`) speed CI installs.
- **Image size:** clean package caches in the same `RUN` layer; copy only required artifacts; prefer `npm ci` over `install`.

## Review checklist (Dockerfile only)

- [ ] Multi-stage; deps installed before source copy (cache-friendly).
- [ ] Small pinned base; runtime stage free of build tools.
- [ ] Runs as a non-root `USER`; copied files `--chown`ed.
- [ ] `EXPOSE` + `HEALTHCHECK` present; `.dockerignore` excludes `node_modules`/`.next`/`.git`/`.env`.
- [ ] No secret baked into ENV/layers (secrets come from `.env` at runtime, injected by the NUC compose).
- [ ] No compose/network/secrets/multi-arch added here — that's the platform's job.
