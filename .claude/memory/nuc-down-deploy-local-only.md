---
name: nuc-down-deploy-local-only
description: NUC is currently broken and there's no VPS — deploy is LOCAL-only for now; don't treat the NUC/push pipeline as a live target or operate on it
metadata:
  type: project
---

As of **2026-07-22** the NUC (`thienminiserver`) is **broken/down** and the user has **NO VPS** to
deploy to either. So the normal platform flow (git push → GitHub Actions → ghcr → Watchtower on the
NUC → `*.thientnse.site`) does **NOT** currently reach a working NUC — the auto-pull side is dead, so a
push does not go live anywhere. Deployment is temporarily **LOCAL-only**: the user runs the app on
their own machine (e.g. `docker compose up -d --build` → `localhost:3789`).

**Why:** I wasted the user's time treating the NUC as a working deploy target — after a push I saw the
live site unchanged, then went and tried to SSH into the NUC and "fix Watchtower". The user never asked
for NUC deployment; the NUC is known-broken and this was overstepping ("bị lố").

**How to apply:** When asked to "deploy", assume **LOCAL** (this machine's Docker / dev server), NOT the
NUC — confirm the target if unsure. Do **NOT** SSH into / run commands on the NUC, and do NOT diagnose
the NUC pipeline (Watchtower/ghcr/Traefik), unless the user explicitly says the NUC is back and asks.
`git push` is still fine (it preserves code on GitHub) but pushing ≠ it goes live. **Re-verify this
state before assuming the NUC/VPS is usable again** — it's a temporary situation, not permanent. Links:
[[verify-end-state-not-upload]], [[execute-over-handoff]], [[practice-first-lean-ceremony]].

**Update 2026-07-24 — a LOCAL deploy CAN be public, via a local `cloudflared` tunnel (no NUC needed).**
`sakubun` now runs on this machine (`docker compose up -d --build`) AND is publicly reachable at
`sakubun.thientnse.site` through a `cloudflared` container the user runs locally with a Cloudflare Tunnel
token (dashboard-managed ingress → `http://host.docker.internal:3789`; on Linux the container needs
`--add-host host.docker.internal:host-gateway`). So "local-only deploy" no longer means "unreachable from
the internet" — the tunnel bypasses the NUC/Traefik entirely and terminates TLS at Cloudflare. It lives in
a gitignored `docker-compose.tunnel.yml` + `.env.tunnel` (chmod 600) in the sakubun repo. Still no NUC:
`git push` does not auto-deploy, and the running container must be rebuilt by hand to pick up new code.
