---
name: nuc-health-audit
description: Health-check & sync the NUC platform — reconcile INVENTORY.md against reality (container/volume/route/Authentik), find orphans (volume/image/provider), check subdomains alive, Watchtower scanning, disk/RAM, secret hygiene (.env chmod 600), nuc-monitor baseline. Use when the user says "audit/check the system", "clean up the NUC", "is everything ok", "any junk", or for a periodic run.
---

# Skill: Health-check & sync the NUC platform

Goal: catch **drift** (table ↔ reality mismatch) and **junk** (orphans) BEFORE they become "little
bugs". This skill **only reads & reports**; every destructive action (deleting a volume/image) must **ask the user**
and only happen with consent. Source of truth: [`nuc-platform/INVENTORY.md`](../../../nuc-platform/INVENTORY.md).

SSH NUC: `ssh thien25@thienminiserver`. Run the check groups A–K in order (A–J over SSH; K runs local), gather the results into
one report with ✅/⚠️/❌ sections then propose fixes.

## A. Drift: INVENTORY ↔ reality

```bash
ssh thien25@thienminiserver '
echo "[dirs]"; ls -1 /opt/apps/
echo "[running]"; docker ps --format "{{.Names}}\t{{.Image}}\t{{.Status}}"
echo "[all]"; docker ps -a --format "{{.Names}}\t{{.Status}}"'
```
Reconcile against INVENTORY §1: every app in the table must have a dir + an `Up` container; every dir/container
must have a row in the table. A mismatch (an app in the table not running, or a stray container not in the table,
or an image tag different from the table) → ⚠️ list it specifically.

## B. Orphan volumes

```bash
ssh thien25@thienminiserver '
for v in $(docker volume ls -q); do
  c=$(docker ps -a --filter volume=$v --format "{{.Names}}" | tr "\n" "," )
  [ -z "$c" ] && echo "ORPHAN: $v" || echo "ok: $v -> $c"
done'
```
An `ORPHAN` volume (0 containers) → ⚠️. **Don't delete it automatically** — reconcile with INVENTORY §5, LOOK at what the volume
contains (`docker run --rm -v <vol>:/d alpine ls -la /d`), then ask the user before `docker volume rm`.

## C. Dangling images

```bash
ssh thien25@thienminiserver 'docker images -f dangling=true -q | wc -l; docker system df'
```
> 0 → propose `docker image prune` (safe, only removes untagged layers). Ask before running.

## D. Every public subdomain is alive

Get the Host list from compose, curl each one:
```bash
ssh thien25@thienminiserver '
for h in $(grep -rhoP "Host\(\`\K[^\`]+" /opt/apps/*/docker-compose.yml | sort -u); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "https://$h/")
  echo "$h -> $code"
done'
```
Expected: open app → `200`; gated app (forward-auth) → `302` to auth. `404/502/530/000` → ❌
(404=lost route, 502=app dead, 530=tunnel, 000=DNS) — check the debug table `01-architecture-and-operations...` §7.

## E. Authentik: providers ↔ registry

```bash
ssh thien25@thienminiserver '
T=$(grep "^AUTHENTIK_BOOTSTRAP_TOKEN=" /opt/apps/authentik/.env | cut -d= -f2-)
B=https://auth.thientnse.site/api/v3
curl -s -H "Authorization: Bearer $T" "$B/providers/proxy/?page_size=50" | jq -r ".results[]|\"\(.pk) \(.name) \(.mode) \(.external_host)\""
echo "--- outpost providers ---"
curl -s -H "Authorization: Bearer $T" "$B/outposts/instances/?page_size=20" | jq -r ".results[]|select(.name|test(\"Embedded\";\"i\")).providers"'
```
Reconcile with INVENTORY §3 + `auth-apps.md`. A provider pointing to the domain of an **already-removed** app = hanging → ⚠️
(clean up per `/nuc-remove-project` G3). Every provider must be in the outpost's `providers`.

## F. Watchtower still scanning

