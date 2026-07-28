# `target: cloud` — a VPS or managed runtime on the public internet

> Applies to a project whose `INVENTORY §0` row says `target: cloud`. Platform-wide Invariants A still bind
> (secrets in `.env`, never self-code auth, named volume, repo is the source of truth). These are the additions.
>
> **Status: written 2026-07-28, not yet exercised.** No project on this platform has `target: cloud` today. The law
> is written first on purpose — the first cloud deploy is `idea-0023` (the MCP platform server) and improvising its
> rules mid-build is how the NUC ended up with seven invariants discovered the hard way. Treat this as a *draft
> earned from the NUC's lessons*, and correct it from real experience at the first deploy.

## What makes `cloud` different from the other two

Not "bigger" or "better". Three things change, and every invariant below follows from one of them:

| | `nuc` | `local` | `cloud` |
|---|---|---|---|
| Who can reach it | Cloudflare → Traefik → forward-auth | localhost (unless tunnelled) | **the entire internet, immediately** |
| Who owns the machine | you | you | **a vendor** |
| What it costs when idle | electricity | nothing | **money, forever, silently** |

## Invariants

1. **Auth exists before the first deploy, not after.** On `nuc`, an app is private until a Traefik label makes it
   public; on `cloud` the default is inverted — it is public the moment it boots. Anything without auth is exposed
   during the window you meant to "add auth next". If the service is machine-facing (an API, an MCP endpoint), that
   means a token check in the handler on day one, not a firewall you intend to configure.
2. **TLS is terminated by the provider or by Cloudflare. Never self-manage certificates.** Same rule, same reason as
   the NUC's: certbot on a box you also run the app on is a renewal failure waiting for a weekend.
3. **Secrets come from the provider's secret store** (or a `.env` at chmod 600 that is never in the image and never
   in git). A secret baked into an image is published the moment the image is — and a cloud image registry is not a
   private NUC disk.
4. **Persistent data lives on a named volume or managed disk, and it is backed up off the provider.** On `local` you
   can walk to the machine. Here, account suspension, a billing lapse or a region incident takes the data with it.
   No backup ⇒ the service may not hold the only copy of anything.
5. **The image is pulled, never built on the host.** Build in CI, deploy an immutable tag (`latest` **and** the SHA,
   as on `nuc`). A host that can build is a host that can drift.
6. **Cost is an operational property, so it goes in `INVENTORY §0`:** the provider, the plan, the monthly figure, and
   the answer to *"what happens if this is forgotten for six months?"*. A `nuc` app that is forgotten wastes nothing;
   a cloud app that is forgotten bills until someone notices. This row is the noticing.
7. **The blast radius is stated up front.** Write down what this service can reach — which repos, which tokens, which
   internal endpoints — before it is reachable. A public service holding a credential to a private system *is* the
   attack path; the NUC never had to think about this because nothing outside could talk to it unprompted.

## Choosing `cloud` over `local`

Only for something that must be reachable when your machine is off, by someone or something that is not you. If the
consumer is you at your desk, `local` is cheaper, faster and has a smaller attack surface. "It feels more
professional" is not a reason and has never been one.

## Verify

```bash
curl -fsS https://<host>/health                  # served, and over TLS
curl -fsS -o /dev/null -w '%{http_code}\n' \
     https://<host>/<a-protected-route>          # expect 401/403 WITHOUT a token, not 200
```

The second check is the one that matters and the one that gets skipped. A cloud service that answers `200` to an
unauthenticated stranger is not deployed — it is disclosed.
