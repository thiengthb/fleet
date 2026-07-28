---
name: supply-chain-guard
description: Audit a project's dependencies + CI/CD for supply-chain compromise and harden against it — across npm/PyPI workers and the GitHub Actions → ghcr pipeline. Use before a risky deploy, when a supply-chain attack is in the news and you want to check exposure, or to harden a repo's dependency/CI hygiene. Distinct from /security-review (code) and /nuc-health-audit (infra).
---

# Supply Chain Guard (platform-adapted)

> **Adapted from** `security/supply-chain-guard` (`davila7/claude-code-templates`). **I read its bash scanners — they
> are benign** (local grep against a hardcoded IOC list, no network/destructive ops) **but dropped them**: their IOC
> database is frozen (2026-03-31), and a frozen scanner gives *false confidence* ("scan passed" against a stale list).
> Kept the durable value — the hardening checklist + a **live** scan procedure (check current advisories, don't trust a
> frozen list). If a specific live incident hits, the upstream scanners can be vendored on-demand and re-vetted.

The platform's exposure: every app is `git push → GitHub Actions build → ghcr → Watchtower auto-pull`. A compromised dep
or a poisoned Action ships itself to the NUC within ≤60s. Two jobs: **detect** exposure, and **harden** so it can't happen.

## Detect (live, not a frozen list)

1. **Identify ecosystems:** npm (`package*.json`, `*-lock*`), PyPI (`requirements*.txt`, `pyproject.toml`), and CI
   (`.github/workflows/`, `Dockerfile`).
2. **Run the always-current checks:**
   ```bash
   npm audit --audit-level=high        # GitHub advisory DB (this DOES update — unlike a frozen IOC list)
   npm ls <suspect-package>            # is a flagged package actually in the tree?
   ```
   Python: `pip-audit` (or `uv pip audit`).
3. **For a named incident** (a package/version called out in the news): search current advisories from **Socket, Aikido,
   Snyk, JFrog, Endor Labs**, get the exact bad package@version + IOCs, then grep your committed lockfile for them:
   ```bash
   grep -nE '"(bad-pkg-a|bad-pkg-b)"' package-lock.json
   ```
   Use the *current* advisory, not a list baked into a skill months ago.

## Remediate (if a compromised package is found)

1. Remove/downgrade to a known-safe version; `npm cache clean --force` / `pip cache purge`.
2. Delete `node_modules`/`.venv`, reinstall from the (cleaned) lockfile.
3. **Rotate every credential reachable from the build/runtime env** — npm/PyPI tokens, the app's `.env` secrets, any
   ghcr/GitHub token, DB passwords. (On this platform secrets live in `.env` chmod 600 on the NUC + GitHub Secrets.)
4. If filesystem persistence is suspected (rogue systemd unit, `.pth` file, cron): treat the host as compromised — see
   `platform/02-known-traps.md` and escalate; consider rebuilding via `04-agent-rebuild-runbook.md`.

## Harden (the durable, never-stale part)

- **Pin GitHub Actions to a full commit SHA**, not a tag (`uses: actions/checkout@<sha>`), in every `deploy.yml`.
- **`npm ci` (not `npm install`)** in CI; add **`--ignore-scripts`** unless a package genuinely needs a postinstall.
- Python: `pip install --require-hashes` against a hashed lockfile.
- **Commit lockfiles**; pin exact versions.
- **Least-privilege workflow tokens** (`permissions:` block scoped to what the job needs).
- Keep the `npm audit --audit-level=high` step in CI (pairs with `/lint-and-validate`).
- Run this audit before a risky deploy and whenever a relevant attack is reported.

> Why no shipped scanner: a security tool whose threat list can't update is itself a risk (it lulls you). Prefer
> always-current advisory sources + `npm audit`/`pip-audit` over a frozen array.
