---
name: app-protect
description: "Put an app behind authentication, using whatever the app's target provides — reads `target` from INVENTORY §0 first. On `nuc`: Authentik SSO via forward-auth, group-restricted. On `local`/`cloud`: an established library, never hand-rolled (Invariant A2). Use when the user says \"protect this app\", \"require login\", \"only me/group X can access\", or \"add SSO\"."
---

# Skill: Protect an app with Authentik (NUC platform)

Authentik is the central IdP at `https://auth.thientnse.site` (`/opt/apps/authentik`).
Living docs: the `projects/authentik/` repo (especially `projects/authentik/docs/auth-apps.md` — the registry of every
provider/app, UPDATE it after each use of this skill) and `projects/authentik/README.md`.
The invariants in `<repo-root>/CLAUDE.md` under the "Authentik" section are law.

SSH NUC: `ssh thien25@thienminiserver`. App at `/opt/apps/<name>`.

## Step 0 — Read the `target` FIRST (mandatory)

**Which kind of machine is this app on?** Read the project's row in `platform/inventory.md §0`. It is **DATA — read
it, never assume.** The full law per target is in `platform/targets/<target>/README.md`.

| `target` | What this skill does |
|---|---|
| `nuc` | The procedure below. 🔴 **Check `INVENTORY` §NUC STATUS first** — the host has been down since 2026-07-22, so a `git push` deploys nothing. |
| `local` | Authentik does not exist here. **Invariant A2 still binds**: an established library, never hand-rolled. If the app is published through a `cloudflared` tunnel it is on the public internet, so auth is **required**, not optional. |
| `cloud` | **Not defined yet.** Read `platform/targets/cloud/README.md`, propose the procedure, and get it approved — do not improvise one. No project uses this target today. |
| `none` | This skill does not apply. |

> Unless a section says otherwise, **everything below this line is the `nuc` branch.** This skill was written
> NUC-first and renamed on 2026-07-28; the `local` column is the honest summary, not a second full procedure.

## Concepts (read once)

- **Forward-auth = gating at the EDGE.** Traefik calls Authentik before the request reaches the app. Not
  logged in → 302 to `auth.thientnse.site`. After login, Traefik injects the
  `X-authentik-email|username|groups|...` headers into the request. The app needs NO auth code.
- Traefik here **only has the docker provider** (no file provider) → the forward-auth middleware is
  declared via a LABEL on `authentik-server`, referenced as **`authentik@docker`**.
