# nuc-set-env — install & first use (sandbox → you install)

A secure one-command way to push env/secrets into a NUC app's `.env` from a local mirror file. Skill + scripts are
**governance-class** → built + tested here, you `cp` them into `.claude/` and commit. **Verified:** merge logic
**16/16** (real code path via `NUC_ENV_FILE` override, no ssh), 3 scripts ASCII-only, `.ps1` parses + the base64
ssh-transport decodes to byte-identical clean **LF** bash on the NUC (`bash -n` OK).

## What it is

| File | Role |
|---|---|
| `scripts/nuc-set-env-remote.sh` | runs ON THE NUC (base64-sent over ssh): idempotent upsert into `/opt/apps/<app>/.env`, atomic, chmod 600, `.env.bak`, force-recreate |
| `scripts/nuc-set-env.ps1` | Windows front-end: reads `~/.nuc-env/<app>.env`, pipes it via ssh STDIN (secret-safe) |
| `scripts/nuc-set-env.sh` | Git Bash / Linux front-end (parity) |
| `skills/nuc-set-env/SKILL.md` | the skill doc + the **agent rule** (never request secrets in chat) |

## Step 1 — install (you cp + commit)

```bash
# from repo root C:\project\miniserver-platform
mkdir -p .claude/skills/nuc-set-env
cp nuc-platform/plans/nuc-set-env-sandbox/scripts/nuc-set-env-remote.sh .claude/scripts/nuc-set-env-remote.sh
cp nuc-platform/plans/nuc-set-env-sandbox/scripts/nuc-set-env.ps1       .claude/scripts/nuc-set-env.ps1
cp nuc-platform/plans/nuc-set-env-sandbox/scripts/nuc-set-env.sh        .claude/scripts/nuc-set-env.sh
cp nuc-platform/plans/nuc-set-env-sandbox/skills/nuc-set-env/SKILL.md   .claude/skills/nuc-set-env/SKILL.md
# re-run the merge test from the installed location to confirm:
cp nuc-platform/plans/nuc-set-env-sandbox/tests/merge.test.sh /tmp/merge.test.sh 2>/dev/null || true
bash nuc-platform/plans/nuc-set-env-sandbox/tests/merge.test.sh   # expect 16 passed, 0 failed
```

Then commit (governance install) and `rm -rf nuc-platform/plans/nuc-set-env-sandbox`.

## Step 2 — first use: finish the nuc-ops-bot deploy (B4)

```bash
mkdir -p ~/.nuc-env
notepad ~/.nuc-env/nuc-ops-bot.env
```
Put the four values (the ones you generated in provisioning 3a/3c/3d) — one per line, no spaces around `=`:
```dotenv
GATES_REPO=thiengthb/nuc-agent-gates
GATES_GITHUB_TOKEN=github_pat_...
GATE_SIGNING_KEY_B64=<base64 of gate.key from 3a>
GATE_APPROVAL_CHANNEL_ID=<channel id from 3d>
```
Then:
```powershell
.claude/scripts/nuc-set-env.ps1 nuc-ops-bot
```
It merges those into `/opt/apps/nuc-ops-bot/.env` and force-recreates the bot. Confirm the feature is ON:
```bash
ssh thien25@thienminiserver "docker logs nuc-ops-bot --tail 30 2>&1 | grep -i gate"
#   expect: gate-approval ON: repo=thiengthb/nuc-agent-gates channel=... poll=25s ttl=900s
```

> Note: this only sets the runtime env. The bot **code** (`gate_approval.py`, commit `65f4bae`) still needs `git push`
> in the `nuc-ops-bot` repo so CI builds an image that contains it — do that first (or alongside), else the recreated
> container runs the old image and the feature stays off regardless of env.

## Security recap

Values go: your keyboard → `~/.nuc-env/<app>.env` (local, uncommitted, treat like the NUC `.env`) → ssh **STDIN** →
NUC `.env`. Never on a command line, never in the chat. The mirror file doubles as your local backup of that app's env.
