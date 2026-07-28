---
name: nuc-scheduled-maintenance
description: Decide what recurring NUC maintenance is worth automating and wire it via /schedule — periodic health-audit, Dependabot triage, dependency/secret-hygiene drift. Use when the user says "automate the health check", "run X weekly", "set up recurring maintenance", or "what should run on a cron" for the NUC. REPORT-ONLY by hard rule: a scheduled run notifies, it never deletes/restarts/edits. NOT for ad-hoc one-off runs.
---

# Skill: Scheduled NUC maintenance (report-only)

Goal: turn the **recurring** parts of platform upkeep (drift, dep-rot, orphans) into a cheap cron heartbeat so problems
surface early — without ever letting an unattended agent take a destructive action.

This skill owns the **what + when + safe wiring**. It does NOT reimplement scheduling (that's `/schedule`), the audit
logic (`/nuc-health-audit`), dep triage (`/dependabot-review`), or uptime/liveness (that's the **nuc-monitor** app —
don't duplicate it).

## The non-negotiable rule

**A scheduled run is REPORT-ONLY.** There is no human at the keyboard when it fires, so it can NEVER do anything that
`/nuc-health-audit`'s "ask the user first" gate covers — no deleting a volume/image, no restarting a container, no editing
`.env`, no merging a PR. It may only: run read-only checks, and **notify** (push notification / a written summary / open
an issue). The user reads the report and runs any destructive cleanup by hand. This preserves the platform invariant
"audit reports, every destructive action asks for consent."

## Recurring jobs worth scheduling (the catalog)

Pick from these; don't schedule what nuc-monitor already covers (liveness/uptime/resource alerts).

| Job | Cadence | Runs | Reports (never acts) |
|---|---|---|---|
| **Drift + orphan scan** | weekly | `/nuc-health-audit` read-only groups only | `INVENTORY.md` ↔ reality mismatches, orphan volumes/images, disk/RAM headroom |
| **Dependency triage** | weekly | `/dependabot-review` | open Dependabot PRs classified by risk + a recommended action list (it already never auto-merges) |
| **Secret hygiene drift** | monthly | check `.env` chmod 600 + no secret leaked to a tracked file | any file losing 600, any hardcoded token spotted |
| **Supply-chain re-scan** | monthly / on-news | `/supply-chain-guard` live procedure | high/critical advisories against the fleet's deps |

Keep the set small — each scheduled agent costs tokens on every fire. Start with the **weekly drift+dep** pair; add the
monthly ones only if they earn it.

## How to wire it (mechanism = /schedule)

1. Use **`/schedule`** to create a cron cloud-agent. The scheduled prompt MUST state report-only, e.g.:
   > "Run /nuc-health-audit in read-only mode. Do NOT delete or change anything. Summarize drift, orphans, and disk
   > headroom, and notify me with the findings."
2. For delivery, prefer a push notification or a written summary the user reads later — not a silent log.
3. Cadence sanity: weekly for drift/deps (cheap, high-signal), monthly for the deeper scans. Hourly/daily liveness is
   nuc-monitor's job — don't add it here.
4. **Log what you scheduled** so it's not invisible: note the job + cadence in `nuc-platform/INVENTORY.md` (or the ops
   doc) the same way any other standing platform fact is recorded.

## Done when

- [ ] The scheduled prompt is explicitly report-only (no destructive verb).
- [ ] It doesn't duplicate nuc-monitor's liveness/uptime role.
- [ ] Cadence matches signal value (weekly drift/deps; monthly deep scans).
- [ ] The new recurring job is recorded as a standing platform fact (INVENTORY/ops doc).
