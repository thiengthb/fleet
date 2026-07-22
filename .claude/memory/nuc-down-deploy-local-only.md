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
