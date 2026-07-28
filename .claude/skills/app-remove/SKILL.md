---
name: app-remove
description: Remove/retire a project from its target completely and safely — reads `target` from INVENTORY §0 first, then tears down container + volume + image + directory, cleans auth config, verifies the app is really gone, and updates INVENTORY. Use when the user says "remove/delete/retire project X", "I don't use app X anymore", or "clean up X".
---

# Skill: Remove a project from the NUC platform (safe, leaving nothing behind)

This is the REVERSE process of `/app-onboard`. Goal: cleanly remove a project **without
affecting other services** and **leaving no junk** (orphan volume, hanging Authentik provider,
wrong registry row, nuc-monitor noise). Work SEQUENTIALLY; each stage has a VERIFICATION.

The invariants in `D:\Projects\MiniServer\CLAUDE.md` are law. The source of truth about apps:
[`platform/inventory.md`](../../../platform/inventory.md). SSH NUC: `ssh thien25@thienminiserver`.

> ⚠️ **Deleting a volume = permanent data loss.** Before tearing anything down, LOOK at it
> (what the volume contains, whether it needs a backup) and **CONFIRM with the user** the exact project + that they accept the
> data loss. If reality contradicts the user's description (e.g. the app is still being called by another service) →
> stop, tell the user, don't just delete.

## Step 0 — Read the `target` FIRST (mandatory)

**Which kind of machine is this app on?** Read the project's row in `platform/inventory.md §0`. It is **DATA — read
it, never assume.** The full law per target is in `platform/targets/<target>/README.md`.

| `target` | What this skill does |
|---|---|
| `nuc` | The procedure below. 🔴 **Check `INVENTORY` §NUC STATUS first** — the host has been down since 2026-07-22, so a `git push` deploys nothing. |
| `local` | Stop + remove the container, remove the named volume (after the same data-loss confirmation), remove the image, delete the directory, **free the host port**, update `INVENTORY §0`. Skip every Authentik and subdomain step — there are none. |
| `cloud` | **Not defined yet.** Read `platform/targets/cloud/README.md`, propose the procedure, and get it approved — do not improvise one. No project uses this target today. |
| `none` | This skill does not apply. |

> Unless a section says otherwise, **everything below this line is the `nuc` branch.** This skill was written
> NUC-first and renamed on 2026-07-28; the `local` column is the honest summary, not a second full procedure.

## Stage 0 — Confirm & build a damage inventory

1. Ask/confirm with the user: the **project name**, and confirm they **accept losing all its data**.
2. Open `inventory.md` to get exactly: its **§0 row** (the `domain` + `kind` classification — to be removed
   in Stage 7) and its **§1 row** (subdomain/URL, image, volume(s), auth level — does it have its own Authentik
   provider/group — GitHub repo). This is the list of what must be cleaned up. (NB: "subdomain" = the public URL;
   the §0 `domain` column = the purpose bucket `platform`/`product`/`automation`/`shared` — don't confuse them.)
3. Check **no other service depends on** this project (e.g. another app calls its API,
   shares a volume). In doubt → ask the user.
4. Snapshot the baseline state to compare after removal:
   ```bash
   ssh thien25@thienminiserver 'docker ps --format "{{.Names}}\t{{.Status}}"'
   ```
   Note the other services currently `Up/healthy` — at the end of the process they must STILL be so.

**VERIFICATION:** you've fully listed {local dir, container, volume(s), image, NUC dir,
Authentik provider/app/group (if any), domain, repo} for this project.

## Stage 1 — Delete local code

```powershell
Remove-Item -Recurse -Force "D:\Projects\MiniServer\<name>"
```
(Delete only the project directory; do NOT touch `.claude/`, `platform/`, or another project.)

## Stage 2 — Tear down on the NUC (container → volume → image → dir)

```bash
ssh thien25@thienminiserver
cd /opt/apps/<name>
docker compose down                 # stop + remove the app's own container/network
# Delete volumes (GET THE NAME FROM INVENTORY — don't guess; the volume name may differ from the app name):
docker volume rm <name>_data         # repeat for every volume of the app
# Delete the image (get the image name from INVENTORY):
docker rmi ghcr.io/thiengthb/<repo>:latest
cd / && rm -rf /opt/apps/<name>
```

- If `docker volume rm` reports "volume is in use" → a container still references it (even stopped);
  `docker ps -a --filter volume=<vol>` to find it, remove it first.
- Be careful with `docker rmi`: if the image is shared with another app (rare), keep it.

**VERIFICATION:**
```bash
docker ps -a --filter name=<name>            # empty
docker volume ls | grep <name>               # empty (check every volume listed)
ls /opt/apps/ | grep <name>                  # empty
```

## Stage 3 — Clean up Authentik (ONLY if the app has its own config)

Check `inventory.md` / `auth-apps.md`: does this app have its OWN provider/application/group?
- **No** (the app just "rides along" on the `NUC SSO` domain provider pk 1, or the app is open) → **skip this stage**.
- **Yes** → delete in order: policy binding → application → provider → group (and remove the provider from the outpost).

