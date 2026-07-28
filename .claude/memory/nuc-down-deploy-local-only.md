---
name: nuc-down-deploy-local-only
description: Never assume a deploy target — read `target` + the NUC STATUS block in INVENTORY §0 before deploying, SSH-ing, or calling anything "live"
metadata:
  type: feedback
---

**Read the target; do not remember it.** Every project declares `target: nuc | local | none` in
`platform/inventory.md §0`, and the NUC's own up/down state is a **NUC STATUS** block at the top of the same file.
Before deploying, SSH-ing anywhere, or reporting something as live: read those two, in that file. As of 2026-07-22 the
NUC is 🔴 down with no VPS substitute — but check, because that is exactly the kind of fact that changes without the
memory being updated.

**Why this is a memory at all, when the fact now lives in data.** The durable lesson is not "the NUC is down" — that
expires. It is the behaviour: **I treated a `git push` as a release, saw the live site unchanged, and then went and
tried to SSH into a dead host to "fix Watchtower".** The user never asked for NUC deployment and called it overstepping
("bị lố"). A push preserves code on GitHub; it is not a deploy, and it is certainly not a deploy to a host that is off.

**How to apply.**
- "Deploy" with no target named → the project's `target`, and if that is `nuc` while NUC STATUS is 🔴, say so and
  deploy **local** instead of proceeding.
- `target: local` → deploy means rebuild the local container and verify it healthy + serving. See
  [[rebuild-container-to-review]] and [[verify-end-state-not-upload]].
- Local does **not** mean private: a locally-run `cloudflared` container puts a local app on `*.thientnse.site` with
  TLS at Cloudflare, no NUC involved (that is how `sakubun` is public today; gitignored
  `docker-compose.tunnel.yml` + `.env.tunnel`, chmod 600).
- Do **not** SSH into or diagnose the NUC (Watchtower/ghcr/Traefik) unless the user says it is back and asks.

**The general form of this lesson** — and the reason 2026-07-28 moved the fact into INVENTORY: *a fact that governs
behaviour belongs where it is read, not where it is remembered.* When something in memory starts steering decisions,
that is the signal to promote it into data with a gate. See [[enforce-rules-with-gates]] and
[[check-prior-decisions-early]].
