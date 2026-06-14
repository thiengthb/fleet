# B4 — Two-way Discord control plane · install & provisioning handoff

Capstone for plan `2026-06-14-autonomous-agent.md` step B4 (design: `2026-06-14-discord-control-plane.md`).
Everything below is **built + tested**; what remains is *installing* the governance-class files (sandbox → you cp),
*provisioning* the secrets/repo, and one *live* end-to-end test. Commit/push only when you're satisfied.

## What was built + verified (evidence)

| Component | File | Status |
|---|---|---|
| Shared verifier (trust core) | `.claude/scripts/gate-verify.mjs` (+`.test.mjs`) | ✅ **20/20** |
| Autonomy-gate w/ token-release | `b4b-sandbox/hooks/autonomy-gate.mjs` (+`.test.mjs`) | ✅ **24/24** |
| Bot sign↔Node verify interop | `b4b-sandbox/interop/` | ✅ approve/deny/tamper, cryptography **44.0.0** pinned |
| Worker CLI (request/check/consume) | `b4b-sandbox/scripts/gate-cli.mjs` | ✅ full-stack w/ real bot-signed token (approve/consume/replay/deny) |
| Bot side (sign + buttons + GH channel) | `nuc-ops-bot/gate_approval.py` (+ wiring, env, reqs) | ✅ py_compile; live discord/GH = test on deploy |

**Token format (single source of truth):** `base64url(payloadJson).base64url(sig)`, sig = RSA-SHA256/PKCS#1v1.5
over the payloadB64 ASCII bytes. Payload `{gate_id, decision: approve|deny, iat, exp, jti}`.

## Step 1 — Install the control-plane (governance-class; you cp + commit)

```bash
# from repo root C:\project\miniserver-platform
cp nuc-platform/plans/b4b-sandbox/hooks/autonomy-gate.mjs      .claude/hooks/autonomy-gate.mjs
cp nuc-platform/plans/b4b-sandbox/hooks/autonomy-gate.test.mjs .claude/hooks/autonomy-gate.test.mjs
cp nuc-platform/plans/b4b-sandbox/scripts/gate-cli.mjs         .claude/scripts/gate-cli.mjs
# gate-verify.mjs (+test) already live in .claude/scripts/
# re-run from the real locations to confirm import paths resolve:
node .claude/scripts/gate-verify.test.mjs            # expect 20/20
node .claude/hooks/autonomy-gate.test.mjs             # expect 24/24
```

## Step 2 — Wire the worker loop (full sandbox copies — just cp, all verified)

These three are FULL drop-in replacements (built in `b4b-sandbox/`, dry-run/parse verified):

```bash
cp nuc-platform/plans/b4b-sandbox/skills/auto-pilot/SKILL.md .claude/skills/auto-pilot/SKILL.md
cp nuc-platform/plans/b4b-sandbox/scripts/auto-pilot-run.sh  .claude/scripts/auto-pilot-run.sh
cp nuc-platform/plans/b4b-sandbox/scripts/auto-pilot-run.ps1 .claude/scripts/auto-pilot-run.ps1
# re-verify after install:
bash -n .claude/scripts/auto-pilot-run.sh && bash .claude/scripts/auto-pilot-run.sh --plan <any-plan> --dry-run
```

What changed vs the current files:
- **SKILL.md** — new **Step 1.5** (resuming a parked gate: `gate-cli check` → on `approve` cross exactly that gate
  `git push … auto/<branch>` + `gh pr create`, then `gate-cli consume`); **Step 5** now writes a `gate-cli request`
  for PR-gates so Discord can approve; the **Hard-never** list now carves out that ONE token-approved push+PR.
- **auto-pilot-run.sh / .ps1** — auto-detect + sync the gates repo (`GATE_REPO_DIR`, default `~/.claude/agent-gates`):
  pull approvals before each batch, push park-requests after. ⚠️ **Removed `Bash(git push:*)` from `--disallowedTools`**
  — the autonomy-gate hook is now the SOLE arbiter of pushes (it allows only a token-approved `auto/*` push, blocks the
  rest, verified 24/24); a blanket CLI push-deny would also block the approved push and break B4b. `merge/docker/ssh/rm`
  stay CLI-denied. The orchestrator pushes the gates repo with your existing local git creds (it's not a Claude session,
  so not hook-gated).

## Step 3 — Provision (you; secrets + repo)

```bash
# 3a. RSA keypair — private stays a secret, public is committed (non-secret).
openssl genpkey -algorithm RSA -pkcs8 -pkeyopt rsa_keygen_bits:2048 -out gate.key
openssl pkey -in gate.key -pubout -out gate.pub
cp gate.pub .claude/keys/gate-approval.pub.pem          # commit this (the agent/hook verify with it)
base64 -w0 gate.key                                      # → paste into the BOT's .env GATE_SIGNING_KEY_B64 (NUC); then shred gate.key

# 3b. Private gates repo + local clone for the orchestrator.
gh repo create thiengthb/nuc-agent-gates --private
#   seed empty requests/ and gates/ dirs (.gitkeep), then:
git clone git@github.com:thiengthb/nuc-agent-gates.git ~/.claude/agent-gates   # = GATE_REPO_DIR default

# 3c. Fine-grained GitHub PAT: repo = nuc-agent-gates ONLY, permission Contents: Read and write → bot .env GATES_GITHUB_TOKEN.
# 3d. Discord channel id for approvals → bot .env GATE_APPROVAL_CHANNEL_ID (or leave blank to reuse OPS_CHANNEL_ID).
```

Bot `.env` (on the NUC, `/opt/apps/nuc-ops-bot/.env`, chmod 600) — set the 4 new vars (`.env.example` documents them):
`GATES_REPO=thiengthb/nuc-agent-gates`, `GATES_GITHUB_TOKEN=…`, `GATE_SIGNING_KEY_B64=…`, `GATE_APPROVAL_CHANNEL_ID=…`.
Then deploy the bot: commit + push `nuc-ops-bot` (main → CI → ghcr → Watchtower). Feature stays **off** until all four are set.

Agent-side env (the machine that runs the worker), defaults shown — only override if you moved things:
`GATE_REPO_DIR=~/.claude/agent-gates` · `GATE_TOKEN_DIR=$GATE_REPO_DIR/gates` · `GATE_PUBKEY_FILE=.claude/keys/gate-approval.pub.pem` · `GATE_STATE_FILE=~/.claude/state/current-gate.json` · `GATE_NONCE_FILE=~/.claude/agent-gate-nonces.json`.

## Step 4 — Live end-to-end (B4a.3 / B4b.3, supervised, from your phone)

1. Run the orchestrator on a low-risk approved plan with a real `auto/*` branch step that ends in "open a PR".
2. Worker parks → pushes `requests/<id>.json` → bot posts **Duyệt/Từ chối** in the ops channel.
3. From your phone: press **Duyệt**. Bot signs + writes `gates/<id>.json`.
4. Next batch: orchestrator pulls → `gate-cli check` = `approve` → worker pushes the branch + opens the PR (hook allows exactly that) → `consume`.
5. Assert: no T4 ever crossed; a `Từ chối` leaves the agent parked; an old token can't cross a new gate.

## Cleanup

After Step 1 installs + tests pass: `rm -rf nuc-platform/plans/b4b-sandbox` (and the throwaway `.cryptolib*` dirs).