```bash
ssh thien25@thienminiserver
T=$(grep '^AUTHENTIK_BOOTSTRAP_TOKEN=' /opt/apps/authentik/.env | cut -d= -f2-)
B=https://auth.thientnse.site/api/v3
H=(-H "Authorization: Bearer $T" -H "Content-Type: application/json")

# 1) Find the pk of the app's application + provider + group:
curl -s "${H[@]}" "$B/core/applications/?search=<name>"      | jq -r '.results[]|"\(.pk) \(.slug) provider=\(.provider)"'
curl -s "${H[@]}" "$B/providers/proxy/?search=<name>"        | jq -r '.results[]|"\(.pk) \(.name)"'
curl -s "${H[@]}" "$B/core/groups/?search=<name>"            | jq -r '.results[]|"\(.pk) \(.name)"'

# 2) Remove the provider from the embedded outpost (keep the remaining providers):
OUTPOST=$(curl -s "${H[@]}" "$B/outposts/instances/?page_size=20" | jq -r '.results[]|select(.name|test("Embedded";"i")).pk')
CUR=$(curl -s "${H[@]}" "$B/outposts/instances/$OUTPOST/")
NEW=$(echo "$CUR" | jq -c --argjson p <PROVIDER_PK> '(.providers//[])|map(select(.!=$p))')
curl -s "${H[@]}" -X PATCH "$B/outposts/instances/$OUTPOST/" -d "{\"providers\":$NEW}" | jq -c '{providers}'

# 3) Delete application → provider → group (HTTP 204 = OK):
curl -s "${H[@]}" -X DELETE "$B/core/applications/<APP_SLUG>/"   -o /dev/null -w "app:%{http_code}\n"
curl -s "${H[@]}" -X DELETE "$B/providers/proxy/<PROVIDER_PK>/"  -o /dev/null -w "provider:%{http_code}\n"
curl -s "${H[@]}" -X DELETE "$B/core/groups/<GROUP_PK>/"         -o /dev/null -w "group:%{http_code}\n"
```
(Deleting the application usually removes the policy bindings attached to it; if a binding still hangs,
`curl "$B/policies/bindings/?target=<APP_PK>"` then DELETE each one.)

**VERIFICATION:** re-search the 3 endpoints above → empty; the outpost `providers` no longer has the pk just deleted.

## Stage 4 — Verify the subdomain is dead (if the app was public)

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<sub>.thientnse.site/   # → 404 (Traefik no longer has a route)
```
404 is correct (the DNS wildcard still points, but no router matches the Host). **No** need to touch Cloudflare.

## Stage 5 — nuc-monitor (usually NOTHING to do)

The edge-triggered logic is fixed (2026-06-11): when a container disappears, nuc-monitor reports **exactly once**
at warning level ("If you removed it deliberately, ignore this") then forgets it (`forget`). So once the project is removed, it's clean.
- Just note: if the app has multiple containers, they'll be "forgotten" one by one.
- To suppress even that one-time warning (a planned removal), add the container name to `DOCKER_IGNORE`
  in `/opt/apps/nuc-monitor/.env` BEFORE tearing down — but usually unnecessary.

## Stage 6 — GitHub repo + ghcr package (GUIDE the user to do it)

This is **not automated** (it needs a PAT with `delete_repo` scope — not storing a repo-deletion token on the machine
is safer). Give the user the exact steps:

1. **Delete the ghcr package:** `https://github.com/users/thiengthb/packages/container/<repo>/settings`
   → "Delete this package".
2. **Delete the repo:** `https://github.com/thiengthb/<repo>/settings` → bottom of the page → "Delete this repository".
   (Or, if `gh` + a sufficiently-scoped token is available: `gh repo delete thiengthb/<repo> --yes`.)

Ask the user whether they want to delete the repo — some projects are only removed from the NUC but keep the code on GitHub.

## Stage 7 — Update the registry (MANDATORY — anti-drift)

1. **`platform/inventory.md`:** remove the app's row from **§0** (the project map — its `domain`/`kind`/path)
   AND from §1 (apps); remove the provider/group row from §3 (if any); add a line to §6 "Decommissioned apps" with
   the date + what was deleted.
2. **`authentik/docs/auth-apps.md`** (if the app is listed there): remove the app's entry, note "Removed
   YYYY-MM-DD".
3. Commit + push the modified doc repos — **only when the user asks** (per the git rule). Message like:
   `docs(inventory): retire <name> project` / `chore: tear down <name>`.

## Stage 8 — Acceptance (mandatory — prove "no other service is affected")

```bash
ssh thien25@thienminiserver 'docker ps --format "{{.Names}}\t{{.Status}}"'
```
- ✅ Every OTHER service is still `Up`/`healthy`, exactly as in the snapshot from Stage 0.
- ✅ No container/volume/dir/image/route/provider of the removed project remains.
- ✅ (recommended) Quickly run `/host-audit` to be sure no orphan is left.

## Report for the user

List what was deleted: {local dir, container, N volumes, image, NUC dir, Authentik provider/group if
any}, subdomain → 404, INVENTORY/auth-apps updated, and **what the user still needs to do**: delete the GitHub
repo + ghcr package (with the 2 links from Stage 6). Confirm the other services are unaffected.

## Known pitfalls

- **Volume name ≠ app name.** Always get the real volume name from INVENTORY/`docker volume ls` — the
  link-manager case left `backend_link_data` behind because it was wrongly guessed as `link-manager_data`.
- **Don't delete a shared image.** Third-party images (postgres, redis…) may be used by another app.
- **`compose down -v` deletes volumes too** — only use it when certain; here the steps are split for safety/clarity.
- **Authentik has no Watchtower** — irrelevant when removing, but don't accidentally restart authentik too.
