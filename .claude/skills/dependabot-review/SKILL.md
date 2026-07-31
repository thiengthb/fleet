---
name: dependabot-review
description: Triage open Dependabot PRs — classify by risk (patch/minor/major + security), check CI, and present a recommended action per PR. Use when the user says "review/check dependabot", "dependabot PRs", or "update dependencies". On this platform it RECOMMENDS merges for the user to approve (never auto-merges) — Watchtower then auto-pulls the new image after the merge builds.
disallowed-tools: Write Edit
---

# Dependabot PR Review (platform-adapted)

> **Adapted from** `workflow-automation/dependabot-review` (`davila7/claude-code-templates`). **Removed the auto-merge
> behaviour** — the platform invariant is *commit/push/merge only when the user asks*. This skill **classifies + checks
> CI + recommends**; the user confirms which to merge (a batch "merge the safe ones" is fine). Remember the deploy chain:
> a merged PR → GH Actions builds → ghcr → **Watchtower auto-pulls within ≤60s**, so a bad merge ships itself — hence no
> silent merges.

## Workflow

### 1. Discover
```bash
gh pr list --author "dependabot[bot]" --state open --json number,title,labels,createdAt,headRefName --limit 50
```
None found → tell the user and stop.

### 2. Classify (by branch + title)
| Tier | Criteria | Recommendation |
|------|----------|----------------|
| **Safe** | GitHub Actions bumps (`dependabot/github_actions/`), patch (`1.2.3→1.2.4`) | Recommend merge (after CI) |
| **Low risk** | Minor (`1.2.0→1.3.0`) for well-known libs | Recommend merge after CI |
| **Review** | Major (`1.x→2.x`), unknown lib, **any `security` label / CVE** | Flag to the user with the changelog |

Title patterns: `Bump X from 1.2.3 to 1.2.4` (patch) / `to 1.3.0` (minor) / `to 2.0.0` (major).

### 3. CI check (for anything you'd recommend merging)
```bash
gh pr checks <number> --json name,state,bucket
```
Pass → eligible. Pending → poll ~30s up to 2 min, else report "CI pending". Any fail → skip + report.

### 4. Present (do NOT merge unprompted)
Show the summary table and the recommended action per PR. **Wait for the user's go-ahead.** Only after they approve:
```bash
gh pr merge <number> --merge --delete-branch   # one at a time; never --force; never a red PR
```
After a batch, re-run discovery (remaining PRs may need a rebase).

### 5. Report
```
## Dependabot Review
### Recommend merge (CI green): #123 actions/checkout v4→v6 · #124 zod 3.25.1→3.25.6
### Needs your review: #456 jest 29→30 (major) · #457 (security label — CVE-xxxx)
### Skipped: #789 chalk 5.5→5.6 (CI failing)
```

## Guardrails (platform)

- **Never merge without the user's explicit go-ahead** — not even "safe" PRs (the merge ships to prod via Watchtower).
- **Never** merge a red PR or a major bump silently; present the changelog and ask.
- **Security label / CVE** → always surface, even a patch.
- **Batch** if >10 PRs: process 5, re-check, ask before continuing.
- **Conflicts** → skip and report; don't try to resolve a Dependabot rebase by hand.