```bash
ssh thien25@thienminiserver 'docker logs watchtower --since 5m 2>&1 | tail -5'
```
Should show "Scanned=N Updated Failed=0". `Failed>0` → ⚠️ (usually expired ghcr credentials,
see doc 02 §4.4 / 01 §6.11). Check that apps with the `watchtower.enable` label match INVENTORY (authentik/n8n
must NOT have this label).

## G. Disk / RAM / load

```bash
ssh thien25@thienminiserver 'df -h / ; echo; free -h ; echo; uptime'
```
Disk `/` > 80% or very little RAM left → ⚠️ (nuc-monitor also warns in realtime; this is the manual checkpoint).

## H. Infrastructure & container health

```bash
ssh thien25@thienminiserver 'docker ps -a --format "{{.Names}}\t{{.Status}}" | grep -iE "restart|exited|unhealthy" || echo "all healthy"'
```
A `Restarting`/`Exited`/`unhealthy` container → ❌ investigate `docker logs <name> --tail 50`.
traefik + cloudflared must be `Up` (if they die → the whole system's web goes down).

## I. Secret hygiene

```bash
ssh thien25@thienminiserver '
for d in /opt/apps/*/ /opt/infra/; do
  f="$d.env"; [ -f "$f" ] && stat -c "%a %n" "$f"
done'
```
`.env` must be `600`. Otherwise → ⚠️ `chmod 600`. (Recall invariant #4: secrets only in `.env`,
not hardcoded in compose/Dockerfile/code.)

## J. nuc-monitor baseline

```bash
ssh thien25@thienminiserver 'docker logs nuc-monitor --tail 20 2>&1 | grep -iE "tracking|container" | tail -3'
```
The number of containers nuc-monitor is tracking must match the real container count (minus itself if it excludes itself).
A mismatch → there may be stale `known_containers`; restart nuc-monitor to reset the baseline if needed.

## K. Doc-set drift (docs ↔ standard) — run LOCAL on the dev machine

Reconcile each project in `INVENTORY §0` against the mandatory file set per `kind`
(`nuc-platform/05-documentation-standard.md §3`). Check on the dev directory `D:\Projects\MiniServer\<name>`
(NOT over SSH — the doc-set lives in the dev repo):

```bash
for d in /d/Projects/MiniServer/*/; do
  p=$(basename "$d"); [ -f "$d/docs/00-map.md" ] && m=ok || m=MISSING
  [ -f "$d/docs/decisions.md" ] && k=ok || k=MISSING
  echo "$p: 00-map=$m decisions=$k"
done
```

- A project with CODE (`web-app`/`worker`/`monorepo`) missing `docs/00-map.md` or `docs/decisions.md` → ⚠️
  propose `/project-docs scaffold`.
- web-app/monorepo missing `01-product`/`02-technical`/`03-user-guide` → ⚠️.
- `infra`/`meta`: only need `00-map` (+README) — missing deep docs is normal.
- To inspect a project deeply (does the map match the code) → `/project-docs audit <project>`.

## L. Dependency freshness (per-repo, LOCAL) — light

Watchtower auto-pulls new **images**, but the **package dependencies inside each repo** don't update themselves — that's
a separate hygiene sweep. Per code repo: `npm outdated` + `npm audit --audit-level=high` (Python: `pip list --outdated`
+ `pip-audit`). Apply a **tiered** judgement — patch/minor of a trusted lib = low-risk (recommend), **major bump or any
security advisory = flag for review**. Don't bulk-bump. Defer the actual PR triage to `/dependabot-review` and the
hardening/IOC angle to `/supply-chain-guard`; this group just surfaces *which* repos are drifting/vulnerable.

---

## Report

Present concisely by group A–K, each item ✅/⚠️/❌ + a 1-line evidence. At the end of the report:
1. **Drift to fix** (table vs reality) — propose updating INVENTORY or fixing reality.
2. **Junk to clean up** (orphan volume, dangling image, hanging provider) — **list the commands but
   ASK the user before running** anything destructive.
3. **Health warnings** (disk, failing container, exposed secret).

If the user agrees to clean orphans/drift → do it, then update INVENTORY.md to match.
**Never** delete a volume/image/provider without consent.