- **2 protection tiers, choose per need:**
  1. **Login gate** (default): just attach the `authentik@docker` middleware → any Authentik
     user who logs in can get in. Enough for most internal apps.
  2. **Restrict who can enter** (block even a logged-in user who isn't in the group): the app has
     **its own `forward_single` provider + its own application + a policy attached to a group**. An exact host
     match beats the shared `forward_domain` provider → this app's policy takes effect.
- **Authorization WITHIN the app** (read/write, role) = the app reads the `X-authentik-groups` header Traefik injects
  (in Next.js: `headers()` in a Server Component / route handler / server action).
- **OIDC (login inside the app, not edge gating)** is only for when the app truly needs its own OIDC
  session (rare) → see guide §4 (Auth.js + Authentik), create an OAuth2/OpenID Provider.
- ⛔ **NEVER attach forward-auth to an endpoint that a machine client (script/cron/ollama/
  webhook) calls automatically** — it would get redirected to HTML and break. Machine endpoints: a separate router
  with NO middleware, or use an Authentik API token / client_credentials.

## Stage 0 — Determine the protection level (ask the user if unclear)

1. Is the app already running public on the NUC? (has a `Host(...)` router in `/opt/apps/<name>/docker-compose.yml`).
   No → run the `app-onboard` skill first, then come back.
2. Which level?
   - **(A) Login only** (any Authentik user) → Stage 2.
   - **(B) Only certain people/groups** can enter → Stage 2 + 3.
   - **(C) Fine-grained authorization within the app** (read/write…) → 2 (+3 if needed) + 4, and the app's code must change.
3. Is there any endpoint a MACHINE client calls automatically? → split it into a separate router, NO middleware (see Concepts).

## Preparation — token + ID (used by every API stage)

```bash
ssh thien25@thienminiserver
T=$(grep '^AUTHENTIK_BOOTSTRAP_TOKEN=' /opt/apps/authentik/.env | cut -d= -f2-)  # admin token
B=https://auth.thientnse.site/api/v3
H=(-H "Authorization: Bearer $T" -H "Content-Type: application/json")
# Flow PKs (stable, but best to re-fetch to be sure):
AUTHZ=$(curl -s "${H[@]}" "$B/flows/instances/default-provider-authorization-implicit-consent/" | jq -r .pk)
INVAL=$(curl -s "${H[@]}" "$B/flows/instances/default-provider-invalidation-flow/" | jq -r .pk)
OUTPOST=$(curl -s "${H[@]}" "$B/outposts/instances/?page_size=20" | jq -r '.results[]|select(.name|test("Embedded";"i")).pk')
```

## Stage 2 — Login gate (attach the middleware)

Edit `/opt/apps/<name>/docker-compose.yml`, add to the app's router (keep a backup `.pre-authentik.bak`):

```yaml
- "traefik.http.routers.<name>.middlewares=authentik@docker"
```
Then `cd /opt/apps/<name> && docker compose up -d`.

**VERIFICATION:** `curl -sS -o /dev/null -w "%{http_code} %{redirect_url}\n" https://<sub>.thientnse.site/`
→ **302** to `auth.thientnse.site/application/o/authorize/...`. If 404 right after recreate:
wait for the container to be healthy then retry (Traefik drops the route during recreate).

> If only level (A) is needed: done, go to Stage 6.

## Stage 3 — Restrict who can enter (own app + group policy)

Create a `forward_single` provider + application + group + policy binding, then attach to the outpost:

```bash
# 1) Own provider for the app (exact host match → beats the shared domain provider)
PPK=$(curl -s "${H[@]}" -X POST "$B/providers/proxy/" -d "$(jq -n --arg a "$AUTHZ" --arg i "$INVAL" \
  '{name:"<name>",authorization_flow:$a,invalidation_flow:$i,mode:"forward_single",external_host:"https://<sub>.thientnse.site"}')" | jq -r .pk)
# 2) Application
APK=$(curl -s "${H[@]}" -X POST "$B/core/applications/" -d "$(jq -n --argjson p "$PPK" '{name:"<Name>",slug:"<name>",provider:$p}')" | jq -r .pk)
# 3) Group + add members (get the user pk: curl "$B/core/users/?username=<email>")
GPK=$(curl -s "${H[@]}" -X POST "$B/core/groups/" -d '{"name":"<name>-access"}' | jq -r .pk)
for uid in <pk1> <pk2>; do curl -s "${H[@]}" -X POST "$B/core/groups/$GPK/add_user/" -d "{\"pk\":$uid}" -o /dev/null -w "%{http_code}\n"; done
# 4) Policy binding: only this group may open the app
curl -s "${H[@]}" -X POST "$B/policies/bindings/" -d "$(jq -n --arg t "$APK" --arg g "$GPK" '{target:$t,group:$g,order:0,enabled:true,negate:false}')" | jq -c '{pk,enabled}'
# 5) Attach the provider to the embedded outpost (MERGE with existing providers, don't overwrite)
CUR=$(curl -s "${H[@]}" "$B/outposts/instances/$OUTPOST/")
NEW=$(echo "$CUR" | jq -c --argjson p "$PPK" '(.providers//[])+[$p]|unique')
curl -s "${H[@]}" -X PATCH "$B/outposts/instances/$OUTPOST/" -d "{\"providers\":$NEW}" | jq -c '{providers}'
```

**VERIFICATION:** wait ~8s (outpost reloads config) → `curl` the app, still 302; then check the log to be sure
the CORRECT provider for the app is handling it (not the shared domain provider):
```bash
curl -s -o /dev/null https://<sub>.thientnse.site/
docker logs authentik-server --since 30s 2>&1 | grep "<sub>.thientnse" | tail -1 \
  | jq -r '"provider="+.name+" status="+(.status|tostring)'   # must be provider="<name>"
```
Denying a user-not-in-the-group can only be fully verified by logging in with a browser
(tell the user to test); the correct structure is a sufficient condition.

## Stage 4 — Authorization within the app (only when level C is needed)

The app reads the headers Traefik injects (fail-closed if `X-authentik-email` is missing):
- `X-authentik-email` = the stable user key (used as the user linking key, per invariant #8).
- `X-authentik-groups` = a `|`-separated string → map to the app's permissions.

In **Next.js** (the current standard stack): read with `headers()` in a Server Component / route
handler / server action; centralize the logic in `lib/auth.ts` (a `getUser()` function reads email + groups,
returns `null` → fail-closed). Map group → permission (e.g. `<name>:write` ⇒ read+write, `:read` ⇒ read-only).
Sign-out button: redirect to `/outpost.goauthentik.io/sign_out` (a path on the app's OWN domain,
handled by the outpost). Do NOT hardcode the old IdP URL; if needed read it from env `AUTHENTIK_URL=https://auth.thientnse.site`.
> No app currently reads headers for authorization (the old `link-manager` reference was removed; `todo` only gates at the
> proxy by the `todo-access` group, no in-app authorization). The first app to do level C → create `lib/auth.ts`
> per the description above and update it as the new living reference here.

Change the app's code → commit + push → CI build → on the NUC `docker compose pull && up -d` (sync in
one beat: new image + env + middleware).

## Stage 5 — Report + update the registry

1. Update `projects/authentik/docs/auth-apps.md` (the app table + provider/group details), commit & push the
   `authentik` repo.
2. Tell the user: which level the app is protected at, which group can enter, how to grant more access (add a user to the
   group in the Authentik admin), and remind them to test a browser login once.

## Known pitfalls (don't trip again)

- **The shared network is `edge`** (verified; `infrastructure` in the dev-local compose is
  junk). The Authentik server must be on `edge` so Traefik can call it + see the middleware.
- **The embedded outpost redirects to `localhost`** if `authentik_host` + `authentik_host_browser`
  = `https://auth.thientnse.site` is missing (already set; if rebuilding Authentik, set it again).
- **OAuth/redirect URL comes out as `http://`** because Cloudflare terminates TLS then Traefik overwrites
  `X-Forwarded-Proto=http`. Fixed with a label on the authentik router:
  `traefik.http.middlewares.authentik-xfp.headers.customrequestheaders.X-Forwarded-Proto=https`
  + `routers.authentik.middlewares=authentik-xfp@docker`. The Google provider also needs the redirect URI
  `https://auth.thientnse.site/source/oauth/callback/<slug>/` in the Google Cloud Console.
- **The outpost needs ~5–10s** to load a new provider/config after creating it via the API — wait before verifying.
- **404 right after `docker compose up -d`** = the recreate window, Traefik hasn't re-registered the route;
  wait for healthy.
- **Authentik is NOT auto-upgraded by Watchtower** (no label) — updates are manual, bump `AUTHENTIK_TAG`.
- Link users by **email** (`user_matching_mode=email_link` for the source) to avoid creating duplicates.
