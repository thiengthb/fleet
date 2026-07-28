# `target: local` — Docker on a dev machine

> Applies to a project whose `INVENTORY §0` row says `target: local`. Platform-wide Invariants A still bind
> (secrets in `.env`, never self-code auth, named volume, repo is the source of truth). These are the additions.

A `local` app runs under Docker on a machine you sit at — this PC, a laptop. There is **no Traefik, no `edge`
network, no Watchtower, no Authentik forward-auth**. None of the NUC invariants apply; don't go looking for them.

## Invariants

1. **"Deploy" means rebuild the local container** and verify it healthy + serving — *not* `git push`. A push builds
   an image and backs up the code; it releases nothing. Claiming "deployed" after a push is the single most repeated
   mistake on this target.
2. **Ports are published to the host, so a port is a shared resource.** Pick one, record it in `INVENTORY §0`, and
   check it is not already taken by another local app before you claim it.
3. **A local app is still a real app** — same Dockerfile, same named volume, same doc set, same tests. It differs in
   *routing and auth*, not in engineering standard, so promotion later is a config change and not a rewrite.
4. **Public reachability is opt-in and explicit.** A local app can be public without the NUC via a locally-run
   `cloudflared` container (Cloudflare Tunnel → `*.thientnse.site`, TLS terminated at Cloudflare). If you do that,
   say so in `INVENTORY §0` — a "local" app on the public internet with no auth is the failure mode this row prevents.
   `sakubun` is the live example.
5. **The container's lifetime is the machine's lifetime.** It does not come back after a reboot unless something
   starts it. Say in `INVENTORY §0` what that something is (Docker Desktop autostart, a compose `restart:` policy) —
   or accept that "running" means "running until the next reboot".

## Machine-specific notes belong in `CLAUDE.local.md`

Which Docker daemon, which context, which absolute path — those are facts about *one box*, not about the target, and
they are gitignored for that reason. This file describes the target on any machine.

## Verify

```bash
docker compose up -d --build          # from the project directory
docker ps --filter name=<app>         # STATUS must read (healthy), not just Up
curl -fsS localhost:<port>/api/health # or whatever the app's health route is
```

Healthy + serving is the bar. Anything less is not deployed.
